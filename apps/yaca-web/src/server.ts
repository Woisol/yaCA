import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  applySxmlPatch,
  collectAssistantText,
  createStoredAgentEventMessage,
  parseUserInput,
  storedChatMessagesToModelMessages,
  type AgentLoop,
  type CliState,
  type SessionStore,
  type ToolPermissionController,
  type YacaSxmlEvent
} from '@yaca/agent-core';
import type { AgentEvent, ToolCall, ToolDefinition } from '@yaca/types';
import { appendAssistantDelta, appendChatLine, applyAssistantEventPatch, applyRewindSelection, applyToolCall, applyToolResult, formatStoredMessageContent, reduceMessageFile, renderSessionMessages, type ChatMessage } from '@yaca/ui';
import type {
  ApiError,
  ClientWsMessage,
  CreateSessionRequest,
  RuntimeInfo,
  ServerWsMessage,
  ToolDefinitionView,
  UpdateAllowToolsRequest,
  UpdateConfigRequest
} from './api/types.js';

type ToolRegistryLike = {
  definitions?(): ToolDefinition[];
};

export type YacaWebRuntime = {
  cwd: string;
  state: CliState;
  store: SessionStore;
  tools?: ToolRegistryLike;
  toolPermissions?: ToolPermissionController;
  createAgent(): AgentLoop;
};

export type StartYacaWebServerOptions = YacaWebRuntime & {
  port: number;
  host?: string;
  serveStatic?: boolean;
};

type PendingToolApproval = {
  call: ToolCall;
  kind: 'tool' | 'command';
  resolve(approved: boolean): void;
};

const clients = new Set<WebSocket>();

export function startYacaWebServer(options: StartYacaWebServerOptions): http.Server {
  const runtime: YacaWebRuntime = options;
  const server = http.createServer((request, response) => {
    void handleHttpRequest(request, response, runtime, options.serveStatic ?? true);
  });
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    if (url.pathname !== '/api/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    let pendingToolApproval: PendingToolApproval | null = null;
    let activeTurnController: AbortController | null = null;

    runtime.state.toolCallConfirm = async ({ kind, name, args }) => new Promise<boolean>((resolve) => {
      const call: ToolCall = { name, args };
      const callId = call.call_id ?? `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingToolApproval = { call: { ...call, call_id: callId }, kind, resolve };
      send(ws, { type: 'tool.confirm_request', id: callId, callId, call: pendingToolApproval.call, kind });
    });

    ws.on('message', (raw) => {
      void handleWsMessage(String(raw), ws, runtime, {
        getPending: () => pendingToolApproval,
        setPending: (value) => { pendingToolApproval = value; },
        getController: () => activeTurnController,
        setController: (value) => { activeTurnController = value; }
      });
    });
    ws.on('close', () => {
      clients.delete(ws);
      activeTurnController?.abort();
      pendingToolApproval?.resolve(false);
    });
  });

  server.listen(options.port, options.host);
  return server;
}

async function handleHttpRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  runtime: YacaWebRuntime,
  serveStatic: boolean
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, { ok: true });
    }
    if (url.pathname.startsWith('/api/')) {
      return await handleApiRequest(request, response, runtime, url);
    }
    if (serveStatic) {
      return await serveAsset(response, url.pathname);
    }
    return notFound(response);
  } catch (error) {
    return json(response, { error: toApiError(error) }, 500);
  }
}

async function handleApiRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  runtime: YacaWebRuntime,
  url: URL
): Promise<void> {
  if (request.method === 'GET' && url.pathname === '/api/sessions') {
    return json(response, { sessions: await runtime.store.listSessions() });
  }
  if (request.method === 'POST' && url.pathname === '/api/sessions') {
    const body = await readJson<CreateSessionRequest>(request);
    const session = await runtime.store.createSession(body.name || 'New session');
    runtime.state.sessionId = session.id;
    broadcast({ type: 'session.list', id: 'sessions', sessions: await runtime.store.listSessions() });
    return json(response, { session }, 201);
  }
  const sessionMatch = /^\/api\/sessions\/([^/]+)(?:\/(messages|rewind))?$/.exec(url.pathname);
  if (sessionMatch) {
    return await handleSessionApi(request, response, runtime, sessionMatch[1] ?? '', sessionMatch[2]);
  }
  if (request.method === 'GET' && url.pathname === '/api/config') {
    await runtime.toolPermissions?.refreshConfigIfChanged();
    return json(response, { config: runtime.state.config, runtime: getRuntimeInfo(runtime) });
  }
  if (request.method === 'PATCH' && url.pathname === '/api/config') {
    const body = await readJson<UpdateConfigRequest>(request);
    await updateRuntimeConfig(runtime, body);
    broadcast({ type: 'config', id: 'config', config: runtime.state.config, runtime: getRuntimeInfo(runtime) });
    return json(response, { config: runtime.state.config, runtime: getRuntimeInfo(runtime) });
  }
  if (request.method === 'GET' && url.pathname === '/api/tools') {
    return json(response, listTools(runtime));
  }
  if (request.method === 'POST' && url.pathname === '/api/tools/allow') {
    const body = await readJson<UpdateAllowToolsRequest>(request);
    await updateRuntimeConfig(runtime, { allowTools: body.allowTools, allowCommands: body.allowCommands });
    broadcast({ type: 'config', id: 'config', config: runtime.state.config, runtime: getRuntimeInfo(runtime) });
    return json(response, listTools(runtime));
  }
  return notFound(response);
}

async function handleSessionApi(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  runtime: YacaWebRuntime,
  sessionId: string,
  action?: string
): Promise<void> {
  if (!action && request.method === 'GET') {
    return json(response, { session: await runtime.store.getSession(sessionId) ?? null });
  }
  if (action === 'messages' && request.method === 'GET') {
    return json(response, { messages: renderSessionMessages(await runtime.store.readMessages(sessionId)) });
  }
  if (action === 'rewind' && request.method === 'POST') {
    const body = await readJson<{ selectedIndex?: number }>(request);
    const messages = renderSessionMessages(await runtime.store.readMessages(sessionId));
    const result = applyRewindSelection(messages, body.selectedIndex ?? -1);
    await runtime.store.replaceMessages(sessionId, result.storedMessages);
    return json(response, { messages: result.messages, input: result.input });
  }
  return notFound(response);
}

async function handleWsMessage(
  raw: string,
  ws: WebSocket,
  runtime: YacaWebRuntime,
  state: {
    getPending(): PendingToolApproval | null;
    setPending(value: PendingToolApproval | null): void;
    getController(): AbortController | null;
    setController(value: AbortController | null): void;
  }
): Promise<void> {
  const message = JSON.parse(raw) as ClientWsMessage;
  if (message.type === 'tool.confirm') {
    const pending = state.getPending();
    if (pending && (pending.call.call_id ?? '') === message.callId) {
      pending.resolve(message.approved);
      state.setPending(null);
    }
    return;
  }
  if (message.type === 'chat.abort') {
    state.getController()?.abort();
    send(ws, { type: 'chat.line', id: message.id, kind: 'status', text: 'Turn aborted.' });
    return;
  }
  if (message.type === 'session.resume') {
    const session = await runtime.store.resumeSession(message.sessionId);
    runtime.state.sessionId = session.id;
    send(ws, { type: 'chat.messages', id: message.id, sessionId: session.id, messages: renderSessionMessages(await runtime.store.readMessages(session.id)) });
    return;
  }
  if (message.type === 'chat.send') {
    const controller = new AbortController();
    state.setController(controller);
    try {
      const result = await runWebAgentTurn(message.text, runtime, {
        sessionId: message.sessionId,
        signal: controller.signal,
        onMessages: (messages, sessionId) => send(ws, { type: 'chat.messages', id: message.id, sessionId, messages }),
        onEvent: (event) => send(ws, { type: 'agent.event', id: message.id, event })
      });
      broadcast({ type: 'session.list', id: 'sessions', sessions: await runtime.store.listSessions() });
      send(ws, { type: 'chat.messages', id: message.id, sessionId: result.sessionId, messages: result.messages });
    } catch (error) {
      send(ws, { type: 'error', id: message.id, error: toApiError(error) });
    } finally {
      if (state.getController() === controller) {
        state.setController(null);
      }
    }
  }
}

async function runWebAgentTurn(
  text: string,
  runtime: YacaWebRuntime,
  options: {
    sessionId?: string;
    signal?: AbortSignal;
    onMessages(messages: ChatMessage[], sessionId: string): void;
    onEvent(event: AgentEvent): void;
  }
): Promise<{ sessionId: string; messages: ChatMessage[] }> {
  await runtime.toolPermissions?.refreshConfigIfChanged();
  if (options.sessionId) {
    runtime.state.sessionId = options.sessionId;
  }
  if (!runtime.state.sessionId) {
    runtime.state.sessionId = (await runtime.store.createSession(text.slice(0, 80))).id;
  }

  const sessionId = runtime.state.sessionId;
  const content = await parseUserInput(text, runtime.cwd);
  await runtime.store.appendMessage(sessionId, { role: 'user', content });

  let messages = appendChatLine(renderSessionMessages(await runtime.store.readMessages(sessionId)).slice(0, -1), 'user', reduceMessageFile(formatStoredMessageContent(content)));
  options.onMessages(messages, sessionId);

  const assistantEvents: YacaSxmlEvent[] = [];
  const assistantTextEvents: string[] = [];
  const storedHistory = await runtime.store.readMessages(sessionId);
  const initialMessages = storedChatMessagesToModelMessages(storedHistory, runtime.state.config.tool_call.tool_call_compatible);

  for await (const event of runtime.createAgent().runStream(initialMessages, { signal: options.signal })) {
    options.onEvent(event);
    if (event.type === 'assistant_delta') {
      assistantTextEvents.push(event.text);
      messages = appendAssistantDelta(messages, event.text);
    } else if (event.type === 'assistant_replace') {
      continue;
    } else if (event.type === 'assistant_event') {
      applySxmlPatch(assistantEvents, event.patch);
      messages = applyAssistantEventPatch(messages, event.patch);
    } else if (event.type === 'tool_call') {
      await appendStoredAgentEvent(runtime, event);
      messages = applyToolCall(messages, event);
    } else if (event.type === 'tool_result') {
      await appendStoredAgentEvent(runtime, event);
      messages = applyToolResult(messages, event, false);
    } else {
      await appendStoredAgentEvent(runtime, event);
      if (event.type === 'assistant_text') {
        assistantTextEvents.push(event.text);
        messages = appendChatLine(messages, 'assistant', event.text);
      } else if (event.type === 'error') {
        messages = appendChatLine(messages, 'error', event.message);
      }
    }
    options.onMessages(messages, sessionId);
  }

  const assistantText = [collectAssistantText(assistantEvents), ...assistantTextEvents].filter(Boolean).join('');
  if (assistantText) {
    await runtime.store.appendMessage(sessionId, { role: 'assistant', content: assistantText });
  }
  return { sessionId, messages };
}

async function appendStoredAgentEvent(runtime: YacaWebRuntime, event: AgentEvent): Promise<void> {
  if (!runtime.state.sessionId) return;
  const message = createStoredAgentEventMessage(event);
  if (!message) return;
  await runtime.store.appendMessage(runtime.state.sessionId, message);
}

async function updateRuntimeConfig(runtime: YacaWebRuntime, update: UpdateConfigRequest): Promise<void> {
  if (update.model !== undefined) {
    runtime.state.model = update.model;
    runtime.state.config.model = update.model;
  }
  if (update.baseUrl !== undefined) {
    runtime.state.baseUrl = update.baseUrl;
    runtime.state.config.base_url = update.baseUrl;
  }
  if (update.trustMode !== undefined) {
    runtime.state.trustMode = update.trustMode;
  }
  if (update.allowTools !== undefined) {
    runtime.state.config.tool_call.allow.tools = update.allowTools;
  }
  if (update.allowCommands !== undefined) {
    runtime.state.config.tool_call.allow.commands = update.allowCommands;
  }
  await runtime.state.configStore.save(runtime.state.config);
  runtime.state.configMtimeMs = await runtime.state.configStore.getMtimeMs();
}

function listTools(runtime: YacaWebRuntime): { tools: ToolDefinitionView[]; allowTools: string[]; allowCommands: string[] } {
  return {
    tools: runtime.tools?.definitions?.().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    })) ?? [],
    allowTools: runtime.state.config.tool_call.allow.tools,
    allowCommands: runtime.state.config.tool_call.allow.commands
  };
}

function getRuntimeInfo(runtime: YacaWebRuntime): RuntimeInfo {
  return {
    model: runtime.state.model,
    baseUrl: runtime.state.baseUrl,
    cwd: runtime.cwd,
    trustMode: runtime.state.trustMode ?? false
  };
}

async function readJson<T>(request: http.IncomingMessage): Promise<T> {
  const raw = await readRequestBody(request);
  return raw ? JSON.parse(raw) as T : {} as T;
}

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function send(ws: WebSocket, message: ServerWsMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: ServerWsMessage): void {
  for (const client of clients) {
    send(client, message);
  }
}

function json(response: http.ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function notFound(response: http.ServerResponse): void {
  json(response, { error: { code: 'NOT_FOUND', message: 'not found' } }, 404);
}

function toApiError(error: unknown): ApiError {
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error)
  };
}

async function serveAsset(response: http.ServerResponse, pathname: string): Promise<void> {
  const packageRoot = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const root = path.join(packageRoot, 'dist');
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const assetPath = path.resolve(root, relative);
  if (!assetPath.startsWith(root)) {
    return notFound(response);
  }
  try {
    const content = await readFile(assetPath);
    response.writeHead(200, { 'content-type': contentType(assetPath) });
    response.end(content);
  } catch {
    const fallback = await readFile(path.join(root, 'index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fallback);
  }
}

function findPackageRoot(startDirectory: string): string {
  let current = path.resolve(startDirectory);
  for (let depth = 0; depth < 8; depth += 1) {
    if (path.basename(current) === 'yaca-web') {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDirectory, '../../..');
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
