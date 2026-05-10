import type { AppendMessage, ThreadMessage } from '@assistant-ui/react';
import type { ChatMessage } from '@yaca/ui/chat/types.js';

export function toThreadMessages(messages: ChatMessage[]): ThreadMessage[] {
  return messages.map((message, index) => {
    const id = `${index}-${message.kind}-${message.callId ?? ''}`;
    const createdAt = new Date(index);
    if (message.kind === 'user') {
      return {
        id,
        role: 'user',
        createdAt,
        content: [{ type: 'text', text: message.text ?? '' }],
        attachments: [],
        metadata: { custom: { yaca: message } }
      };
    }
    if (message.kind === 'assistant') {
      return createAssistantThreadMessage(id, createdAt, message.text ?? '', message);
    }
    if (message.kind === 'tool') {
      return createAssistantThreadMessage(id, createdAt, formatToolMessage(message), message);
    }
    return createAssistantThreadMessage(id, createdAt, message.text ?? '', message);
  });
}

export function appendMessageText(message: AppendMessage): string {
  return message.content
    .map((part) => part.type === 'text' ? part.text : '')
    .filter(Boolean)
    .join('\n\n');
}

function createAssistantThreadMessage(id: string, createdAt: Date, text: string, source: ChatMessage): ThreadMessage {
  return {
    id,
    role: 'assistant',
    createdAt,
    content: [{ type: 'text', text }],
    status: source.kind === 'tool' && source.status === 'running'
      ? { type: 'running' }
      : source.kind === 'error' || source.status === 'error'
        ? { type: 'incomplete', reason: 'error', error: text }
        : { type: 'complete', reason: 'stop' },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: { yaca: source }
    }
  };
}

function formatToolMessage(message: ChatMessage): string {
  const args = message.args ? JSON.stringify(message.args, null, 2) : '';
  const result = message.result ? `\n\n${message.result}` : '';
  return `${message.toolName ?? 'tool'} ${message.status ?? 'running'}\n${args}${result}`;
}
