import { parseStoredAgentEvent } from '@yaca/agent-core';
import type { ChatMessage as StoredChatMessage } from '@yaca/types';
import { appendAssistantEvent, applyToolResult } from '../chat/messages.js';
import type { ChatMessage } from '../chat/types.js';
import { chatMessagesToStored, formatStoredMessageContent, reduceMessageFileToPathMention } from '../format/message-format.js';

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
  const event = parseStoredAgentEvent(content);
  if (!event) {
    return [...lines, { kind: 'tool' as const, text: formatStoredMessageContent(content) }];
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
    const next = applyToolResult(lines, { ...event, rawResponse: '' }, false);
    if (next !== lines && next.some((message, index) => message !== lines[index])) {
      return next;
    }
    return [...lines, {
      kind: 'tool' as const,
      callId: event.call_id ?? '',
      toolName: 'tool_result',
      status: event.result.ok ? 'success' : 'error' as const,
      result: event.result.content,
      expanded: true,
      orphan: true
    }];
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
    input: reduceMessageFileToPathMention(selected.text ?? ''),
    storedMessages: chatMessagesToStored(messages)
  };
}
