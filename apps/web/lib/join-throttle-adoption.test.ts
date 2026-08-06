/**
 * The join-door throttle is ACTUALLY IN FORCE, not merely built.
 *
 * 🔑 Why this test exists, and it is the whole point: PR #4160 built the
 * throttle, tested it thoroughly, watched every guard go red — and shipped it
 * DARK. The file that mints a guest identity was owned by another open PR at
 * the time, so nothing called the helper. Green CI, real tests, zero protection.
 * A reviewer caught it; the builder had said so honestly in its own summary and
 * it would still have been easy to read the PR as "done".
 *
 * A guard that is not CALLED is not a guard. This test asserts the call site,
 * because no test of the helper itself can tell you whether anyone uses it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ACTIONS = 'app/join/[eventId]/actions.ts';
const src = () => fs.readFileSync(ACTIONS, 'utf8');

/** The body of selfJoinAction — the function that mints a guest identity. */
function selfJoinBody(): string {
  const s = src();
  const start = s.indexOf('export async function selfJoinAction');
  assert.ok(start > -1, 'selfJoinAction not found');
  const next = s.indexOf('\nexport ', start + 10);
  return s.slice(start, next === -1 ? undefined : next);
}

test('the mint path CALLS the throttle — not just imports it', () => {
  assert.match(src(), /import \{ allowGuestSelfJoinAttempt \}/, 'helper must be imported');
  assert.match(
    selfJoinBody(),
    /allowGuestSelfJoinAttempt\(\s*eventId\s*,/,
    'selfJoinAction must consume a throttle slot, keyed on the event',
  );
});

test('a throttled caller is REFUSED, not merely logged', () => {
  const body = selfJoinBody();
  assert.match(body, /if \(!throttle\.allowed\)/, 'the decision must be acted on');
  assert.match(body, /too_many_attempts/, 'a refused caller needs an error the page can render');
  // The refusal must come back before anything is written.
  const refusal = body.indexOf('too_many_attempts');
  const insert = body.indexOf(".from('guests')");
  assert.ok(refusal > -1, 'no refusal found');
  if (insert > -1) {
    assert.ok(refusal < insert, 'the throttle must refuse BEFORE any guest row is written');
  }
});

test('the throttle sits AFTER token validation, so junk cannot spend a real budget', () => {
  const body = selfJoinBody();
  const tokenGate = body.indexOf('invalid_token');
  const throttleCall = body.indexOf('allowGuestSelfJoinAttempt');
  assert.ok(tokenGate > -1 && throttleCall > -1);
  assert.ok(
    tokenGate < throttleCall,
    'validate the token first — otherwise anyone can exhaust a real event\'s budget with garbage',
  );
});

test('the CONSUMING check is used at the mint, and the peek is not', () => {
  const body = selfJoinBody();
  assert.doesNotMatch(
    body,
    /guestSelfJoinDoorIsThrottled/,
    'the mint must consume a slot; the non-consuming peek is for rendering only',
  );
});
