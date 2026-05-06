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

export type AgentEvent =
  | { type: 'assistant_text'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; call: ToolCall; result: ToolResult };

export type ModelClient = {
  complete(messages: ChatMessage[]): Promise<string>;
};
