import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { YACA_HOME } from '../constants/path.js';

export type YacaConfig = {
  model: string;
  base_url: string;
  api_key?: string;
  max_turns: number;
  max_tool_retry: number;
  tool_call: {
    tool_call_compatible: boolean;
    postpone_tool_calls: number;
    try_fallback: boolean;
    allow: {
      tools: string[];
      commands: string[];
    };
  };
};

// 好个 legacy
type LegacyYacaConfig = Partial<Omit<YacaConfig, 'tool_call'>> & {
  default_model?: string;
  models?: Array<{ name: string; base_url: string }>;
  maxToolRetry?: number;
  postpone_tool_calls?: number;
  tool_call_compatible?: boolean;
  try_fallback?: boolean;
  tool_call?: Partial<YacaConfig['tool_call']>;
};

const defaultModel = 'qwen2.5-vl-7b';
const defaultBaseUrl = 'http://127.0.0.1:11434/v1';
const defaultPostponeToolCallsSeconds = 2;
const defaultMaxToolRetry = 5;
const defaultAllowedTools = ['read_file', 'list_directory', 'stat_path', 'cwd', 'get_tool_hint', 'explore', 'edit'];

const defaultConfig: YacaConfig = {
  model: defaultModel,
  base_url: defaultBaseUrl,
  max_turns: 20,
  max_tool_retry: defaultMaxToolRetry,
  tool_call: {
    tool_call_compatible: false,
    postpone_tool_calls: defaultPostponeToolCallsSeconds,
    try_fallback: false,
    allow: {
      tools: [...defaultAllowedTools],
      commands: []
    }
  }
};

export class ConfigStore {
  private readonly configPath: string;

  constructor(homeDirectory?: string) {
    this.configPath = path.join(homeDirectory ?? YACA_HOME, 'config.json');
  }

  async load(): Promise<YacaConfig> {
    try {
      const content = await readFile(this.configPath, 'utf8');
      return normalizeConfig(JSON.parse(content) as LegacyYacaConfig);
    } catch {
      await this.save(defaultConfig);
      return { ...defaultConfig };
    }
  }

  async save(config: YacaConfig): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(normalizeConfig(config), null, 2), 'utf8');
  }

  async loadIfChanged(lastMtimeMs: number): Promise<{ config: YacaConfig; mtimeMs: number } | undefined> {
    try {
      const nextMtimeMs = (await stat(this.configPath)).mtimeMs;
      if (nextMtimeMs <= lastMtimeMs) return undefined;
      return { config: await this.load(), mtimeMs: nextMtimeMs };
    } catch {
      return undefined;
    }
  }

  async getMtimeMs(): Promise<number> {
    try {
      return (await stat(this.configPath)).mtimeMs;
    } catch {
      return 0;
    }
  }
}

function normalizeConfig(config: LegacyYacaConfig): YacaConfig {
  const model = config.model || config.default_model || defaultModel;
  const baseUrl = config.base_url
    || config.models?.find((item) => item.name === model)?.base_url
    || config.models?.[0]?.base_url
    || defaultBaseUrl;
  return {
    model,
    base_url: baseUrl,
    ...(config.api_key ? { api_key: config.api_key } : {}),
    max_turns: config.max_turns ?? 20,
    max_tool_retry: config.max_tool_retry ?? config.maxToolRetry ?? defaultMaxToolRetry,
    tool_call: {
      tool_call_compatible: config.tool_call?.tool_call_compatible ?? config.tool_call_compatible ?? false,
      postpone_tool_calls: config.tool_call?.postpone_tool_calls ?? config.postpone_tool_calls ?? defaultPostponeToolCallsSeconds,
      try_fallback: config.tool_call?.try_fallback ?? config.try_fallback ?? true,
      allow: {
        tools: normalizeStringArray(config.tool_call?.allow?.tools, defaultAllowedTools),
        commands: normalizeStringArray(config.tool_call?.allow?.commands, [])
      }
    }
  };
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))];
}
