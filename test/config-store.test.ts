import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
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
    postpone_tool_calls: 2,
    try_fallback: false,
    allow: {
      tools: ['read_file', 'list_directory', 'stat_path', 'cwd', 'get_tool_hint'],
      commands: []
    }
  });
});

test('ConfigStore normalizes missing tool_call allow lists', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    model: 'test-model',
    base_url: 'http://127.0.0.1:1/v1',
    tool_call: {
      tool_call_compatible: false,
      postpone_tool_calls: 2,
      try_fallback: false
    }
  }), 'utf8');

  const config = await new ConfigStore(home).load();

  assert.deepEqual(config.tool_call.allow, {
    tools: ['read_file', 'list_directory', 'stat_path', 'cwd', 'get_tool_hint'],
    commands: []
  });
});

test('ConfigStore reloads when config file changes', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  const store = new ConfigStore(home);
  const config = await store.load();
  const firstStat = await stat(path.join(home, 'config.json'));
  await store.loadIfChanged(firstStat.mtimeMs);

  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    ...config,
    model: 'changed-model',
    tool_call: {
      ...config.tool_call,
      allow: {
        tools: ['cwd'],
        commands: ['echo hi']
      }
    }
  }), 'utf8');
  const changedStat = await stat(path.join(home, 'config.json'));

  const reloaded = await store.loadIfChanged(firstStat.mtimeMs);

  assert.equal(changedStat.mtimeMs > firstStat.mtimeMs, true);
  assert.ok(reloaded);
  assert.equal(reloaded?.mtimeMs, changedStat.mtimeMs);
  assert.equal(reloaded?.config.model, 'changed-model');
  assert.deepEqual(reloaded?.config.tool_call.allow, {
    tools: ['cwd'],
    commands: ['echo hi']
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

test('ConfigStore normalizes legacy top-level try_fallback to tool_call.try_fallback', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-config-'));
  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    model: 'test-model',
    base_url: 'http://127.0.0.1:1/v1',
    try_fallback: false
  }), 'utf8');

  const config = await new ConfigStore(home).load();

  assert.equal(config.tool_call.try_fallback, false);
  assert.equal('try_fallback' in config, false);
});
