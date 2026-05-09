import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SessionStore, type CliState } from '@yaca/agent-core';
import { appendAssistantEvent, appendAssistantDelta, appendChatLine, applyRewindSelection, applyToolResult, createStoredAgentEventMessage, renderSessionMessages, replaceAssistantText, replRenderOptions, type ChatMessage } from '../apps/cli/src/screens/repl-ui.js';
import { runAgentTurn } from '../apps/cli/src/api/repl-helpers.js';

// 现在不再在消息数据中附带 id
// test('appendChatLine assigns unique ids for consecutive appends', () => {
//   const first = appendChatLine([], 'status', 'one');
//   const second = appendChatLine(first, 'status', 'two');

//   assert.deepEqual(second.map((line) => line.id), [1, 2]);
// });

test('repl render options let Ctrl+C reach keyboard shortcuts', () => {
  assert.equal(replRenderOptions.exitOnCtrlC, false);
});

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
    { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } }, _rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>' } },
    { role: 'tool', content: { type: 'tool_result', call_id: 'call-1', result: { ok: true, content: 'done' } } }
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
    call_id: 'call-1',
    result: { ok: true, content: 'file content' },
    rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>'
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
    call_id: 'call-1',
    result: { ok: false, content: 'failed' },
    rawResponse: '<tool_call name="read_file">{}</tool_call>'
  }, true);

  assert.equal(updated[0]?.kind, 'tool');
  assert.equal(updated[0]?.expanded, true);
  assert.equal(updated[0]?.status, 'error');
});

test('createStoredAgentEventMessage persists tool calls, tool results, and errors', () => {
  assert.deepEqual(createStoredAgentEventMessage({
    type: 'tool_call',
    call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } },
    rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>'
  }), {
    role: 'tool',
    content: {
      type: 'tool_call',
      call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } },
      _rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>'
    }
  });

  assert.deepEqual(createStoredAgentEventMessage({
    type: 'tool_result',
    call_id: 'call-1',
    result: { ok: false, content: 'missing' },
    rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>'
  }), {
    role: 'tool',
    content: {
      type: 'tool_result',
      call_id: 'call-1',
      result: { ok: false, content: 'missing' }
    }
  });

  assert.deepEqual(createStoredAgentEventMessage({ type: 'error', message: 'model failed' }), {
    role: 'tool',
    content: { type: 'error', message: 'model failed' }
  });
});

test('appendAssistantEvent ignores parse errors because synthetic tool events render the card', () => {
  const lines = appendAssistantEvent([], {
    type: 'parse_error',
    message: 'Failed to parse assistant tool call',
    content: '{"path":'
  });

  assert.deepEqual(lines, []);
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

test('applyRewindSelection leaves inline reduced file markers unchanged', () => {
  const current = [
    { kind: 'user' as const, text: 'summarize [File:src/index.ts]' },
    { kind: 'assistant' as const, text: 'answer' }
  ];

  const result = applyRewindSelection(current, 0);
  assert.equal(result.input, 'summarize [File:src/index.ts]');
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

test('runAgentTurn persists assistant_text events that are not backed by sxml text', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-repl-'));
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const runtime = {
    cwd: home,
    state: { model: 'test-model' } as CliState,
    store,
    createAgent() {
      return {
        async *runStream() {
          yield { type: 'assistant_text' as const, text: 'Stopped this turn because tool calls failed 2 times in a row.' };
        }
      };
    }
  };
  const lines: Array<{ kind: string; text: string }> = [];

  await runAgentTurn(
    'hello',
    runtime as never,
    (kind, text) => lines.push({ kind, text }),
    () => undefined,
    false
  );

  assert.equal(lines.at(-1)?.text, 'Stopped this turn because tool calls failed 2 times in a row.');
  assert.ok(runtime.state.sessionId);
  const messages = await store.readMessages(runtime.state.sessionId);
  assert.deepEqual(messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(messages.at(-1)?.content, 'Stopped this turn because tool calls failed 2 times in a row.');
});

test('runAgentTurn passes abort signal to the agent stream', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-repl-'));
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const controller = new AbortController();
  let streamSignal: AbortSignal | undefined;
  const runtime = {
    cwd: home,
    state: { model: 'test-model' } as CliState,
    store,
    createAgent() {
      return {
        async *runStream(_messages: unknown, options?: { signal?: AbortSignal }) {
          streamSignal = options?.signal;
          yield { type: 'assistant_text' as const, text: 'hello' };
        }
      };
    }
  };

  await runAgentTurn(
    'hello',
    runtime as never,
    () => undefined,
    () => undefined,
    false,
    { signal: controller.signal }
  );

  assert.equal(streamSignal, controller.signal);
});

test('runAgentTurn uses pre-parsed user content when provided', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'yaca-repl-'));
  const filePath = path.join(home, 'notes.md');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(filePath, 'hello file', 'utf8'));
  const store = new SessionStore({ homeDirectory: home, workspace: home });
  const runtime = {
    cwd: home,
    state: { model: 'test-model' } as CliState,
    store,
    createAgent() {
      return {
        async *runStream() {
          await import('node:fs/promises').then(({ rm }) => rm(filePath));
          yield { type: 'assistant_text' as const, text: 'ok' };
        }
      };
    }
  };

  await runAgentTurn(
    'summarize @notes.md',
    runtime as never,
    () => undefined,
    () => undefined,
    false,
    { userContent: [{ type: 'text', text: 'pre-parsed file content' }] }
  );

  const messages = await store.readMessages(runtime.state.sessionId!);
    assert.deepEqual(messages[0]?.content, [{ type: 'text', text: 'pre-parsed file content' }]);
});
