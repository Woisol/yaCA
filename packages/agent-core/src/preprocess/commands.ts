import type { SessionStore } from '../storage/session-store.js';
import type { ConfigStore, YacaConfig } from '../storage/config-store.js';

export type CliState = {
  model: string;
  baseUrl?: string;
  apiKey?: string;
  sessionId?: string;
  configMtimeMs?: number;
  trustMode?: boolean;
  toolCallConfirm?: (request: { kind: 'tool' | 'command'; name: string; args: Record<string, unknown> }) => boolean | Promise<boolean>;
  config: YacaConfig;
  configStore: ConfigStore;
};

export type BuiltinCommand = {
  name: string;
  usage: string;
  description: string;
  handle(args: string, state: CliState, store: SessionStore): Promise<string> | string;
};

export const builtinCommands: BuiltinCommand[] = [
  {
    name: '/help',
    usage: '/help',
    description: 'Show help',
    handle() {
      return ['YACA commands:', ...builtinCommands.map((command) => `${command.usage.padEnd(22)} ${command.description}`)].join('\n');
    }
  },
  {
    name: '/model',
    usage: '/model <name>',
    description: 'Set the current model',
    async handle(value, state) {
      if (!value) return 'Usage: /model <name>';
      state.model = value;
      state.config.model = value;
      await state.configStore.save(state.config);
      return `Model set to ${state.model}`;
    }
  },
  {
    name: '/baseurl',
    usage: '/baseurl <url>',
    description: 'Set the OpenAI-compatible base URL',
    async handle(value, state) {
      if (!value) return 'Usage: /baseurl <url>';
      state.baseUrl = value;
      state.config.base_url = value;
      await state.configStore.save(state.config);
      return `Base URL set to ${state.baseUrl}`;
    }
  },
  {
    name: '/apikey',
    usage: '/apikey <key>',
    description: 'Set the API key',
    async handle(value, state) {
      if (!value) return 'Usage: /apikey <key>';
      state.apiKey = value;
      state.config.api_key = value;
      await state.configStore.save(state.config);
      return 'API key set.';
    }
  },
  {
    name: '/clear',
    usage: '/clear',
    description: 'Clear context and start a new session',
    async handle(_value, state, store) {
      const session = await store.createSession('New session');
      state.sessionId = session.id;
      return `Started session ${session.id}`;
    }
  },
  {
    name: '/resume',
    usage: '/resume [session-id]',
    description: 'List sessions or resume one by id',
    async handle(value, state, store) {
      if (value) {
        const session = await store.resumeSession(value);
        state.sessionId = session.id;
        return `Resumed session ${session.id}`;
      }
      const sessions = await store.listSessions();
      return sessions.length === 0
        ? 'No sessions found for this project.'
        : sessions.map((session) => `${session.id}  ${session.name}  ${session.updated_at}`).join('\n');
    }
  },
  {
    name: '/continue',
    usage: '/continue',
    description: 'Continue the most recent session',
    async handle(_value, state, store) {
      const [session] = await store.listSessions();
      if (!session) return 'No sessions found for this project.';
      state.sessionId = session.id;
      return `Continued session ${session.id}`;
    }
  },
  {
    name: '/rename',
    usage: '/rename <name>',
    description: 'Rename the current session',
    async handle(value, state, store) {
      if (!state.sessionId) return 'No active session.';
      if (!value.trim()) return 'Usage: /rename <name>';
      const session = await store.renameSession(state.sessionId, value);
      return `Renamed session ${session.id} to ${session.name}`;
    }
  },
  {
    name: '/delete',
    usage: '/delete',
    description: 'Soft delete the current session',
    async handle(_value, state, store) {
      if (!state.sessionId) return 'No active session.';
      const deleted = await store.deleteSession(state.sessionId);
      state.sessionId = undefined;
      return `Deleted session ${deleted.id}`;
    }
  },
  {
    name: '/clean',
    usage: '/clean',
    description: 'Permanently remove soft-deleted sessions',
    async handle(_value, _state, store) {
      const result = await store.cleanDeletedSessions();
      return `Cleaned ${result.removed.length} deleted ${result.removed.length === 1 ? 'session' : 'sessions'}.`;
    }
  },
  {
    name: '/tool',
    usage: '/tool',
    description: 'Open tool allow-list selector',
    handle() {
      return '/tool';
    }
  },
  {
    name: '/exit',
    usage: '/exit',
    description: 'Exit REPL',
    handle() {
      return '/exit';
    }
  }
];

export async function handleBuiltinCommand(input: string, state: CliState, store: SessionStore): Promise<string | undefined> {
  const [command, ...rest] = input.trim().split(/\s+/);
  const value = rest.join(' ');
  return builtinCommands.find((item) => item.name === command)?.handle(value, state, store);
}
