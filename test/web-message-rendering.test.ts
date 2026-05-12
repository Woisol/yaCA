import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLlmHtmlPayload, createLlmHtmlShellDocument, LLM_HTML_INTERACTION_SCRIPT, LLM_HTML_PROMPT, LLM_HTML_STYLES } from '../packages/llm-html/src/index.js';
import { highlightLlmHtmlCodeBlocks } from '../packages/llm-html/src/highlight.js';
import { createHighlightedSandboxedHtmlPayload, getMessageRenderMode } from '../apps/yaca-web/src/lib/message-rendering.js';

test('getMessageRenderMode uses html only for body wrapped output', () => {
  assert.equal(getMessageRenderMode('\n<body><h1>Preview</h1>'), 'html');
  assert.equal(getMessageRenderMode('\n<!doctype html><html></html>'), 'markdown');
  assert.equal(getMessageRenderMode('<section>plain snippet</section>'), 'markdown');
  assert.equal(getMessageRenderMode('# title'), 'markdown');
});

test('createLlmHtmlShellDocument creates a stable iframe shell with restrictive CSP', () => {
  const html = createLlmHtmlShellDocument({ frameId: 'frame-1', token: 'token-1' });

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'nonce-token-1'/);
  assert.match(html, /id="llm-html-root"/);
  assert.match(html, /ResizeObserver/);
  assert.match(html, /postMessage/);
  assert.match(html, /frame-1/);
  assert.match(html, /token-1/);
  assert.match(html, /data-yaca-llm-html-style/);
  assert.match(html, /data-yaca-llm-html-runtime/);
  assert.equal(html.includes(LLM_HTML_STYLES), true);
  assert.equal(html.includes(LLM_HTML_INTERACTION_SCRIPT), true);
  assert.doesNotMatch(html, /<h1>Preview/);
});

test('llm-html iframe shell supports explicit dark theme updates', () => {
  const html = createLlmHtmlShellDocument({ frameId: 'frame-1', token: 'token-1' });

  assert.match(LLM_HTML_STYLES, /\[data-theme="dark"\]/);
  assert.match(LLM_HTML_STYLES, /color-scheme:\s*dark/i);
  assert.match(html, /document\.documentElement\.dataset\.theme/);
  assert.match(html, /data\.theme/);
});

test('createLlmHtmlPayload strips unsafe authored html', () => {
  const html = createLlmHtmlPayload('<body><h1 onclick="bad()">Safe</h1><script>window.evil = true</script><a href="javascript:bad()">x</a><img src="data:image/png;base64,aaa" style="width:999px"></body>', { mode: 'stream' });

  assert.doesNotMatch(html, /window\.evil/);
  assert.doesNotMatch(html, /onclick=/);
  assert.doesNotMatch(html, /style=/);
  assert.match(html, /href="#"/);
  assert.match(html, /src="data:image\/png;base64,aaa"/);
});

test('createLlmHtmlPayload accepts incomplete streaming body content', () => {
  const html = createLlmHtmlPayload('<body><section><h1>Streaming', { mode: 'stream' });

  assert.equal(html.includes('<h1>Streaming'), true);
  assert.doesNotMatch(html, /<\/body>|<\/html>|<!doctype/i);
});

test('createLlmHtmlPayload normalizes custom component tags to preset classes', () => {
  const html = createLlmHtmlPayload('<body><note-info>Use class names</note-info><tag-blue>ref</tag-blue></body>', { mode: 'final' });

  assert.match(html, /<div class="note-info">Use class names<\/div>/);
  assert.match(html, /<span class="tag-blue">ref<\/span>/);
  assert.doesNotMatch(html, /<note-info>/);
});

test('createLlmHtmlPayload keeps stream and final payloads lightweight before async highlighting', () => {
  const source = '<body><pre><code class="language-js">const answer = 42;</code></pre></body>';
  const streaming = createLlmHtmlPayload(source, { mode: 'stream' });
  const final = createLlmHtmlPayload(source, { mode: 'final' });

  assert.doesNotMatch(streaming, /class="token keyword"/);
  assert.doesNotMatch(final, /class="token keyword"/);
  assert.match(final, /language-js/);
});

test('highlightLlmHtmlCodeBlocks uses the full prism language registry in a split entry', () => {
  const source = createLlmHtmlPayload('<body><pre><code class="language-tsx">const view = <Panel title="x" />;</code></pre><pre><code>const answer = 42;</code></pre></body>', { mode: 'final' });
  const highlighted = highlightLlmHtmlCodeBlocks(source);

  assert.match(highlighted, /class="token keyword"/);
  assert.match(highlighted, /class="token tag"/);
  assert.match(highlighted, /class="token number"/);
});

test('createHighlightedSandboxedHtmlPayload dynamically loads final code highlighting', async () => {
  const highlighted = await createHighlightedSandboxedHtmlPayload('<body><pre><code class="language-tsx">const view = <Panel title="x" />;</code></pre></body>');

  assert.match(highlighted, /class="token keyword"/);
  assert.match(highlighted, /class="token tag"/);
});

test('llm-html styles render steps as horizontal flow cards without grid layout', () => {
  assert.match(LLM_HTML_STYLES, /\.steps\s*{[^}]*display:\s*flex/i);
  assert.match(LLM_HTML_STYLES, /\.steps\s*{[^}]*flex-wrap:\s*wrap/i);
  assert.match(LLM_HTML_STYLES, /\.step:not\(:last-child\)::after/);
  assert.doesNotMatch(LLM_HTML_STYLES, /\.step\s*{[^}]*display:\s*grid/i);
});

test('llm-html prompt says presets are class names and encourages dense structure', () => {
  assert.match(LLM_HTML_PROMPT, /CSS class names/i);
  assert.match(LLM_HTML_PROMPT, /not custom elements/i);
  assert.match(LLM_HTML_PROMPT, /col-con/i);
  assert.match(LLM_HTML_PROMPT, /collapse/i);
  assert.match(LLM_HTML_PROMPT, /information density/i);
  assert.match(LLM_HTML_PROMPT, /avoid relying on fenced code blocks/i);
});

test('ThreadView keeps assistant-ui message component identity stable across streaming renders', () => {
  const source = readFileSync('apps/yaca-web/src/components/chat/ThreadView.tsx', 'utf8');
  const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  assert.match(source, /THREAD_MESSAGE_COMPONENTS/);
  assert.doesNotMatch(executableSource, /components=\{\{\s*Message:/);
});

test('SessionSidebar keeps session item actions outside the session item button', () => {
  const source = readFileSync('apps/yaca-web/src/components/sidebar/SessionSidebar.tsx', 'utf8');
  const itemIndex = source.indexOf('className="session-item"');
  const itemCloseIndex = source.indexOf('</button>', itemIndex);
  const actionIndex = source.indexOf('className="session-action-group"');

  assert.match(source, /className=\{`session-row/);
  assert.match(source, /className="session-item"/);
  assert.match(source, /className="session-action-group"/);
  assert.equal(itemIndex > -1, true);
  assert.equal(itemCloseIndex > itemIndex, true);
  assert.equal(actionIndex > itemCloseIndex, true);
});

test('llm-html keeps full prism registry out of the lightweight entry', () => {
  const lightweightEntry = readFileSync('packages/llm-html/src/index.ts', 'utf8');
  const highlightEntry = readFileSync('packages/llm-html/src/highlight.ts', 'utf8');

  assert.doesNotMatch(lightweightEntry, /refractor\/all/);
  assert.match(highlightEntry, /refractor\/all/);
});
