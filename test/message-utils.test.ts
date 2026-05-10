import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { storedChatMessageToModelMessage, storedChatMessagesToModelMessages } from '@yaca/agent-core';
import { reduceMessageFile, reduceMessageFileToPathMention } from '../apps/cli/src/api/message-utils.js';

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

test('reduceMessageFileToPathMention keeps inline reduced file markers unchanged', () => {
  const rawMessage = `summarize [File:src${path.sep}index.ts] and [File:test${path.sep}setup.ts]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `summarize [File:src${path.sep}index.ts] and [File:test${path.sep}setup.ts]`);
});

test('reduceMessageFileToPathMention keeps inline reduced file markers with spaces unchanged', () => {
  const rawMessage = `[File:docs${path.sep}my note.md]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `[File:docs${path.sep}my note.md]`);
});

test('reduceMessageFileToPathMention converts reduced file blocks with spaces back to quoted @path references', () => {
  const rawMessage = `\n\n[File: docs${path.sep}my note.md]\ncontent\n[End of File]\n\n`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `@"docs${path.sep}my note.md"`);
});

test('reduceMessageFileToPathMention converts full file blocks back to @path references', () => {
  const filePath = path.join(process.cwd(), 'src', 'index.ts');
  const rawMessage = `summarize \n\n[File: ${filePath}]\ncode\n[End of File]\n\n now`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  const relative = path.relative(process.cwd(), filePath);
  assert.equal(restored, `summarize @${relative} now`);
});
