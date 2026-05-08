import type { ChatMessage as StoredChatMessage } from '@yaca/types';
import type { ChatMessage } from './message-utils.js';
import { formatStoredMessageContent, chatMessagesToStored } from './message-utils.js';
import { appendAssistantEvent, appendChatLine } from './chat-operations.js';
import { applyToolResult } from './chat-operations.js';
import { parseStoredAgentEvent } from './agent-events.js';

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

export function appendStoredToolMessage(lines: ChatMessage[], content: StoredChatMessage['content']): ChatMessage[] {
  const text = formatStoredMessageContent(content);
  const event = parseStoredAgentEvent(text);
  if (!event) {
    return [...lines, { kind: 'tool' as const, text }];
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
  return [...lines, { kind: 'error' as const, text: event.message }];
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

export function applyRewindInput(currentInput: string, rewindInput: string): string {
  return currentInput.length === 0 ? rewindInput : currentInput;
}
