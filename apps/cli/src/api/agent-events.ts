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

export function appendAgentEvent(event: AgentEvent, appendLine: (kind: string, text: string) => void): void {
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
    appendLine('tool', `${event.result.ok ? 'ok' : 'error'} ${event.call_id ?? ''}: ${event.result.content}`);
  } else {
    appendLine('error', event.message);
  }
}

export function parseStoredAgentEvent(content: ChatMessage['content']): Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }> | undefined {
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

function isStoredAgentEvent(value: unknown): value is Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }>>;
  return event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'error';
}
