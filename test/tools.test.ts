import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultToolRegistry } from '@yaca/agent-tools';

test('read_file reads relative files from cwd', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  await writeFile(path.join(workspace, 'note.txt'), 'hello');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('read_file', { path: 'note.txt' });

  assert.deepEqual(result, { ok: true, content: 'hello' });
});

test('read_file reads absolute paths outside cwd', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'yaca-outside-'));
  const target = path.join(outside, 'note.txt');
  await writeFile(target, 'outside');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('read_file', { path: target });

  assert.deepEqual(result, { ok: true, content: 'outside' });
});

test('write_file refuses to overwrite unless dangerouslyOverride is true', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const target = path.join(workspace, 'note.txt');
  await writeFile(target, 'old');
  const tools = createDefaultToolRegistry(workspace);

  const refused = await tools.execute('write_file', { path: 'note.txt', content: 'new' });
  const written = await readFile(target, 'utf8');

  assert.equal(refused.ok, false);
  assert.equal(written, 'old');
});

test('list_directory supports paths outside cwd', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'yaca-outside-'));
  await writeFile(path.join(outside, 'note.txt'), 'outside');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('list_directory', { path: outside });

  assert.equal(result.ok, true);
  assert.match(result.content, /note\.txt/);
});

test('search_files finds matching text inside workspace', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  await writeFile(path.join(workspace, 'a.ts'), 'const answer = 42;\n');
  await writeFile(path.join(workspace, 'b.txt'), 'no match\n');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('search_files', { pattern: 'answer', include: '.ts' });

  assert.equal(result.ok, true);
  assert.match(result.content, /a\.ts:1: const answer = 42;/);
});

test('read_file reads a line and column range', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  await writeFile(path.join(workspace, 'note.txt'), 'alpha\nbravo\ncharlie\n');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('read_file', {
    path: 'note.txt',
    startLineNumber: 2,
    startColumn: 2,
    endLineNumber: 3,
    endColumn: 4
  });

  assert.deepEqual(result, { ok: true, content: 'ravo\ncha' });
});

test('replace_file replaces a line and column range', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const target = path.join(workspace, 'note.txt');
  await writeFile(target, 'alpha\nbravo\ncharlie\n');
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('replace_file', {
    path: 'note.txt',
    new_text: 'B',
    startLineNumber: 2,
    startColumn: 1,
    endLineNumber: 2,
    endColumn: 5
  });

  assert.equal(result.ok, true);
  assert.equal(await readFile(target, 'utf8'), 'alpha\nBo\ncharlie\n');
});

test('exec_command requires explicit approval', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('exec_command', { command: 'echo hi' });

  assert.equal(result.ok, false);
  assert.match(result.content, /requires approve: true/);
});

test('cwd returns the registry cwd', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  const tools = createDefaultToolRegistry(workspace);

  const result = await tools.execute('cwd', {});

  assert.deepEqual(result, { ok: true, content: path.resolve(workspace) });
});

test('silent approval mode allows tool calls', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  await writeFile(path.join(workspace, 'note.txt'), 'hello');
  const tools = createDefaultToolRegistry(workspace, { approvalMode: 'silent' });

  const result = await tools.execute('read_file', { path: 'note.txt' });

  assert.equal(result.ok, true);
  assert.equal(result.content, 'hello');
});

test('confirm approval mode delegates each tool call to callback', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-tools-'));
  await writeFile(path.join(workspace, 'note.txt'), 'hello');
  const calls: string[] = [];
  const tools = createDefaultToolRegistry(workspace, {
    approvalMode: 'confirm',
    confirm: async (request) => {
      calls.push(request.name);
      return request.name !== 'read_file';
    }
  });

  const result = await tools.execute('read_file', { path: 'note.txt' });

  assert.equal(result.ok, false);
  assert.match(result.content, /denied/i);
  assert.deepEqual(calls, ['read_file']);
});
