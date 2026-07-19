/**
 * Unit suite for the pure optimistic-update + undo layer (Living Roster · P1).
 *
 * Load-bearing invariants proven here (no browser needed):
 *  1. apply → project hides a deleted row and patches a field-set row.
 *  2. reconcile-by-id is idempotent and prunes the overlay ONLY once the server
 *     has caught up — the "don't flip a row twice" guardrail.
 *  3. buildUndo of a soft-delete carries the RELEASED SEATS, so restoring a
 *     guest re-places them on the same table/chair (the seat-release round-trip).
 *  4. buildUndo of a field-set recovers each guest's PRIOR value.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_OPTIMISTIC,
  applyMutation,
  clearMutation,
  projectGuests,
  reconcile,
  buildUndo,
  type GuestMutation,
  type ReleasedSeat,
} from './guest-optimistic';

type Row = {
  guest_id: string;
  side: 'bride' | 'groom' | 'both';
  role: 'guest' | 'bride' | 'groom';
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
};

function row(id: string, over: Partial<Row> = {}): Row {
  return { guest_id: id, side: 'both', role: 'guest', rsvp_status: 'pending', ...over };
}

const SERVER: Row[] = [row('a'), row('b', { side: 'bride' }), row('c', { side: 'groom' })];

// ── apply + project ─────────────────────────────────────────────────────────

test('remove: project hides the removed guests, keeps the rest', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a', 'c'] });
  const shown = projectGuests(SERVER, state).map((g) => g.guest_id);
  assert.deepEqual(shown, ['b']);
});

test('remove: applying is a fresh object (does not mutate the input state)', () => {
  const next = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a'] });
  assert.notEqual(next, EMPTY_OPTIMISTIC);
  assert.equal(EMPTY_OPTIMISTIC.removedIds.size, 0, 'input state untouched');
  assert.equal(next.removedIds.has('a'), true);
});

test('setField: project patches the field by id, others unchanged', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, {
    kind: 'setField',
    guestIds: ['b'],
    override: { side: 'both' },
  });
  const projected = projectGuests(SERVER, state);
  assert.equal(projected.find((g) => g.guest_id === 'b')?.side, 'both');
  assert.equal(projected.find((g) => g.guest_id === 'c')?.side, 'groom');
  // Original server row object is not mutated in place.
  assert.equal(SERVER[1]!.side, 'bride');
});

test('clearMutation: undoes an applied remove', () => {
  const applied = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a'] });
  const cleared = clearMutation(applied, { kind: 'remove', guestIds: ['a'] });
  assert.equal(cleared.removedIds.has('a'), false);
  assert.deepEqual(projectGuests(SERVER, cleared).map((g) => g.guest_id), ['a', 'b', 'c']);
});

// ── reconcile-by-id (the "don't flip twice" guardrail) ──────────────────────

test('reconcile: keeps a removedId while the server still shows it (delete not landed)', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a'] });
  const reconciled = reconcile(SERVER, state); // 'a' still present server-side
  assert.equal(reconciled.removedIds.has('a'), true, 'stays hidden until server catches up');
  assert.deepEqual(projectGuests(SERVER, reconciled).map((g) => g.guest_id), ['b', 'c']);
});

test('reconcile: drops a removedId once the server no longer lists it (delete landed)', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a'] });
  const serverAfter = SERVER.filter((g) => g.guest_id !== 'a'); // soft-delete propagated
  const reconciled = reconcile(serverAfter, state);
  assert.equal(reconciled.removedIds.has('a'), false, 'overlay pruned');
  // Row is STILL gone (absent from server list) — no re-appear/flip.
  assert.deepEqual(projectGuests(serverAfter, reconciled).map((g) => g.guest_id), ['b', 'c']);
});

test('reconcile: is idempotent', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['a'] });
  const serverAfter = SERVER.filter((g) => g.guest_id !== 'a');
  const once = reconcile(serverAfter, state);
  const twice = reconcile(serverAfter, once);
  assert.equal(twice, once, 'no-op the second time (same reference back)');
});

test('reconcile: drops a field override once the server value matches it', () => {
  const state = applyMutation(EMPTY_OPTIMISTIC, {
    kind: 'setField',
    guestIds: ['b'],
    override: { side: 'both' },
  });
  // still pending (server 'b' is 'bride')
  assert.equal(reconcile(SERVER, state).overrides.has('b'), true);
  // server caught up
  const serverAfter = SERVER.map((g) => (g.guest_id === 'b' ? { ...g, side: 'both' as const } : g));
  assert.equal(reconcile(serverAfter, state).overrides.has('b'), false);
});

// ── buildUndo — seat-restore round-trip ─────────────────────────────────────

test('buildUndo(remove): restore plan carries the released seats for those guests', () => {
  const mutation: GuestMutation = { kind: 'remove', guestIds: ['a', 'c'] };
  const releasedSeats: ReleasedSeat[] = [
    { guest_id: 'a', table_id: 'T1', seat_number: 3, locked: false },
    { guest_id: 'c', table_id: 'T2', seat_number: null, locked: true },
    { guest_id: 'z', table_id: 'T9', seat_number: 1, locked: false }, // unrelated
  ];
  const plan = buildUndo(mutation, [row('a'), row('c')], releasedSeats);
  assert.equal(plan.kind, 'restore');
  if (plan.kind !== 'restore') return;
  assert.deepEqual(plan.guestIds, ['a', 'c']);
  // Only the two removed guests' seats, and the exact placement is preserved.
  assert.deepEqual(plan.seats, [
    { guest_id: 'a', table_id: 'T1', seat_number: 3, locked: false },
    { guest_id: 'c', table_id: 'T2', seat_number: null, locked: true },
  ]);
});

test('buildUndo(remove): a guest with no released seat restores without a seat', () => {
  const plan = buildUndo({ kind: 'remove', guestIds: ['a'] }, [row('a')], []);
  assert.equal(plan.kind, 'restore');
  if (plan.kind !== 'restore') return;
  assert.deepEqual(plan.guestIds, ['a']);
  assert.deepEqual(plan.seats, []);
});

test('buildUndo(setField): recovers each guest PRIOR field value', () => {
  const mutation: GuestMutation = {
    kind: 'setField',
    guestIds: ['b', 'c'],
    override: { side: 'both' },
  };
  const prior = [row('b', { side: 'bride' }), row('c', { side: 'groom' })];
  const plan = buildUndo(mutation, prior, []);
  assert.equal(plan.kind, 'setField');
  if (plan.kind !== 'setField') return;
  assert.deepEqual(plan.overridesByGuestId, {
    b: { side: 'bride' },
    c: { side: 'groom' },
  });
});
