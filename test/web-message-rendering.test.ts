import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(html.indexOf('Content-Security-Policy') < html.indexOf('<script>bad()'), true);
});
