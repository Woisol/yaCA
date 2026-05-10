export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type TextPart = {
  type: 'text';
  text: string;
};

export type ImageUrlPart = {
  type: 'image_url';
  image_url: {
    url: string;
  };
  meta?: {
    path?: string;
  };
};

export type MessagePart = TextPart | ImageUrlPart;

export type ChatMessage = {
  role: MessageRole;
  content: string | MessagePart[] | ToolEventContent | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
};

export type ToolCall = {
  call_id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolResult = {
  ok: boolean;
  content: string;
};

export type ChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolEventContent =
  | { type: 'tool_call'; call: ToolCall; _rawResponse: string }
  | { type: 'tool_result'; call_id?: string; result: ToolResult }
  | { type: 'error'; message: string };

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
};

export type ModelToolCall = ToolCall & {
  rawResponse: string;
};

export type ModelToolResponse = {
  content: string;
  toolCalls: ModelToolCall[];
};

export type ModelToolStreamEvent = {
  type: 'content_delta';
  text: string;
} | {
  type: 'think_delta';
  text: string;
};

export type AssistantEvent =
  | { type: 'text'; content: string }
  | { type: 'think'; content: string }
  | { type: 'tool_call'; call_id?: string; toolName: string; args: Record<string, unknown>; content: string }
  | { type: 'parse_error'; message: string; content: string };

export type AssistantEventPatch = {
  update?: AssistantEvent | null;
  append: AssistantEvent[];
};

export type AgentEvent =
  | { type: 'assistant_delta'; text: string }
  | { type: 'assistant_replace'; text: string }
  | { type: 'assistant_text'; text: string }
  | { type: 'assistant_event'; patch: AssistantEventPatch }
  | { type: 'tool_call'; call: ToolCall; rawResponse: string }
  | { type: 'tool_result'; call_id?: string; result: ToolResult; rawResponse: string }
  | { type: 'error'; message: string };

export type ModelClient = {
  complete(messages: ChatMessage[], options?: ModelRequestOptions): Promise<string>;
  streamComplete?(messages: ChatMessage[], options?: ModelRequestOptions): AsyncIterable<string>;
  completeWithTools?(messages: ChatMessage[], tools: ToolDefinition[], options?: ModelRequestOptions): Promise<ModelToolResponse>;
  streamWithTools?(messages: ChatMessage[], tools: ToolDefinition[], options?: ModelRequestOptions): AsyncGenerator<ModelToolStreamEvent, ModelToolResponse>;
};

export type ModelRequestOptions = {
  signal?: AbortSignal;
};
