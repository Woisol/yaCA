import path from 'node:path';
import type { ChatMessage as StoredChatMessage, MessagePart } from '@yaca/types';
import { pathPrefferentiallyRelative } from '@yaca/utils/path.js';

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
  return storedChatMessageToSxmlModelMessage(m);
}

// TODO 知错了……这个函数应该放到 agent-loop 中……
export function storedChatMessagesToModelMessages(messages: StoredChatMessage[], toolCallCompatible = false): StoredChatMessage[] {
  return toolCallCompatible
    ? messages.map(storedChatMessageToSxmlModelMessage)
    : storedChatMessagesToOpenAIModelMessages(messages);
}

function storedChatMessagesToOpenAIModelMessages(messages: StoredChatMessage[]): StoredChatMessage[] {
  const converted: StoredChatMessage[] = [];
  for (const message of messages) {
    const event = message.role === 'tool' ? parseToolEventContent(message.content) : undefined;
    if (event?.type === 'tool_call') {
      converted.push({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: event.call.call_id ?? '',
          type: 'function',
          function: {
            name: event.call.name,
            arguments: JSON.stringify(event.call.args)
          }
        }]
      });
      continue;
    }
    if (event?.type === 'tool_result') {
      converted.push({
        role: 'tool',
        tool_call_id: event.call_id,
        content: event.result.content
      });
      continue;
    }
    converted.push(storedChatMessageToSxmlModelMessage(message));
  }
  return converted;
}

function storedChatMessageToSxmlModelMessage(m: StoredChatMessage): StoredChatMessage {
  if (m.role === 'tool') {
    // try to normalize known tool event shapes
    const value = parseToolEventContent(m.content);
    if (value?.type === 'tool_call') {
      return { role: 'tool', content: `<tool_call name="${value.call.name}">${value.call.args.content ?? JSON.stringify(value.call.args)}` };//value._rawResponse ||
    }
    if (value?.type === 'tool_result') {
      // const ok = value.result?.ok;
      const content = value.result?.content;
      return { role: 'user', content };
    }
    if (value?.type === 'error') {
      return { role: 'tool', content: String(value.message) };
    }
    return { role: 'tool', content: typeof m.content === 'string' ? m.content : formatStoredMessageContent(m.content) };
  }
  return { role: m.role, content: typeof m.content === 'string' ? m.content : formatStoredMessageContent(m.content) };
}

function parseToolEventContent(content: StoredChatMessage['content']): Extract<StoredChatMessage['content'], { type: string }> | undefined {
  try {
    const value: StoredChatMessage['content'] = typeof content === 'string' ? JSON.parse(content) : content;
    if (value && typeof value === 'object' && !Array.isArray(value) && 'type' in value) {
      return value as Extract<StoredChatMessage['content'], { type: string }>;
    }
  } catch {
    // fallthrough to undefined
  }
  return undefined;
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
      const stored: StoredChatMessage[] = [{ role: 'tool', content: { type: 'tool_call', call, _rawResponse: `<tool_call name="${call.name}">${JSON.stringify(call.args)}</tool_call>` } }];
      if (message.result !== undefined) {
        stored.push({
          role: 'tool',
          content: {
            type: 'tool_result',
            call_id: message.callId,
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

export function reduceMessageFile(rawMessage: string): string {
  const filePattern = /\n\n\[File: (.+?)\]\n[\s\S]*?\[End of File\]\n\n/g;
  return rawMessage.replace(filePattern, (_match, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath);
    return `[File:${chosen}]`;
  });
}

export function reduceMessageFileToPathMention(rawMessage: string): string {
  const withoutFileContent = rawMessage.replace(/\n\n\[File: (.+?)\]\n[\s\S]*?\[End of File\]\n\n/g, (_match, filePath: string) => {
    const fp = filePath.trim();
    const chosen = pathPrefferentiallyRelative(fp);
    return `@${formatPathMention(chosen)}`;
  });
  return withoutFileContent.replace(/\n\n\[File:([^\]]+)\]\n\n/g, (_match, filePath: string) => {
    const fp = filePath.trim();
    const chosen = pathPrefferentiallyRelative(fp);
    return `@${formatPathMention(chosen)}`;
  });
}

// 即有空格就加引号并转义
function formatPathMention(filePath: string): string {
  return /\s/.test(filePath) ? `"${filePath.replaceAll('"', '\\"')}"` : filePath;
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
  rawResponse?: string;
};
