import OpenAI from 'openai';
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ChatMessage, ModelClient } from '@yaca/types';

type OpenAIChatClient = {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: ChatCompletionMessageParam[];
        stream: false;
      }): Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>;
      create(args: {
        model: string;
        messages: ChatCompletionMessageParam[];
        stream: true;
      }): Promise<AsyncIterable<ChatCompletionChunk>>;
    };
  };
};

export type OpenAICompatibleOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  client?: OpenAIChatClient;
};

export class OpenAICompatibleClient implements ModelClient {
  private readonly client: OpenAIChatClient;
  private readonly model: string;

  constructor(options: OpenAICompatibleOptions) {
    this.client = options.client ?? OpenAICompatibleClient.createSdkClient(options);
    this.model = options.model;
  }

  static createSdkClient(options: { baseUrl: string; apiKey?: string }): OpenAIChatClient & { headers: Record<string, string | null> } {
    const headers: Record<string, string | null> = options.apiKey ? {} : { Authorization: null };
    const client = new OpenAI({
      baseURL: options.baseUrl.replace(/\/$/, ''),
      apiKey: options.apiKey ?? 'unused',
      defaultHeaders: headers
    }) as unknown as OpenAIChatClient & { headers: Record<string, string | null> };
    client.headers = headers;
    return client;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: false
    });
    return completion.choices?.[0]?.message?.content ?? '';
  }

  async *streamComplete(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: true
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
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
    role: message.role,
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  })) as ChatCompletionMessageParam[];
}
