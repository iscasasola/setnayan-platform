/**
 * invitation-reach.test.ts — CTRL-B4 build 3, executed rather than grepped.
 * 🛡 Mutation-checked; sabotages listed per test, all confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationReach, unreachableSentence, isReachable, hasEmailAddress } from '@/lib/invitation-reach';

const g = (o: Partial<{ email: string | null; mobile: string | null; invitation_sent_at: string | null }>) => ({
  email: null, mobile: null, invitation_sent_at: null, ...o,
});

// SABOTAGE: count unreachable only among the UNMARKED → RED.
test('the production shape: 146 guests, 5 addresses, nobody marked', () => {
  const list = [
    ...Array.from({ length: 5 }, () => g({ email: 'a@b.test' })),
    ...Array.from({ length: 141 }, () => g({})),
  ];
  const r = invitationReach(list);
  assert.equal(r.total, 146);
  assert.equal(r.marked, 0);
  assert.equal(r.remaining, 146);
  assert.equal(r.sendable, 5, 'only the five with an address can be sent anything');
  assert.equal(r.unreachable, 141, 'this is the number that turns "nothing happened" into an action');
});

// SABOTAGE: drop the whitespace trim → RED.
test('a whitespace-only address reaches nobody', () => {
  assert.equal(hasEmailAddress(g({ email: '   ' })), false);
  assert.equal(isReachable(g({ email: '  ', mobile: '\t' })), false);
  assert.equal(invitationReach([g({ email: ' ' })]).unreachable, 1);
});

// SABOTAGE: exclude marked guests from `unreachable` → RED.
test('marking a guest does not make them reachable', () => {
  const r = invitationReach([g({ invitation_sent_at: '2026-01-01T00:00:00Z' })]);
  assert.equal(r.marked, 1);
  assert.equal(
    r.unreachable,
    1,
    'a guest handed a printed card is still unreachable electronically — hiding that would make the number fall for the wrong reason',
  );
  assert.equal(r.sendable, 0, 'an already-marked guest is not in the send set');
});

// SABOTAGE: return a sentence when unreachable is 0 → RED.
test('the sentence appears only when it has something to say', () => {
  assert.equal(unreachableSentence(invitationReach([g({ email: 'a@b.test' })])), null);
  const all = unreachableSentence(invitationReach([g({}), g({})]));
  assert.match(String(all), /None of your 2 guests/, 'all-unreachable gets its own wording');
  const some = unreachableSentence(invitationReach([g({ email: 'a@b.test' }), g({})]));
  assert.match(String(some), /1 of 2/, 'the partial case names both numbers');
});

test('an empty list is answerable, not a crash', () => {
  const r = invitationReach([]);
  assert.deepEqual(r, { total: 0, marked: 0, remaining: 0, sendable: 0, unreachable: 0 });
  assert.equal(unreachableSentence(r), null);
});
