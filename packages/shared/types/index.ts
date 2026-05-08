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
};

export type MessagePart = TextPart | ImageUrlPart;

export type ChatMessage = {
  role: MessageRole;
  content: string | MessagePart[];
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

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
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
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; call: ToolCall; result: ToolResult }
  | { type: 'error'; message: string };

export type ModelClient = {
  complete(messages: ChatMessage[]): Promise<string>;
  streamComplete?(messages: ChatMessage[]): AsyncIterable<string>;
};
