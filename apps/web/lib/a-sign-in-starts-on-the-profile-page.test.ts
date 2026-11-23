/**
 * 🏠 A SIGN-IN STARTS ON THE PERSON'S PROFILE PAGE — EVERY DOOR, EVERY ACCOUNT TYPE.
 *
 * Owner, 22 Nov 2026, verbatim: *"when i log in. don't start on discovery. start on their profile page"*.
 * The profile page is Home (DECISION_LOG 2026-11-11 "ONE PROFILE PAGE v2 APPROVED: IT IS CALLED HOME", "HOME PAGE v3
 * APPROVED": a supplier's Home opens on Shop). A coordinator is a supplier account (`account_type` is only
 * customer · vendor · admin), so the supplier row covers both.
 *
 * Measured before this guard: the shell's Sign in link opens the in-place panel with no `onSignedIn`, so a password
 * sign-in from the front door REFRESHED `/` — Discover; and an email link with no destination of its own left a
 * non-supplier on `/`. The OAuth callback and the whole-page /login route already went to `/dashboard`, which is not
 * always Home either: its single-event auto-jump and empty-console bounce carry a person off it without `?hub=1`.
 *
 * WHAT IS HELD, door by door, for a sign-in that names no destination (`next` = `/`):
 *   · the rule (`landingForAccount`) — customer / admin / unknown → Home `?hub=1`; vendor → Home `?seg=shop`;
 *     never `/`; a named `next` is honoured exactly, for every account type;
 *   · password, whole page (`signInWithPassword`) — its destination is the rule WITH the account type;
 *   · password, in place (`signInInPlace` → the panel) — hands back `landing` only for `/`, and the panel goes there;
 *   · Google / Apple / magic link (`/auth/callback`) — every account type, not only a supplier;
 *   · the any-device email link (`/auth/confirm`) — the rule with the account type.
 *
 * SABOTAGE (run 22 Nov 2026, each RED, then restored):
 *   · `landingForAccount` returning `next` unchanged for a customer           → rule test RED (`/` ≠ Home)
 *   · callback condition put back to `rawNext === '/' && accountType === 'vendor'` → OAuth door test RED
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { landingForAccount } from '@/lib/auth-confirm-link';
import { SIGNED_IN_LANDING, signInDestination } from '@/lib/sign-in-landing';
import { homeSegHref } from '@/lib/home-segments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', 'app');
const read = (p: string) => {
  const raw = readFileSync(resolve(APP, p), 'utf8');
  assert.ok(raw.length > 500, `${p} is missing or a stub — a guard pointed at the wrong file passes forever.`);
  return stripComments(raw);
};

const HOME = homeSegHref('events');
const HOME_ON_SHOP = homeSegHref('shop');
const EXPECTED: ReadonlyArray<readonly [string | null, string]> = [
  ['customer', HOME],
  ['admin', HOME],
  [null, HOME],
  ['vendor', HOME_ON_SHOP],
];
const NAMED = ['/v/saysay', '/maria-and-jose/invite', '/dashboard/abc/guests?tab=rsvp', '/open-shop', '/vendors?q=cake'];

test('the profile page is Home, and it is Home’s own address — never Discover', () => {
  assert.equal(HOME, '/dashboard?hub=1');
  assert.equal(HOME_ON_SHOP, '/dashboard?seg=shop');
  assert.equal(SIGNED_IN_LANDING, HOME, 'the front door falls back to Home');
});

test('the rule: `/` lands every account type on its profile page; a named `next` is honoured exactly', () => {
  for (const [type, want] of EXPECTED) {
    assert.equal(landingForAccount('/', type), want, `${type} with no next must land on ${want}`);
    assert.equal(signInDestination('/', type), want, `signInDestination is the same rule for ${type}`);
    assert.notEqual(landingForAccount('/', type), '/', `${type} must never start on Discover`);
    for (const next of NAMED) {
      assert.equal(landingForAccount(next, type), next, `${type}: next=${next} must come back whole`);
      assert.equal(signInDestination(next, type), next, `${type}: next=${next} must come back whole`);
    }
  }
});

test('password, whole page: the destination is the rule WITH the account type, read only for `/`', () => {
  const src = read('login/actions.ts');
  const fn = src.slice(src.indexOf('async function exchangeCredentials'), src.indexOf('export async function signInWithPassword'));
  assert.match(fn, /if \(rawNext === '\/'\) \{[\s\S]*?from\('users'\)\.select\('account_type'\)/, 'the account type is read for a `/` sign-in');
  assert.match(fn, /const destination = signInDestination\(rawNext, accountType\);/, 'the destination must carry the account type');
  const route = src.slice(src.indexOf('export async function signInWithPassword'));
  assert.match(route, /return redirect\(result\.destination\);/);
});

test('password, in place: `landing` is handed back only for `/`, and the panel goes there', () => {
  const actions = read('login/actions.ts');
  const inPlace = actions.slice(actions.indexOf('export async function signInInPlace'));
  assert.match(inPlace, /const landing = safeNext\(formData\.get\('next'\)\) === '\/' \? result\.destination : null;/);
  assert.match(inPlace, /ok: true, resetSent: false, attempt, landing \}/);

  const card = read('login/_components/sign-in-card.tsx');
  assert.match(card, /onSignedIn\(state\.landing \?\? null\)/, 'the card must pass the landing on');

  const panel = read('_components/auth/sign-in-here-panel.tsx');
  assert.match(panel, /else if \(landing\) \{\s*router\.push\(landing\);/, 'the panel must go to the landing when it has one');

  const front = read('_components/frontdoor/front-door-shell.tsx');
  assert.match(front, /onSignedIn: \(landing\) => router\.push\(landing \?\? SIGNED_IN_LANDING\)/, 'the front door must use the handed landing');
});

test('Google / Apple / magic link: every account type with no `next` goes through the rule, not only a supplier', () => {
  const src = read('auth/callback/route.ts');
  assert.match(src, /if \(rawNext === '\/'\) landing = landingForAccount\(rawNext, accountType\);/);
  assert.doesNotMatch(src, /rawNext === '\/' && accountType === 'vendor'/, 'the `/` landing is for every account type');
  assert.match(src, /NextResponse\.redirect\(new URL\(landing, url\.origin\)\)/, 'the success exit must use `landing`');
});

test('the any-device email link: the rule with the account type', () => {
  const src = read('auth/confirm/route.ts');
  assert.match(src, /if \(next === '\/'\) \{[\s\S]*?from\('users'\)\.select\('account_type'\)/);
  assert.match(src, /NextResponse\.redirect\(new URL\(landingForAccount\(next, accountType\), url\.origin\)\)/);
});
