/**
 * B1(b) — the join door must name the REAL reason it turned someone away.
 *
 * Asserts the PROPERTY: `event_is_private` and `invalid_token` must never
 * resolve to the same sentence, and the private sentence must never say the
 * link/token is invalid — a reword that keeps "no longer valid" wording on
 * the private branch fails this test even if the code key is right.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  joinDoorRefusalMessage,
  joinDoorRefusalMessages,
} from './join-door-refusal-copy';

const COUPLE = { theOrganizer: 'the couple' };
const FAMILY = { theOrganizer: 'the family' };

test('event_is_private and invalid_token are different sentences', () => {
  const messages = joinDoorRefusalMessages(COUPLE);
  assert.notEqual(messages.event_is_private, messages.invalid_token);
});

test('the private-event sentence never claims the link/token is invalid', () => {
  const msg = joinDoorRefusalMessage('event_is_private', COUPLE);
  assert.ok(msg);
  const lower = msg!.toLowerCase();
  assert.equal(lower.includes('no longer valid'), false, `"${msg}" still blames the link`);
  assert.equal(lower.includes('invalid'), false, `"${msg}" still blames the link`);
  // And it DOES say what's actually true.
  assert.equal(lower.includes('private'), true);
});

test('invalid_token keeps its original "ask for a fresh one" sentence', () => {
  const msg = joinDoorRefusalMessage('invalid_token', COUPLE);
  assert.ok(msg);
  assert.match(msg!, /no longer valid/);
  assert.match(msg!, /fresh one/);
});

test('every sentence uses the event\'s own word for the organizer, no "host" fallback', () => {
  const familyMsg = joinDoorRefusalMessage('event_is_private', FAMILY);
  assert.match(familyMsg!, /the family/);
  assert.equal(familyMsg!.includes('the host'), false);
});

test('an unrecognised key echoes itself back (matches the previous inline fallback)', () => {
  assert.equal(joinDoorRefusalMessage('some_future_code', COUPLE), 'some_future_code');
});

test('a null key resolves to no message', () => {
  assert.equal(joinDoorRefusalMessage(null, COUPLE), null);
});

// 🛑 THE REGRESSION THIS TEST HOLDS: before this fix, actions.ts redirected a
// private event through the SAME `invalid_token` code as a dead token, so
// both a real dead link and a private event rendered this exact sentence.
test('regression: the pre-fix behaviour (private event mapped to invalid_token) reads wrong', () => {
  const preFixMessage = joinDoorRefusalMessage('invalid_token', COUPLE); // what a private event used to get
  assert.match(preFixMessage!, /no longer valid/); // provably the wrong sentence for "this event is private"
});
