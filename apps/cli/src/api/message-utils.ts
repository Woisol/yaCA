import type { ChatMessage as StoredChatMessage, MessagePart } from '@yaca/types';

export function formatStoredMessageContent(content: StoredChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(formatMessagePart).join('');
  return JSON.stringify(content);
}

export function formatMessagePart(part: MessagePart): string {
  if (part.type === 'text') return part.text;
  return '[image]';
}

export function chatMessagesToStored(messages: ChatMessage[]): StoredChatMessage[] {
  return messages.flatMap((message): StoredChatMessage[] => {
    if (message.kind === 'user') {
      return [{ role: 'user', content: message.text ?? '' }];
    }
    if (message.kind === 'assistant') {
      return [{ role: 'assistant', content: message.text ?? '' }];
    }
    if (message.kind === 'tool' && message.callId && message.toolName) {
      const call = { call_id: message.callId, name: message.toolName, args: message.args ?? {} };
      const stored: StoredChatMessage[] = [{ role: 'tool', content: { type: 'tool_call', call } }];
      if (message.result !== undefined) {
        stored.push({
          role: 'tool',
          content: {
            type: 'tool_result',
            call,
            result: { ok: message.status !== 'error', content: message.result }
          }
        });
      }
      return stored;
    }
    if (message.kind === 'error') {
      return [{ role: 'tool', content: { type: 'error', message: message.text ?? '' } }];
    }
    return [];
  });
}

export type ChatMessage = {
  kind: 'user' | 'assistant' | 'tool' | 'status' | 'error';
  text?: string;
  callId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  status?: 'running' | 'success' | 'error';
  result?: string;
  expanded?: boolean;
};
