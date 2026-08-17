/**
 * THE BOOKED SUPPLIER'S WAY PAST A PRIVATE EVENT'S LOCK SCREEN.
 *
 * The supplier doorway, its gate (`resolveVendorCapability`) and its read
 * (`loadVendorBooking`) all shipped 2026-08-03 — and on a PRIVATE event none of
 * it could ever run, because `app/[slug]/page.tsx` refused the supplier ~200
 * lines before the gate was called. They met "scan your invitation QR", a QR
 * nobody sends a supplier. 4 of 6 production events are private.
 *
 * This file pins the two halves of the fifth path:
 *
 *   1. WHO GETS IN — `vendorBookingIsCommitted`. A LINK IS NOT A BOOKING:
 *      `lib/reusable-bookings.server.ts` mints a linked row at 'shortlisted'
 *      for a reuse offer the couple has yet to lock. A supplier the couple is
 *      still only considering must NOT read a private celebration — the same
 *      boundary PR-H draws when it refuses an ASKED supplier the venue address
 *      and the run-of-show.
 *
 *   2. WHAT THEY CARRY — the capability's payload. Admitting a supplier to the
 *      PAGE must not hand them a guest session, guest names or any per-guest
 *      surface. A test that only checks the happy path passes while leaking, so
 *      the assertions below run against a booking read POISONED with guest
 *      data and assert what the payload does NOT contain.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveVendorCapability,
  vendorBookingIsCommitted,
  VENDOR_CAPABILITY_KEYS,
} from './site-identity';
import { COMMITTED_BOOKING_STATUSES } from '@/lib/vendor-addon-first5-free';

// ── 1 · WHO GETS IN ────────────────────────────────────────────────────────

test('every committed booking status admits the supplier', () => {
  // Derived from the shared constant, never re-typed: the set is pinned by a
  // drift test to the booking-fee RPC's own list, so "booked enough to read the
  // page" cannot drift away from "booked enough to be charged for".
  assert.ok(COMMITTED_BOOKING_STATUSES.length >= 4, 'the status set must not be empty');
  for (const status of COMMITTED_BOOKING_STATUSES) {
    assert.equal(vendorBookingIsCommitted(status), true, `${status} must admit`);
  }
});

test('a LINKED but not yet booked supplier is refused — the reuse-accept case', () => {
  // The exact row `acceptReuseRequest` mints: linked, priced, and 'shortlisted'
  // until the couple locks it. The couple has not chosen them yet.
  assert.equal(vendorBookingIsCommitted('shortlisted'), false);
});

test('the earlier funnel stages are refused', () => {
  for (const status of ['considering', 'inquiry', 'requested', 'declined', 'cancelled']) {
    assert.equal(vendorBookingIsCommitted(status), false, `${status} must not admit`);
  }
});

test('an absent or unrecognised status FAILS CLOSED', () => {
  // A private event is a promise the couple made about who reads their
  // celebration. An unknown value must never be read as consent.
  assert.equal(vendorBookingIsCommitted(null), false);
  assert.equal(vendorBookingIsCommitted(''), false);
  assert.equal(vendorBookingIsCommitted('CONTRACTED'), false, 'case must not be coerced');
  assert.equal(vendorBookingIsCommitted('contracted_pending'), false, 'no prefix matching');
  assert.equal(vendorBookingIsCommitted('some_status_invented_later'), false);
});

// ── 2 · WHAT THEY CARRY ────────────────────────────────────────────────────

/** A booking read that has been poisoned with guest-derived data — the shape a
 *  future careless edit to `loadVendorBooking` could produce. */
const poisonedBooking = async () =>
  ({
    vendorProfileId: 'vp1',
    businessName: 'San Marco Catering',
    bookingStatus: 'contracted',
    // None of these may survive into the capability.
    guestName: 'Maria Santos',
    guests: [{ full_name: 'Jose Rizal', seat: 'Table 4' }],
    guestEmail: 'maria@example.com',
    rsvpStatus: 'attending',
    tableAssignment: 'Table 4',
  }) as unknown as Awaited<ReturnType<Parameters<typeof resolveVendorCapability>[0]['checkVendorBooking']>>;

test('the supplier capability carries ONLY its five declared keys', async () => {
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: 'u1',
    checkVendorBooking: poisonedBooking,
  });
  assert.ok(cap, 'a contracted supplier must get a capability');
  assert.deepEqual(
    Object.keys(cap).sort(),
    [...VENDOR_CAPABILITY_KEYS].sort(),
    'the capability grew a key — every new key is a new thing a supplier can read',
  );
});

test('NOT PRESENT: no guest name, seat, email or RSVP reaches the supplier', async () => {
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: 'u1',
    checkVendorBooking: poisonedBooking,
  });
  const serialized = JSON.stringify(cap);
  for (const secret of [
    'Maria Santos',
    'Jose Rizal',
    'maria@example.com',
    'attending',
    'Table 4',
  ]) {
    assert.equal(
      serialized.includes(secret),
      false,
      `the supplier payload leaked ${secret}`,
    );
  }
  for (const key of ['guestName', 'guests', 'guestEmail', 'rsvpStatus', 'tableAssignment']) {
    assert.equal(key in (cap as object), false, `the supplier payload carries ${key}`);
  }
});

test('a supplier who is not booked here gets nothing at all', async () => {
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: 'u1',
    checkVendorBooking: async () => null,
  });
  assert.equal(cap, null);
});

test('a cookie-only guest has no account, so no capability can be resolved', async () => {
  let asked = false;
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: null,
    checkVendorBooking: async () => {
      asked = true;
      return { vendorProfileId: 'vp1', businessName: 'X', bookingStatus: 'contracted' };
    },
  });
  assert.equal(cap, null);
  assert.equal(asked, false, 'the booking read must not even run without an account');
});

test('the grant stays bound to the event it was resolved against', async () => {
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: 'u1',
    checkVendorBooking: async () => ({
      vendorProfileId: 'vp1',
      businessName: 'San Marco',
      bookingStatus: 'contracted',
    }),
  });
  assert.equal(cap?.vendorEventId, 'event-A');
  assert.notEqual(cap?.vendorEventId, 'event-B');
});
