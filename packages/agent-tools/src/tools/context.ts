import type { ToolDefinition, ToolResult } from '@yaca/types';

export type SubAgentKind = 'explore' | 'edit';

export type SubAgentRequest = {
  kind: SubAgentKind;
  prompt: string;
};

export type SubAgentRunner = (request: SubAgentRequest) => Promise<ToolResult>;

export type ToolFactoryContext = {
  cwd: string;
  hint(toolName?: string): string;
  runSubAgent?: SubAgentRunner;
};

export type ToolFactory = (context: ToolFactoryContext) => ToolDefinition[];
