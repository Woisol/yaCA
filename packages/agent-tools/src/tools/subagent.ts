import type { ToolDefinition } from '@yaca/types';
import type { SubAgentKind, ToolFactory } from './context.js';
import { readRequiredString } from '../utils/args.js';

export const subAgentTools: ToolFactory = ({ runSubAgent }) => {
  const createTool = (kind: SubAgentKind, description: string): ToolDefinition => ({
    name: kind,
    description,
    parameters: { prompt: 'task prompt for the sub agent' },
    async execute(args) {
      const prompt = readRequiredString(args.prompt, 'prompt');
      if (!runSubAgent) {
        return { ok: false, content: `SubAgent runner not configured: ${kind}` };
      }
      return runSubAgent({ kind, prompt });
    }
  });

  return [
    createTool('explore', 'Run a read-only sub agent with file read permissions.'),
    createTool('edit', 'Run a sub agent with file read and write permissions.')
  ];
};
