import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import buildConfig from '../tsup.config.js';
import type { Options } from 'tsup';

type TsupEntry = string | string[] | Record<string, string>;

function listEntries(entry: TsupEntry | undefined): string[] {
  if (!entry) return [];
  if (typeof entry === 'string') return [entry];
  if (Array.isArray(entry)) return entry;
  return Object.values(entry);
}

test('root package builds a single runtime bundle for CLI and web-runtime exports', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.notEqual(typeof buildConfig, 'function');
  const configValue = buildConfig as Options | Options[];
  const configs = Array.isArray(configValue) ? configValue : [configValue];
  const entries = configs.flatMap((config) => listEntries(config.entry as TsupEntry | undefined));

  assert.deepEqual(entries, ['apps/index.ts']);
  assert.equal(packageJson.exports['.'], './dist/index.js');
  assert.equal(packageJson.exports['./web-runtime.js'], './dist/index.js');
});
