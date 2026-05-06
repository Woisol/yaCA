import type { SessionStore } from '@yaca/agent-core';
import type { ConfigStore, YacaConfig } from '@yaca/agent-core/storage/config-store.js';

export type CliState = {
  model: string;
  baseUrl?: string;
  sessionId?: string;
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
    description: '显示帮助信息',
    handle() {
      return ['YACA commands:', ...builtinCommands.map((command) => `${command.usage.padEnd(18)} ${command.description}`)].join('\n');
    }
  },
  {
    name: '/model',
    usage: '/model <name>',
    description: '切换模型',
    async handle(value, state) {
      if (!value) return 'Usage: /model <name>';
      state.model = value;
      state.config.default_model = value;
      await state.configStore.save(state.config);
      return `Model set to ${state.model}`;
    }
  },
  {
    name: '/baseurl',
    usage: '/baseurl <url>',
    description: '设置 Base URL',
    async handle(value, state) {
      if (!value) return 'Usage: /baseurl <url>';
      state.baseUrl = value;
      state.config.models = upsertModelBaseUrl(state.config.models, state.model, value);
      await state.configStore.save(state.config);
      return `Base URL set to ${state.baseUrl}`;
    }
  },
  {
    name: '/clear',
    usage: '/clear',
    description: '清除上下文并开始新会话',
    async handle(_value, state, store) {
      const session = await store.createSession('New session');
      state.sessionId = session.id;
      return `Started session ${session.id}`;
    }
  },
  {
    name: '/resume',
    usage: '/resume [session-id]',
    description: '浏览历史会话',
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
    name: '/exit',
    usage: '/exit',
    description: '退出 REPL',
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

function upsertModelBaseUrl(models: YacaConfig['models'], name: string, baseUrl: string): YacaConfig['models'] {
  const existing = models.find((model) => model.name === name);
  if (existing) {
    return models.map((model) => model.name === name ? { ...model, base_url: baseUrl } : model);
  }
  return [...models, { name, base_url: baseUrl }];
}
