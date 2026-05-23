import type { ToolDefinition } from '@yaca/types';
import type { ToolFactoryContext } from './context.js';
import { filesystemTools } from './filesystem.js';
import { metaTools } from './meta.js';
import { subAgentTools } from './subagent.js';
import { systemTools } from './system.js';

export { filesystemTools } from './filesystem.js';
export { metaTools } from './meta.js';
export { subAgentTools } from './subagent.js';
export { systemTools } from './system.js';
export type { SubAgentKind, SubAgentRequest, SubAgentRunner, ToolFactory, ToolFactoryContext } from './context.js';

export type CreateDefaultToolsOptions = {
  includeSubAgentTools?: boolean;
};

// 所有工具合集
export const toolCategories = [
  metaTools,
  filesystemTools,
  systemTools,
  subAgentTools
];

export function createDefaultTools(context: ToolFactoryContext, options: CreateDefaultToolsOptions = { includeSubAgentTools: true }): ToolDefinition[] {
  const includeSubAgentTools = options.includeSubAgentTools;
  // dTODO 啊？slice？？？维护性不炸掉？
  const categories = includeSubAgentTools ? toolCategories : toolCategories.filter((category) => category !== subAgentTools);
  // 每个工具都需要提供 context 来创建因此是函数……
  return categories.flatMap((createTools) => createTools(context));
}
