/**
 * Unit suite for the Adaptive Pax Pricing surcharge math (Phase 5). Load-bearing
 * invariants: no rate ⇒ no surcharge (the owner fallback), at/below the quoted
 * base ⇒ no surcharge, the floor+block model rounds UP per block, and the math
 * is symmetric (a drop below a previously-applied surcharge yields a negative
 * delta at the call site, which this helper supports by returning a lower
 * target).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeAddedPaxSurcharge } from './pax';

test('no rate (null/0) ⇒ no surcharge — the owner fallback', () => {
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 250, quoteBasePax: 180, ratePhp: null }),
    0,
  );
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 250, quoteBasePax: 180, ratePhp: 0 }),
    0,
  );
});

test('at or below the quoted base ⇒ no surcharge', () => {
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 180, quoteBasePax: 180, ratePhp: 300 }),
    0,
  );
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 150, quoteBasePax: 180, ratePhp: 300 }),
    0,
  );
});

test('per-guest surcharge (default block 1)', () => {
  // 25 extra guests × ₱300 = ₱7,500
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 205, quoteBasePax: 180, ratePhp: 300 }),
    7500,
  );
});

test('per-block surcharge rounds UP per block', () => {
  // 60 extra over 50-guest blocks = 2 blocks × ₱350 = ₱700
  assert.equal(
    computeAddedPaxSurcharge({
      livePax: 160,
      quoteBasePax: 100,
      ratePhp: 350,
      block: 50,
    }),
    700,
  );
  // exactly one block boundary (50 extra) = 1 block
  assert.equal(
    computeAddedPaxSurcharge({
      livePax: 150,
      quoteBasePax: 100,
      ratePhp: 350,
      block: 50,
    }),
    350,
  );
  // 1 over the block = next block up
  assert.equal(
    computeAddedPaxSurcharge({
      livePax: 151,
      quoteBasePax: 100,
      ratePhp: 350,
      block: 50,
    }),
    700,
  );
});

test('null pax / base ⇒ no surcharge (nothing to anchor on)', () => {
  assert.equal(
    computeAddedPaxSurcharge({ livePax: null, quoteBasePax: 180, ratePhp: 300 }),
    0,
  );
  assert.equal(
    computeAddedPaxSurcharge({ livePax: 205, quoteBasePax: null, ratePhp: 300 }),
    0,
  );
});

test('a lower live pax yields a lower target (symmetric delta at call site)', () => {
  // Applied surcharge was for 250; count drops to 205 → lower target, so the
  // caller's (target - applied) delta is negative — the symmetric-confirm case.
  const at250 = computeAddedPaxSurcharge({ livePax: 250, quoteBasePax: 180, ratePhp: 300 });
  const at205 = computeAddedPaxSurcharge({ livePax: 205, quoteBasePax: 180, ratePhp: 300 });
  assert.equal(at250, 21000);
  assert.equal(at205, 7500);
  assert.ok(at205 - at250 < 0);
});
