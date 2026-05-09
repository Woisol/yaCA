import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveInputAfterCurrentKeypress } from '../apps/cli/src/input/preserve.js';

test('preserveInputAfterCurrentKeypress restores input after same-keypress text input changes', async () => {
  let input = 'draft';

  preserveInputAfterCurrentKeypress(input, (value) => {
    input = value;
  });
  input = `${input}o`;

  await new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

  assert.equal(input, 'draft');
});
