/**
 * THE SIGN-IN CARD SAYS ONLY OUR WORDS — and speaks to a guest as a guest.
 * Guest text audit, 2026-09-30.
 *
 * 🔒 `/login?error=` is a query param anyone can type. The card used to print any
 * value that READ like a sentence, so a crafted link put a phishing line inside
 * our own sign-in card. The URL may now only CHOOSE among our sentences.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERIC_SIGN_IN_ERROR, loginErrorFromParam } from './human-auth-error';
import { SIGN_IN_DOOR_MESSAGES } from './sign-in-door';
import { eventSlugFromNext } from './sign-in-for-a-guest';
import { stripComments } from './strip-comments';

test('🔒 a URL cannot write the error banner — an unknown sentence becomes the generic one', () => {
  const phish = 'Your account is locked. Call 0917 000 0000 to restore it.';
  assert.equal(loginErrorFromParam(phish), GENERIC_SIGN_IN_ERROR);
  assert.equal(loginErrorFromParam(encodeURIComponent(phish)), GENERIC_SIGN_IN_ERROR);
  assert.equal(loginErrorFromParam('Visit evil.example to verify your email'), GENERIC_SIGN_IN_ERROR);
});

test('our own sentences and the provider mappings still come through', () => {
  for (const m of Object.values(SIGN_IN_DOOR_MESSAGES)) assert.equal(loginErrorFromParam(m), m);
  assert.equal(loginErrorFromParam('Account deleted'), 'This account has been deleted.');
  assert.equal(loginErrorFromParam('missing'), 'Enter your email and password.');
  assert.match(loginErrorFromParam('Invalid login credentials') ?? '', /do not match/);
  assert.match(loginErrorFromParam('google sign-in is not configured. Please use email + password or contact support.') ?? '', /not available right now/);
  assert.equal(loginErrorFromParam(undefined), null);
  assert.equal(loginErrorFromParam('   '), null);
});

test('🔒 getLoginView maps ?error= through the fixed list — never decodes it straight to the card', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', 'login', '_components', 'login-data.ts'), 'utf8'));
  assert.match(src, /const errorMessage = loginErrorFromParam\(params\.error\);/);
  assert.doesNotMatch(src, /decodeURIComponent\(params\.error\)/, 'the raw ?error= reaches the card again');
});

test('a sign-in that leads back to an event is a guest’s — the candidate slug', () => {
  assert.equal(eventSlugFromNext('/cale-ice'), 'cale-ice');
  assert.equal(eventSlugFromNext('/Cale-Ice/invite/reply?x=1'), 'cale-ice');
  assert.equal(eventSlugFromNext('/u/ice/cale-ice'), 'cale-ice');
  assert.equal(eventSlugFromNext('/dashboard'), null, 'a planner’s page is not an event');
  assert.equal(eventSlugFromNext('/'), null);
  assert.equal(eventSlugFromNext('//evil.example'), null);
  assert.equal(eventSlugFromNext(null), null);
});

test('the guest version drops "Welcome back" and "couples and vendors"; nobody is told "vendor"', () => {
  const card = stripComments(readFileSync(join(__dirname, '..', 'app', 'login', '_components', 'sign-in-card.tsx'), 'utf8'));
  assert.match(card, /\{forGuest \? \(/, 'the card has no guest version');
  assert.doesNotMatch(card, /couples and vendors/);
  assert.match(card, /placeholder="you@email\.com"/);
});
