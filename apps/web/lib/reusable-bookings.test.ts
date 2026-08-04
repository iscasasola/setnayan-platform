/**
 * Unit suite for Reusable Locked Bookings — the safety-critical rules the couple
 * and vendor server actions lean on: scope sanitization (no price / no other
 * couple's PII survives), the status machine (vendor can decline; only a quoted
 * request is acceptable), the distinct-event / new-lock-new-fee invariant, and
 * the flag-off no-op. Money-adjacent: the new-lock-new-fee arm is pinned against
 * the UNCHANGED free-5 rule so the 6th reuse booking is proven to be charged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isReusableBookingsEnabled,
  canTransitionReuse,
  sanitizeScopeSnapshot,
  reuseTargetsDistinctEvent,
  isReusableSourceBooking,
  REUSE_REQUEST_STATUSES,
} from './reusable-bookings';
import { isFreeBooking, decideLockFee } from './booking-fee-lock';

// ── flag gate (dark by default) ──────────────────────────────────────────────

test('flag defaults OFF', () => {
  const prev = process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED;
  delete process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED;
  assert.equal(isReusableBookingsEnabled(), false);
  process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED = 'true';
  assert.equal(isReusableBookingsEnabled(), true);
  process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED = '0';
  assert.equal(isReusableBookingsEnabled(), false);
  if (prev === undefined) delete process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED;
  else process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED = prev;
});

// ── scope sanitization: template carries NO price + NO other couple's PII ─────

test('sanitizeScopeSnapshot strips price + PII from proposal line_items', () => {
  const lineItems = [
    {
      label: 'Full-day coverage',
      detail: '10 hours, 2 shooters',
      amount_centavos: 4500000, // price → MUST be dropped
      price_php: 45000,
    },
    {
      label: 'Same-day edit',
      detail: 'delivered at reception',
      total_centavos: 900000,
      // couple instance data that must never leak into the template:
      couple_name: 'Maria & Jose',
      contact_email: 'maria@example.com',
      confirmed_guests: 180,
    },
  ];
  const scope = sanitizeScopeSnapshot(lineItems);
  assert.deepEqual(scope, [
    { label: 'Full-day coverage', detail: '10 hours, 2 shooters' },
    { label: 'Same-day edit', detail: 'delivered at reception' },
  ]);
  // Hard proof: no forbidden value survives anywhere in the serialized template.
  const blob = JSON.stringify(scope);
  for (const needle of ['4500000', '45000', '900000', 'Maria', 'maria@example.com', '180']) {
    assert.ok(!blob.includes(needle), `template leaked "${needle}"`);
  }
  // And only label/detail keys exist on each line.
  for (const line of scope) {
    assert.deepEqual(Object.keys(line).sort(), ['detail', 'label']);
  }
});

test('sanitizeScopeSnapshot accepts a host_inclusions string[]', () => {
  const scope = sanitizeScopeSnapshot(['Reception coverage', '  Prenup shoot  ', '']);
  assert.deepEqual(scope, [
    { label: 'Reception coverage', detail: null },
    { label: 'Prenup shoot', detail: null },
  ]);
});

test('sanitizeScopeSnapshot is total on junk input', () => {
  assert.deepEqual(sanitizeScopeSnapshot(null), []);
  assert.deepEqual(sanitizeScopeSnapshot(undefined), []);
  assert.deepEqual(sanitizeScopeSnapshot([{ amount_centavos: 500 } as Record<string, unknown>]), []);
  assert.deepEqual(sanitizeScopeSnapshot([{ label: '   ' }]), []);
});

test('sanitizeScopeSnapshot caps the number of lines', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ label: `item ${i}` }));
  assert.equal(sanitizeScopeSnapshot(many).length, 40);
});

// ── status machine: vendor can decline; only a quoted request is acceptable ───

test('vendor re-prices: pending → quoted (vendor only)', () => {
  assert.ok(canTransitionReuse('pending', 'quoted', 'vendor'));
  assert.ok(!canTransitionReuse('pending', 'quoted', 'couple'));
  assert.ok(!canTransitionReuse('quoted', 'quoted', 'vendor')); // no re-quote of a quote
});

test('vendor can DECLINE a live request (retired package)', () => {
  assert.ok(canTransitionReuse('pending', 'declined', 'vendor'));
  assert.ok(canTransitionReuse('quoted', 'declined', 'vendor'));
  assert.ok(!canTransitionReuse('pending', 'declined', 'couple')); // couple cancels, not declines
});

test('couple can only ACCEPT a quoted request (never a pending one)', () => {
  assert.ok(canTransitionReuse('quoted', 'accepted', 'couple'));
  assert.ok(!canTransitionReuse('pending', 'accepted', 'couple')); // no price yet
  assert.ok(!canTransitionReuse('quoted', 'accepted', 'vendor'));
});

test('couple can cancel; terminal states are frozen', () => {
  assert.ok(canTransitionReuse('pending', 'cancelled', 'couple'));
  assert.ok(canTransitionReuse('quoted', 'cancelled', 'couple'));
  for (const from of ['accepted', 'declined', 'cancelled'] as const) {
    for (const to of REUSE_REQUEST_STATUSES) {
      assert.ok(!canTransitionReuse(from, to, 'couple'), `${from}→${to} must be frozen`);
      assert.ok(!canTransitionReuse(from, to, 'vendor'), `${from}→${to} must be frozen`);
    }
  }
});

// ── distinct-event invariant (the root of new-lock-new-fee) ───────────────────

test('reuse must target a DIFFERENT event than the source', () => {
  assert.ok(reuseTargetsDistinctEvent('evt_A', 'evt_B'));
  assert.ok(!reuseTargetsDistinctEvent('evt_A', 'evt_A')); // same event → forbidden
  assert.ok(reuseTargetsDistinctEvent(null, 'evt_B')); // no source anchor is fine
  assert.ok(!reuseTargetsDistinctEvent('evt_A', '')); // no target → invalid
});

test('only committed marketplace bookings are reusable sources', () => {
  assert.ok(isReusableSourceBooking({ status: 'contracted', marketplaceVendorId: 'vp1' }));
  assert.ok(isReusableSourceBooking({ status: 'complete', marketplaceVendorId: 'vp1' }));
  assert.ok(!isReusableSourceBooking({ status: 'considering', marketplaceVendorId: 'vp1' })); // not locked
  assert.ok(!isReusableSourceBooking({ status: 'contracted', marketplaceVendorId: null })); // off-platform
});

// ── new-lock-new-fee: a reuse booking rides the UNCHANGED free-5 rule ─────────
// A reuse into a new event is the vendor's Nth DISTINCT (vendor,event) lock, so
// the frozen free-5 ordinal advances exactly like any booking. Proof: simulate
// 6 distinct-event locks (5 originals + 1 reuse as the 6th) and assert the 6th
// is charged. The fee is NOT re-implemented for reuse — this pins that reuse
// gets no free ride and no carry-over of a prior lock's paid state.

test('the 6th distinct booking (a reuse) is CHARGED, first 5 free', () => {
  const agreedTotalPhp = 50000;
  for (let ordinal = 1; ordinal <= 5; ordinal++) {
    const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: ordinal, agreedTotalPhp });
    assert.equal(d.free, true, `booking ${ordinal} should be free`);
    assert.equal(d.createOrder, false);
    assert.equal(d.feePhp, 0);
  }
  // The reuse lands as the 6th distinct (vendor,event) lock → new charge.
  const reuse = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp });
  assert.equal(reuse.free, false, 'the 6th (reuse) booking must not be free');
  assert.equal(reuse.createOrder, true, 'the 6th (reuse) booking must mint a fee order');
  assert.equal(reuse.feePhp, 2500); // 5% of 50,000
  assert.ok(!isFreeBooking(6));
});

test('a reuse charges on its OWN re-quoted price, not the source price', () => {
  // Vendor re-priced the reuse up to 80,000 for the new event → 5% = 4,000,
  // independent of whatever the source booking cost. No carry-over.
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: 80000 });
  assert.equal(d.feePhp, 4000);
});
