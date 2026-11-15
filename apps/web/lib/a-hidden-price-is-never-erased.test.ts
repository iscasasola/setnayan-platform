/**
 * A HIDDEN PRICE IS NEVER ERASED — #5936, controller audit on PR #7560 (Fix A).
 *
 * A Suppliers=Edit delegate whose Budget & payments area is Off reads every booking amount as hidden
 * (`event_vendor_money_read` → `money_shown: false`, amounts null). The self-added supplier's Details sheet then
 * pre-fills Price as '' and posts it back with `price_only`. Before this fix `updateVendorCosts` wrote
 * `total_cost_php = NULL` — a delegate fixed a phone number, tapped Save, and the couple's ₱120,000 was gone — and
 * read the hidden total as 0, so the pax surcharge re-baselined.
 *
 * This calls the payload rule itself (lib/booking-cost-write.ts) and checks the action wires it.
 *
 * Run (from apps/web): tsx --test lib/a-hidden-price-is-never-erased.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import { bookingCostWrite, type BookingCostWriteInput } from './booking-cost-write';
import { BOOKING_MONEY_COLUMNS } from './event-vendor-money';

const HIDDEN = { total_cost_php: null, money_shown: false } as const;
const SHOWN = { total_cost_php: 120000, money_shown: true } as const;

const input = (over: Partial<BookingCostWriteInput>): BookingCostWriteInput => ({
  priceOnly: true,
  quoteSettlesPrice: false,
  existing: HIDDEN,
  newTotal: null, // the Details sheet pre-filled '' — parseMoney('') is null
  transport: null,
  foodAllowance: null,
  crewSize: 2,
  crewMealCovered: false,
  ...over,
});

describe('a Budget-off delegate saving a booking leaves every amount as it is', () => {
  it('the Details sheet (price-only, blank price) writes nothing — total_cost_php is untouched', () => {
    const { payload, totalChanged } = bookingCostWrite(input({}));
    assert.deepEqual(payload, {}, 'a hidden price posted back blank must not be written as NULL');
    assert.equal(totalChanged, false, 'a hidden total is not a measured 0 — the pax surcharge must not re-baseline');
  });

  it('even a typed price is not written by someone who cannot read the price', () => {
    const { payload } = bookingCostWrite(input({ newTotal: 1 }));
    assert.ok(!('total_cost_php' in payload));
  });

  it('the full Costing form writes the crew fields and none of the five amounts', () => {
    for (const crewMealCovered of [false, true]) {
      const { payload, totalChanged } = bookingCostWrite(
        input({ priceOnly: false, transport: 0, foodAllowance: 0, crewMealCovered, crewSize: 5 }),
      );
      for (const col of BOOKING_MONEY_COLUMNS) {
        assert.ok(!(col in payload), `crewMealCovered=${crewMealCovered}: ${col} written by a delegate who cannot read it`);
      }
      assert.deepEqual(payload, { crew_size: 5, crew_meal_covered: crewMealCovered });
      assert.equal(totalChanged, false);
    }
  });

  it('a host (amounts shown) still sets, clears and re-baselines the price as before', () => {
    assert.deepEqual(bookingCostWrite(input({ existing: SHOWN, newTotal: 130000 })), {
      payload: { total_cost_php: 130000 },
      totalChanged: true,
    });
    assert.deepEqual(bookingCostWrite(input({ existing: SHOWN, newTotal: 120000 })).totalChanged, false);
    // A host who blanks the price really does clear it.
    assert.deepEqual(bookingCostWrite(input({ existing: SHOWN, newTotal: null })).payload, { total_cost_php: null });
  });
});

describe('the action uses the rule with what the reader returned', () => {
  const ACTIONS = stripComments(
    readFileSync(path.join(__dirname, '../app/dashboard/[eventId]/vendors/actions.ts'), 'utf8'),
  );
  const start = ACTIONS.indexOf('export async function updateVendorCosts(');
  const body = ACTIONS.slice(start, ACTIONS.indexOf('\nexport ', start + 10));

  it('updateVendorCosts reads the amounts through the reader and hands them to bookingCostWrite', () => {
    assert.ok(start >= 0, 'updateVendorCosts not found');
    assert.match(body, /readOneBookingMoney\(supabase, eventId, vendorId\)/);
    assert.match(body, /bookingCostWrite\(\{[^}]*\bexisting\b/);
    assert.doesNotMatch(body, /const updatePayload[^=]*=\s*priceOnly/, 'the payload is decided in two places again');
    assert.doesNotMatch(body, /const totalChanged\s*=/, 'totalChanged is computed outside the rule again');
  });
});
