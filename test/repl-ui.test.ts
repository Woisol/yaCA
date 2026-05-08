import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantDelta, appendChatLine, renderSessionMessages, replaceAssistantText } from '../apps/cli/src/screens/repl-ui.js';

// 现在不再在消息数据中附带 id
// test('appendChatLine assigns unique ids for consecutive appends', () => {
//   const first = appendChatLine([], 'status', 'one');
//   const second = appendChatLine(first, 'status', 'two');

//   assert.deepEqual(second.map((line) => line.id), [1, 2]);
// });

test('renderSessionMessages converts resumed session history into chat lines', () => {
  const lines = renderSessionMessages([
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
    { role: 'tool', content: '{"tool":"read_file","result":{"ok":true,"content":"done"}}' }
  ]);

  assert.deepEqual(lines, [
    { kind: 'user', text: 'hello' },
    { kind: 'assistant', text: 'hi' },
    { kind: 'tool', text: '{"tool":"read_file","result":{"ok":true,"content":"done"}}' }
  ]);
});

test('renderSessionMessages renders a single text part as plain text', () => {
  const lines = renderSessionMessages([
    { role: 'user', content: [{ type: 'text', text: 'hello' }] }
  ]);

  assert.deepEqual(lines, [{ kind: 'user', text: 'hello' }]);
});

test('appendAssistantDelta updates the active assistant line', () => {
  const first = appendAssistantDelta([], 'hel');
  const second = appendAssistantDelta(first, 'lo');

  assert.deepEqual(second, [{ kind: 'assistant', text: 'hello' }]);
});

test('replaceAssistantText replaces the active assistant line after parser rollback', () => {
  const current = appendAssistantDelta([], 'Need <tool_call');

  const replaced = replaceAssistantText(current, 'Need ');

  assert.deepEqual(replaced, [{ kind: 'assistant', text: 'Need ' }]);
});
