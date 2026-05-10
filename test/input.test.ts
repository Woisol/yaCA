import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUserInput } from '@yaca/agent-core';

test('parseUserInput keeps plain text input as a string', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));

  const content = await parseUserInput('hello model', directory);

  assert.equal(content, 'hello model');
});

test('parseUserInput converts local image @path references to image_url parts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));
  const imagePath = path.join(directory, 'screen.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const parts = await parseUserInput(`explain @${imagePath} please`, directory);

  assert.deepEqual(parts, [
    { type: 'text', text: 'explain ' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' }, meta: { path: imagePath } },
    { type: 'text', text: ' please' }
  ]);
});

test('parseUserInput keeps unresolved @path references as text', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));

  const content = await parseUserInput('open @missing.png now', directory);

  assert.equal(content, 'open @missing.png now');
});

test('parseUserInput reads local text file @path references as file-marked text', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));
  const filePath = path.join(directory, 'notes.md');
  await writeFile(filePath, '# Notes\n\nRead this.', 'utf8');

  const content = await parseUserInput('summarize @notes.md please', directory);

  assert.equal(content, `summarize \n\n[File: ${filePath}]\n# Notes\n\nRead this.\n[End of File]\n\n please`);
});

test('parseUserInput keeps directory @path references as text', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));
  await mkdir(path.join(directory, 'src'));

  const content = await parseUserInput('inspect @src now', directory);

  assert.equal(content, 'inspect @src now');
});

test('parseUserInput caches image base64 payloads', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));
  const yacaHome = path.join(directory, '.yaca');
  const imagePath = path.join(directory, 'screen.webp');
  await writeFile(imagePath, Buffer.from([1, 2, 3]));

  await parseUserInput(`see @${imagePath}`, directory, { yacaHome });

  const cachedFiles = await import('node:fs/promises').then(({ readdir }) => readdir(path.join(yacaHome, 'cache'), { recursive: true }));
  assert.equal(cachedFiles.some((item) => String(item).endsWith('screen.webp.base64')), true);
});
