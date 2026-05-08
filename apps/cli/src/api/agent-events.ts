import type { AgentEvent } from '@yaca/types';

export function createStoredAgentEventMessage(event: AgentEvent): { role: 'tool'; content: string } | undefined {
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
    appendLine('tool', `${event.result.ok ? 'ok' : 'error'} ${event.call.name}: ${event.result.content}`);
  } else {
    appendLine('error', event.message);
  }
}

export function parseStoredAgentEvent(content: string): Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }> | undefined {
  try {
    const value = JSON.parse(content) as unknown;
    if (!value || typeof value !== 'object') return undefined;
    const event = value as Partial<Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }>>;
    return event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'error'
      ? (event as Extract<AgentEvent, { type: 'tool_call' | 'tool_result' | 'error' }>)
      : undefined;
  } catch {
    return undefined;
  }
}
