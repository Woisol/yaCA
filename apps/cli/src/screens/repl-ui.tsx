import React, { useMemo, useState } from 'react';
import { Box, render, Text, useApp } from 'ink';
import { applySxmlPatch, collectAssistantText, handleBuiltinCommand, parseUserInput, type AgentLoop, type CliState, type SessionStore, type YacaSxmlEvent } from '@yaca/agent-core';
import { AgentEvent, type AssistantEvent, type AssistantEventPatch, type ChatMessage as StoredChatMessage, type MessagePart } from '@yaca/types';
import { useKeyboardShortcuts } from '../input/registry.js';
import { createReplShortcuts, type ReplShortcutContext } from '../input/shortcuts/index.js';
import { ChatArea, ChatMessage } from './home/chat/ChatArea.js';
import { Input } from './home/action/Input.js';
import { StatusBar } from './home/action/StatusBar.js';
import { Resume } from './home/action/Resume.js';
import { Rewind } from './home/action/Rewind.js';
import { SessionMeta } from '@yaca/agent-core/storage/session-store.js';

export type ReplRuntime = {
  cwd: string;
  state: CliState;
  store: SessionStore;
  createAgent(): AgentLoop;
};

export function startInkRepl(runtime: ReplRuntime): void {
  render(<YacaRepl runtime={runtime} />);
}

function YacaRepl({ runtime }: { runtime: ReplRuntime }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showToolOutput, setShowToolOutput] = useState(false);
  const [lastCtrlCAt, setLastCtrlCAt] = useState(0);
  const [lastEscapeAt, setLastEscapeAt] = useState(0);
  const [showRewind, setShowRewind] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [resumeSessions, setResumeSessions] = useState<SessionMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { kind: 'status', text: 'YACA CLI ready. Send a message to create a session, or type /resume to browse history.' }
  ]);

  const appendLine = (kind: ChatMessage['kind'], text: string) => {
    setMessages((current) => appendChatLine(current, kind, text));
  };

  const shortcuts = useMemo(() => createReplShortcuts(), []);
  const shortcutContext: ReplShortcutContext = {
    input,
    busy,
    lastCtrlCAt,
    lastEscapeAt,
    now: Date.now,
    setInput,
    setBusy,
    setLastCtrlCAt,
    setLastEscapeAt,
    appendLine,
    toggleToolOutput: () => {
      setShowToolOutput((current) => {
        const next = !current;
        setMessages((messages) => setToolOutputExpanded(messages, next));
        return next;
      });
    },
    openRewind: () => {
      setShowRewind(true);
    },
    openResume: () => {
      void openResume();
    },
    submit: (text) => {
      void submit(text);
    },
    exit
  };
  useKeyboardShortcuts(shortcutContext, shortcuts);

  async function submit(text: string): Promise<void> {
    appendLine('user', text);
    setBusy(true);
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith('/')) {
        if (trimmed === '/rewind') {
          setShowRewind(true);
          return;
        }
        if (trimmed === '/resume') {
          await openResume();
          return;
        }
        const sessionIdBeforeCommand = runtime.state.sessionId;
        const commandResult = await handleBuiltinCommand(text, runtime.state, runtime.store);
        if (commandResult === '/exit') {
          exit();
          return;
        }
        if (commandResult === undefined) {
          const cmd = trimmed.split(/\s+/)[0];
          appendLine('error', `Unknown command: ${cmd}`);
          return;
        }
        if (runtime.state.sessionId && runtime.state.sessionId !== sessionIdBeforeCommand && isSessionSwitchCommand(text)) {
          const history = await runtime.store.readMessages(runtime.state.sessionId);
          setMessages(renderSessionMessages(history));
        }
        appendLine('status', commandResult);
        return;
      }
      await runAgentTurn(text, runtime, appendLine, setMessages, showToolOutput);
    } catch (error) {
      appendLine('error', formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function openResume(): Promise<void> {
    setResumeSessions(await runtime.store.listSessions());
    setShowResume(true);
  }

  async function resumeFromPicker(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const session = await runtime.store.resumeSession(sessionId);
    runtime.state.sessionId = session.id;
    setMessages(renderSessionMessages(await runtime.store.readMessages(session.id)));
    setShowResume(false);
  }

  return (
    <Box flexDirection="column">
      {showRewind ? (
        <Rewind messages={messages} onMessageSelect={(selectedIndex) => {
          void applyRewind(runtime, messages, selectedIndex, setMessages, setInput, setShowRewind);
        }} onQuit={() => {
          setShowRewind(false);
        }} />
      ) : (
        <>
            <ChatArea messages={messages} hasSession={!!runtime.state.sessionId} />
            <Input input={input} />
            <StatusBar busy={busy} model={runtime.state.model} cwd={runtime.cwd} />
        </>
      )}
      {showResume ? (
        <Resume sessions={resumeSessions} onSessionSelect={(sessionId) => {
          void resumeFromPicker(sessionId);
        }} onQuit={() => {
            setShowResume(false);
          }} />
      ) : null}
    </Box>
  );
}

async function runAgentTurn(
  text: string,
  runtime: ReplRuntime,
  appendLine: (kind: ChatMessage['kind'], text: string) => void,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  showToolOutput: boolean
): Promise<void> {
  if (!runtime.state.sessionId) {
    runtime.state.sessionId = (await runtime.store.createSession(text.slice(0, 80))).id;
  }
  const content = await parseUserInput(text, runtime.cwd);
  await runtime.store.appendMessage(runtime.state.sessionId, { role: 'user', content });
  const assistantEvents: YacaSxmlEvent[] = [];
  for await (const event of runtime.createAgent().runStream(await runtime.store.readMessages(runtime.state.sessionId))) {
    if (event.type === 'assistant_delta') {
      continue;
    } else if (event.type === 'assistant_replace') {
      continue;
    } else if (event.type === 'assistant_event') {
      applySxmlPatch(assistantEvents, event.patch);
      setMessages((current) => applyAssistantEventPatch(current, event.patch));
    } else if (event.type === 'tool_call') {
      await appendStoredAgentEvent(runtime, event);
    } else if (event.type === 'tool_result') {
      await appendStoredAgentEvent(runtime, event);
      setMessages((current) => applyToolResult(current, event, showToolOutput));
    } else {
      await appendStoredAgentEvent(runtime, event);
      appendAgentEvent(event, appendLine);
    }
  }
  const assistantText = collectAssistantText(assistantEvents);
  if (assistantText) {
    await runtime.store.appendMessage(runtime.state.sessionId, { role: 'assistant', content: assistantText });
  }
}

async function appendStoredAgentEvent(runtime: ReplRuntime, event: AgentEvent): Promise<void> {
  if (!runtime.state.sessionId) return;
  const message = createStoredAgentEventMessage(event);
  if (!message) return;
  await runtime.store.appendMessage(runtime.state.sessionId, message);
}

async function applyRewind(
  runtime: ReplRuntime,
  messages: ChatMessage[],
  selectedIndex: number,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  setShowRewind: React.Dispatch<React.SetStateAction<boolean>>
): Promise<void> {
  const result = applyRewindSelection(messages, selectedIndex);
  setMessages(result.messages);
  setInput(result.input);
  setShowRewind(false);
  if (runtime.state.sessionId) {
    await runtime.store.replaceMessages(runtime.state.sessionId, result.storedMessages);
  }
}


function appendAgentEvent(event: AgentEvent, appendLine: (kind: ChatMessage['kind'], text: string) => void): void {
  if (event.type === 'assistant_text') {
    appendLine('assistant', event.text);
  } else if (event.type === 'assistant_delta') {
    appendLine('assistant', event.text);
  } else if (event.type === 'assistant_replace') {
    appendLine('assistant', event.text);
  } else if (event.type === 'assistant_event') {
    return;
  } else if (event.type === 'tool_call') {
    appendLine('tool', `tool ${event.call.name} running`);
  } else if (event.type === 'tool_result') {
    appendLine('tool', `${event.result.ok ? 'ok' : 'error'} ${event.call.name}: ${event.result.content}`);
  } else {
    appendLine('error', event.message);
  }
}

export function appendChatLine(current: ChatMessage[], kind: ChatMessage['kind'], text: string): ChatMessage[] {
  // const nextId = current.reduce((max, line) => Math.max(max, line.id), 0) + 1;
  return [...current, {  kind, text }];
}

export function createStoredAgentEventMessage(event: AgentEvent): StoredChatMessage | undefined {
  if (event.type === 'tool_call') {
    return { role: 'tool', content: JSON.stringify({ type: event.type, call: event.call }) };
  }
  if (event.type === 'tool_result') {
    return { role: 'tool', content: JSON.stringify({ type: event.type, call: event.call, result: event.result }) };
  }
  if (event.type === 'error') {
    return { role: 'tool', content: JSON.stringify({ type: event.type, message: event.message }) };
  }
  return undefined;
}

export function applyRewindSelection(current: ChatMessage[], selectedIndex: number): { messages: ChatMessage[]; input: string; storedMessages: StoredChatMessage[] } {
  const selected = current[selectedIndex];
  if (selected?.kind !== 'user') {
    return { messages: current, input: '', storedMessages: chatMessagesToStored(current) };
  }
  const messages = current.slice(0, selectedIndex);
  return {
    messages,
    input: selected.text ?? '',
    storedMessages: chatMessagesToStored(messages)
  };
}

export function applyAssistantEventPatch(current: ChatMessage[], patch: AssistantEventPatch): ChatMessage[] {
  let next = current;
  if (patch.update === null) {
    next = next.slice(0, -1);
  } else if (patch.update !== undefined) {
    next = replaceLastAssistantEvent(next, patch.update);
  }
  for (const event of patch.append) {
    next = appendAssistantEvent(next, event);
  }
  return next;
}

export function appendAssistantEvent(current: ChatMessage[], event: AssistantEvent): ChatMessage[] {
  if (event.type === 'text' || event.type === 'think') {
    return appendAssistantDelta(current, event.content);
  }
  if (event.type === 'tool_call') {
    return [...current, {
      kind: 'tool',
      callId: event.call_id ?? '',
      toolName: event.toolName,
      args: event.args,
      status: 'running',
      expanded: false
    }];
  }
  if (event.type === 'parse_error') {
    return appendChatLine(current, 'error', event.message);
  }
  return current;
}

export function applyToolResult(current: ChatMessage[], event: Extract<AgentEvent, { type: 'tool_result' }>, expanded: boolean): ChatMessage[] {
  return current.map((message) => {
    if (message.kind !== 'tool' || message.callId !== event.call.call_id) {
      return message;
    }
    return {
      ...message,
      status: event.result.ok ? 'success' : 'error',
      result: event.result.content,
      expanded
    };
  });
}

export function setToolOutputExpanded(current: ChatMessage[], expanded: boolean): ChatMessage[] {
  return current.map((message) => message.kind === 'tool' ? { ...message, expanded } : message);
}

export function appendAssistantDelta(current: ChatMessage[], text: string): ChatMessage[] {
  const last = current.at(-1);
  if (last?.kind === 'assistant') {
    return [...current.slice(0, -1), { ...last, text: last.text + text }];
  }
  return appendChatLine(current, 'assistant', text);
}

export function replaceAssistantText(current: ChatMessage[], text: string): ChatMessage[] {
  const last = current.at(-1);
  if (last?.kind === 'assistant') {
    return [...current.slice(0, -1), { ...last, text }];
  }
  return appendChatLine(current, 'assistant', text);
}

export function renderSessionMessages(history: StoredChatMessage[]): ChatMessage[] {
  return history.reduce<ChatMessage[]>((lines, message) => {
    if (message.role === 'tool') {
      return appendStoredToolMessage(lines, message.content);
    }
    return [...lines, {
      kind: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : 'tool',
      text: formatStoredMessageContent(message.content)
    }];
  }, []);
}

function appendStoredToolMessage(lines: ChatMessage[], content: StoredChatMessage['content']): ChatMessage[] {
  const text = formatStoredMessageContent(content);
  const event = parseStoredAgentEvent(text);
  if (!event) {
    return [...lines, { kind: 'tool', text }];
  }
  if (event.type === 'tool_call') {
    return appendAssistantEvent(lines, {
      type: 'tool_call',
      call_id: event.call.call_id,
      toolName: event.call.name,
      args: event.call.args,
      content: JSON.stringify(event.call.args)
    });
  }
  if (event.type === 'tool_result') {
    return applyToolResult(lines, event, false);
  }
  return [...lines, { kind: 'error', text: event.message }];
}

function chatMessagesToStored(messages: ChatMessage[]): StoredChatMessage[] {
  return messages.flatMap((message): StoredChatMessage[] => {
    if (message.kind === 'user') {
      return [{ role: 'user', content: message.text ?? '' }];
    }
    if (message.kind === 'assistant') {
      return [{ role: 'assistant', content: message.text ?? '' }];
    }
    if (message.kind === 'tool' && message.callId && message.toolName) {
      const call = { call_id: message.callId, name: message.toolName, args: message.args ?? {} };
      const stored: StoredChatMessage[] = [{ role: 'tool', content: JSON.stringify({ type: 'tool_call', call }) }];
      if (message.result !== undefined) {
        stored.push({
          role: 'tool',
          content: JSON.stringify({
            type: 'tool_result',
            call,
            result: { ok: message.status !== 'error', content: message.result }
          })
        });
      }
      return stored;
    }
    if (message.kind === 'error') {
      return [{ role: 'tool', content: JSON.stringify({ type: 'error', message: message.text ?? '' }) }];
    }
    return [];
  });
}

function parseStoredAgentEvent(content: string): Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }> | undefined {
  try {
    const value = JSON.parse(content) as unknown;
    if (!value || typeof value !== 'object') return undefined;
    const event = value as Partial<Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }>>;
    return event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'error'
      ? event as Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }>
      : undefined;
  } catch {
    return undefined;
  }
}

function formatStoredMessageContent(content: StoredChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map(formatMessagePart).join('');
}

function formatMessagePart(part: MessagePart): string {
  if (part.type === 'text') return part.text;
  return '[image]';
}

function isSessionSwitchCommand(text: string): boolean {
  const command = text.trim().split(/\s+/)[0];
  return command === '/resume' || command === '/continue';
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function replaceLastAssistantEvent(current: ChatMessage[], event: AssistantEvent): ChatMessage[] {
  if (event.type === 'text' || event.type === 'think') {
    return replaceAssistantText(current, event.content);
  }
  return [...current.slice(0, -1), ...appendAssistantEvent([], event)];
}
