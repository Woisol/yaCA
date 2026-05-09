import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTextInputKey, clampCursorOffset, moveWordLeft, moveWordRight } from '../apps/cli/src/screens/home/action/enhanced-text-input.js';

test('clampCursorOffset keeps cursor within text bounds', () => {
  assert.equal(clampCursorOffset(-1, 'abc'), 0);
  assert.equal(clampCursorOffset(4, 'abc'), 3);
});

test('applyTextInputKey moves cursor to home and end', () => {
  const home = applyTextInputKey({ value: 'hello', cursorOffset: 3 }, '', { home: true });
  assert.deepEqual(home, { value: 'hello', cursorOffset: 0, cursorWidth: 0 });

  const end = applyTextInputKey({ value: 'hello', cursorOffset: 1 }, '', { end: true });
  assert.deepEqual(end, { value: 'hello', cursorOffset: 5, cursorWidth: 0 });
});

test('moveWordLeft jumps to the start of the previous word', () => {
  assert.equal(moveWordLeft('one two_three  four', 20), 15);
  assert.equal(moveWordLeft('one two_three  four', 15), 4);
  assert.equal(moveWordLeft('one two_three  four', 4), 0);
});

test('moveWordRight jumps to the start of the next word or end', () => {
  assert.equal(moveWordRight('one two_three  four', 0), 4);
  assert.equal(moveWordRight('one two_three  four', 4), 15);
  assert.equal(moveWordRight('one two_three  four', 15), 19);
});

test('applyTextInputKey moves by words on ctrl left and ctrl right', () => {
  const left = applyTextInputKey({ value: 'one two three', cursorOffset: 13 }, '', { leftArrow: true, ctrl: true });
  assert.equal(left.cursorOffset, 8);

  const right = applyTextInputKey({ value: 'one two three', cursorOffset: 0 }, '', { rightArrow: true, ctrl: true });
  assert.equal(right.cursorOffset, 4);
});

test('applyTextInputKey inserts text and deletes around the cursor', () => {
  const inserted = applyTextInputKey({ value: 'helo', cursorOffset: 2 }, 'l', {});
  assert.deepEqual(inserted, { value: 'hello', cursorOffset: 3, cursorWidth: 0 });

  const deleted = applyTextInputKey(inserted, '', { backspace: true });
  assert.deepEqual(deleted, { value: 'helo', cursorOffset: 2, cursorWidth: 0 });
});
