import test from 'node:test';
import assert from 'node:assert/strict';
import { applySxmlPatch, collectToolCalls, createYacaSxmlParser, endAndDrain, writeAndDrain, type YacaSxmlEvent } from '@yaca/agent-core/parser/sxml-adapter.js';

test('sxml adapter extracts tool calls split across stream chunks', () => {
  const parser = createYacaSxmlParser();
  const events: YacaSxmlEvent[] = [];

  for (const patch of writeAndDrain(parser, 'Before <tool_call name="read_file">{"path"')) applySxmlPatch(events, patch);
  for (const patch of writeAndDrain(parser, ':"README.md"}</tool_call> after')) applySxmlPatch(events, patch);
  for (const patch of endAndDrain(parser)) applySxmlPatch(events, patch);

  assert.deepEqual(collectToolCalls(events), [{ name: 'read_file', args: { path: 'README.md' } }]);
  assert.equal(events.some((event) => event.type === 'text' && event.content.includes('Before')), true);
});

test('sxml adapter streams think events at open tag', () => {
  const parser = createYacaSxmlParser();
  const events: YacaSxmlEvent[] = [];

  for (const patch of writeAndDrain(parser, 'a<think>hel')) applySxmlPatch(events, patch);
  for (const patch of writeAndDrain(parser, 'lo</think>b')) applySxmlPatch(events, patch);
  for (const patch of endAndDrain(parser)) applySxmlPatch(events, patch);

  assert.equal(events.some((event) => event.type === 'think' && event.content === 'hello'), true);
});
