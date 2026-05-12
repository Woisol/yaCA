import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYacaWebSystemPrompt } from '../apps/yaca-web/src/server/prompt.js';

test('buildYacaWebSystemPrompt describes web markdown and html rendering in default tool mode', () => {
  const prompt = buildYacaWebSystemPrompt({ toolCallCompatible: false });

  assert.match(prompt, /yaCA Web interface/);
  assert.match(prompt, /HTML-first/i);
  assert.match(prompt, /renders Markdown/);
  assert.match(prompt, /<body>.*<\/body>/i);
  assert.doesNotMatch(prompt, /<!doctype html>/i);
  assert.match(prompt, /note-info/);
  assert.match(prompt, /tabs/);
  assert.match(prompt, /CSS class names/i);
  assert.match(prompt, /not custom elements/i);
  assert.match(prompt, /information density/i);
  assert.match(prompt, /Do not write scripts/i);
  assert.doesNotMatch(prompt, /Markdown render is not supported/);
  assert.doesNotMatch(prompt, /<tool_call name=/);
});

test('buildYacaWebSystemPrompt preserves XML tool instructions in compatible mode', () => {
  const prompt = buildYacaWebSystemPrompt({ toolCallCompatible: true, toolHint: 'read_file: Read file' });

  assert.match(prompt, /renders Markdown/);
  assert.match(prompt, /HTML-first/i);
  assert.match(prompt, /<tool_call name="tool_name">/);
  assert.match(prompt, /read_file: Read file/);
});
