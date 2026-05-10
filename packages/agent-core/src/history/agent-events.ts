import type { AgentEvent, ChatMessage, ToolEventContent } from '@yaca/types';

export function createStoredAgentEventMessage(event: AgentEvent): { role: 'tool'; content: ToolEventContent } | undefined {
  if (event.type === 'tool_call') {
    return { role: 'tool', content: { type: event.type, call: event.call, _rawResponse: event.rawResponse } };
  }
  if (event.type === 'tool_result') {
    return { role: 'tool', content: { type: event.type, call_id: event.call_id, result: event.result } };
  }
  if (event.type === 'error') {
    return { role: 'tool', content: { type: event.type, message: event.message } };
  }
  return undefined;
}

export function parseStoredAgentEvent(content: ChatMessage['content']): ToolEventContent | undefined {
  if (isStoredAgentEvent(content)) {
    return content;
  }
  if (typeof content !== 'string') {
    return undefined;
  }
  try {
    const value = JSON.parse(content) as unknown;
    return isStoredAgentEvent(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isStoredAgentEvent(value: unknown): value is ToolEventContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<ToolEventContent>;
  return event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'error';
}
