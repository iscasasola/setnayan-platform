import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLimitedQuote } from './papic-limited';

// Papic Limited = the guest-list cameras (owner-locked 2026-06-26). A guest
// camera at the roll tier IS a Papic One (roll == mini), so it must price like
// /pricing's FLAT per-camera promise. These pin the 2026-07-22 flat naming lock
// (migration 20270830568357): the capture-window `days` sizes seat validity, it
// is NEVER a price multiplier.

test('Limited bill is FLAT — guestCount × rate, no days multiplier', () => {
  // 40 guests × ₱100 = ₱4,000, under the ₱6,000 wedding cap → billed in full,
  // identical for a 1-day or a 5-day capture window.
  const oneDay = computeLimitedQuote(40, 100, 6000, 1);
  const fiveDay = computeLimitedQuote(40, 100, 6000, 5);
  assert.equal(oneDay.rawBillPhp, 4000); // 40 × ₱100 — NOT × days
  assert.equal(oneDay.frozenBillPhp, 4000);
  assert.equal(fiveDay.frozenBillPhp, 4000); // same bill regardless of window length
  assert.equal(fiveDay.days, 5); // window span still surfaced, just not billed
});

test('cameraCap covers cap / rate at the flat rate (window-independent)', () => {
  // ₱6,000 cap ÷ ₱100 = 60 cameras covered — the same whether the window is 1
  // day or 3 (pre-fix, a 3-day window wrongly shrank this to 20).
  const oneDay = computeLimitedQuote(200, 100, 6000, 1);
  const threeDay = computeLimitedQuote(200, 100, 6000, 3);
  assert.equal(oneDay.cameraCap, 60);
  assert.equal(threeDay.cameraCap, 60);
  assert.equal(oneDay.frozenBillPhp, 6000); // 200 × ₱100 = ₱20,000 → clamped to the cap
  assert.equal(oneDay.capped, true);
  assert.equal(oneDay.overflow, 140); // 200 − 60
});
