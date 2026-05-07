import type { ToolDefinition } from '@yaca/types';
import type { ToolFactoryContext } from './context.js';
import { filesystemTools } from './filesystem.js';
import { metaTools } from './meta.js';
import { systemTools } from './system.js';

export { filesystemTools } from './filesystem.js';
export { metaTools } from './meta.js';
export { systemTools } from './system.js';
export type { ToolFactory, ToolFactoryContext } from './context.js';

export const toolCategories = [
  metaTools,
  filesystemTools,
  systemTools
];

export function createDefaultTools(context: ToolFactoryContext): ToolDefinition[] {
  return toolCategories.flatMap((createTools) => createTools(context));
}
