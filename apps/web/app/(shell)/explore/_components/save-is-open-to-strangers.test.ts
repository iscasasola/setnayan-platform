/**
 * GUARD — a visitor who has just found a supplier can keep them.
 *
 * Owner, 2026-08-13, asked whether a stranger should be able to save a
 * supplier: **"show it."**
 *
 * WHAT IT USED TO DO. The marketplace card rendered Save only when
 * `bookable && isAuthenticated && eventId`, and the comparison table passed
 * `canSave={user !== null && coupleEventId !== null}`. So the one person most
 * likely to want to keep a supplier — someone who has just found one and has
 * no account yet — was the one person who could not see the button. We asked
 * for the account before giving anybody a reason to want one.
 *
 * 🔑 THIS FAILS SILENTLY IF IT REGRESSES. Re-adding an auth condition to
 * either call site does not error, does not warn, and looks like tightening a
 * permission. Every signed-in developer keeps seeing the button, so nobody
 * notices it vanished for everyone else. Exactly the shape of defect this repo
 * keeps paying for: the guard has to be the thing that looks.
 *
 * 🛡 Mutation-tested — each rule broken on purpose, occurrence count printed
 * before and after, confirmed RED, before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPLORE = resolve(HERE, '..');

/** Strip comments — this file's own explanations quote the retired conditions. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ');
}

const CARD = code(readFileSync(join(HERE, 'vendor-card.tsx'), 'utf8'));
const COMPARE = code(readFileSync(join(EXPLORE, 'compare', 'page.tsx'), 'utf8'));
const BUTTON = code(readFileSync(join(HERE, 'save-vendor-button.tsx'), 'utf8'));

/** The JSX condition guarding <SaveVendorButton> at a call site, if any. */
function gateBefore(src: string): string {
  const at = src.indexOf('<SaveVendorButton');
  assert.notEqual(at, -1, 'SaveVendorButton is not rendered here any more.');
  // Look back to the start of the enclosing JSX expression.
  const open = src.lastIndexOf('{', at);
  return src.slice(open, at);
}

test('the marketplace card offers Save to a signed-out visitor', () => {
  const gate = gateBefore(CARD);
  assert.doesNotMatch(
    gate,
    /isAuthenticated|\buser\b|signedIn|eventId/,
    'Save on the marketplace card must not be gated on being signed in or ' +
      'having an event. A stranger who just found a supplier is exactly who ' +
      'this button is for; pressing it opens the sign-in over the page.',
  );
  assert.match(
    gate,
    /bookable/,
    'It IS still gated on `bookable` — a supplier finishing verification ' +
      'cannot be saved by anyone, and offering it would be a fake door.',
  );
});

test('the comparison table agrees with the card', () => {
  const gate = gateBefore(COMPARE);
  assert.doesNotMatch(
    gate,
    /isAuthenticated|user !== null|coupleEventId/,
    'Showing Save on the grid and hiding it in the comparison is the kind of ' +
      'split that reads as a bug.',
  );
});

test('no call site passes the retired canSave prop', () => {
  for (const [name, src] of [['card', CARD], ['compare', COMPARE], ['button', BUTTON]] as const) {
    assert.doesNotMatch(
      src,
      /canSave/,
      `${name} still references canSave. It meant "the viewer can save right ` +
        'now" and was false for every signed-out visitor; a prop every caller ' +
        'answers the same way is not a choice.',
    );
  }
});

test('pressing Save signed out opens the sign-in over the page, and retries the save', () => {
  assert.match(
    BUTTON,
    /openSignIn\(\{\s*onSignedIn:\s*attemptSave\s*\}\)/,
    'A signed-out press must open the in-place panel AND hand it the retry — ' +
      'one press should mean one save, not a press, a round trip, and having ' +
      'to remember to press again.',
  );
  assert.doesNotMatch(
    BUTTON,
    /window\.location\.href\s*=/,
    'It must not navigate away — the supplier they were looking at is the ' +
      'whole reason they pressed it.',
  );
});

test('a brand-new account is offered a way forward, not a dead end', () => {
  // Signing in is not the end of the journey: a fresh account has no event, so
  // the action refuses. That state must be a doorway.
  assert.match(
    BUTTON,
    /needs_event/,
    'The no-event case must be its own state, not folded into `error`.',
  );
  assert.match(
    BUTTON,
    /href="\/dashboard"/,
    'It must offer a real way to start an event. Ending on the sentence ' +
      '"Create an event first" leaves the person who just did everything we ' +
      'asked with no button.',
  );
});
