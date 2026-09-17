import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  CONFIRM_OTP_TYPES,
  parseConfirmOtpType,
  buildConfirmUrl,
} from './auth-confirm-link';

/**
 * The property: a password-reset link completes on a device that never saw the
 * request. Measured broken on production 2026-09-18 —
 *   /auth/callback?code=probe&next=%2Freset-password
 *   → 307 /login?error=PKCE%20code%20verifier%20not%20found%20in%20storage…
 *
 * 🔑 THE DECISION IS EXECUTED HERE, NOT GREPPED. The route is `server-only`
 * and the action is `'use server'`, so a test can only read their source; the
 * two things that can actually be got wrong — which OTP types are accepted and
 * how the URL is spelled — live in a pure sibling and are called for real.
 */

/* ── THE DECISIONS, EXECUTED ─────────────────────────────────────────────── */

test('an unrecognised OTP type is refused, never defaulted', () => {
  for (const hostile of [
    'signup', 'phone_change', 'sms', 'RECOVERY ', '', 'recovery;drop',
    null, undefined, 42, {},
  ]) {
    const out = parseConfirmOtpType(hostile as unknown);
    if (typeof hostile === 'string' && hostile.trim().toLowerCase() === 'recovery') {
      continue; // 'RECOVERY ' normalises — that is intended, asserted below.
    }
    assert.equal(out, null, `accepted a type it should refuse: ${String(hostile)}`);
  }
  // A miss must be null, NOT a fallback: guessing 'recovery' would run the
  // password-recovery ceremony on a token minted for something else.
  assert.equal(parseConfirmOtpType('signup'), null);
});

test('the types we do issue are accepted, case and padding forgiven', () => {
  for (const t of CONFIRM_OTP_TYPES) {
    assert.equal(parseConfirmOtpType(t), t);
    assert.equal(parseConfirmOtpType(` ${t.toUpperCase()} `), t);
  }
  // The floor: recovery is the one this was built for and must never drop out
  // of the list. A shrunken allowlist would break every reset silently.
  assert.ok(CONFIRM_OTP_TYPES.includes('recovery'));
  assert.ok(CONFIRM_OTP_TYPES.length >= 5);
});

test('the link carries its whole proof in the query string', () => {
  const url = buildConfirmUrl({
    appUrl: 'https://www.setnayan.com',
    tokenHash: 'pkce_abc+123/xyz=',
    type: 'recovery',
    next: '/reset-password',
  });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/auth/confirm');
  // Round-trips exactly — an unencoded token would end early at the `+` or `/`
  // and the link would arrive with no proof on it at all.
  assert.equal(parsed.searchParams.get('token_hash'), 'pkce_abc+123/xyz=');
  assert.equal(parsed.searchParams.get('type'), 'recovery');
  assert.equal(parsed.searchParams.get('next'), '/reset-password');
  // 🚨 NO `code=`. That parameter is the PKCE flow this exists to leave.
  assert.equal(parsed.searchParams.get('code'), null);
});

test('a next that carries its own query survives intact', () => {
  const url = buildConfirmUrl({
    appUrl: 'https://www.setnayan.com/',  // trailing slash must not double up
    tokenHash: 'tok',
    type: 'magiclink',
    next: '/join/S89E-ABC?from=email&x=1',
  });
  assert.ok(!url.includes('.com//auth'), `doubled slash: ${url}`);
  assert.equal(
    new URL(url).searchParams.get('next'),
    '/join/S89E-ABC?from=email&x=1',
  );
});

/* ── THE WIRING — a correct helper nobody calls is decoration ────────────── */
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const code = (rel: string) =>
  stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the confirm route verifies the token instead of exchanging a code', () => {
  const route = code('app/auth/confirm/route.ts');
  assert.match(route, /verifyOtp\(\{\s*type,\s*token_hash:/,
    'the route stopped calling verifyOtp — the link is browser-bound again');
  assert.match(route, /parseConfirmOtpType\(/,
    'the type allowlist was bypassed; a stranger picks the ceremony');
  assert.doesNotMatch(route, /exchangeCodeForSession/,
    'the PKCE exchange came back into the one route that must not need it');
  assert.match(route, /safeNext\(/, 'open redirect: next is unguarded');
});

test('forgot-password no longer starts a PKCE flow', () => {
  const action = code('app/forgot-password/actions.ts');
  // The exact call that produced the production failure.
  assert.doesNotMatch(action, /resetPasswordForEmail/,
    'resetPasswordForEmail is back — under @supabase/ssr that is PKCE, and the ' +
    'emailed link then only works in the browser that asked for it');
  assert.match(action, /sendPasswordRecoveryLink\(/,
    'nothing sends a recovery link any more');
});

test('we rate-limit what we now mail ourselves', () => {
  const action = code('app/forgot-password/actions.ts');
  // GoTrue used to cap this as a side effect of being the mailer. Losing a
  // protection while fixing a bug turns a fix into a regression.
  assert.match(action, /rateLimit\(/, 'the reset mailer has no cap at all');
  const caps = action.match(/rateLimit\(/g) ?? [];
  assert.ok(caps.length >= 2, `expected a per-email AND a per-IP cap, found ${caps.length}`);
  assert.match(action, /error=rate_limited/, 'the cap is measured and then ignored');
});

test('the captcha is verified by someone, now that GoTrue is out of the path', () => {
  const action = code('app/forgot-password/actions.ts');
  assert.match(action, /verifyTurnstileToken\(/,
    'the Turnstile token arrives and nobody checks it — a bot check that ' +
    'renders and protects nothing looks MORE protected than having none');
  assert.match(action, /error=captcha/,
    'a failed bot check still tells the person we sent them a link');
});

test('the neutral confirmation is the only success copy', () => {
  const action = code('app/forgot-password/actions.ts');
  // Anti-enumeration: "no such account" and "Resend refused" must be
  // indistinguishable from the outside.
  const sentRedirects = action.match(/\?sent=1/g) ?? [];
  assert.equal(sentRedirects.length, 1,
    `the sent-confirmation is written ${sentRedirects.length} times; a second ` +
    'copy is how one of them comes to depend on whether the account exists');
  assert.doesNotMatch(action, /user not found|no such (account|user)/i);
});
