import type { ToolFactory } from './context.js';
import { readOptionalNumber, readRequiredString } from '../utils/args.js';
import { executeCommand } from '../utils/command.js';

export const systemTools: ToolFactory = ({ cwd }) => [
  {
    name: 'exec_command',
    description: 'Execute a command from cwd.',
    parameters: { command: 'command and arguments', timeout: 'timeout in milliseconds', approve: 'must be true to execute' },
    async execute(args) {
      if (args.approve !== true) {
        return { ok: false, content: 'exec_command requires approve: true' };
      }
      return executeCommand(cwd, readRequiredString(args.command, 'command'), readOptionalNumber(args.timeout) ?? 30_000);
    }
  }
];
