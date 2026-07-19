/**
 * Custom-tier quote math (owner-signed rate card · VENDOR_TIERS_AND_BENEFITS.md
 * §11). Golden cases from the signed rate card + the charm-rounding edges.
 * Run with `pnpm test:unit` (tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  charmRoundUp,
  computeCustomQuote,
  type CustomComposition,
  type CustomUnitPrices,
} from './vendor-custom-pricing';

// The seeded rate-card unit prices (migration 20270512705572). The lib never
// hardcodes these — the caller reads them from vendor_billing_catalog — so the
// tests pin the math against the signed prices explicitly.
const PRICES: CustomUnitPrices = {
  base: 8999,
  branch: 999,
  reachStep: 499,
  reachNationwide: 2499,
  seat: 250,
  slot: 499,
  photoPack: 99,
  includedToken: 100,
  domain: 499,
};

/** Base composition = exactly the included tier (no add-ons). */
const BASE: CustomComposition = {
  branches: 1,
  reachKm: 100,
  nationwide: false,
  seats: 10,
  slotsPerCategory: 8,
  photos: 300,
  tokensPerCycle: 0,
  domain: false,
};

test('charmRoundUp: signed edges (16997→16999 · 16999→16999 · 17000→17099)', () => {
  assert.equal(charmRoundUp(16997), 16999);
  assert.equal(charmRoundUp(16999), 16999);
  assert.equal(charmRoundUp(17000), 17099);
});

test('charmRoundUp: non-positive / non-finite → 0', () => {
  assert.equal(charmRoundUp(0), 0);
  assert.equal(charmRoundUp(-5), 0);
  assert.equal(charmRoundUp(Number.NaN), 0);
  assert.equal(charmRoundUp(Infinity), 0);
});

test('base only quotes exactly the base fee (floored, no add-ons)', () => {
  const q = computeCustomQuote(BASE, PRICES);
  assert.equal(q.final28, 8999);
  assert.equal(q.list28, 8999);
  assert.equal(q.discountValue, 0);
  assert.equal(q.annual, charmRoundUp(8999 * 10)); // 89990 → 89999
  assert.equal(q.annual, 89999);
});

test('floor: below-base raw never quotes under the base fee', () => {
  // A degenerate composition (fewer than the included baselines) still floors at
  // base — excess() clamps negatives to 0, so raw == base here.
  const q = computeCustomQuote(
    { ...BASE, seats: 2, photos: 50, slotsPerCategory: 1 },
    PRICES,
  );
  assert.equal(q.final28, 8999);
});

test('5-branch = 12,999', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5 }, PRICES);
  assert.equal(q.raw, 12995); // 8999 + 4×999
  assert.equal(q.final28, 12999);
});

test('5-branch nationwide = 15,499', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5, nationwide: true }, PRICES);
  assert.equal(q.raw, 15494); // 8999 + 4×999 + 2499
  assert.equal(q.final28, 15499);
});

test('full-service (5-branch nationwide + domain + 100 tokens) = 25,999', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true, domain: true, tokensPerCycle: 100 },
    PRICES,
  );
  assert.equal(q.raw, 25993); // 8999 + 3996 + 2499 + 499 + 10000
  assert.equal(q.final28, 25999);
});

test('nationwide replaces per-step reach (no double-charge)', () => {
  const stepped = computeCustomQuote({ ...BASE, reachKm: 500 }, PRICES);
  // 4 steps × 499 = 1996 → 8999+1996 = 10995 → charm 10999
  assert.equal(stepped.raw, 10995);
  assert.equal(stepped.final28, 10999);
  // nationwide ignores reachKm entirely
  const nation = computeCustomQuote({ ...BASE, reachKm: 500, nationwide: true }, PRICES);
  assert.equal(nation.raw, 8999 + 2499);
});

test('per-step reach caps at 500 km (no steps beyond)', () => {
  const capped = computeCustomQuote({ ...BASE, reachKm: 900 }, PRICES);
  assert.equal(capped.raw, 8999 + 4 * 499); // same as 500 km
});

test('amount discount: applied to list, re-charm-rounded, floored at base', () => {
  // list = 15,499 (5-branch nationwide) − ₱2,000 = 13,499 → already ‑99 → 13,499
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 2000 },
  );
  assert.equal(q.list28, 15499);
  assert.equal(q.final28, 13499);
  assert.equal(q.discountValue, 2000);
  assert.equal(q.annual, charmRoundUp(13499 * 10)); // 134990 → 134999
});

test('percent discount: applied to list, re-charm-rounded UP to next ‑99', () => {
  // list = 12,999 (5-branch) × (1 − 0.10) = 11,699.1 → charm rounds UP → 11,799.
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 10 },
  );
  assert.equal(q.list28, 12999);
  assert.equal(q.final28, 11799);
  assert.equal(q.discountValue, 1200);
});

test('discount never pushes below the base fee (floored)', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 90 },
  );
  assert.equal(q.final28, 8999);
});

test('annual re-charm on a plan whose ×10 lands on a round hundred (169990→169999)', () => {
  // Find a final28 whose ×10 is 169,990: final28 = 16,999.
  // 5-branch nationwide + a few slots to reach 16,999.
  // 8999 + 3996 (4 branches) + 2499 (nationwide) = 15,494 · +3 slots ×499 = 1497
  // → 16,991 → charm 16,999. Then ×10 = 169,990 → charm 169,999.
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true, slotsPerCategory: 11 },
    PRICES,
  );
  assert.equal(q.final28, 16999);
  assert.equal(q.annual, 169999);
});

test('discountValue is exactly list28 − final28', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 1500 },
  );
  assert.equal(q.discountValue, q.list28 - q.final28);
});
