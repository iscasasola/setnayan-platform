/**
 * vendor-customer-pipeline.test.ts — the four states, and the two things about
 * them that would be invisible if they broke.
 *
 * 🔑 THE TWO LOAD-BEARING ASSERTIONS, said up front so nobody weakens them:
 *   1. A `waiting` row NEVER carries the couple's name or venue — including a
 *      BOOKING ASK, which is the half a reader is most likely to "fix".
 *   2. The four lanes still work with the handshake flag OFF. The register
 *      warned this page would render "two of four" while the flag is dark;
 *      measured, only the `booking_ask` KIND is unreachable, and these tests
 *      run the whole set through `handshakeEnabled = false` to prove it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  customerLaneOf,
  comparePipelineCustomers,
  groupByLane,
  waitingDays,
  CUSTOMER_LANES,
  type PipelineInput,
} from './vendor-customer-pipeline';

const DESCRIPTOR = 'A couple planning a wedding in Metro Manila';

function input(over: Partial<PipelineInput> = {}): PipelineInput {
  return {
    eventId: 'e1',
    thread: null,
    booking: null,
    eventName: 'Ana & Marco',
    descriptor: DESCRIPTOR,
    eventDate: '2027-02-14',
    place: 'Tagaytay Chapel',
    ...over,
  };
}

const thread = (
  inquiryStatus: string | null,
  createdAt: string | null = '2026-08-01T00:00:00Z',
  revealed = inquiryStatus === 'accepted',
) => ({ threadId: 't1', inquiryStatus, createdAt, revealed });

const booking = (
  status: string | null,
  lock: string | null = null,
  requestedAt: string | null = '2026-08-02T00:00:00Z',
  expiresAt: string | null = '2026-08-09T00:00:00Z',
) => ({
  eventVendorId: 'ev1',
  status,
  lock_request_state: lock,
  requestedAt,
  expiresAt,
});

// ── 1 · THE FOUR LANES ─────────────────────────────────────────────────────

test('a pending enquiry is somebody waiting on the shop', () => {
  const row = customerLaneOf(input({ thread: thread('pending') }), false);
  assert.equal(row?.lane, 'waiting');
  assert.equal(row?.waitingKind, 'inquiry');
  assert.equal(row?.waitingSince, '2026-08-01T00:00:00Z');
});

test('an accepted enquiry with no booking is talking', () => {
  const row = customerLaneOf(input({ thread: thread('accepted') }), false);
  assert.equal(row?.lane, 'talking');
  assert.equal(row?.waitingKind, null);
});

test('a confirmed booking is booked', () => {
  const row = customerLaneOf(input({ booking: booking('contracted') }), false);
  assert.equal(row?.lane, 'booked');
});

test('a delivered or completed booking is finished, not booked', () => {
  for (const status of ['delivered', 'complete']) {
    const row = customerLaneOf(input({ booking: booking(status) }), false);
    assert.equal(row?.lane, 'finished', `${status} should be finished`);
  }
});

test('a live booking ask is waiting — but ONLY with the handshake flag on', () => {
  const on = customerLaneOf(input({ booking: booking('considering', 'pending') }), true);
  assert.equal(on?.lane, 'waiting');
  assert.equal(on?.waitingKind, 'booking_ask');
  assert.equal(on?.expiresAt, '2026-08-09T00:00:00Z');

  // Flag OFF: `lockRequestStateOf` answers 'none', so this person is not a
  // customer at all — which is correct, because with the flag off the couple's
  // Lock books outright and no `pending` row is ever created.
  assert.equal(customerLaneOf(input({ booking: booking('considering', 'pending') }), false), null);
});

test('THE FOUR LANES ALL WORK WITH THE FLAG OFF — only the booking-ask kind does not', () => {
  const lanes = new Set(
    [
      customerLaneOf(input({ thread: thread('pending') }), false),
      customerLaneOf(input({ thread: thread('accepted') }), false),
      customerLaneOf(input({ booking: booking('deposit_paid') }), false),
      customerLaneOf(input({ booking: booking('delivered') }), false),
    ].map((r) => r?.lane),
  );
  for (const lane of CUSTOMER_LANES) {
    assert.ok(lanes.has(lane), `lane ${lane} is unreachable with the flag off`);
  }
});

// ── 2 · WHO IS NOT A CUSTOMER ──────────────────────────────────────────────

test('a shortlisted shop nobody contacted is not a customer', () => {
  assert.equal(customerLaneOf(input({ booking: booking('shortlisted') }), true), null);
  assert.equal(customerLaneOf(input(), true), null);
});

test('a declined, displaced or withdrawn enquiry leaves the roster', () => {
  for (const status of ['declined', 'displaced', 'withdrawn', 'expired']) {
    assert.equal(
      customerLaneOf(input({ thread: thread(status) }), true),
      null,
      `${status} should not be a customer`,
    );
  }
});

test('an answered booking ask is not still waiting', () => {
  for (const lock of ['declined', 'cancelled', 'expired']) {
    assert.equal(
      customerLaneOf(input({ booking: booking('considering', lock) }), true),
      null,
      `${lock} should not be waiting`,
    );
  }
});

// ── 3 · IDENTITY — the assertion that matters most ─────────────────────────

test('a WAITING row never carries the name, the venue, or anything but the mask', () => {
  const enquiry = customerLaneOf(input({ thread: thread('pending') }), true);
  const ask = customerLaneOf(input({ booking: booking('considering', 'pending') }), true);
  for (const row of [enquiry, ask]) {
    assert.ok(row, 'row should exist');
    assert.equal(row.identityRevealed, false);
    assert.equal(row.title, DESCRIPTOR);
    assert.equal(row.place, null);
    // Belt and braces: the couple's name must not appear ANYWHERE on the row.
    assert.ok(
      !JSON.stringify(row).includes('Ana & Marco'),
      'the couple name reached a masked row',
    );
    assert.ok(!JSON.stringify(row).includes('Tagaytay'), 'the venue reached a masked row');
  }
});

test('a booked or talking row is entitled to the name and the venue', () => {
  for (const row of [
    customerLaneOf(input({ booking: booking('contracted') }), true),
    customerLaneOf(input({ booking: booking('complete') }), true),
    customerLaneOf(input({ thread: thread('accepted') }), true),
  ]) {
    assert.equal(row?.identityRevealed, true);
    assert.equal(row?.title, 'Ana & Marco');
    assert.equal(row?.place, 'Tagaytay Chapel');
  }
});

test('a nameless booked event falls back to the mask, never to an empty row', () => {
  const row = customerLaneOf(
    input({ booking: booking('contracted'), eventName: '   ' }),
    true,
  );
  assert.equal(row?.title, DESCRIPTOR);
});

// ── 4 · A REAL BOOKING OUTRANKS A STALE MARKER ─────────────────────────────

test('a paid booking carrying a stale pending marker is booked, not waiting', () => {
  // The printed Locked-QR path promotes to deposit_paid without touching a
  // single lock_* column, so this row shape is real, not hypothetical.
  const row = customerLaneOf(input({ booking: booking('deposit_paid', 'pending') }), true);
  assert.equal(row?.lane, 'booked');
  assert.equal(row?.waitingKind, null);
});

test('a booking ask outranks an un-accepted enquiry — one person, one row', () => {
  const row = customerLaneOf(
    input({ thread: thread('pending'), booking: booking('considering', 'pending') }),
    true,
  );
  assert.equal(row?.waitingKind, 'booking_ask');
  assert.equal(row?.threadId, 't1');
  assert.equal(row?.eventVendorId, 'ev1');
});

// ── 4b · THE POOL-RESERVATION FLOOR — the anti-regression ─────────────────

test('a live pool hold with no booking row is still a customer', () => {
  // The roster this replaced derived "booked" from pool bookings ALONE. A hold
  // whose `event_vendors` row is archived, or was never stamped with a
  // marketplace id, must not vanish from the shop's own customer list.
  const row = customerLaneOf(input({ poolBooked: true }), true);
  assert.equal(row?.lane, 'booked');
  assert.equal(row?.identityRevealed, true);
});

test('a live pool hold lifts a talking row to booked', () => {
  const row = customerLaneOf(input({ thread: thread('accepted'), poolBooked: true }), true);
  assert.equal(row?.lane, 'booked');
});

test('a live pool hold does NOT outrank an unanswered booking ask', () => {
  // Of the two facts, the one the shop must act on is the question.
  const row = customerLaneOf(
    input({ booking: booking('considering', 'pending'), poolBooked: true }),
    true,
  );
  assert.equal(row?.lane, 'waiting');
  assert.equal(row?.waitingKind, 'booking_ask');
  // …and the mask still holds: a floor must not become a way past it.
  assert.equal(row?.identityRevealed, false);
  assert.equal(row?.title, DESCRIPTOR);
});

test('a live pool hold does not drag a finished celebration back to booked', () => {
  const row = customerLaneOf(input({ booking: booking('delivered'), poolBooked: true }), true);
  assert.equal(row?.lane, 'finished');
});

// ── 5 · ORDER ──────────────────────────────────────────────────────────────

test('waiting is oldest first', () => {
  const older = customerLaneOf(
    input({ eventId: 'old', thread: thread('pending', '2026-08-01T00:00:00Z') }),
    true,
  )!;
  const newer = customerLaneOf(
    input({ eventId: 'new', thread: thread('pending', '2026-08-05T00:00:00Z') }),
    true,
  )!;
  assert.deepEqual(
    [newer, older].sort(comparePipelineCustomers).map((r) => r.eventId),
    ['old', 'new'],
  );
});

test('an unreadable clock sorts to the TOP of waiting, never out of sight', () => {
  const known = customerLaneOf(
    input({ eventId: 'known', thread: thread('pending', '2026-08-01T00:00:00Z') }),
    true,
  )!;
  const unknown = customerLaneOf(
    input({ eventId: 'unknown', thread: thread('pending', null) }),
    true,
  )!;
  assert.deepEqual(
    [known, unknown].sort(comparePipelineCustomers).map((r) => r.eventId),
    ['unknown', 'known'],
  );
});

test('booked is soonest first with undated last', () => {
  const soon = customerLaneOf(
    input({ eventId: 'soon', booking: booking('contracted'), eventDate: '2027-01-01' }),
    true,
  )!;
  const later = customerLaneOf(
    input({ eventId: 'later', booking: booking('contracted'), eventDate: '2027-06-01' }),
    true,
  )!;
  const undated = customerLaneOf(
    input({ eventId: 'undated', booking: booking('contracted'), eventDate: null }),
    true,
  )!;
  assert.deepEqual(
    [undated, later, soon].sort(comparePipelineCustomers).map((r) => r.eventId),
    ['soon', 'later', 'undated'],
  );
});

test('groupByLane files every row and sorts each lane', () => {
  const rows = [
    customerLaneOf(input({ eventId: 'b', booking: booking('contracted'), eventDate: '2027-06-01' }), true)!,
    customerLaneOf(input({ eventId: 'a', booking: booking('contracted'), eventDate: '2027-01-01' }), true)!,
    customerLaneOf(input({ eventId: 'w', thread: thread('pending') }), true)!,
    customerLaneOf(input({ eventId: 'f', booking: booking('delivered') }), true)!,
  ];
  const grouped = groupByLane(rows);
  assert.deepEqual(grouped.booked.map((r) => r.eventId), ['a', 'b']);
  assert.equal(grouped.waiting.length, 1);
  assert.equal(grouped.finished.length, 1);
  assert.equal(grouped.talking.length, 0);
  const total = CUSTOMER_LANES.reduce((n, l) => n + grouped[l].length, 0);
  assert.equal(total, rows.length, 'a row went missing between the lanes');
});

// ── 6 · THE AGE ────────────────────────────────────────────────────────────

test('waitingDays floors at zero and refuses to invent a number', () => {
  const now = Date.parse('2026-08-10T00:00:00Z');
  assert.equal(waitingDays('2026-08-08T00:00:00Z', now), 2);
  assert.equal(waitingDays('2026-08-10T06:00:00Z', now), 0, 'a future stamp is not negative days');
  assert.equal(waitingDays(null, now), null);
  assert.equal(waitingDays('not a date', now), null);
});
