import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigStore, createToolPermissionController, type CliState } from '@yaca/agent-core';

test('ToolPermissionController allows configured tools without prompting', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore, configMtimeMs: 0 };
  const prompts: string[] = [];
  const permissions = createToolPermissionController(state, {
    request: async (request) => {
      prompts.push(request.name);
      return false;
    }
  });

  const approved = await permissions.confirm({ name: 'read_file', args: { path: 'a.txt' } });

  assert.equal(approved, true);
  assert.deepEqual(prompts, []);
});

test('ToolPermissionController prompts for denied tools without mutating allow lists', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore, configMtimeMs: 0 };
  const permissions = createToolPermissionController(state, {
    request: async () => true
  });

  const approved = await permissions.confirm({ name: 'write_file', args: { path: 'a.txt' } });

  assert.equal(approved, true);
  assert.equal(state.config.tool_call.allow.tools.includes('write_file'), false);
  assert.equal((await configStore.load()).tool_call.allow.tools.includes('write_file'), false);
});

test('ToolPermissionController checks exec_command command allow list after tool allow list', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  config.tool_call.allow.tools = ['exec_command'];
  config.tool_call.allow.commands = [];
  await configStore.save(config);
  const state: CliState = { model: config.model, config, configStore, configMtimeMs: 0 };
  const prompts: string[] = [];
  const permissions = createToolPermissionController(state, {
    request: async (request) => {
      prompts.push(`${request.kind}:${String(request.args.command ?? request.name)}`);
      return false;
    }
  });

  const approved = await permissions.confirm({ name: 'exec_command', args: { command: 'echo hi' } });

  assert.equal(approved, false);
  assert.deepEqual(prompts, ['command:echo hi']);
});

test('ToolPermissionController supports suffix wildcard command allow entries', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  config.tool_call.allow.tools = ['exec_command'];
  config.tool_call.allow.commands = ['pnpm *'];
  await configStore.save(config);
  const configMtimeMs = await configStore.getMtimeMs();
  const state: CliState = { model: config.model, config: await configStore.load(), configStore, configMtimeMs };
  const prompts: string[] = [];
  const permissions = createToolPermissionController(state, {
    request: async (request) => {
      prompts.push(String(request.args.command));
      return false;
    }
  });

  const approved = await permissions.confirm({ name: 'exec_command', args: { command: 'pnpm test' } });
  const denied = await permissions.confirm({ name: 'exec_command', args: { command: 'npm test' } });

  assert.equal(approved, true);
  assert.equal(denied, false);
  assert.deepEqual(prompts, ['npm test']);
});

test('ToolPermissionController supports full wildcard command allow entries', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  config.tool_call.allow.tools = ['exec_command'];
  config.tool_call.allow.commands = ['*'];
  await configStore.save(config);
  const configMtimeMs = await configStore.getMtimeMs();
  const state: CliState = { model: config.model, config: await configStore.load(), configStore, configMtimeMs };
  const permissions = createToolPermissionController(state, {
    request: async () => false
  });

  assert.equal(await permissions.confirm({ name: 'exec_command', args: { command: 'anything here' } }), true);
});

test('ToolPermissionController reloads config before permission checks', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore, configMtimeMs: await configStore.getMtimeMs() };
  await writeFile(path.join(home, 'config.json'), JSON.stringify({
    ...config,
    model: 'changed-model',
    tool_call: {
      ...config.tool_call,
      allow: {
        tools: ['write_file'],
        commands: []
      }
    }
  }), 'utf8');
  const permissions = createToolPermissionController(state, {
    request: async () => false
  });

  const approved = await permissions.confirm({ name: 'write_file', args: { path: 'a.txt' } });

  assert.equal(approved, true);
  assert.equal(state.model, 'changed-model');
  assert.deepEqual(state.config.tool_call.allow.tools, ['write_file']);
});

test('ToolPermissionController allows every call in trust mode', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-permissions-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore, trustMode: true, configMtimeMs: await configStore.getMtimeMs() };
  const permissions = createToolPermissionController(state, {
    request: async () => false
  });

  assert.equal(await permissions.confirm({ name: 'remove_file', args: { path: 'a.txt' } }), true);
  assert.equal(await permissions.confirm({ name: 'exec_command', args: { command: 'echo hi' } }), true);
});
