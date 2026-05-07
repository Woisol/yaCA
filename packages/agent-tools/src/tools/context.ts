import type { ToolDefinition } from '@yaca/types';

export type ToolFactoryContext = {
  cwd: string;
  hint(toolName?: string): string;
};

export type ToolFactory = (context: ToolFactoryContext) => ToolDefinition[];
