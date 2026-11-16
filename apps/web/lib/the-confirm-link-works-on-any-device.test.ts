import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEAD_LINK_WORDS,
  confirmNextFrom,
  deadLinkLanding,
  isDeadLinkError,
  parseConfirmOtpType,
} from './auth-confirm-link';
import { safeNext } from './safe-next';
import { stripComments } from './strip-comments';

/**
 * W1-B24 (FAIL on live, walkthrough 2, 16 Nov 2026). A supplier signed up on the laptop and opened the confirmation
 * mail on the phone: the first open failed AND spent the one-time link (GoTrue's `ConfirmationURL` verifies, then
 * hands a PKCE code only the laptop can exchange), the second open said "expired" in SDK words, and nothing offered a
 * new link. Sabotage any one: put `{{ .ConfirmationURL }}` back in the template · drop the dead-link landing from
 * /auth/callback or /auth/confirm · drop `intent=relink` from the card → red.
 */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('the confirm-signup email links to /auth/confirm with a token_hash — never the PKCE ConfirmationURL', () => {
  const t = read('../../supabase/templates/confirm-signup.html');
  const body = t.slice(t.indexOf('<body'));
  assert.doesNotMatch(body, /\{\{\s*\.ConfirmationURL\s*\}\}/, 'the button is the browser-bound link again');
  assert.match(t, /\{\{ \$link := printf "%s\/auth\/confirm\?token_hash=%s&type=email&next=%s" \.SiteURL \.TokenHash \(urlquery \.RedirectTo\) \}\}/);
  assert.ok((body.match(/href="\{\{ \$link \}\}"/g) ?? []).length >= 2, 'the button and the copy-this-link line both use it');
  assert.equal(parseConfirmOtpType('email'), 'email', '/auth/confirm accepts the type the email sends');
});

test('`.RedirectTo` (an absolute …/auth/callback?next=) is unwrapped to its path; anything else is safeNext-ed', () => {
  assert.equal(confirmNextFrom('https://www.setnayan.com/auth/callback?next=%2Fvendor-dashboard'), '/vendor-dashboard');
  assert.equal(confirmNextFrom('/reset-password'), '/reset-password');
  assert.equal(confirmNextFrom(null), null);
  assert.equal(confirmNextFrom('https://evil.example/elsewhere'), null);
  // A hostile inner next is still refused by the one rule.
  assert.equal(safeNext(confirmNextFrom('https://x/auth/callback?next=%2F%2Fevil.example')), '/');
  const route = stripComments(read('app/auth/confirm/route.ts'));
  assert.match(route, /const next = safeNext\(confirmNextFrom\(url\.searchParams\.get\('next'\)\)\);/);
});

test('a dead link (expired · spent · PKCE opened elsewhere) lands on ONE plain screen, from both email routes', () => {
  for (const m of [
    'PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser',
    'Email link is invalid or has expired',
    'otp_expired',
    'Token has expired or is invalid',
  ]) assert.ok(isDeadLinkError(m), m);
  assert.equal(isDeadLinkError('Invalid login credentials'), false);
  assert.equal(deadLinkLanding('/'), '/login?link=expired');
  assert.equal(deadLinkLanding('/vendor-dashboard'), '/login?link=expired&next=%2Fvendor-dashboard');
  const confirm = stripComments(read('app/auth/confirm/route.ts'));
  assert.match(confirm, /if \(error && isDeadLinkError\(error\.message\)\) \{\s*return NextResponse\.redirect\(new URL\(deadLinkLanding\(next\), url\.origin\)\);/);
  const callback = stripComments(read('app/auth/callback/route.ts'));
  assert.match(callback, /if \(error && isDeadLinkError\(error\.message\)\) \{\s*return NextResponse\.redirect\(new URL\(deadLinkLanding\(fallbackNext\), url\.origin\)\);/);
  assert.match(callback, /error_code'\) === 'otp_expired' \|\| isDeadLinkError\(oauthError\)/);
  // Plain words: no SDK vocabulary on the screen.
  assert.doesNotMatch(DEAD_LINK_WORDS.line, /pkce|verifier|otp|token/i);
});

test('the dead-link screen has a "Send a new link" button that re-sends — through the existing action, any device', () => {
  const card = read('app/login/_components/sign-in-card.tsx');
  const form = card.slice(card.indexOf('{linkExpired && !shownError ? ('), card.indexOf('{shownError ? ('));
  assert.ok(form.length > 0, 'the dead-link form is gone');
  assert.match(form, /<form action=\{sendRelink\}/);
  assert.match(form, /name="intent" value="relink"/);
  assert.match(form, /name="email"/);
  assert.match(form, /\{DEAD_LINK_WORDS\.button\}/);
  assert.equal(DEAD_LINK_WORDS.button, 'Send a new link');
  assert.match(read('app/login/_components/login-data.ts'), /linkExpired: params\.link === LINK_EXPIRED_VALUE/);
  assert.match(read('app/login/page.tsx'), /linkExpired=\{view\.linkExpired\}/);
  const actions = stripComments(read('app/login/actions.ts'));
  assert.match(actions, /if \(formData\.get\('intent'\) === 'relink'\) return sendNewSignInLink\(attempt, formData\);/);
  const send = actions.slice(actions.indexOf('async function sendNewSignInLink'), actions.indexOf('export async function signInInPlace'));
  assert.match(send, /verifyTurnstileToken/, 'the re-send lost its bot check');
  assert.match(send, /rateLimit\(`relink:email:/, 'the re-send lost its per-email cap');
  const link = read('lib/password-recovery-link.ts');
  const fn = link.slice(link.indexOf('export async function sendSignInLink'));
  assert.match(fn, /generateLink\(\{ type: 'magiclink', email \}\)/);
  assert.match(fn, /buildConfirmUrl\(\{ appUrl: appUrl\(\), tokenHash, type: 'magiclink', next \}\)/, 'the new link is browser-bound');
  assert.doesNotMatch(fn, /action_link/, 'the GoTrue action_link (implicit-flow fragment) is used again');
});
