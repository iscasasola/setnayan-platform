/**
 * SETTING A PRICE MUST NOT RESET THE REST OF THE COSTING. (2026-09-21)
 *
 * `updateVendorCosts` rewrites every costing column on each call, reading an
 * absent field as null / false — right for the workspace Costing form, which
 * posts all of them. The bench's inline price control (#5777) posted only the
 * price plus transport and food, so every save silently set `crew_size` to
 * null and `crew_meal_covered` to false — erasing "the event feeds this crew".
 *
 * The fix is a `price_only` mode. This guards both halves:
 *  · the writer, in price-only mode, touches ONLY `total_cost_php`;
 *  · every caller that manages only the price says so.
 *
 * ⚠ Comment-stripped with the repo's one stripper, and the block is sliced
 * between two anchors that are asserted present, so a rename fails loud.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bookingCostWrite } from '@/lib/booking-cost-write';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS = stripComments(readFileSync(path.join(HERE, 'actions.ts'), 'utf8'));
const BENCH_PRICE = stripComments(
  readFileSync(path.join(HERE, '_components', 'self-added-price.tsx'), 'utf8'),
);

describe('price-only leaves the rest of the costing alone', () => {
  // The payload is decided by lib/booking-cost-write.ts (#5936); updateVendorCosts hands it the switch.
  const write = (over: Partial<Parameters<typeof bookingCostWrite>[0]> = {}) =>
    bookingCostWrite({
      priceOnly: true,
      quoteSettlesPrice: false,
      existing: { total_cost_php: 40000, money_shown: true },
      newTotal: 45000,
      transport: 1500,
      foodAllowance: 800,
      crewSize: 3,
      crewMealCovered: true,
      ...over,
    });

  it('the writer, in price-only mode, writes the price and nothing else', () => {
    assert.match(ACTIONS, /const priceOnly = formData\.get\('price_only'\) === '1'/);
    assert.match(ACTIONS, /bookingCostWrite\(\{[^}]*\bpriceOnly\b/, 'updateVendorCosts must hand priceOnly to bookingCostWrite');
    assert.deepEqual(write().payload, { total_cost_php: 45000 });
  });

  it('writes NOTHING when an accepted quote already settles the price', () => {
    assert.deepEqual(write({ quoteSettlesPrice: true }).payload, {});
    assert.match(ACTIONS, /if \(Object\.keys\(updatePayload\)\.length === 0\) return;/);
  });

  it('every price-only caller says so', () => {
    assert.match(BENCH_PRICE, /fd\.set\('price_only', '1'\)/, 'the bench price control');
    // addManualSupplier + updateSelfAddedSupplier both build a costFd.
    const n = (ACTIONS.match(/costFd\.set\('price_only', '1'\)/g) ?? []).length;
    assert.equal(n, 2, `expected the add AND details sheets to post price_only, found ${n}`);
  });

  it('the bench control no longer echoes columns it does not own', () => {
    for (const col of ['transport_php', 'food_allowance_php', 'crew_size', 'crew_meal_covered']) {
      assert.ok(!BENCH_PRICE.includes(`'${col}'`), `the bench price control posts ${col} again`);
    }
  });
});
