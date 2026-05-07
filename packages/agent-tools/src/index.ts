import path from 'node:path';
import type { ToolDefinition, ToolResult } from '@yaca/types';
import { createDefaultTools } from './tools/index.js';

export type ToolApprovalRequest = {
  name: string;
  args: Record<string, unknown>;
};

export type ToolApprovalMode = 'silent' | 'confirm';

export type ToolRegistryOptions = {
  approvalMode?: ToolApprovalMode;
  confirm?: (request: ToolApprovalRequest) => boolean | Promise<boolean>;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly approvalMode: ToolApprovalMode;
  private readonly confirm: (request: ToolApprovalRequest) => boolean | Promise<boolean>;

  constructor(options: ToolRegistryOptions = {}) {
    this.approvalMode = options.approvalMode ?? 'silent';
    this.confirm = options.confirm ?? (() => true);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, content: `Unknown tool: ${name}` };
    }
    try {
      const approved = await this.approve({ name, args });
      if (!approved) {
        return { ok: false, content: `Tool call denied: ${name}` };
      }
      return await tool.execute(args);
    } catch (error) {
      return { ok: false, content: error instanceof Error ? error.message : String(error) };
    }
  }

  hint(toolName?: string): string {
    const selected = toolName ? [...this.tools.values()].filter((tool) => tool.name === toolName) : [...this.tools.values()];
    return selected
      .map((tool) => `${tool.name}: ${tool.description}\nparameters: ${JSON.stringify(tool.parameters)}`)
      .join('\n\n');
  }

  private approve(request: ToolApprovalRequest): boolean | Promise<boolean> {
    if (this.approvalMode === 'silent') {
      return true;
    }
    return this.confirm(request);
  }
}

export function createDefaultToolRegistry(cwd: string, options: ToolRegistryOptions = {}): ToolRegistry {
  const root = path.resolve(cwd);
  const registry = new ToolRegistry(options);

  registry.registerMany(createDefaultTools({
    cwd: root,
    hint: (toolName) => registry.hint(toolName)
  }));

  return registry;
}

export { createDefaultTools, filesystemTools, metaTools, systemTools, toolCategories } from './tools/index.js';
export type { ToolFactory, ToolFactoryContext } from './tools/index.js';
