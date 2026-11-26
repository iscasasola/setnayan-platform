/**
 * FINAL CHECK A1-059 · OWNER RULING Add 33 (25 Nov 2026): "a supplier is a user with a shop".
 *
 * sign-up (as a supplier) → "Have an account? Sign in" → "New here? Create account" must never lose the shop intent,
 * and a Google / Apple start error from the supplier sign-up must carry it back too. A supplier's bare landing is
 * `/open-shop` (the same rule `signUp` applies), which takes any signed-in user, so an account filed as a couple is
 * never blocked from having a shop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signInHrefKeepingIntent } from './signup-intent';
import { stripComments } from './strip-comments';

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('the sign-up card’s sign-in link keeps the shop intent and lands on the shop set-up', () => {
  assert.equal(signInHrefKeepingIntent('/', 'vendor'), '/login?next=%2Fopen-shop&as=vendor');
  assert.equal(signInHrefKeepingIntent('/vendor-dashboard/shop', 'vendor'), '/login?next=%2Fvendor-dashboard%2Fshop&as=vendor');
  // A couple's sign-up is unchanged: no intent invented.
  assert.equal(signInHrefKeepingIntent('/', 'customer'), '/login');
  assert.equal(signInHrefKeepingIntent('/dashboard', 'customer'), '/login?next=%2Fdashboard');
  // An OAuth start error rides back with the intent.
  const back = new URL(signInHrefKeepingIntent('/', 'vendor', 'provider is not enabled'), 'https://x.test');
  assert.equal(back.pathname, '/login');
  assert.equal(back.searchParams.get('as'), 'vendor');
  assert.equal(back.searchParams.get('next'), '/open-shop');
  assert.equal(back.searchParams.get('error'), 'provider is not enabled');
});

test('the full round trip: the sign-in card’s "Create account" carries the shop intent and the landing back', () => {
  // login-data.ts is server-only, so its link is read, not run: `as=vendor` in → `as=vendor` out, with `next`.
  const login = src('app/login/_components/login-data.ts');
  assert.match(login, /if \(params\.as === 'vendor'\) signupParams\.set\('as', 'vendor'\);/, 'the sign-in card drops the shop intent');
  assert.match(login, /if \(landsAt !== '\/'\) signupParams\.set\('next', landsAt\);/);
});

test('🔒 every hop uses the one helper', () => {
  assert.match(src('app/signup/page.tsx'), /const loginHref = signInHrefKeepingIntent\(next, accountType\);/);
  const oauth = src('app/auth/oauth-actions.ts');
  assert.doesNotMatch(oauth, /`\/login\?error=/, 'an OAuth error drops the shop intent again');
  assert.equal((oauth.match(/signInHrefKeepingIntent\(/g) ?? []).length, 2);
});

test('an account filed as a couple can still open a shop (Add 33): /open-shop self-heals account_type', () => {
  assert.match(src('app/open-shop/actions.ts'), /\.update\(\{ account_type: 'vendor' \}\)/);
});
