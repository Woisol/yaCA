import type { ToolDefinition } from '@yaca/types';
import type { ToolFactory } from './context.js';
import { readOptionalString } from '../utils/args.js';

export const metaTools: ToolFactory = ({ cwd, hint }) => {
  const tools: ToolDefinition[] = [{
    name: 'get_tool_hint',
    description: 'Get available tool usage hints.',
    parameters: { toolName: 'optional tool name' },
    async execute(args) {
      return { ok: true, content: hint(readOptionalString(args.toolName)) };
    }
  }, {
    name: 'cwd',
    description: 'Get the current working directory used to resolve relative paths.',
    parameters: {},
    async execute() {
      return { ok: true, content: cwd };
    }
  }];
  return tools;
};
