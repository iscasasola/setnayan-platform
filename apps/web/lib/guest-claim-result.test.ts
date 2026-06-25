/**
 * Unit suite for newGuestIsOrphaned — the concurrency predicate that decides
 * whether a guest row minted during claim approval must be cleaned up because a
 * racing approve finalized the claim first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGuestIsOrphaned } from './guest-claim-result';

test('a successfully-bound new guest is NOT an orphan', () => {
  assert.equal(newGuestIsOrphaned({ linked: true, already: false, guest_id: 'g1' }), false);
});

test('already-confirmed (a racing approve won) → orphan', () => {
  assert.equal(
    newGuestIsOrphaned({ linked: true, already: true, reason: 'already_confirmed', guest_id: 'g1' }),
    true,
  );
});

test('finalize declined (linked:false) → orphan', () => {
  assert.equal(newGuestIsOrphaned({ linked: false, reason: 'claim_not_found' }), true);
  assert.equal(newGuestIsOrphaned({ linked: false, reason: 'guest_already_claimed' }), true);
});

test('null / undefined RPC result is AMBIGUOUS → never an orphan (never risk deleting a bound guest)', () => {
  assert.equal(newGuestIsOrphaned(null), false);
  assert.equal(newGuestIsOrphaned(undefined), false);
});

test('a malformed result missing linked is treated as not-bound → orphan', () => {
  assert.equal(newGuestIsOrphaned({ reason: 'weird' }), true);
});
