import { applySxmlPatch, collectAssistantText, createStoredAgentEventMessage, parseUserInput, storedChatMessagesToModelMessages, type AgentLoop, type CliState, type SessionStore, type YacaSxmlEvent } from '@yaca/agent-core';
import type { AgentEvent, ChatMessage as StoredChatMessage } from '@yaca/types';
import { appendAssistantDelta, applyAssistantEventPatch, applyToolCall, applyToolResult } from '../chat/messages.js';
import type { ChatMessage } from '../chat/types.js';
import { appendAgentEvent } from './event-lines.js';

export function isSessionSwitchCommand(text: string): boolean {
  const command = text.trim().split(/\s+/)[0];
  return command === '/resume' || command === '/continue';
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAgentTurn(
  text: string,
  runtime: { cwd: string; state: CliState; store: SessionStore; createAgent(): AgentLoop },
  appendLine: (kind: string, text: string) => void,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  showToolOutput: boolean,
  options: { signal?: AbortSignal; userContent?: StoredChatMessage['content'] } = {}
): Promise<void> {
  if (!runtime.state.sessionId) {
    runtime.state.sessionId = (await runtime.store.createSession(text.slice(0, 80))).id;
  }
  const content = options.userContent ?? await parseUserInput(text, runtime.cwd);
  await runtime.store.appendMessage(runtime.state.sessionId, { role: 'user', content });
  const assistantEvents: YacaSxmlEvent[] = [];
  const assistantTextEvents: string[] = [];
  const storedHistory = await runtime.store.readMessages(runtime.state.sessionId);
  const initialMessages = storedChatMessagesToModelMessages(storedHistory, runtime.state.config?.tool_call.tool_call_compatible ?? false);

  for await (const event of runtime.createAgent().runStream(initialMessages, { signal: options.signal })) {
    if (event.type === 'assistant_delta') {
      assistantTextEvents.push(event.text);
      setMessages((current) => appendAssistantDelta(current, event.text));
    } else if (event.type === 'assistant_replace') {
      continue;
    } else if (event.type === 'assistant_event') {
      applySxmlPatch(assistantEvents, event.patch);
      setMessages((current) => applyAssistantEventPatch(current, event.patch));
    } else if (event.type === 'tool_call') {
      await appendStoredAgentEvent(runtime, event);
      setMessages((current) => applyToolCall(current, event));
    } else if (event.type === 'tool_result') {
      await appendStoredAgentEvent(runtime, event);
      setMessages((current) => applyToolResult(current, event, showToolOutput));
    } else {
      await appendStoredAgentEvent(runtime, event);
      if (event.type === 'assistant_text') {
        assistantTextEvents.push(event.text);
      }
      appendAgentEvent(event, appendLine);
    }
  }
  const assistantText = [collectAssistantText(assistantEvents), ...assistantTextEvents].filter(Boolean).join('');
  if (assistantText) {
    await runtime.store.appendMessage(runtime.state.sessionId, { role: 'assistant', content: assistantText });
  }
}

async function appendStoredAgentEvent(runtime: { state: CliState; store: SessionStore }, event: AgentEvent): Promise<void> {
  if (!runtime.state.sessionId) return;
  const message = createStoredAgentEventMessage(event);
  if (!message) return;
  await runtime.store.appendMessage(runtime.state.sessionId, message);
}
