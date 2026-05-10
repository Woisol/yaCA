import type { ChatMessage, ChatToolCall, MessagePart, ModelClient, ModelRequestOptions, ModelToolResponse, ModelToolStreamEvent, ToolDefinition } from '@yaca/types';

export type ChatCompletionMessageParam = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessagePart[] | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAIToolCall[] } }>;
};

type ChatCompletionChunk = {
  choices?: Array<{ delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null; tool_calls?: OpenAIStreamingToolCall[] } }>;
};

type OpenAIToolCall = {
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
};

type OpenAIStreamingToolCall = OpenAIToolCall & {
  index?: number;
};

type OpenAIToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: 'string'; description: string }>;
      required: string[];
    };
  };
};

export type OpenAICompatibleOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export class OpenAICompatibleClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.model = options.model;
    this.headers = OpenAICompatibleClient.createRequestHeaders(options);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static createRequestHeaders(options: { apiKey?: string }): Record<string, string> {
    return options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {};
  }

  static createSdkClient(options: { baseUrl: string; apiKey?: string }): { headers: Record<string, string | null> } {
    return { headers: options.apiKey ? {} : { Authorization: null } };
  }

  async complete(messages: ChatMessage[], options: ModelRequestOptions = {}): Promise<string> {
    const completion = await this.postJson<ChatCompletionResponse>({ model: this.model, messages: toOpenAIMessages(messages), stream: false }, options);
    return completion.choices?.[0]?.message?.content ?? '';
  }

  async completeWithTools(messages: ChatMessage[], tools: ToolDefinition[], options: ModelRequestOptions = {}): Promise<ModelToolResponse> {
    const completion = await this.postJson<ChatCompletionResponse>({
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: false,
      tools: tools.map(toOpenAIToolDefinition)
    }, options);
    const message = completion.choices?.[0]?.message;
    return {
      content: message?.content ?? '',
      toolCalls: (message?.tool_calls ?? []).flatMap(parseOpenAIToolCall)
    };
  }

  async *streamWithTools(messages: ChatMessage[], tools: ToolDefinition[], options: ModelRequestOptions = {}): AsyncGenerator<ModelToolStreamEvent, ModelToolResponse> {
    const chunks = this.streamChatCompletion({
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: true,
      tools: tools.map(toOpenAIToolDefinition)
    }, options);
    const contentParts: string[] = [];
    const toolCallParts = new Map<number, OpenAIToolCall>();

    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        contentParts.push(delta.content);
        yield { type: 'content_delta', text: delta.content };
      }
      const thinking = delta.reasoning_content ?? delta.reasoning;
      if (thinking) {
        yield { type: 'think_delta', text: thinking };
      }
      for (const toolCall of delta.tool_calls ?? []) {
        mergeStreamingToolCall(toolCallParts, toolCall);
      }
    }

    return {
      content: contentParts.join(''),
      toolCalls: [...toolCallParts.values()].flatMap(parseOpenAIToolCall)
    };
  }

  async *streamComplete(messages: ChatMessage[], options: ModelRequestOptions = {}): AsyncIterable<string> {
    const chunks = this.streamChatCompletion({
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: true
    }, options);
    for await (const chunk of chunks) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }

  private async *streamChatCompletion(body: { model: string; messages: ChatCompletionMessageParam[]; stream: true; tools?: OpenAIToolDefinition[] }, options: ModelRequestOptions): AsyncIterable<ChatCompletionChunk> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`Model request failed with status ${response.status}`);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const chunk = parseChunk(line);
        if (chunk === '[DONE]') {
          return;
        }
        if (chunk) {
          yield chunk;
        }
      }
    }

    const finalChunk = parseChunk(buffer);
    if (finalChunk && finalChunk !== '[DONE]') {
      yield finalChunk;
    }
  }

  private async postJson<T>(body: { model: string; messages: ChatCompletionMessageParam[]; stream: false; tools?: OpenAIToolDefinition[] }, options: ModelRequestOptions): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`Model request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

export class FailureModelClient implements ModelClient {
  async complete(): Promise<string> {
    return 'Request Error: Base URL not configured.';
  }
}

export function createModelClient(options: { baseUrl?: string; model?: string; apiKey?: string }): ModelClient {
  if (!options.baseUrl) {
    return new FailureModelClient();
  }

  return new OpenAICompatibleClient({
    baseUrl: options.baseUrl,
    model: options.model ?? 'qwen2.5-vl-7b',
    apiKey: options.apiKey
  });
}

export function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: formatMessageContent(message.content),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {})
      };
    }
    return {
      role: message.role,
      content: formatMessageContent(message.content),
      ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
    };
  });
}

function formatMessageContent(content: ChatMessage['content']): string | MessagePart[] | null {
  if (content === null) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(toOpenAIMessagePart);
  return JSON.stringify(content);
}

function toOpenAIMessagePart(part: MessagePart): MessagePart {
  if (part.type === 'image_url') {
    return { type: 'image_url', image_url: part.image_url };
  }
  return part;
}

function toOpenAIToolDefinition(tool: ToolDefinition): OpenAIToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(Object.entries(tool.parameters).map(([name, description]) => [name, { type: 'string' as const, description }])),
        required: []
      }
    }
  };
}

function parseOpenAIToolCall(toolCall: OpenAIToolCall): ModelToolResponse['toolCalls'] {
  const name = toolCall.function?.name;
  if (!name) return [];
  return [{
    call_id: toolCall.id,
    name,
    args: parseToolArguments(toolCall.function?.arguments ?? '{}'),
    rawResponse: toolCall.id ?? JSON.stringify(toolCall)
  }];
}

function mergeStreamingToolCall(toolCalls: Map<number, OpenAIToolCall>, delta: OpenAIStreamingToolCall): void {
  const index = delta.index ?? toolCalls.size;
  const current = toolCalls.get(index) ?? {};
  toolCalls.set(index, {
    id: delta.id ?? current.id,
    type: delta.type ?? current.type,
    function: {
      name: delta.function?.name ?? current.function?.name,
      arguments: `${current.function?.arguments ?? ''}${delta.function?.arguments ?? ''}`
    }
  });
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseChunk(line: string): ChatCompletionChunk | '[DONE]' | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  const payload = trimmed.startsWith('data:') ? trimmed.slice('data:'.length).trim() : trimmed;
  if (!payload) return undefined;
  if (payload === '[DONE]') return '[DONE]';
  try {
    return JSON.parse(payload) as ChatCompletionChunk;
  } catch {
    return undefined;
  }
}


export function buildSystemPrompt(toolHint: string): string {
  return [
    'You are yaCA, a local coding agent running in a terminal.',
    'Markdown render is not supported, so use plain text to respond unless requested.',
    'When you need a tool, emit exactly: <tool_call name="tool_name">{"arg":"value"}</tool_call>. You can **only** call these XML labeled tools that are listed below during the following conversation.',
    'Available tools:',
    toolHint
  ].join('\n\n');
}

export function buildOpenAIToolSystemPrompt(): string {
  return [
    'You are yaCA, a local coding agent running in a terminal.',
    'Markdown render is not supported, so use plain text to respond unless requested.'
  ].join('\n\n');
}
