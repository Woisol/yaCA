import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAssistantEvent, appendAssistantDelta, appendChatLine, applyRewindInput, applyRewindSelection, applyToolResult, createStoredAgentEventMessage, renderSessionMessages, replaceAssistantText } from '../apps/cli/src/screens/repl-ui.js';

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

test('renderSessionMessages rebuilds persisted tool call cards with results', () => {
  const lines = renderSessionMessages([
    { role: 'tool', content: '{"type":"tool_call","call":{"call_id":"call-1","name":"read_file","args":{"path":"a.txt"}}}' },
    { role: 'tool', content: '{"type":"tool_result","call":{"call_id":"call-1","name":"read_file","args":{"path":"a.txt"}},"result":{"ok":true,"content":"done"}}' }
  ]);

  assert.deepEqual(lines, [{
    kind: 'tool',
    callId: 'call-1',
    toolName: 'read_file',
    args: { path: 'a.txt' },
    status: 'success',
    result: 'done',
    expanded: false
  }]);
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

test('applyToolResult updates the matching tool call card without showing content by default', () => {
  const current = appendAssistantEvent([], {
    type: 'tool_call',
    call_id: 'call-1',
    toolName: 'read_file',
    args: { path: 'a.txt' },
    content: '{"path":"a.txt"}'
  });

  const updated = applyToolResult(current, {
    type: 'tool_result',
    call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } },
    result: { ok: true, content: 'file content' }
  }, false);

  assert.deepEqual(updated, [{
    kind: 'tool',
    callId: 'call-1',
    toolName: 'read_file',
    args: { path: 'a.txt' },
    status: 'success',
    result: 'file content',
    expanded: false
  }]);
});

test('applyToolResult expands matching tool result when tool output is enabled', () => {
  const current = appendAssistantEvent([], {
    type: 'tool_call',
    call_id: 'call-1',
    toolName: 'read_file',
    args: {},
    content: '{}'
  });

  const updated = applyToolResult(current, {
    type: 'tool_result',
    call: { call_id: 'call-1', name: 'read_file', args: {} },
    result: { ok: false, content: 'failed' }
  }, true);

  assert.equal(updated[0]?.kind, 'tool');
  assert.equal(updated[0]?.expanded, true);
  assert.equal(updated[0]?.status, 'error');
});

test('createStoredAgentEventMessage persists tool calls, tool results, and errors', () => {
  assert.deepEqual(createStoredAgentEventMessage({
    type: 'tool_call',
    call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } }
  }), {
    role: 'tool',
    content: '{"type":"tool_call","call":{"call_id":"call-1","name":"read_file","args":{"path":"a.txt"}}}'
  });

  assert.deepEqual(createStoredAgentEventMessage({
    type: 'tool_result',
    call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } },
    result: { ok: false, content: 'missing' }
  }), {
    role: 'tool',
    content: '{"type":"tool_result","call":{"call_id":"call-1","name":"read_file","args":{"path":"a.txt"}},"result":{"ok":false,"content":"missing"}}'
  });

  assert.deepEqual(createStoredAgentEventMessage({ type: 'error', message: 'model failed' }), {
    role: 'tool',
    content: '{"type":"error","message":"model failed"}'
  });
});

test('applyRewindSelection trims to before selected user message and restores it to input', () => {
  const current = [
    { kind: 'user' as const, text: 'first' },
    { kind: 'assistant' as const, text: 'answer' },
    { kind: 'user' as const, text: 'second' },
    { kind: 'assistant' as const, text: 'later' }
  ];

  const result = applyRewindSelection(current, 2);

  assert.deepEqual(result, {
    messages: [
      { kind: 'user', text: 'first' },
      { kind: 'assistant', text: 'answer' }
    ],
    input: 'second',
    storedMessages: [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' }
    ]
  });
});

test('applyRewindSelection ignores non-user selected messages', () => {
  const current = [
    { kind: 'user' as const, text: 'first' },
    { kind: 'assistant' as const, text: 'answer' }
  ];

  const result = applyRewindSelection(current, 1);

  assert.deepEqual(result, {
    messages: current,
    input: '',
    storedMessages: [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' }
    ]
  });
});

test('applyRewindInput only restores rewind text when current input is empty', () => {
  assert.equal(applyRewindInput('', 'rewound message'), 'rewound message');
  assert.equal(applyRewindInput('draft', 'rewound message'), 'draft');
});
