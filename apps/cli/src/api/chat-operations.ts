import type { AssistantEvent, AssistantEventPatch, AgentEvent } from '@yaca/types';
import type { ChatMessage } from './message-utils.js';

export function appendChatLine(current: ChatMessage[], kind: ChatMessage['kind'], text: string): ChatMessage[] {
  return [...current, { kind, text }];
}

export function appendAssistantEvent(current: ChatMessage[], event: AssistantEvent): ChatMessage[] {
  if (event.type === 'text' || event.type === 'think') {
    return appendAssistantDelta(current, event.content);
  }
  if (event.type === 'tool_call') {
    return [...current, {
      kind: 'tool' as const,
      callId: event.call_id ?? '',
      toolName: event.toolName,
      args: event.args,
      status: 'running' as const,
      expanded: false
    }];
  }
  if (event.type === 'parse_error') {
    return appendChatLine(current, 'error', event.message);
  }
  return current;
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

export function applyToolResult(current: ChatMessage[], event: Extract<AgentEvent, { type: 'tool_result' }>, expanded: boolean): ChatMessage[] {
  return current.map((message) => {
    if (message.kind !== 'tool' || message.callId !== event.call.call_id) {
      return message;
    }
    return {
      ...message,
      status: event.result.ok ? 'success' : 'error' as const,
      result: event.result.content,
      expanded
    };
  });
}

export function setToolOutputExpanded(current: ChatMessage[], expanded: boolean): ChatMessage[] {
  return current.map((message) => message.kind === 'tool' ? { ...message, expanded } : message);
}

function replaceLastAssistantEvent(current: ChatMessage[], event: AssistantEvent): ChatMessage[] {
  if (event.type === 'text' || event.type === 'think') {
    return replaceAssistantText(current, event.content);
  }
  return [...current.slice(0, -1), ...appendAssistantEvent([], event)];
}
