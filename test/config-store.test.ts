import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigStore } from '@yaca/agent-core';

test('ConfigStore defaults max_tool_retry to 5', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  const config = await new ConfigStore(home).load();

  assert.equal(config.max_tool_retry, 5);
});

test('ConfigStore defaults tool_call options', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  const config = await new ConfigStore(home).load();

  assert.deepEqual(config.tool_call, {
    tool_call_compatible: false,
    postpone_tool_calls: 2
  });
});

test('ConfigStore normalizes legacy maxToolRetry to max_tool_retry', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    model: 'test-model',
    base_url: 'http://127.0.0.1:1/v1',
    maxToolRetry: 3
  }), 'utf8');

  const config = await new ConfigStore(home).load();

  assert.equal(config.max_tool_retry, 3);
  assert.equal('maxToolRetry' in config, false);
});

test('ConfigStore normalizes legacy top-level postpone_tool_calls to tool_call.postpone_tool_calls', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    model: 'test-model',
    base_url: 'http://127.0.0.1:1/v1',
    postpone_tool_calls: 7
  }), 'utf8');

  const config = await new ConfigStore(home).load();

  assert.equal(config.tool_call.postpone_tool_calls, 7);
  assert.equal('postpone_tool_calls' in config, false);
});
