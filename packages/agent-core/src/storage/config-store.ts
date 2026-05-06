import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type YacaConfig = {
  default_model: string;
  models: Array<{ name: string; base_url: string }>;
};

const defaultConfig: YacaConfig = {
  default_model: 'qwen2.5-vl-7b',
  models: [
    { name: 'qwen2.5-vl-7b', base_url: 'http://127.0.0.1:11434/v1' }
  ]
};

export class ConfigStore {
  private readonly configPath: string;

  constructor(homeDirectory = path.join(homedir(), '.yaca')) {
    this.configPath = path.join(process.env.YACA_HOME ?? homeDirectory, 'config.json');
  }

  async load(): Promise<YacaConfig> {
    try {
      const content = await readFile(this.configPath, 'utf8');
      return { ...defaultConfig, ...JSON.parse(content) as Partial<YacaConfig> };
    } catch {
      await this.save(defaultConfig);
      return defaultConfig;
    }
  }

  async save(config: YacaConfig): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }
}
