import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveClipboardImageReference } from '@yaca/agent-core/input/clipboard.js';

test('saveClipboardImageReference stores pasted images as @path references', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-clipboard-'));

  const reference = await saveClipboardImageReference({ extension: '.png', data: Buffer.from([1, 2, 3]) }, { yacaHome: home });

  assert.equal(reference.startsWith('@'), true);
  assert.deepEqual(await readFile(reference.slice(1)), Buffer.from([1, 2, 3]));
});
