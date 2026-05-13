import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartInteractiveRepl, createNonInteractiveReplError } from '../apps/index.js';

test('canStartInteractiveRepl rejects stdin without TTY raw mode support', () => {
  assert.equal(canStartInteractiveRepl({ isTTY: false }), false);
});

test('canStartInteractiveRepl accepts interactive stdin', () => {
  assert.equal(canStartInteractiveRepl({ isTTY: true }), true);
});

test('createNonInteractiveReplError points users to non-interactive modes', () => {
  const message = createNonInteractiveReplError();

  assert.match(message, /interactive terminal/);
  assert.match(message, /--once/);
  assert.match(message, /--serve/);
});
