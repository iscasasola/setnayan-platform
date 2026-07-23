/**
 * Unit suite for the Booking-Fee send-gate RULES (pure + env-driven). These are
 * the safety-critical pieces: attribution mapping, the TWO-KEY fail-safe (never
 * enforce unless BOTH the flag and a live Maya rail are on), and the pure send
 * decision (fail-OPEN on a null charge, clear on paid/waived, block on pending).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeeAttribution,
  isBookingFeeEnabled,
  isBookingFeeEnforced,
  decideFeeGate,
  type OpenChargeResult,
} from './booking-fee-gate';

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const charge = (over: Partial<OpenChargeResult>): OpenChargeResult => ({
  charge_id: 'c1',
  status: 'pending',
  amount_charged_centavos: 76000,
  computed_fee_centavos: 76000,
  attribution: 'sourced',
  reused: false,
  ...over,
});

test('bookingFeeAttribution: marketplace sources → sourced', () => {
  for (const s of [
    'explore', 'search', 'shortlist', 'first_pick', 'favorites',
    'auto_build', 'editorial', 'influencer', 'website',
  ]) {
    assert.equal(bookingFeeAttribution(s), 'sourced', `${s} should be sourced`);
  }
});

test('bookingFeeAttribution: null / unknown / non-billable → import (free)', () => {
  assert.equal(bookingFeeAttribution(null), 'import');
  assert.equal(bookingFeeAttribution(undefined), 'import');
  assert.equal(bookingFeeAttribution('host_manual'), 'import');
  assert.equal(bookingFeeAttribution('invite_claim'), 'import');
  assert.equal(bookingFeeAttribution('degree'), 'import'); // not in the billable set
});

test('isBookingFeeEnforced: TWO-KEY — needs both the flag AND Maya APPROVED', () => {
  withEnv(
    { NEXT_PUBLIC_BOOKING_FEE_ENABLED: undefined, NEXT_PUBLIC_MAYA_STATUS: undefined },
    () => {
      assert.equal(isBookingFeeEnforced(), false); // neither

      process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = 'true';
      assert.equal(isBookingFeeEnabled(), true);
      assert.equal(isBookingFeeEnforced(), false); // flag on, no rail → NOT enforced

      process.env.NEXT_PUBLIC_MAYA_STATUS = 'APPROVED';
      assert.equal(isBookingFeeEnforced(), true); // both keys → enforced

      delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
      assert.equal(isBookingFeeEnforced(), false); // rail on, flag off → NOT enforced
    },
  );
});

test('decideFeeGate: null charge → cleared (fail-open, never trap a live send)', () => {
  assert.deepEqual(decideFeeGate(null), { cleared: true });
});

test('decideFeeGate: paid / waived_import → cleared', () => {
  assert.deepEqual(decideFeeGate(charge({ status: 'paid' })), { cleared: true });
  assert.deepEqual(
    decideFeeGate(charge({ status: 'waived_import', amount_charged_centavos: 0 })),
    { cleared: true },
  );
});

test('decideFeeGate: pending → blocked with the charge to pay', () => {
  assert.deepEqual(
    decideFeeGate(charge({ status: 'pending', charge_id: 'c9', amount_charged_centavos: 76000 })),
    { cleared: false, chargeId: 'c9', amountCentavos: 76000 },
  );
});
