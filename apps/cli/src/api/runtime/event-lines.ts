import type { AgentEvent } from '@yaca/types';

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
