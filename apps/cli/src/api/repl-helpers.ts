import { applySxmlPatch, collectAssistantText, parseUserInput, type AgentLoop, type CliState, type SessionStore, type YacaSxmlEvent } from '@yaca/agent-core';
import type { AgentEvent, ChatMessage as StoredChatMessage } from '@yaca/types';
import type { ChatMessage } from './message-utils.js';
import { applyAssistantEventPatch, applyToolCall, applyToolResult } from './chat-operations.js';
import { createStoredAgentEventMessage, appendAgentEvent } from './agent-events.js';
import { storedChatMessageToModelMessage } from './message-utils.js';

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
  showToolOutput: boolean
): Promise<void> {
  if (!runtime.state.sessionId) {
    runtime.state.sessionId = (await runtime.store.createSession(text.slice(0, 80))).id;
  }
  const content = await parseUserInput(text, runtime.cwd);
  await runtime.store.appendMessage(runtime.state.sessionId, { role: 'user', content });
  const assistantEvents: YacaSxmlEvent[] = [];
  const assistantTextEvents: string[] = [];
  const storedHistory = await runtime.store.readMessages(runtime.state.sessionId);
  const initialMessages = storedHistory.map(storedChatMessageToModelMessage);

  for await (const event of runtime.createAgent().runStream(initialMessages)) {
    if (event.type === 'assistant_delta') {
      continue;
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
