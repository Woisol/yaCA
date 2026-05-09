import type { AgentEvent, ToolCall, ToolDefinition, ToolResult } from '@yaca/types';

export type AgentRunOptions = {
  signal?: AbortSignal;
};

export type PendingToolCall = ToolCall & {
  rawResponse: string;
};

export type ToolFailureCall = {
  call: ToolCall;
  result: ToolResult;
  rawResponse: string;
};

export type StreamTurnResult = {
  response: string;
  calls: PendingToolCall[];
  parseFailures: ToolFailureCall[];
  stopped: boolean;
};

export type AssistantTurnContext = {
  createCallId(): string;
  tools: ToolDefinition[];
};

export type AssistantTurnStrategy = (
  messages: import('@yaca/types').ChatMessage[],
  options: AgentRunOptions,
  context: AssistantTurnContext
) => AsyncGenerator<AgentEvent, StreamTurnResult>;

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
