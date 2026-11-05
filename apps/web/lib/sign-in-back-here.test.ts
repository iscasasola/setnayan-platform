/**
 * The not-found page's "Sign in" returns the person to the address they opened (owner, 23 Oct 2026) — the pure
 * builder, and the page actually using it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { signInBackHereHref } from './sign-in-back-here';
import { safeNext } from './safe-next';

test('a shop address survives the trip through /login', () => {
  const href = signInBackHereHref('/setnaprod');
  assert.equal(href, '/login?next=%2Fsetnaprod');
  const next = new URL(href, 'https://www.setnayan.com').searchParams.get('next');
  assert.equal(safeNext(next), '/setnaprod', 'the login page reads back exactly the address');
  assert.equal(signInBackHereHref('/v/setnaprod'), '/login?next=%2Fv%2Fsetnaprod');
});

test('nothing off-site, and no address at all, goes back Home', () => {
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com/x', '', null, undefined, '/']) {
    assert.equal(signInBackHereHref(bad as string | null | undefined), '/login?next=%2F', String(bad));
  }
});

test('the bare-root not-found draws SignInBackHere and no bare /login link', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/not-found.tsx'), 'utf8'));
  assert.match(src, /<SignInBackHere\b/, 'the Sign in button is the one that comes back');
  assert.doesNotMatch(src, /href=["'`{]\s*["'`]?\/login["'`]?/, 'a bare /login drops the person on Home');
  const btn = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/sign-in-back-here.tsx'), 'utf8'));
  assert.match(btn, /href=\{`\/login\?next=\$\{signInBackHereNext\(pathname\)\}`\}/, 'the button builds its href from the address it is on');
  assert.match(btn, /usePathname\(\)/);
});
