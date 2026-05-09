import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { storedChatMessageToModelMessage, reduceMessageFile, reduceMessageFileToPathMention } from '../apps/cli/src/api/message-utils.js';

test('stored tool parse error formats as tool error with message', () => {
  const stored = { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'parse_tool_call', args: { content: '{}' } }, _rawResponse: '<tool_call name="parse_tool_call">{"content":"{}"}</tool_call>' } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(formatted.role, 'tool');
  assert.equal(formatted.content, '<tool_call name="parse_tool_call">{"content":"{}"}</tool_call>');
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

test('reduceMessageFileToPathMention converts reduced file markers back to @path references', () => {
  const rawMessage = `summarize [File:src${path.sep}index.ts] and [File:test${path.sep}setup.ts]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `summarize [File:src${path.sep}index.ts] and [File:test${path.sep}setup.ts]`);
});

test('reduceMessageFileToPathMention quotes paths with spaces', () => {
  const rawMessage = `[File:docs${path.sep}my note.md]`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  assert.equal(restored, `[File:docs${path.sep}my note.md]`);
});

test('reduceMessageFileToPathMention converts full file blocks back to @path references', () => {
  const filePath = path.join(process.cwd(), 'src', 'index.ts');
  const rawMessage = `summarize \n\n[File: ${filePath}]\ncode\n[End of File]\n\n now`;
  const restored = reduceMessageFileToPathMention(rawMessage);

  const relative = path.relative(process.cwd(), filePath);
  assert.equal(restored, `summarize @${relative} now`);
});
