/**
 * plus-one-seat-people.test.ts — 🪪 THE +1 CARDS ARE THE SAME SEATS AS THE +1 LINES (owner-approved prototype
 * `guest_card_groups_and_papic_2026-10-23.html`: one card per +1 in Additional Guests).
 *
 * `plusOneSeatPeople` draws one person per seat row: the same rows, the same order and the same naming rule as
 * `plusOneSeatLines` (a seat waiting for its name is `name: null`, never "TBA +1"), and the seat's own reply.
 * SABOTAGE (seen RED, then restored): the sort dropped · an unnamed seat named "TBA +1".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { plusOneSeatLines, plusOneSeatPeople } from '@/lib/extra-seats';

const ROWS = [
  { guest_id: 'g-2', first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, created_at: '2026-09-30T00:00:01Z', rsvp_status: 'pending' as const },
  { guest_id: 'g-1', first_name: 'Ana', last_name: 'Cruz', plus_one_name_confirmed_at: '2026-10-01T00:00:00Z', created_at: '2026-09-30T00:00:00Z', rsvp_status: 'attending' as const },
];

test('one person per seat, oldest first, in the same order as the +1 lines', () => {
  const people = plusOneSeatPeople('g-host', ROWS);
  assert.deepEqual(people, [
    { guestId: 'g-1', name: 'Ana Cruz', status: 'attending' },
    { guestId: 'g-2', name: null, status: 'pending' },
  ]);
  const lines = plusOneSeatLines('g-host', ROWS);
  assert.equal(people.length, lines.length);
  people.forEach((p, i) => assert.equal(p.name === null, lines[i] === 'Awaiting +1 to confirm their name', `seat ${i + 1} disagrees with its line`));
});

test('an unread reply is "pending", never a guess', () => {
  assert.equal(plusOneSeatPeople('g-host', [{ ...ROWS[1]!, rsvp_status: null }])[0]!.status, 'pending');
});
