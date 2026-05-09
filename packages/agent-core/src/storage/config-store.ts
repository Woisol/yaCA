import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { YACA_HOME } from '../constants/path.js';

export type YacaConfig = {
  model: string;
  base_url: string;
  api_key?: string;
  max_turns: number;
  max_tool_retry: number;
  postpone_tool_calls: number;
};

type LegacyYacaConfig = Partial<YacaConfig> & {
  default_model?: string;
  models?: Array<{ name: string; base_url: string }>;
  maxToolRetry?: number;
};

const defaultModel = 'qwen2.5-vl-7b';
const defaultBaseUrl = 'http://127.0.0.1:11434/v1';
const defaultPostponeToolCallsSeconds = 2;
const defaultMaxToolRetry = 5;

const defaultConfig: YacaConfig = {
  model: defaultModel,
  base_url: defaultBaseUrl,
  max_turns: 20,
  max_tool_retry: defaultMaxToolRetry,
  postpone_tool_calls: defaultPostponeToolCallsSeconds
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
    postpone_tool_calls: config.postpone_tool_calls ?? defaultPostponeToolCallsSeconds
  };
}
