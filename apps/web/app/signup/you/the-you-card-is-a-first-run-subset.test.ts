/**
 * GUARD — the "You" card (owner 2026-09-22: "small card for signup") is a
 * first-run SUBSET of the profile page, reached right after the account exists,
 * and every door into it and out of it is the one the plan names.
 *
 * Source-read guards, because the page and the action are server code that
 * ends in redirect(); the DECISIONS are executed by lib/signup-landing.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMAL_NAME_FIELDS } from '@/lib/formal-name';
import { PRESENCE_MARKERS } from '@/lib/profile-personal-info-patch';
import { stripComments } from '@/lib/strip-comments';

const strip = stripComments;
const PAGE = strip(readFileSync('app/signup/you/page.tsx', 'utf8'));
const ACTIONS = strip(readFileSync('app/signup/you/actions.ts', 'utf8'));
const FIELD = strip(readFileSync('app/signup/you/_components/account-name-field.tsx', 'utf8'));
const SIGNUP_ACTIONS = strip(readFileSync('app/signup/actions.ts', 'utf8'));
const CALLBACK = strip(readFileSync('app/auth/callback/route.ts', 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) || []).length;

test('the card posts to saveYou, and nothing else', () => {
  assert.equal(count(PAGE, /<form\b[^>]*action=\{saveYou\}/), 1);
  assert.equal(count(PAGE, /<form\b/), 1, 'a second form on the card would post to something else');
});

test('every field the card writes is on the form, by the profile page’s own names', () => {
  const posted = new Set([...PAGE.matchAll(/\bname=(?:"([^"]+)"|\{([^}]+)\})/g)].map((m) => m[1] ?? m[2]));
  for (const n of ['display_name', 'phone', 'profile_photo_url', 'next', 'public_summary_consent']) {
    assert.ok(posted.has(n), `${n} is not posted by the You card`);
  }
  // the formal name renders from the SAME list the profile page uses
  assert.ok(posted.has('f'), 'the formal-name parts must render from FORMAL_NAME_FIELDS (name={f})');
  assert.ok(FORMAL_NAME_FIELDS.length === 5);
  // the photo presence marker rides with the photo control
  assert.ok(posted.has('PRESENCE_MARKERS.profile_photo_url'), 'the photo needs its presence marker');
  assert.equal(PRESENCE_MARKERS.profile_photo_url, 'has_profile_photo_url');
  // the @name posts from the client field, as `slug`, like the profile page's editor
  assert.match(FIELD, /name="slug"/);
});

test('the @name field renders ONLY while the account has none — renames stay on the profile page', () => {
  assert.match(PAGE, /\{currentSlug === null \? \(\s*<AccountNameField/);
  assert.match(PAGE, /Privacy › Public profile/, 'an account with an @name is pointed at the one rename path');
  // and the action never writes a slug over an existing one
  assert.match(ACTIONS, /planYouCard\(formData, \{\s*slug:/);
});

test('the showcase consent is a checkbox, couples only, unticked (interim home — build 2 moves it per event)', () => {
  const tag = /<input\b[^>]*name="public_summary_consent"[^>]*>/.exec(PAGE)?.[0] ?? '';
  assert.ok(tag, 'no consent checkbox on the You card');
  assert.match(tag, /type="checkbox"/);
  assert.doesNotMatch(tag, /defaultChecked|checked=\{true\}/, 'it must start unticked');
  assert.match(PAGE, /\{asksConsent \? \(/, 'the consent block must be gated');
  assert.match(PAGE, /me\.account_type !== 'vendor' && !me\.public_summary_consent_at/, 'couples only, and only while unanswered');
  assert.doesNotMatch(PAGE, /my wedding/i, 'the sentence must not assume a wedding — 17 event types (owner 2026-09-22)');
});

test('a signed-out visitor is sent to /signup, and Later goes exactly where Done goes', () => {
  assert.match(PAGE, /if \(!user\) redirect\(`\/signup\?next=\$\{encodeURIComponent\(next\)\}`\)/);
  assert.match(PAGE, /<Link href=\{next\}[^>]*>\s*Later/);
  assert.match(ACTIONS, /redirect\(next\);\s*\}\s*$/m, 'Done lands on `next` after the write');
});

test('the availability check fails CLOSED — an errored probe never reads as available', () => {
  assert.match(ACTIONS, /catch \{\s*return \{ state: 'unknown', slug \};/);
  assert.match(ACTIONS, /if \(conflict === 'unverified'\) return \{ state: 'unknown', slug \};/);
  assert.match(FIELD, /Could not check right now/, 'the person is told the check did not run');
  assert.match(FIELD, /Checking…/, 'the in-flight moment is shown, not skipped');
});

test('both doors into the card go through lib/signup-landing — one rule, one place', () => {
  // `fromEvent` joined 2026-09-25: a guest signing up FROM AN INVITATION skips
  // the card and goes back to it (owner "1. yes"; lib/signup-landing.ts). The
  // rule still lives in one place — the helper decides, the action only asks.
  assert.match(SIGNUP_ACTIONS, /redirect\(signupLanding\(\{ accountType, next, fromEvent \}\)\)/, '/signup’s action');
  assert.match(CALLBACK, /landing = youHref\(fallbackNext\)/, 'the OAuth callback');
  // …and not one arriving from an invitation (the event-connect return).
  assert.match(
    CALLBACK,
    /accountType === 'customer' &&\s*!isEventConnectNext\(fallbackNext\) &&\s*isBrandNewAccount\(/,
    'only a brand-new CUSTOMER from outside an invitation meets the card',
  );
  assert.match(CALLBACK, /NextResponse\.redirect\(new URL\(landing, url\.origin\)\)/, 'and the final redirect uses it');
  assert.doesNotMatch(SIGNUP_ACTIONS, /'\/signup\/you'/, 'no second copy of the path in the action');
});
