import type { ChatMessage, ModelClient, ModelRequestOptions } from '@yaca/types';

type ChatCompletionMessageParam = {
  role: ChatMessage['role'];
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

type ChatCompletionChunk = {
  choices?: Array<{ delta?: { content?: string | null } }>;
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

  async *streamComplete(messages: ChatMessage[], options: ModelRequestOptions = {}): AsyncIterable<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify({
        model: this.model,
        messages: toOpenAIMessages(messages),
        stream: true
      }),
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
        if (chunk?.choices?.[0]?.delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    }

    const finalChunk = parseChunk(buffer);
    if (finalChunk && finalChunk !== '[DONE]' && finalChunk.choices?.[0]?.delta?.content) {
      yield finalChunk.choices[0].delta.content;
    }
  }

  private async postJson<T>(body: { model: string; messages: ChatCompletionMessageParam[]; stream: false }, options: ModelRequestOptions): Promise<T> {
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

function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    role: message.role === 'tool' ? 'user' : message.role,
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  }));
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
