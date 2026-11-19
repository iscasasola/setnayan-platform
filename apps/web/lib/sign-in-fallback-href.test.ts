import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInFallbackHref } from './sign-in-fallback-href';

/**
 * W1-B1 (walk 16 Nov 2026): the open-shop account step's "Have an account? Sign in" drew
 * `/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop` — the link appended `?next=` to an href that already had a
 * query (and its own `next`). The fallback is built ONCE.
 */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('W1-B1 · a caller that named its own `next` keeps it — no second `?`', () => {
  assert.equal(signInFallbackHref('/login?next=%2Fopen-shop&as=vendor', '/open-shop'), '/login?next=%2Fopen-shop&as=vendor');
});

test('W1-B1 · a bare or queried href gets `next` with the right joiner', () => {
  assert.equal(signInFallbackHref('/login', '/v/titanena'), '/login?next=%2Fv%2Ftitanena');
  assert.equal(signInFallbackHref('/login?as=vendor', '/open-shop'), '/login?as=vendor&next=%2Fopen-shop');
  assert.equal(signInFallbackHref('/login?', '/x'), '/login?next=%2Fx');
  assert.equal(signInFallbackHref('/login', '/'), '/login');
  for (const href of ['/login', '/login?as=vendor', '/login?next=%2Fopen-shop&as=vendor']) {
    const out = signInFallbackHref(href, '/open-shop');
    assert.equal(out.split('?').length, 2, `${out} carries exactly one "?"`);
  }
});

test('W1-B1 · SignInHereLink builds its fallback with the one builder', () => {
  const src = readFileSync(join(WEB, 'app/_components/auth/sign-in-here-link.tsx'), 'utf8');
  assert.match(src, /const fallback = signInFallbackHref\(href, here\);/);
  assert.doesNotMatch(src, /`\$\{href\}\?next=/, 'the link appends ?next= to an href by hand again');
});
