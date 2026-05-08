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

/**
 * Convert a stored chat message into a model-friendly message where
 * tool events are rendered as concise strings suitable for large models.
 */
export function storedChatMessageToModelMessage(m: StoredChatMessage): StoredChatMessage {
  if (m.role === 'tool') {
    // try to normalize known tool event shapes
    try {
      const value: StoredChatMessage['content'] = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
      if (value && typeof value === 'object' && 'type' in value) {
        if (value.type === 'tool_call') {
          return { role: 'tool', content: `<tool_call name="${value.call.name}">${JSON.stringify(value.call.args)}</tool_call>` };
        }
        if (value.type === 'tool_result') {
          // const ok = value.result?.ok;
          const content = value.result?.content;
          return { role: 'user', content };
        }
        if (value.type === 'error') {
          return { role: 'tool', content: String(value.message) };
        }
      }
    } catch {
      // fallthrough to string formatting
    }
    return { role: 'tool', content: typeof m.content === 'string' ? m.content : formatStoredMessageContent(m.content) };
  }
  return { role: m.role, content: typeof m.content === 'string' ? m.content : formatStoredMessageContent(m.content) };
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
