/**
 * ONE DISCOUNT PER FAMILY — the rounding rule, the guards, and the two facts
 * that made the owner's 40% safe to apply.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_DISCOUNT_DEFAULT_PCT,
  PAPIC_DISCOUNT_FLOOR_PCT,
  blockingComplaint,
  discountComplaints,
  effectiveDiscountPct,
  familyForServiceCode,
  previewFamilySave,
  signupPriceFor,
} from './onboarding-family-discount';
import { PAPIC_LADDER_EXPECTED } from '../tests/db/papic-ladder.expected';

test('AT 10%, PAPIC MOVES NOTHING — all sixteen rungs land on their stored price', () => {
  // Derived from the ladder pin, never retyped. The stored sign-up price is
  // exactly 10% off the regular one on every rung today, so the single-discount
  // shape must reproduce all sixteen or it is a repricing.
  for (const [shots, regular] of PAPIC_LADDER_EXPECTED) {
    const signup = signupPriceFor(regular, 10);
    assert.equal(
      signup,
      Math.round(regular * 0.9),
      `${shots} shots: 10% of ₱${regular} must reproduce the stored sign-up price`,
    );
    assert.equal(signup, Math.trunc(signup!), `${shots} shots: whole pesos only`);
  }
});

test("AT 40%, the LIVE charged Setnayan AI price does NOT move", () => {
  // ⚠ The reassuring half of the owner's ruling, and the reason it was safe to
  // apply: 40% of ₱2,499 is ₱1,499.40, which rounds to the ₱1,499 already
  // charged. Band B likewise. Only the two switched-off price-source rows move.
  assert.equal(signupPriceFor(2499, 40), 1499, 'band A — the live, charged row');
  assert.equal(signupPriceFor(1499, 40), 899, 'band B');
  assert.equal(signupPriceFor(899, 40), 539, 'band C moves: was ₱499');
  assert.equal(signupPriceFor(199, 40), 119, 'band D moves: was ₱99');
});

test('WHOLE PESOS ARE A RULE — no discount may produce a fraction', () => {
  // Migration 20271176315255 RAISES on a fractional sign-up price and is written
  // to be re-run, so a fraction here would fail a shipped migration later.
  for (const pct of [0, 1, 7.5, 10, 33.33, 40, 44.49, 50.25, 66.7, 99.99]) {
    for (const [, regular] of PAPIC_LADDER_EXPECTED) {
      const v = signupPriceFor(regular, pct);
      assert.ok(v != null && v === Math.trunc(v), `₱${regular} at ${pct}% → ${v} is not a whole peso`);
    }
  }
});

test('rounding ties go DOWN, so the effective discount is never shallower than advertised', () => {
  // ₱101 at 50% is exactly ₱50.50 — the tie. Down (₱50) gives the customer
  // 50.5% off; up (₱51) would give 49.5%, i.e. LESS than advertised.
  assert.equal(signupPriceFor(101, 50), 50);
  const eff = effectiveDiscountPct(101, signupPriceFor(101, 50));
  assert.ok(eff! >= 50, `effective ${eff}% must not be below the nominal 50%`);
});

test('the effective discount shown beside a row matches the stored pair', () => {
  assert.ok(Math.abs(effectiveDiscountPct(2499, 1499)! - 40.016) < 0.001);
  assert.ok(Math.abs(effectiveDiscountPct(899, 499)! - 44.494) < 0.001);
  assert.equal(effectiveDiscountPct(2499, null), null, 'no sign-up price → nothing to show');
  assert.equal(effectiveDiscountPct(0, 0), null, 'a free row has no discount to state');
});

test('THE FLOOR IS PAPIC-ONLY — Setnayan AI is exempt', () => {
  // Owner 2026-08-28: "we will use the discount created for Papic Service Only
  // instead of both."
  const belowFloor = PAPIC_DISCOUNT_FLOOR_PCT - 5;
  assert.ok(
    discountComplaints('papic', belowFloor).some((c) => c.kind === 'below_floor'),
    'Papic below the floor must warn',
  );
  assert.equal(
    discountComplaints('ai', belowFloor).filter((c) => c.kind === 'below_floor').length,
    0,
    'Setnayan AI must NOT be floored — it answers to its own band discount',
  );
  assert.deepEqual(discountComplaints('papic', PAPIC_DISCOUNT_FLOOR_PCT), [], 'exactly at the floor is fine');
});

test('THE NONSENSE GUARD SURVIVES THE SCOPING — both families, always', () => {
  for (const family of ['papic', 'ai'] as const) {
    assert.ok(
      discountComplaints(family, -1).some((c) => c.kind === 'out_of_range'),
      `${family}: a negative discount must be refused`,
    );
    assert.ok(
      discountComplaints(family, 100).some((c) => c.kind === 'out_of_range'),
      `${family}: 100% must be refused`,
    );
    assert.ok(
      discountComplaints(family, 150).some((c) => c.kind === 'out_of_range'),
      `${family}: over 100% must be refused`,
    );
    assert.ok(
      discountComplaints(family, 0).some((c) => c.kind === 'not_a_discount'),
      `${family}: 0% is not a discount and must be said out loud`,
    );
  }
  assert.equal(signupPriceFor(100, 100), null, 'a 100% discount produces no price, never ₱0');
  assert.equal(signupPriceFor(100, -5), null);
});

test('NOTHING CLAMPS — a complaint is returned, the number is never rewritten', () => {
  // The screen warns and lets him decide. A control that silently corrects your
  // input is worse than one that refuses.
  const pct = 3;
  assert.ok(discountComplaints('papic', pct).length > 0, 'it complains');
  assert.equal(
    signupPriceFor(1000, pct),
    970,
    'and it still computes what he typed — 3%, not the 10% floor',
  );
});

test('a family-wide save says exactly which rows move, before it happens', () => {
  const rows = [
    { serviceCode: 'SETNAYAN_AI', title: 'A', regularPhp: 2499, signupPhp: 1499 },
    { serviceCode: 'SETNAYAN_AI_B', title: 'B', regularPhp: 1499, signupPhp: 899 },
    { serviceCode: 'SETNAYAN_AI_C', title: 'C', regularPhp: 899, signupPhp: 499 },
    { serviceCode: 'SETNAYAN_AI_D', title: 'D', regularPhp: 199, signupPhp: 99 },
  ];
  const preview = previewFamilySave(rows, 40);
  assert.deepEqual(
    preview.filter((p) => p.moves).map((p) => p.serviceCode),
    ['SETNAYAN_AI_C', 'SETNAYAN_AI_D'],
    'exactly the two switched-off price-source rows move at 40%',
  );
  assert.equal(preview.find((p) => p.serviceCode === 'SETNAYAN_AI')!.nextSignupPhp, 1499);
  assert.equal(preview.find((p) => p.serviceCode === 'SETNAYAN_AI_C')!.nextSignupPhp, 539);
});

test('family membership — and SETNAYAN_AI_RENEW belongs to neither', () => {
  assert.equal(familyForServiceCode('PAPIC_GUEST_10K'), 'papic');
  assert.equal(familyForServiceCode('PAPIC_GUEST'), 'papic');
  assert.equal(familyForServiceCode('SETNAYAN_AI'), 'ai');
  assert.equal(familyForServiceCode('SETNAYAN_AI_C'), 'ai');
  // ⚠ A renewal is not an onboarding purchase — nobody renews during the create
  // flow — and it is the one row where a discount lands on a fraction of a peso.
  // Same exclusion the shipped migration makes.
  assert.equal(familyForServiceCode('SETNAYAN_AI_RENEW'), null);
  assert.equal(familyForServiceCode('COUPLE_WEBSITE_PRO'), null);
});

test('the seeded defaults are the values live in production', () => {
  assert.equal(FAMILY_DISCOUNT_DEFAULT_PCT.papic, 10);
  assert.equal(FAMILY_DISCOUNT_DEFAULT_PCT.ai, 40);
});

// ═══════════════════════════════════════════════════════════════════════════
// WHICH COMPLAINTS REFUSE A SAVE — owner ruled 2026-08-29
//
// The floor used to warn and save anyway; its own message said so out loud.
// These pin the split so a future edit cannot quietly turn a refusal back into
// a reminder, which is exactly the state this replaced.
// ═══════════════════════════════════════════════════════════════════════════

test('the Papic floor REFUSES a save; a pointless 0% only warns', () => {
  const under = discountComplaints('papic', PAPIC_DISCOUNT_FLOOR_PCT - 5);
  assert.ok(blockingComplaint(under), 'below the floor must block');
  assert.equal(blockingComplaint(under)!.kind, 'below_floor');

  // 0% on an AI row: no floor applies, so the only complaint is the advisory.
  const zero = discountComplaints('ai', 0);
  assert.ok(
    zero.some((c) => c.kind === 'not_a_discount'),
    'a 0% discount must still be reported',
  );
  assert.equal(
    blockingComplaint(zero),
    null,
    'running a family without a sign-up saving is legal — it must not be blocked',
  );
});

test('nonsense refuses for BOTH families, floor or no floor', () => {
  for (const family of ['papic', 'ai'] as const) {
    assert.equal(
      blockingComplaint(discountComplaints(family, -1))?.kind,
      'out_of_range',
      `a negative discount must block for ${family}`,
    );
    assert.equal(
      blockingComplaint(discountComplaints(family, 100))?.kind,
      'out_of_range',
      `a 100% discount must block for ${family}`,
    );
  }
});

test('the floor tolerates a rounding tail, so a price computed ONTO it still saves', () => {
  assert.equal(
    blockingComplaint(discountComplaints('papic', PAPIC_DISCOUNT_FLOOR_PCT)),
    null,
    'exactly at the floor must save',
  );
  assert.equal(
    blockingComplaint(discountComplaints('papic', PAPIC_DISCOUNT_FLOOR_PCT - 0.001)),
    null,
    'a hair under, from dividing pesos, must not be refused',
  );
  assert.ok(
    blockingComplaint(discountComplaints('papic', PAPIC_DISCOUNT_FLOOR_PCT - 0.5)),
    'a real half-point under the floor must still be refused',
  );
});

test("the refusal message no longer promises it will not refuse", () => {
  const [complaint] = discountComplaints('papic', 1).filter((c) => c.kind === 'below_floor');
  assert.ok(complaint, 'a 1% Papic discount must complain');
  assert.doesNotMatch(
    complaint!.message,
    /reminder, not a refusal|nothing will stop you/i,
    'the message described the old warn-only behaviour and would now be a lie',
  );
});
