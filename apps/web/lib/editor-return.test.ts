/**
 * `return_to` resolution + open-redirect fence (Unified Website Editor · PR-3).
 *
 * The value is attacker-supplied form data that ends up in a `redirect()`, so
 * the fence matters: anything that is not a plain internal `/dashboard/...`
 * path must fall back to the action's own destination.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveReturnTo, isSafeInternalPath } from './editor-return';

const FALLBACK = '/dashboard/e1/website/what-to-bring?saved=1';
const fd = (v?: string) => {
  const f = new FormData();
  if (v !== undefined) f.set('return_to', v);
  return f;
};

test('absent return_to keeps today’s behavior (the sub-page flows are unchanged)', () => {
  assert.equal(resolveReturnTo(fd(), FALLBACK), FALLBACK);
  assert.equal(resolveReturnTo(fd(''), FALLBACK), FALLBACK);
});

test('a valid editor path is honored, with the suffix appended', () => {
  assert.equal(
    resolveReturnTo(fd('/dashboard/e1/website/editor'), FALLBACK, '?saved=1'),
    '/dashboard/e1/website/editor?saved=1',
  );
  // Existing query → the suffix joins with & instead of a second ?
  assert.equal(
    resolveReturnTo(fd('/dashboard/e1/website/editor?open=story'), FALLBACK, '?saved=1'),
    '/dashboard/e1/website/editor?open=story&saved=1',
  );
});

test('open-redirect shapes are rejected and fall back', () => {
  for (const hostile of [
    'https://evil.example/dashboard/x',
    '//evil.example/dashboard/x',
    'javascript:alert(1)',
    '/etc/passwd',
    '/login',
    '/dashboard/e1/website/editor\\..\\evil',
    '/dashboard/e1/website/editor\nLocation: https://evil.example',
    '/dashboard/e1/website/editor with space',
    'dashboard/e1/website/editor',
  ]) {
    assert.equal(resolveReturnTo(fd(hostile), FALLBACK), FALLBACK, `rejected: ${hostile}`);
  }
});

test('isSafeInternalPath accepts only plain internal dashboard paths', () => {
  assert.equal(isSafeInternalPath('/dashboard/e1/website/editor'), true);
  assert.equal(isSafeInternalPath('/dashboard/e1/website/editor?open=story'), true);
  assert.equal(isSafeInternalPath('/vendor-dashboard/x'), false);
  assert.equal(isSafeInternalPath('//dashboard/x'), false);
  assert.equal(isSafeInternalPath('http://x/dashboard/y'), false);
});
