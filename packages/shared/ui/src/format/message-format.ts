import type { ChatMessage as StoredChatMessage, MessagePart } from '@yaca/types';
import { pathPrefferentiallyRelative } from '@yaca/utils/path.js';
import type { ChatMessage } from '../chat/types.js';

export function formatStoredMessageContent(content: StoredChatMessage['content']): string {
  if (content === null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(formatMessagePart).join('');
  return JSON.stringify(content);
}

export function formatMessagePart(part: MessagePart): string {
  if (part.type === 'text') return part.text;
  return formatImagePart(part);
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
  const imagePattern = /\n\n\[Image: (.+?)\]\n\[End of Image\]\n\n/g;
  return rawMessage.replace(filePattern, (_match, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath);
    return `[File:${chosen}]`;
  }).replace(imagePattern, (_match, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath);
    return `[Image:${chosen}]`;
  });
}

export function reduceMessageFileToPathMention(rawMessage: string): string {
  const withoutFileContent = rawMessage.replace(/\n\n\[File: (.+?)\]\n[\s\S]*?\[End of File\]\n\n/g, (_match, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath.trim());
    return `@${formatPathMention(chosen)}`;
  }).replace(/\n\n\[Image: (.+?)\]\n\[End of Image\]\n\n/g, (_match, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath.trim());
    return `@${formatPathMention(chosen)}`;
  });
  return withoutFileContent.replace(/\n\n\[(File|Image):([^\]]+)\]\n\n/g, (_match, _kind: string, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath.trim());
    return `@${formatPathMention(chosen)}`;
  }).replace(/\[(File|Image):([^\]]+)\]/g, (_match, _kind: string, filePath: string) => {
    const chosen = pathPrefferentiallyRelative(filePath.trim());
    return `@${formatPathMention(chosen)}`;
  });
}

function formatPathMention(filePath: string): string {
  return /\s/.test(filePath) ? `"${filePath.replaceAll('"', '\\"')}"` : filePath;
}

function formatImagePart(part: Extract<MessagePart, { type: 'image_url' }>): string {
  const imagePath = part.meta?.path;
  if (!imagePath) return '[image]';
  return `[Image:${pathPrefferentiallyRelative(imagePath)}]`;
}
