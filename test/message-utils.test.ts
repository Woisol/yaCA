import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { storedChatMessageToModelMessage, storedChatMessagesToModelMessages } from '@yaca/agent-core';
import { applyRewindSelection, renderSessionMessages } from '@yaca/ui';
import { formatStoredMessageContent, reduceMessageFile, reduceMessageFileToPathMention } from '../apps/cli/src/api/message-utils.js';
import { toThreadMessages } from '../apps/yaca-web/src/lib/assistant.js';

test('stored tool parse error formats as tool error with message', () => {
  const stored = { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'parse_tool_call', args: { content: '{}' } }, _rawResponse: '<tool_call name="parse_tool_call">{"content":"{}"}</tool_call>' } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(formatted.role, 'tool');
  assert.equal(formatted.content, '<tool_call name="parse_tool_call">{}');
});

test('stored tool_result ok formats as tool result', () => {
  const stored = { role: 'tool', content: { type: 'tool_result', call_id: 'call-2', result: { ok: true, content: 'D:\\Code' } } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(String(formatted.content), 'D:\\Code');
});

test('stored tool_result error formats as tool error with message', () => {
  const stored = { role: 'tool', content: { type: 'tool_result', call_id: 'call-1', result: { ok: false, content: 'Failed to parse' } } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(String(formatted.content), 'Failed to parse');
});

test('renderSessionMessages preserves orphan stored tool results as visible tool cards', () => {
  const messages = renderSessionMessages([
    { role: 'tool', content: { type: 'tool_result', call_id: 'missing-call', result: { ok: false, content: 'tool failed without call' } } }
  ] as any);

  assert.deepEqual(messages, [{
    kind: 'tool',
    callId: 'missing-call',
    toolName: 'tool_result',
    status: 'error',
    result: 'tool failed without call',
    expanded: true,
    orphan: true
  }]);
});

test('applyRewindSelection keeps CLI rewind semantics for web user-message rewind', () => {
  const current = [
    { kind: 'user' as const, text: 'first' },
    { kind: 'assistant' as const, text: 'first answer' },
    { kind: 'user' as const, text: `retry [File:src${path.sep}index.ts]` },
    { kind: 'assistant' as const, text: 'retry answer' }
  ];

  const result = applyRewindSelection(current, 2);

  assert.deepEqual(result.messages, current.slice(0, 2));
  assert.equal(result.input, `retry @src${path.sep}index.ts`);
});

test('toThreadMessages reduces long file blocks for web display without changing rewind semantics', () => {
  const filePath = path.join(process.cwd(), 'src', 'display.ts');
  const rawText = `review this\n\n[File: ${filePath}]\nconst value = 1;\n[End of File]\n\nplease`;

  const threadMessages = toThreadMessages([{ kind: 'user', text: rawText }]);
  const textPart = threadMessages[0]?.content[0];

  assert.equal(textPart?.type, 'text');
  assert.equal(textPart?.type === 'text' ? textPart.text : '', `review this[File:src${path.sep}display.ts]please`);
  assert.equal(reduceMessageFileToPathMention(rawText), `review this@src${path.sep}display.tsplease`);
});

test('storedChatMessagesToModelMessages converts persisted tool events to OpenAI tool history by default', () => {
  const formatted = storedChatMessagesToModelMessages([
    { role: 'user', content: 'read it' },
    { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } }, _rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>' } },
    { role: 'tool', content: { type: 'tool_result', call_id: 'call-1', result: { ok: true, content: 'file content' } } }
  ] as any);

  assert.deepEqual(formatted, [
    { role: 'user', content: 'read it' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path":"a.txt"}' }
      }]
    },
    { role: 'tool', tool_call_id: 'call-1', content: 'file content' }
  ]);
});

test('storedChatMessagesToModelMessages keeps sxml history when compatible mode is enabled', () => {
  const formatted = storedChatMessagesToModelMessages([
    { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' } }, _rawResponse: '<tool_call name="read_file">{"path":"a.txt"}</tool_call>' } },
    { role: 'tool', content: { type: 'tool_result', call_id: 'call-1', result: { ok: true, content: 'file content' } } }
  ] as any, true);

  assert.deepEqual(formatted, [
    { role: 'tool', content: '<tool_call name="read_file">{"path":"a.txt"}' },
    { role: 'user', content: 'file content' }
  ]);
});

test('storedChatMessagesToModelMessages preserves multimodal user message parts', () => {
  const imagePart = {
    type: 'image_url' as const,
    image_url: { url: 'data:image/png;base64,abc' }
  };
  const formatted = storedChatMessagesToModelMessages([
    { role: 'user', content: [{ type: 'text', text: 'describe ' }, imagePart] }
  ]);

  assert.deepEqual(formatted, [
    { role: 'user', content: [{ type: 'text', text: 'describe ' }, imagePart] }
  ]);
});

test('storedChatMessagesToModelMessages normalizes legacy text-only parts to string', () => {
  const formatted = storedChatMessagesToModelMessages([
    { role: 'user', content: [{ type: 'text', text: 'hello ' }, { type: 'text', text: 'model' }] }
  ]);

  assert.deepEqual(formatted, [
    { role: 'user', content: 'hello model' }
  ]);
});

test('reduceMessageFile converts full file paths to relative paths in [File:path] format', () => {
  const filePath = path.join(process.cwd(), 'test', 'file.md');
  const rawMessage = `some text\n\n[File: ${filePath}]\nFile content here\n[End of File]\n\nmore text`;
  const reduced = reduceMessageFile(rawMessage);
  assert.equal(reduced, `some text[File:test${path.sep}file.md]more text`);
});

test('reduceMessageFile requires blank lines around file blocks', () => {
  const externalFile = path.resolve('/', 'external', 'file.md');
  const rawMessage = `[File: ${externalFile}]\nFile content\n[End of File]`;
  const reduced = reduceMessageFile(rawMessage);
  assert.equal(reduced, rawMessage);
});

test('reduceMessageFile handles multiple file references with blank line delimiters', () => {
  const file1 = path.join(process.cwd(), 'src', 'index.ts');
  const file2 = path.join(process.cwd(), 'test', 'setup.ts');
  const rawMessage = `\n\n[File: ${file1}]\ncode here\n[End of File]\n\n\n\n[File: ${file2}]\nsetup code\n[End of File]\n\n`;
  const reduced = reduceMessageFile(rawMessage);
  assert.equal(reduced, `[File:src${path.sep}index.ts][File:test${path.sep}setup.ts]`);
});

test('formatStoredMessageContent reduces image parts with local path metadata for display', () => {
  const imagePath = path.join(process.cwd(), 'assets', 'screen.png');
  const formatted = formatStoredMessageContent([
    { type: 'text', text: 'explain ' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' }, meta: { path: imagePath } } as any,
    { type: 'text', text: ' please' }
  ]);

  assert.equal(formatted, `explain [Image:assets${path.sep}screen.png] please`);
});

test('reduceMessageFile converts full image blocks to reduced image markers', () => {
  const imagePath = path.join(process.cwd(), 'assets', 'screen.png');
  const rawMessage = `see \n\n[Image: ${imagePath}]\n[End of Image]\n\n now`;
  const reduced = reduceMessageFile(rawMessage);

  assert.equal(reduced, `see [Image:assets${path.sep}screen.png] now`);
});

test('reduceMessageFileToPathMention converts inline reduced file markers to @path references', () => {
  const rawMessage = `summarize [File:src${path.sep}index.ts] and [File:test${path.sep}setup.ts]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `summarize @src${path.sep}index.ts and @test${path.sep}setup.ts`);
});

test('reduceMessageFileToPathMention converts inline reduced image markers to @path references', () => {
  const rawMessage = `summarize [Image:assets${path.sep}screen.png]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `summarize @assets${path.sep}screen.png`);
});

test('reduceMessageFileToPathMention converts inline reduced file markers with spaces to quoted @path references', () => {
  const rawMessage = `[File:docs${path.sep}my note.md]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `@"docs${path.sep}my note.md"`);
});

test('reduceMessageFileToPathMention converts reduced file blocks with spaces back to quoted @path references', () => {
  const rawMessage = `\n\n[File: docs${path.sep}my note.md]\ncontent\n[End of File]\n\n`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `@"docs${path.sep}my note.md"`);
});

test('reduceMessageFileToPathMention converts full image blocks back to @path references', () => {
  const imagePath = path.join(process.cwd(), 'assets', 'screen.png');
  const rawMessage = `inspect \n\n[Image: ${imagePath}]\n[End of Image]\n\n now`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `inspect @assets${path.sep}screen.png now`);
});

test('reduceMessageFileToPathMention converts reduced image blocks back to @path references', () => {
  const rawMessage = `\n\n[Image: assets${path.sep}screen.png]\n\n`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `@assets${path.sep}screen.png`);
});

test('reduceMessageFileToPathMention converts full file blocks back to @path references', () => {
  const filePath = path.join(process.cwd(), 'src', 'index.ts');
  const rawMessage = `summarize \n\n[File: ${filePath}]\ncode\n[End of File]\n\n now`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  const relative = path.relative(process.cwd(), filePath);
  assert.equal(restored, `summarize @${relative} now`);
});
