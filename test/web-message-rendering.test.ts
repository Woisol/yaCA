import test from 'node:test';
import assert from 'node:assert/strict';
import { LLM_HTML_INTERACTION_SCRIPT, LLM_HTML_STYLES } from '../packages/llm-html/src/index.js';
import { createSandboxedHtmlDocument, getMessageRenderMode } from '../apps/yaca-web/src/lib/message-rendering.js';

test('getMessageRenderMode uses html only for doctype html documents', () => {
  assert.equal(getMessageRenderMode('\n<!doctype html><html></html>'), 'html');
  assert.equal(getMessageRenderMode('<section>plain snippet</section>'), 'markdown');
  assert.equal(getMessageRenderMode('# title'), 'markdown');
});

test('createSandboxedHtmlDocument injects a restrictive CSP before user html', () => {
  const html = createSandboxedHtmlDocument('<!doctype html><html><head><title>x</title></head><body><script>bad()</script></body></html>');

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /bad\(\)/);
});

test('createSandboxedHtmlDocument injects llm-html styles and runtime before content', () => {
  const html = createSandboxedHtmlDocument('<!doctype html><html><head><title>x</title></head><body><div class="tabs"><div class="tab" data-label="A">A</div></div></body></html>');

  assert.match(html, /data-yaca-llm-html-style/);
  assert.match(html, /data-yaca-llm-html-runtime/);
  assert.match(html, /\.note-info/);
  assert.match(html, /initLlmHtmlTabs/);
  assert.equal(html.includes(LLM_HTML_STYLES), true);
  assert.equal(html.includes(LLM_HTML_INTERACTION_SCRIPT), true);
  assert.equal(html.indexOf('data-yaca-llm-html-style') < html.indexOf('<title>x</title>'), true);
});

test('createSandboxedHtmlDocument creates a head for full html without one', () => {
  const html = createSandboxedHtmlDocument('<!doctype html><html><body><h1>Preview</h1></body></html>');

  assert.match(html, /<head>/i);
  assert.match(html, /data-yaca-llm-html-style/);
  assert.equal(html.indexOf('<head>') < html.indexOf('<body>'), true);
});

test('createSandboxedHtmlDocument strips llm authored scripts while keeping injected runtime', () => {
  const html = createSandboxedHtmlDocument('<!doctype html><html><body><h1>Safe</h1><script>window.evil = true</script></body></html>');

  assert.doesNotMatch(html, /window\.evil/);
  assert.match(html, /data-yaca-llm-html-runtime/);
  assert.match(html, /initLlmHtmlTabs/);
});
