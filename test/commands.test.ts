import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigStore, SessionStore, handleBuiltinCommand, builtinCommands, type CliState } from '@yaca/agent-core';

test('builtinCommands keeps command docs with handlers', () => {
  assert.deepEqual(builtinCommands.map((command) => command.name), ['/help', '/model', '/baseurl', '/clear', '/resume', '/exit']);
  assert.equal(builtinCommands.every((command) => command.usage && command.description), true);
});

test('handleBuiltinCommand updates model in config store', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.default_model, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });

  const result = await handleBuiltinCommand('/model qwen2.5-vl-7b', state, store);

  assert.equal(result, 'Model set to qwen2.5-vl-7b');
  assert.equal((await configStore.load()).default_model, 'qwen2.5-vl-7b');
});

test('handleBuiltinCommand resumes a session by id', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.default_model, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const session = await store.createSession('Old work');

  const result = await handleBuiltinCommand(`/resume ${session.id}`, state, store);

  assert.equal(result, `Resumed session ${session.id}`);
  assert.equal(state.sessionId, session.id);
});
