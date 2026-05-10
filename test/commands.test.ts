import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigStore, SessionStore, handleBuiltinCommand, builtinCommands, type CliState } from '@yaca/agent-core';

test('builtinCommands keeps command docs with handlers', () => {
  assert.deepEqual(builtinCommands.map((command) => command.name), ['/help', '/model', '/baseurl', '/apikey', '/clear', '/resume', '/continue', '/tool', '/exit']);
  assert.equal(builtinCommands.every((command) => command.usage && command.description), true);
});

test('handleBuiltinCommand updates model in config store', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });

  const result = await handleBuiltinCommand('/model qwen2.5-vl-7b', state, store);

  assert.equal(result, 'Model set to qwen2.5-vl-7b');
  const saved = await configStore.load();
  assert.equal(saved.model, 'qwen2.5-vl-7b');
  assert.equal('models' in saved, false);
});

test('handleBuiltinCommand stores api key in config store', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, baseUrl: config.base_url, apiKey: config.api_key, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });

  const result = await handleBuiltinCommand('/apikey sk-local', state, store);

  assert.equal(result, 'API key set.');
  assert.equal(state.apiKey, 'sk-local');
  assert.equal((await configStore.load()).api_key, 'sk-local');
});

test('handleBuiltinCommand resumes a session by id', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const session = await store.createSession('Old work');

  const result = await handleBuiltinCommand(`/resume ${session.id}`, state, store);

  assert.equal(result, `Resumed session ${session.id}`);
  assert.equal(state.sessionId, session.id);
});

test('handleBuiltinCommand continues the most recent session', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-commands-'));
  const configStore = new ConfigStore(home);
  const config = await configStore.load();
  const state: CliState = { model: config.model, config, configStore };
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const older = await store.createSession('Older work');
  const latest = await store.createSession('Latest work');

  const result = await handleBuiltinCommand('/continue', state, store);

  assert.equal(result, `Continued session ${latest.id}`);
  assert.equal(state.sessionId, latest.id);
  assert.notEqual(state.sessionId, older.id);
});
