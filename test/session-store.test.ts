import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionStore } from '@yaca/agent-core';

test('SessionStore creates sessions and appends JSONL messages', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-store-'));
  const workspace = path.join(home, 'workspace');
  const store = new SessionStore({ homeDirectory: home, workspace });

  const session = await store.createSession('Implement login');
  await store.appendMessage(session.id, { role: 'user', content: 'hello' });
  await store.appendMessage(session.id, { role: 'assistant', content: 'hi' });
  const messages = await store.readMessages(session.id);
  const sessions = await store.listSessions();

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.content, 'hello');
  assert.equal(sessions[0]?.id, session.id);
  assert.equal(sessions[0]?.message_count, 2);
});

test('SessionStore resumes an existing session by id', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-store-'));
  const workspace = path.join(home, 'workspace');
  const store = new SessionStore({ homeDirectory: home, workspace });
  const session = await store.createSession('Resume me');
  await store.appendMessage(session.id, { role: 'user', content: 'hello' });

  const resumed = await store.resumeSession(session.id);

  assert.equal(resumed.id, session.id);
  assert.equal(resumed.message_count, 1);
});
