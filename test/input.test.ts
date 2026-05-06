import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUserInput } from '@yaca/agent-core';

test('parseUserInput converts local image @path references to image_url parts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));
  const imagePath = path.join(directory, 'screen.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const parts = await parseUserInput(`explain @${imagePath} please`, directory);

  assert.deepEqual(parts, [
    { type: 'text', text: 'explain ' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' } },
    { type: 'text', text: ' please' }
  ]);
});

test('parseUserInput keeps unresolved @path references as text', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'yaca-input-'));

  const parts = await parseUserInput('open @missing.png now', directory);

  assert.deepEqual(parts, [{ type: 'text', text: 'open @missing.png now' }]);
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
