import type { ChatMessage } from '@yaca/types';

export function storedChatMessageToModelMessage(message: ChatMessage): ChatMessage {
  return storedChatMessageToSxmlModelMessage(message);
}

export function storedChatMessagesToModelMessages(messages: ChatMessage[], toolCallCompatible = false): ChatMessage[] {
  return toolCallCompatible
    ? messages.map(storedChatMessageToSxmlModelMessage)
    : storedChatMessagesToOpenAIModelMessages(messages);
}

function storedChatMessagesToOpenAIModelMessages(messages: ChatMessage[]): ChatMessage[] {
  const converted: ChatMessage[] = [];
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

function storedChatMessageToSxmlModelMessage(message: ChatMessage): ChatMessage {
  if (message.role === 'tool') {
    const value = parseToolEventContent(message.content);
    if (value?.type === 'tool_call') {
      return { role: 'tool', content: `<tool_call name="${value.call.name}">${value.call.args.content ?? JSON.stringify(value.call.args)}` };
    }
    if (value?.type === 'tool_result') {
      return { role: 'user', content: value.result.content };
    }
    if (value?.type === 'error') {
      return { role: 'tool', content: String(value.message) };
    }
    return { role: 'tool', content: formatStoredMessageContent(message.content) };
  }
  return { role: message.role, content: formatStoredMessageContent(message.content) };
}

function parseToolEventContent(content: ChatMessage['content']): Extract<ChatMessage['content'], { type: string }> | undefined {
  try {
    const value: ChatMessage['content'] = typeof content === 'string' ? JSON.parse(content) : content;
    if (value && typeof value === 'object' && !Array.isArray(value) && 'type' in value) {
      return value as Extract<ChatMessage['content'], { type: string }>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function formatStoredMessageContent(content: ChatMessage['content']): string {
  if (content === null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.type === 'text' ? part.text : '[image]').join('');
  }
  return JSON.stringify(content);
}
