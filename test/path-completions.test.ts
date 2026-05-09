import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyPathCompletion, getPathCompletionState } from '../apps/cli/src/screens/home/action/path-completions.js';

test('getPathCompletionState lists relative matches after @', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-complete-'));
  await mkdir(path.join(directory, 'src'));
  await writeFile(path.join(directory, 'README.md'), 'hello', 'utf8');

  const state = await getPathCompletionState('open @', directory);

  assert.deepEqual(state?.replacementRange, { start: 6, end: 6 });
  assert.deepEqual(state?.items.map((item) => item.display), ['README.md', 'src/']);
});

test('getPathCompletionState filters matches in nested relative directories', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-complete-'));
  await mkdir(path.join(directory, 'src'));
  await writeFile(path.join(directory, 'src', 'index.ts'), '', 'utf8');
  await writeFile(path.join(directory, 'src', 'input.ts'), '', 'utf8');
  await writeFile(path.join(directory, 'src', 'README.md'), '', 'utf8');

  const state = await getPathCompletionState('read @src/in', directory);

  assert.deepEqual(state?.replacementRange, { start: 6, end: 12 });
  assert.deepEqual(state?.items.map((item) => item.display), ['src/index.ts', 'src/input.ts']);
});

test('getPathCompletionState lists children when prefix ends with a directory separator', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-complete-'));
  await mkdir(path.join(directory, 'src'));
  await writeFile(path.join(directory, 'src', 'index.ts'), '', 'utf8');

  const state = await getPathCompletionState('read @src/', directory);

  assert.deepEqual(state?.items.map((item) => item.display), ['src/index.ts']);
});

test('getPathCompletionState supports absolute path prefixes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-complete-'));
  await writeFile(path.join(directory, 'alpha.txt'), '', 'utf8');
  const prefix = path.join(directory, 'al');

  const state = await getPathCompletionState(`read @${prefix}`, directory);

  assert.deepEqual(state?.items.map((item) => item.display), ['alpha.txt']);
});

test('applyPathCompletion replaces the active @path token', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-complete-'));
  await mkdir(path.join(directory, 'src'));
  await writeFile(path.join(directory, 'src', 'index.ts'), '', 'utf8');
  const state = await getPathCompletionState('read @src/in', directory);
  assert.ok(state);

  const next = applyPathCompletion('read @src/in', state, 0);

  assert.equal(next, 'read @src/index.ts');
});
