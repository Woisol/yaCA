import test from 'node:test';
import assert from 'node:assert/strict';
import { storedChatMessageToModelMessage } from '../apps/cli/src/api/message-utils.js';

test('stored tool parse error formats as tool error with message', () => {
  const stored = { role: 'tool', content: { type: 'tool_call', call: { call_id: 'call-1', name: 'parse_tool_call', args: { content: '{}' } } } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(formatted.role, 'tool');
  assert.equal(formatted.content, '<tool_call name="parse_tool_call">{"content":"{}"}</tool_call>');
});

test('stored tool_result ok formats as tool result', () => {
  const stored = { role: 'tool', content: { type: 'tool_result', call: { call_id: 'call-2', name: 'cwd', args: {} }, result: { ok: true, content: 'D:\\Code' } } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(String(formatted.content), 'D:\\Code');
});

test('stored tool_result error formats as tool error with message', () => {
  const stored = { role: 'tool', content: { type: 'tool_result', call: { call_id: 'call-1', name: 'parse_tool_call', args: { content: '{}' } }, result: { ok: false, content: 'Failed to parse' } } };
  const formatted = storedChatMessageToModelMessage(stored as any);
  assert.equal(String(formatted.content), 'Failed to parse');
});
