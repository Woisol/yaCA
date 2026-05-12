import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSessionRoute, readSessionIdFromPathname } from '../apps/yaca-web/src/lib/session-route.js';

test('web session route uses root-level /:sessionId paths', () => {
  assert.equal(formatSessionRoute('session-123'), '/session-123');
  assert.equal(formatSessionRoute('id with spaces'), '/id%20with%20spaces');
  assert.equal(formatSessionRoute(undefined), '/');
});

test('web session route reads only single root-level session segments', () => {
  assert.equal(readSessionIdFromPathname('/session-123'), 'session-123');
  assert.equal(readSessionIdFromPathname('/id%20with%20spaces'), 'id with spaces');
  assert.equal(readSessionIdFromPathname('/'), undefined);
  assert.equal(readSessionIdFromPathname('/sessions/session-123'), undefined);
});
