import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppendMessage, ExternalStoreAdapter, ThreadMessage } from '@assistant-ui/react';
import type { ChatMessage, SessionMeta, ToolCall, YacaConfig, RuntimeInfo, ToolDefinitionView, ServerWsMessage } from '../api/types.js';
import { rest } from '../api/rest-client.js';
import { createWsClient, type WsClient } from '../api/ws-client.js';
import { appendMessageText, toThreadMessages } from '../lib/assistant.js';

export type PendingToolConfirm = {
  id: string;
  callId: string;
  call: ToolCall;
  kind: 'tool' | 'command';
};

export function useYacaWeb() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<YacaConfig | undefined>();
  const [runtime, setRuntime] = useState<RuntimeInfo | undefined>();
  const [tools, setTools] = useState<ToolDefinitionView[]>([]);
  const [allowTools, setAllowTools] = useState<string[]>([]);
  const [allowCommands, setAllowCommands] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pendingToolConfirm, setPendingToolConfirm] = useState<PendingToolConfirm | null>(null);
  const wsRef = useRef<WsClient | null>(null);

  const loadInitial = useCallback(async () => {
    const [sessionResponse, configResponse, toolsResponse] = await Promise.all([
      rest.listSessions(),
      rest.getConfig(),
      rest.listTools()
    ]);
    setSessions(sessionResponse.sessions);
    setConfig(configResponse.config);
    setRuntime(configResponse.runtime);
    setTools(toolsResponse.tools);
    setAllowTools(toolsResponse.allowTools);
    setAllowCommands(toolsResponse.allowCommands);
    const first = sessionResponse.sessions[0];
    if (first) {
      setSessionId(first.id);
      setMessages((await rest.getMessages(first.id)).messages);
    }
  }, []);

  useEffect(() => {
    void loadInitial().catch((cause: unknown) => setError(formatError(cause)));
  }, [loadInitial]);

  useEffect(() => {
    const client = createWsClient({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onError: () => setConnected(false),
      onMessage: handleWsMessage
    });
    wsRef.current = client;
    return () => {
      client.close();
      wsRef.current = null;
    };
  }, []);

  const threadMessages = useMemo(() => toThreadMessages(messages), [messages]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    let nextSessionId = sessionId;
    if (!nextSessionId) {
      const created = await rest.createSession({ name: trimmed.slice(0, 80) });
      nextSessionId = created.session.id;
      setSessionId(nextSessionId);
      setSessions((current) => [created.session, ...current]);
    }
    setBusy(true);
    setMessages((current) => [...current, { kind: 'user', text: trimmed }]);
    wsRef.current?.send({ type: 'chat.send', id: crypto.randomUUID(), sessionId: nextSessionId, text: trimmed });
  }, [sessionId]);

  const assistantStore = useMemo<ExternalStoreAdapter<ThreadMessage>>(() => ({
    messages: threadMessages,
    isRunning: busy,
    onNew: async (message: AppendMessage) => {
      await sendText(appendMessageText(message));
    },
    onCancel: async () => {
      wsRef.current?.send({ type: 'chat.abort', id: crypto.randomUUID(), sessionId });
      setBusy(false);
    }
  }), [busy, sendText, sessionId, threadMessages]);

  const createSession = useCallback(async () => {
    const created = await rest.createSession({ name: 'New session' });
    setSessions((current) => [created.session, ...current]);
    setSessionId(created.session.id);
    setMessages([]);
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setSessionId(id);
    setMessages((await rest.getMessages(id)).messages);
    wsRef.current?.send({ type: 'session.resume', id: crypto.randomUUID(), sessionId: id });
  }, []);

  const updateTrustMode = useCallback(async (trustMode: boolean) => {
    const response = await rest.updateConfig({ trustMode });
    setConfig(response.config);
    setRuntime(response.runtime);
  }, []);

  const updateAllow = useCallback(async (nextTools: string[], nextCommands: string[]) => {
    const response = await rest.updateAllow({ allowTools: nextTools, allowCommands: nextCommands });
    setAllowTools(response.allowTools);
    setAllowCommands(response.allowCommands);
  }, []);

  const resolveToolConfirm = useCallback((approved: boolean) => {
    const pending = pendingToolConfirm;
    if (!pending) return;
    wsRef.current?.send({ type: 'tool.confirm', id: pending.id, callId: pending.callId, approved });
    setPendingToolConfirm(null);
  }, [pendingToolConfirm]);

  function handleWsMessage(message: ServerWsMessage): void {
    if (message.type === 'chat.messages') {
      setMessages(message.messages);
      if (message.sessionId) setSessionId(message.sessionId);
      return;
    }
    if (message.type === 'chat.line') {
      setMessages((current) => [...current, { kind: message.kind, text: message.text }]);
      return;
    }
    if (message.type === 'tool.confirm_request') {
      setPendingToolConfirm({ id: message.id, callId: message.callId, call: message.call, kind: message.kind });
      return;
    }
    if (message.type === 'session.list') {
      setSessions(message.sessions);
      return;
    }
    if (message.type === 'config') {
      setConfig(message.config);
      setRuntime(message.runtime);
      setAllowTools(message.config.tool_call.allow.tools);
      setAllowCommands(message.config.tool_call.allow.commands);
      return;
    }
    if (message.type === 'error') {
      setError(message.error.message);
      setBusy(false);
      return;
    }
    if (message.type === 'agent.event' && message.event.type !== 'assistant_delta') {
      return;
    }
  }

  useEffect(() => {
    const last = messages.at(-1);
    if (last?.kind === 'assistant' || last?.kind === 'tool' && last.status !== 'running' || last?.kind === 'error') {
      setBusy(false);
    }
  }, [messages]);

  return {
    assistantStore,
    sessions,
    sessionId,
    messages,
    config,
    runtime,
    tools,
    allowTools,
    allowCommands,
    connected,
    busy,
    error,
    pendingToolConfirm,
    createSession,
    selectSession,
    sendText,
    updateTrustMode,
    updateAllow,
    resolveToolConfirm
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
