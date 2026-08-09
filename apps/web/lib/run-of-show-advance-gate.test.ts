/**
 * run-of-show-advance-gate.test.ts — the decision, exercised, not grepped.
 *
 * Two previous generations of this guard were structural assertions over the
 * server action's source, and the reviewer beat both with the same sabotage:
 * **keep the call, discard its result.** Deleting the entire authorization block
 * left the suite green, because nothing ever called the decision and read what it
 * returned. These tests do.
 *
 * ⚠ EVERY FIXTURE BELOW IS A STATE PRODUCTION CAN ACTUALLY PRODUCE. The earlier
 * delegate test passed only because its stub gave the delegate NO `event_members`
 * row — impossible, since `app/host/accept/[token]/actions.ts` upserts
 * `member_type: 'coordinator'` on every accepted invite. A green test over an
 * impossible fixture is worth less than no test: it stops the next person looking.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideMayAdvance,
  MEMBER_TYPES_THAT_ARE_NOT_ENOUGH,
  COUPLE_IS_A_HOST_TYPE,
  type AdvanceGateInputs,
} from './run-of-show-advance-gate';

const EVENT = 'evt-this-wedding';

/** Nobody: signed in, on no event, with nothing. */
const base: AdvanceGateInputs = {
  memberType: null,
  delegateScheduleLevel: null,
  coordinatorBookedEventIds: [],
  eventId: EVENT,
  isAdmin: false,
  readFailed: false,
};

test('a stranger is refused', () => {
  assert.equal(decideMayAdvance(base).allowed, false);
});

test('the couple advances their own programme', () => {
  const d = decideMayAdvance({ ...base, memberType: 'couple' });
  assert.equal(d.allowed, true);
  assert.equal(d.allowed && d.via, 'couple');
});

test('A WEDDING GUEST CANNOT ADVANCE THE PROGRAMME', () => {
  // The shipped defect: `if (memberRes.data) return true` admitted this row.
  // A guest gets one by scanning the event QR (app/join/[eventId]/actions.ts).
  const d = decideMayAdvance({ ...base, memberType: 'guest' });
  assert.equal(
    d.allowed,
    false,
    'a guest with an event_members row was admitted — this is the exact bug ' +
      'host-scope.ts was written to kill, recurring for the third time',
  );
  assert.equal(d.allowed === false && d.reason, 'insufficient_role');
});

test('a VIEW-ONLY delegate is refused even though they carry a coordinator row', () => {
  // THE SHAPE BOTH AGENT ROUNDS MISSED. Accepting a host invite always mints
  // member_type:'coordinator', so this pairing is what production looks like for
  // every delegate — including one whose grid says schedule:'view'.
  const d = decideMayAdvance({
    ...base,
    memberType: 'coordinator',
    delegateScheduleLevel: 'view',
  });
  assert.equal(
    d.allowed,
    false,
    'a coordinator membership row waved a view-only delegate through — that row ' +
      'is minted for every accepted invite and proves nothing about permission',
  );
});

test('a delegate with schedule:edit advances, coordinator row and all', () => {
  const d = decideMayAdvance({
    ...base,
    memberType: 'coordinator',
    delegateScheduleLevel: 'edit',
  });
  assert.equal(d.allowed, true);
  assert.equal(d.allowed && d.via, 'delegate_edit');
});

test('the booked coordinator supplier advances; another wedding of theirs does not', () => {
  const yes = decideMayAdvance({ ...base, coordinatorBookedEventIds: [EVENT] });
  assert.equal(yes.allowed, true);
  assert.equal(yes.allowed && yes.via, 'booked_coordinator');

  const no = decideMayAdvance({ ...base, coordinatorBookedEventIds: ['evt-some-other'] });
  assert.equal(no.allowed, false, 'a coordinator booked elsewhere must not advance THIS wedding');
});

test('a booked caterer or florist is refused — the RPC admits them, we do not', () => {
  // current_vendor_booked_event_ids() (the RPC's own arm) is every booked
  // supplier. This gate only ever sees the coordinator-filtered list, so a
  // non-coordinator supplier arrives with an empty array.
  const d = decideMayAdvance({ ...base, memberType: 'vendor', coordinatorBookedEventIds: [] });
  assert.equal(d.allowed, false);
});

test('a failed read refuses — it never degrades to yes', () => {
  // Supabase resolves `{ error }` rather than throwing, so an unchecked error
  // turns a failed read into an empty one, and empty can only loosen the answer.
  const d = decideMayAdvance({ ...base, memberType: 'couple', readFailed: true });
  assert.equal(
    d.allowed,
    false,
    'read_failed must beat every allow arm, including the couple',
  );
  assert.equal(d.allowed === false && d.reason, 'read_failed');
});

test('an unreadable coordinator list is not an empty one', () => {
  const d = decideMayAdvance({ ...base, coordinatorBookedEventIds: null });
  assert.equal(d.allowed, false);
});

test('the admin arm still works, and is last', () => {
  assert.equal(decideMayAdvance({ ...base, isAdmin: true }).allowed, true);
  // …but not ahead of a failed read.
  assert.equal(decideMayAdvance({ ...base, isAdmin: true, readFailed: true }).allowed, false);
});

test('every membership type that is not "couple" needs corroboration', () => {
  assert.ok(COUPLE_IS_A_HOST_TYPE, 'couple stopped being a host type — re-read the gate');
  assert.ok(
    MEMBER_TYPES_THAT_ARE_NOT_ENOUGH.length >= 3,
    'the not-enough list shrank — this test would pass vacuously',
  );
  for (const t of MEMBER_TYPES_THAT_ARE_NOT_ENOUGH) {
    assert.equal(
      decideMayAdvance({ ...base, memberType: t }).allowed,
      false,
      `member_type "${t}" was admitted on its own`,
    );
  }
});
