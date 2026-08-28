/**
 * sign-in-landing.test.ts — signing in with nowhere to go back to lands on
 * Events, through all three doors, and the shared panel is not one of them.
 *
 * ─── WHY THIS IS A SOURCE GUARD AND NOT ONLY A PURE ONE ────────────────────
 * 🔑 TESTING THE RULE IS NOT TESTING THE CALLERS. `signInDestination` is four
 * characters of logic; the defect this file exists to catch is a door that
 * stops calling it. That is exactly how `/login` and `/auth/callback` came to
 * disagree once already — `DECISION_LOG.md` 2026-08-13 records the identical
 * line living in both files and warns that fixing one leaves Google sign-in
 * answering differently from password sign-in.
 *
 * Every source assertion runs over `stripComments` output and is anchored to
 * the CALL, never to a bare identifier — this module is NAMED in four comments
 * in those same files, so an unstripped match would pass with the call deleted.
 * Each was mutation-checked with the occurrence count printed before → after:
 *
 *   signInDestination( in login/actions.ts        1 → 0   RED
 *   signInDestination( in auth/callback/route.ts  1 → 0   RED
 *   openSignIn({ onSignedIn … SIGNED_IN_LANDING }) 1 → 0  RED
 *   the customer nav entry's own label renamed     1 → 0  RED
 *   the rule itself gutted to `return raw`         1 → 0  RED
 *
 * ─── WHAT THIS FILE DELIBERATELY DOES NOT ASSERT ───────────────────────────
 * ⛔ THAT THE SHARED PANEL NEVER NAVIGATES — `seam-invariants.test.ts`
 * ("the panel stays put on success — refresh, never push") already holds it,
 * and a second copy of a rule is this repo's most-paid-for defect shape. It is
 * named here because it is the reason the front door passes `onSignedIn`
 * instead of the shorter fix: `SignInHerePanel` is opened from shop pages and
 * guest flows to sign somebody in WITHOUT losing what they were doing, so a
 * push inside the panel would silently break every other caller.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { SIGNED_IN_LANDING, signInDestination } from '@/lib/sign-in-landing';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', 'app');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

test('the bare front door becomes the Events board', () => {
  assert.equal(SIGNED_IN_LANDING, '/dashboard');
  assert.equal(signInDestination('/'), '/dashboard');
});

test('a real destination is always honoured, exactly as given', () => {
  // Somebody sent to sign in FROM a page is owed that page back — this is the
  // half of the 2026-08-13 decision that is deliberately not reversed.
  for (const next of [
    '/vendors?q=cake',
    '/dashboard/abc/guests',
    '/open-shop',
    '/maria-and-jose',
    '/dashboard',
  ]) {
    assert.equal(signInDestination(next), next, `${next} must come back whole`);
  }
});

test('the password door resolves its destination through the shared rule', () => {
  const src = read(resolve(APP, 'login', 'actions.ts'));
  assert.equal(
    count(src, 'signInDestination('),
    1,
    'app/login/actions.ts must call signInDestination exactly once — a hand-' +
      'written `rawNext === "/"` here is the second answer to one question.',
  );
  assert.match(
    src,
    /const destination = signInDestination\(/,
    'The success destination is what goes through the rule.',
  );
});

test('the OAuth / magic-link door resolves it the same way', () => {
  const src = read(resolve(APP, 'auth', 'callback', 'route.ts'));
  assert.equal(
    count(src, 'signInDestination('),
    1,
    'app/auth/callback/route.ts must call signInDestination — otherwise ' +
      'Google sign-in and password sign-in land in different places.',
  );
});

test('the front door asks the panel to leave for Events', () => {
  const src = read(
    resolve(APP, '_components', 'frontdoor', 'front-door-shell.tsx'),
  );
  assert.match(
    src,
    /openSignIn\(\{\s*onSignedIn:[^}]*SIGNED_IN_LANDING/,
    'The front door must hand the panel an onSignedIn that pushes to the ' +
      'Events board. Without it the person signs in and stays on the front ' +
      'door, which is what the owner asked to change on 2026-08-28.',
  );
});

test('the menu entry says Events, without claiming they are all yours', () => {
  const src = read(resolve(HERE, 'nav-registry-defaults.ts'));
  assert.match(
    src,
    /key: "customer\.account\.events",[\s\S]{0,200}?label: "Events",/,
    'The customer events nav entry must read "Events".',
  );
  assert.equal(
    count(src, '"My Events"'),
    0,
    'Owner 2026-08-28: "remove My since event events of other people that you ' +
      'are invited will be here". The board carries invited celebrations too.',
  );
});
