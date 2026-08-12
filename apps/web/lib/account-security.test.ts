/**
 * Unit suite for the account-security pure helpers. The load-bearing
 * invariants: the return-path allowlist can never be escaped (open-redirect
 * guard on the shared change-password / sign-out-others actions), password
 * validation mirrors the original /dashboard/profile rules, and the
 * post-reset role routing matches the three doorways.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  accountHomePath,
  isAuthRateLimitError,
  isCaptchaVerificationError,
  safeSecurityReturnPath,
  validateNewPassword,
} from './account-security';

// ── safeSecurityReturnPath — allowlist, never user-controlled ───────────────

test('safeSecurityReturnPath: allowlisted surfaces pass through', () => {
  assert.equal(safeSecurityReturnPath('/dashboard/profile'), '/dashboard/profile');
  assert.equal(
    safeSecurityReturnPath('/vendor-dashboard/profile'),
    '/vendor-dashboard/profile',
  );
});

test('safeSecurityReturnPath: anything else falls back to the customer profile', () => {
  assert.equal(safeSecurityReturnPath('https://evil.com'), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath('//evil.com'), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath('/admin'), '/dashboard/profile');
  assert.equal(
    safeSecurityReturnPath('/dashboard/profile?x=1'),
    '/dashboard/profile',
  );
  assert.equal(safeSecurityReturnPath(null), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath(undefined), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath(42), '/dashboard/profile');
});

// ── validateNewPassword — mirrors the original changePassword rules ─────────

test('validateNewPassword: min 8 + confirm match', () => {
  assert.equal(validateNewPassword('short', 'short'), 'Password must be at least 8 characters');
  assert.equal(validateNewPassword('longenough', 'different1'), 'Passwords do not match');
  assert.equal(validateNewPassword('longenough', 'longenough'), null);
  // Exactly 8 chars is valid (>= 8, not > 8).
  assert.equal(validateNewPassword('12345678', '12345678'), null);
});

// ── accountHomePath — three doorways ────────────────────────────────────────

test('accountHomePath: vendor → /vendor-dashboard · admin → /admin · else /dashboard', () => {
  assert.equal(accountHomePath('vendor'), '/vendor-dashboard');
  assert.equal(accountHomePath('admin'), '/admin');
  assert.equal(accountHomePath('customer'), '/dashboard');
  assert.equal(accountHomePath(null), '/dashboard');
  assert.equal(accountHomePath(undefined), '/dashboard');
});

// ── isAuthRateLimitError — friendly message gate on /forgot-password ────────

test('isAuthRateLimitError: 429 + Supabase rate-limit phrasings detected', () => {
  assert.equal(isAuthRateLimitError(429, 'whatever'), true);
  assert.equal(
    isAuthRateLimitError(
      undefined,
      'For security purposes, you can only request this after 52 seconds.',
    ),
    true,
  );
  assert.equal(isAuthRateLimitError(undefined, 'Email rate limit exceeded'), true);
  assert.equal(isAuthRateLimitError(400, 'Too many requests'), true);
});

test('isAuthRateLimitError: ordinary errors are NOT rate limits (stay neutral)', () => {
  // "User not found"-shaped errors must collapse to the neutral sent state.
  assert.equal(isAuthRateLimitError(400, 'User not found'), false);
  assert.equal(isAuthRateLimitError(undefined, undefined), false);
  assert.equal(isAuthRateLimitError(500, 'Internal server error'), false);
});

/* ── isCaptchaVerificationError — the failed bot check must SAY SO ───────────
   /forgot-password deliberately collapses every error to the neutral
   "if that email exists, we've sent a link", so it can never be used to
   discover whether an account exists. That rule is correct and these tests
   protect it. But it also swallowed a FAILED BOT CHECK — so with captcha on, a
   real person who failed it would be told a link was sent and nothing would be
   sent, on the one page someone reaches when they are already locked out.
   A captcha failure is decided BEFORE any account lookup, so naming it leaks
   nothing. Everything else must still collapse to the neutral confirmation.  */

test('isCaptchaVerificationError: the GoTrue captcha phrasings are detected', () => {
  assert.equal(
    isCaptchaVerificationError(
      400,
      'captcha protection: request disallowed (invalid-input-response)',
    ),
    true,
  );
  assert.equal(
    isCaptchaVerificationError(400, 'captcha verification process failed'),
    true,
  );
  assert.equal(isCaptchaVerificationError(400, 'Captcha failed'), true, 'case-insensitive');
  // The structured code, for GoTrue versions that send one.
  assert.equal(isCaptchaVerificationError(400, undefined, 'captcha_failed'), true);
});

test('isCaptchaVerificationError: everything that must stay NEUTRAL is not matched', () => {
  // 🔒 THE ENUMERATION GUARD. If any of these ever returns true, /forgot-password
  // starts distinguishing a real account from a fake one, which is the exact
  // thing the neutral confirmation exists to prevent.
  for (const [status, message] of [
    [400, 'User not found'],
    [400, 'Unable to validate email address: invalid format'],
    [422, 'Signups not allowed for this instance'],
    [500, 'Internal Server Error'],
    [400, 'Email address is invalid'],
    [undefined, undefined],
    [undefined, ''],
  ] as Array<[number | undefined, string | undefined]>) {
    assert.equal(
      isCaptchaVerificationError(status, message),
      false,
      `must stay neutral: ${status} ${JSON.stringify(message)}`,
    );
  }
});

test('isCaptchaVerificationError: a 400 alone is NOT enough', () => {
  // Matching the STATUS would have swept up "User not found" (also a 400) and
  // silently turned this page into an account-existence oracle. The message is
  // the narrower signal, not the wider one.
  assert.equal(isCaptchaVerificationError(400, 'User not found'), false);
});

/* ── the wiring, asserted against source ────────────────────────────────────
   The helper being correct proves nothing if the page never calls it — this
   codebase has shipped guards that could never fire. Server actions here have
   no render harness, so these read the source, the same shape used elsewhere. */

const HERE = dirname(fileURLToPath(import.meta.url));
const readRepo = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

test('forgot-password ACTUALLY calls the captcha check, before the neutral fallthrough', () => {
  const src = readRepo('app/forgot-password/actions.ts');
  assert.match(src, /isCaptchaVerificationError/, 'the action never calls the helper');
  const captchaAt = src.indexOf('isCaptchaVerificationError(');
  const sentAt = src.indexOf("redirect('/forgot-password?sent=1')");
  assert.ok(captchaAt > -1 && sentAt > -1);
  assert.ok(
    captchaAt < sentAt,
    'the captcha branch must come BEFORE the neutral sent-confirmation, or it can never fire',
  );
  assert.match(
    src,
    /redirect\('\/forgot-password\?error=captcha'\)/,
    'the captcha branch must redirect to an error the page can render',
  );
});

test('the forgot-password page has copy for error=captcha (an unrendered code is silence)', () => {
  const page = readRepo('app/forgot-password/page.tsx');
  assert.match(page, /\bcaptcha:/, 'ERROR_COPY has no captcha entry');
  // And it must not claim anything was sent.
  const copy = page.slice(page.indexOf('captcha:'), page.indexOf('captcha:') + 260);
  assert.ok(
    !/sent you|we've sent|link is on its way/i.test(copy),
    'the captcha message must not claim a link was sent — that is the bug',
  );
});
