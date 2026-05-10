import type { ToolCall } from '@yaca/types';
import type { CliState } from '../preprocess/commands.js';

export type ToolPermissionRequest = {
  kind: 'tool' | 'command';
  name: string;
  args: Record<string, unknown>;
};

export type ToolPermissionPrompt = (request: ToolPermissionRequest) => boolean | Promise<boolean>;

export type ToolPermissionController = {
  refreshConfigIfChanged(): Promise<void>;
  confirm(call: ToolCall): Promise<boolean>;
};

export function createToolPermissionController(
  state: CliState,
  options: { request?: ToolPermissionPrompt } = {}
): ToolPermissionController {
  async function refreshConfigIfChanged(): Promise<void> {
    const changed = await state.configStore.loadIfChanged(state.configMtimeMs ?? 0);
    if (!changed) return;
    state.configMtimeMs = changed.mtimeMs;
    state.config = changed.config;
    state.model = changed.config.model;
    state.baseUrl = changed.config.base_url;
    state.apiKey = process.env.YACA_API_KEY ?? changed.config.api_key;
  }

  async function requestPermission(request: ToolPermissionRequest): Promise<boolean> {
    return options.request?.(request) ?? false;
  }

  async function confirm(call: ToolCall): Promise<boolean> {
    await refreshConfigIfChanged();
    if (state.trustMode) return true;
    if (!state.config.tool_call.allow.tools.includes(call.name)) {
      return requestPermission({ kind: 'tool', name: call.name, args: call.args });
    }
    if (call.name !== 'exec_command') return true;
    const command = typeof call.args.command === 'string' ? call.args.command : '';
    if (isAllowedCommand(command, state.config.tool_call.allow.commands)) return true;
    return requestPermission({ kind: 'command', name: call.name, args: call.args });
  }

  return {
    refreshConfigIfChanged,
    confirm
  };
}

function isAllowedCommand(command: string, allowCommands: string[]): boolean {
  return allowCommands.some((pattern) => {
    if (pattern === '*') return true;
    if (!pattern.endsWith('*')) return pattern === command;
    return command.startsWith(pattern.slice(0, -1));
  });
}
