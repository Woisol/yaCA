import type { ToolDefinition } from '@yaca/types';
import type { SubAgentKind, ToolFactoryContext } from './context.js';
import { createDefaultTools } from './index.js';

const readTools = new Set(['read_file', 'list_directory', 'stat_path', 'cwd', 'get_tool_hint']);
const writeTools = new Set(['write_file', 'replace_file', 'move_file', 'remove_file']);

export function createSubAgentToolDefinitions(kind: SubAgentKind, context: ToolFactoryContext): ToolDefinition[] {
  const allowedTools = kind === 'explore'
    ? new Set([...readTools])
    : new Set([...readTools, ...writeTools]);
  return createDefaultTools(context, { includeSubAgentTools: false }).filter((tool) => allowedTools.has(tool.name));
}
