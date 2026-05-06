import type { ChatMessage, ModelClient } from '@yaca/types';

export type OpenAICompatibleOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export class OpenAICompatibleClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.model = options.model;
    this.apiKey = options.apiKey;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({ model: this.model, messages, stream: false })
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export class EchoModelClient implements ModelClient {
  async complete(messages: ChatMessage[]): Promise<string> {
    const last = [...messages].reverse().find((message) => message.role === 'user');
    const content = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '');
    return `Echo: ${content}`;
  }
}

export function createModelClient(options: { baseUrl?: string; model?: string; apiKey?: string }): ModelClient {
  if (!options.baseUrl) {
    return new EchoModelClient();
  }

  return new OpenAICompatibleClient({
    baseUrl: options.baseUrl,
    model: options.model ?? 'qwen2.5-vl-7b',
    apiKey: options.apiKey
  });
}
