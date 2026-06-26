import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCameraQuote,
  type CameraRates,
  type CameraCaps,
} from './papic-cameras';

// Money-logic guard for the PAPIC_UNLOCK "free + uncapped Unli" allowance (owner
// 2026-06-26). computeCameraQuote is the single pure source the picker (client)
// and purchasePapicCameras (server) both mirror — so its unliFree branch must be
// exactly: Unli charge → ₱0, Roll (Ltd) untouched, never "free up paid cameras"
// when unliFree is false.

const RATES: CameraRates = { roll: 30, unlimited: 100 };
// Generous caps so nothing clamps in the small-count cases below.
const CAPS: CameraCaps = { ltd: 6000, unli: 10000 };

test('paid path (unliFree off): both tiers bill — Unli is NOT free', () => {
  const q = computeCameraQuote({ roll: 5, unlimited: 2 }, 1, RATES, CAPS);
  assert.equal(q.rollChargePhp, 150); // 5 × ₱30
  assert.equal(q.unlimitedChargePhp, 200); // 2 × ₱100 — charged
  assert.equal(q.totalPhp, 350);
});

test('unliFree: Unli charge collapses to ₱0, Roll still bills', () => {
  const q = computeCameraQuote({ roll: 5, unlimited: 4 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.rollChargePhp, 150); // 5 × ₱30 — unchanged
  assert.equal(q.unlimitedChargePhp, 0); // freed by the umbrella
  assert.equal(q.totalPhp, 150);
  // Subtotal is still computed for display (the "would be" figure).
  assert.equal(q.unlimitedSubtotalPhp, 400);
});

test('unliFree + only Unli → whole order is free (₱0)', () => {
  const q = computeCameraQuote({ roll: 0, unlimited: 12 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.totalPhp, 0);
  assert.equal(q.paidCount, 12); // count is preserved (uncapped), only the charge is 0
});

test('unliFree never trips the Unli cap flag (free, not clamped)', () => {
  // 200 Unli × ₱100 = ₱20,000 would exceed the ₱10,000 cap on the paid path…
  const paid = computeCameraQuote({ roll: 0, unlimited: 200 }, 1, RATES, CAPS);
  assert.equal(paid.capped, true);
  // …but with unliFree it is ₱0, so it is not "capped".
  const free = computeCameraQuote({ roll: 0, unlimited: 200 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(free.capped, false);
  assert.equal(free.totalPhp, 0);
});

test('unliFree does NOT free Roll: a Roll-over-cap order still bills the Ltd cap', () => {
  // 300 Roll × ₱30 = ₱9,000 → clamps to the ₱6,000 Ltd cap even when unliFree.
  const q = computeCameraQuote({ roll: 300, unlimited: 5 }, 1, RATES, CAPS, {
    unliFree: true,
  });
  assert.equal(q.rollChargePhp, 6000); // Ltd cap honored
  assert.equal(q.unlimitedChargePhp, 0); // Unli free
  assert.equal(q.totalPhp, 6000);
  assert.equal(q.capped, true); // Roll tripped its cap
});
