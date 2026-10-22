/**
 * one-tick-covers-every-door.test.ts — the sign-up card asks for the Terms ONCE (owner 2026-10-22, "Yes to all":
 * Host 1 option B, prototype `journey_fixes_2026-10-22.html`).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * /signup's clickwrap box belonged to the email form. Under the Google / Apple buttons sat a SENTENCE — "By continuing
 * with Google or Apple, you agree…" — which recorded nothing (browsewrap). So every new Google / Apple account had no
 * agreement on file, and `needsTermsAgreement` showed it a whole second screen ("One quick thing") before anything
 * else. Email sign-ups were never asked twice; Google / Apple sign-ups always were.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. ONE box for every door — just above "Create user account" (owner 2026-10-22, "do both"); the Google / Apple
 *      row above it sits inside its gate.
 *   2. The tick travels only as a tick: an httpOnly cookie the SERVER sets from an affirmative posted tick, never
 *      OAuth `state` (Supabase owns that) and never a URL parameter (anyone can type one).
 *   3. The callback records it — only where nothing is on record — and spends it.
 *   4. No tick, no record: the one-time re-ask still catches every account without the stamp.
 *   5. The phone app's own Google / Apple code (1.0 in App Review) knows nothing of any of this.
 *
 * Comments stripped before matching (`lib/strip-comments.ts`), so a fix's own explanation is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  CLICKWRAP_SINCE,
  SIGNUP_TERMS_COOKIE_MAX_AGE,
  TERMS_VERSION,
  carriedTermsAgreement,
  needsTermsAgreement,
  signupTermsCarried,
} from '@/lib/terms-agreement';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── THE RULE, EXECUTED ─────────────────────────────────────────────────────

// SABOTAGE: make `signupTermsCarried` return true for an absent cookie → RED.
test('only a carried tick for the version in force is an agreement', () => {
  for (const v of [undefined, null, '', 'on', 'true', '2026-01-01']) {
    assert.equal(signupTermsCarried(v as never), false, `${JSON.stringify(v)} is not a tick for ${TERMS_VERSION}`);
  }
  assert.equal(signupTermsCarried(TERMS_VERSION), true);
  assert.ok(SIGNUP_TERMS_COOKIE_MAX_AGE > 0 && SIGNUP_TERMS_COOKIE_MAX_AGE <= 60 * 60, 'one round trip, not a standing pass');
});

// SABOTAGE: drop `eventConnect &&` from carriedTermsAgreement → RED (the RSVP tick would stamp any sign-in).
test('the callback records an agreement only on a tick somebody performed', () => {
  const none = { eventConnect: true, rsvpCookie: undefined, signupCookie: undefined };
  assert.equal(carriedTermsAgreement(none), false, 'nothing carried → nothing recorded');
  assert.equal(carriedTermsAgreement({ ...none, signupCookie: TERMS_VERSION }), true, 'the sign-up card tick');
  assert.equal(carriedTermsAgreement({ ...none, eventConnect: false, signupCookie: TERMS_VERSION }), true);
  assert.equal(carriedTermsAgreement({ ...none, rsvpCookie: TERMS_VERSION }), true, 'the RSVP page tick, on its route');
  assert.equal(
    carriedTermsAgreement({ ...none, eventConnect: false, rsvpCookie: TERMS_VERSION }),
    false,
    'the RSVP tick stays bound to the event-connect route, as before',
  );
});

test('an account with no stamp still meets the one-time re-ask', () => {
  const after = `${CLICKWRAP_SINCE}T09:00:00Z`;
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: after }), true);
  assert.equal(needsTermsAgreement({ terms_accepted_at: after, created_at: after }), false);
});

// ── THE CARD ───────────────────────────────────────────────────────────────

// SABOTAGE: move the box back above the OAuth row → RED (owner 2026-10-22, "do both": choose how → agree → create).
// SABOTAGE: move the box below the submit → RED.
// SABOTAGE: put `<OAuthTermsLine />` back under the row → RED.
test('/signup: ONE box, just above "Create user account", gating Google / Apple, and no browsewrap line', () => {
  const page = code('app/signup/page.tsx');
  const box = page.indexOf('name={TERMS_FIELD}');
  assert.ok(box > 0, 'the Terms box is gone from /signup');
  assert.equal(page.split('name={TERMS_FIELD}').length - 1, 1, 'exactly one box — the tick is asked once');
  // The reading order (owner 2026-10-22, "do both"): choose how (Google · Apple · or email + password) → agree → create.
  for (const before of ['<OAuthButtonRow', '<DesktopOAuthButtons', '<NativeOAuthButtons', '<form action={signUp}', 'name="email"', 'name="password"']) {
    const at = page.indexOf(before);
    assert.ok(at > 0, `${before} moved — this guard is pointed at nothing`);
    assert.ok(at < box, `the Terms box must sit BELOW ${before} — the card reads choose how, then agree, then create`);
  }
  const submit = page.indexOf('<SubmitButton');
  assert.ok(submit > box, 'the Terms box must sit ABOVE the button that creates the account — below it is browsewrap');
  assert.ok(box < page.indexOf('</form>'), 'the box is inside the email form, so the email door posts it');
  const wrap = page.indexOf('<TermsFirst boxId={TERMS_BOX_ID}>');
  const close = page.indexOf('</TermsFirst>');
  for (const row of ['<OAuthButtonRow', '<DesktopOAuthButtons', '<NativeOAuthButtons']) {
    const at = page.indexOf(row);
    assert.ok(wrap > 0 && wrap < at && at < close, `${row} must sit inside <TermsFirst> — ungated, it skips the tick`);
  }
  assert.match(page, /<input id=\{TERMS_BOX_ID\} name=\{TERMS_FIELD\}/, 'the gate must name THIS box');
  assert.doesNotMatch(page, /<OAuthTermsLine/, 'the "By continuing…" line is browsewrap — the box above is the agreement');
  const tag = page.match(/<input id=\{TERMS_BOX_ID\}[^>]*>/)?.[0] ?? '';
  assert.doesNotMatch(tag, /data-password-only/, 'the box must never fold away with the password half — it covers Google too');
  // Inside the form now, so its LABEL must not fold away either (`GoogleAddressDoor` hides every `[data-password-only]`).
  const label = page.match(/<label htmlFor=\{TERMS_BOX_ID\}[^>]*>/)?.[0] ?? '';
  assert.ok(label, 'the box has lost its label — the label is the 44 px press');
  assert.doesNotMatch(label, /data-password-only/, 'the Terms row must never fold away with the password half');
});

// SABOTAGE: let the gate carry before checking `box.checked` → RED.
test('the gate refuses an unticked box before it carries anything', () => {
  const gate = code('app/_components/auth/terms-first.tsx');
  const check = gate.indexOf('if (!box.checked)');
  const carry = gate.indexOf('carrySignupTerms(');
  assert.ok(check > 0 && carry > check, 'the tick is carried only after the box is read as ticked');
  assert.match(gate, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);/, 'an unticked press must go nowhere');
});

// SABOTAGE: delete the `hasAgreedToTerms` check from the carry action → RED.
test('the carry is set by the server, from an affirmative tick, and nothing else', () => {
  const action = code('app/auth/terms-carry-action.ts');
  assert.match(action, /^'use server';/, 'a server action — a page cannot set an httpOnly cookie, and must not');
  const gate = action.indexOf('if (!hasAgreedToTerms(formData.get(TERMS_FIELD)))');
  const set = action.indexOf('jar.set(SIGNUP_TERMS_COOKIE, TERMS_VERSION');
  assert.ok(gate > 0 && set > gate, 'the cookie is set only past the fail-closed tick check');
  assert.match(action, /jar\.set\(SIGNUP_TERMS_COOKIE, TERMS_VERSION, \{\s*httpOnly: true/, 'readable by the page = forgeable by the page');
});

// SABOTAGE: drop `.is('terms_accepted_at', null)` from the callback write → RED.
test('the callback records the carried tick, never over an earlier one, and spends it', () => {
  const cb = code('app/auth/callback/route.ts');
  assert.match(cb, /signupCookie: request\.cookies\.get\(SIGNUP_TERMS_COOKIE\)\?\.value/, 'the callback does not read the sign-up tick');
  assert.match(
    cb,
    /update\(\{ terms_accepted_at: new Date\(\)\.toISOString\(\), terms_version: TERMS_VERSION \}\)\s*\.eq\('user_id', userId\)\s*\.is\('terms_accepted_at', null\)/,
    'an agreement on record is never rewritten',
  );
  assert.match(cb, /res\.cookies\.set\(SIGNUP_TERMS_COOKIE, '', \{ path: SIGNUP_TERMS_COOKIE_PATH, maxAge: 0 \}\)/, 'the tick is one round trip — spent');
  assert.match(cb, /return spendSignupTerms\(spend\(NextResponse\.redirect\(new URL\(landing, url\.origin\)\)\)\);/);
  assert.doesNotMatch(cb, /searchParams\.get\('(terms|state)'\)/, 'a URL parameter is a claim, not a tick');
});

// SABOTAGE: record on the desktop loopback without `opts.agreed` → RED.
test('the desktop loopback (no callback) records the tick itself, only when ticked', () => {
  const desk = code('lib/desktop-oauth.ts');
  assert.match(desk, /if \(opts\.agreed\) \{[\s\S]{0,400}await acceptTermsNow\(fd\)/, 'the desktop door records only a tick');
  const btns = code('app/_components/desktop-oauth-buttons.tsx');
  assert.match(btns, /const agreed = box instanceof HTMLInputElement && box\.checked;/);
});

// SABOTAGE: import TermsFirst / carrySignupTerms into lib/native-oauth.ts → RED.
test('the phone app’s own Google / Apple code is untouched by the tick', () => {
  for (const f of ['lib/native-oauth.ts', 'app/_components/native-oauth-buttons.tsx']) {
    assert.doesNotMatch(code(f), /terms|Terms/, `${f} learned about the Terms — the native sheet is in App Review; gate it from outside`);
  }
});
