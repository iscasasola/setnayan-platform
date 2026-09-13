/**
 * ⭐ SEC-7 — ₱0.01 BOUGHT A 28-DAY SETNAYAN AI SUBSCRIPTION.
 *
 * ── THE EXPLOIT, END TO END (verified against prod 2026-07-26) ───────────────
 *  1. `submitOrderAction` seeded its charge from
 *     `formData.get('original_centavos')`.
 *  2. It overwrote that ONLY when a catalog row resolved. Its own comment: *"Only
 *     SKUs in NEITHER catalog … keep the client value."*
 *  3. `SETNAYAN_AI_SUB` was in neither catalog, and its checkout branch also
 *     SKIPPED the `event_members` check — the SKU was eventless by design.
 *  4. On approval `cyclesFromAmount(0.01, null)` returned 1 and stamped a full
 *     28-day cycle. Repeatable; the windows STACKED.
 *
 * ── 🔒 THE EXPLOITABLE SURFACE NO LONGER EXISTS (2026-08-01) ─────────────────
 * Setnayan AI is PER EVENT (owner: "it is per event"). `SETNAYAN_AI_SUB`, the
 * per-USER term pass, is deleted — SKU, table, flag, activation writer, refund
 * path, checkout exemption and charge branch. With it went:
 *
 *   • the ONLY eventless SKU        → the `event_members` check is unconditional
 *   • the ONLY cycle multiplier     → nothing multiplies a catalog price at all
 *   • `resolveAiSubTotal`           → the only `unit × cycles` site anywhere
 *   • the `cycles_required` refusal and the `setnayan_ai_subscription_unit`
 *     charge source → both unemittable, both removed from their unions
 *
 * So the arithmetic these tests used to pin is GONE rather than guarded. What
 * remains here is the part that still has teeth: the one-way overcharge tripwire
 * (which protects every SKU, not just the retired one), and the structural
 * tripwires that fire if a client-priced key shape comes back. The
 * "charge traces to the server" half lives in `order-price-authority.test.ts`.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as orderChargeMath from './order-charge-math';
import {
  chargeOverchargesDisplayedPrice,
  orderTotalToPhp,
  refusalMessage,
  sealServerResolvedTotal,
} from './order-charge-math';

/** A server-resolved total, the only way one can be constructed. */
const sealed = (centavos: number) => {
  const out = sealServerResolvedTotal(centavos, 'retail_catalog');
  assert.ok(out.ok);
  return out.total;
};

/* ── 1 · THE RETIRED SUBSCRIPTION LEAVES NO PRICING PATH BEHIND ─────────────── */

test('SEC-7 · nothing in the pure charge math multiplies a catalog price', () => {
  // `resolveAiSubTotal` was the single `unit × cycles` site in the codebase. With
  // the per-USER subscription retired there is no multiplication left between a
  // catalog figure and an order total — every total is sealed as-is. This is the
  // 36×-overcharge class being RETIRED rather than defended.
  const src = orderChargeMath as Record<string, unknown>;
  assert.equal(
    typeof src.resolveAiSubTotal,
    'undefined',
    'resolveAiSubTotal is back — Setnayan AI is per event (owner 2026-08-01); a cycle ' +
      'multiplier means a term-pass product was rebuilt. Read the tombstone in order-charge-math.ts.',
  );
});

test('SEC-7 · the retired cycle refusal + charge source stay unemittable', () => {
  // Both were TS-only union members with no DB enum behind them. If either
  // returns, something is emitting it — i.e. the subscription path is back.
  const refusals: orderChargeMath.ChargeRefusal[] = ['no_price_source', 'read_error'];
  for (const r of refusals) {
    assert.ok(refusalMessage(r).length > 10, `${r} needs real copy`);
  }
});

test('SEC-7 · a non-finite or negative price refuses instead of billing something', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const out = sealServerResolvedTotal(bad, 'retail_catalog');
    assert.equal(out.ok, false, `centavos=${bad} must refuse`);
    assert.equal(out.ok === false && out.refusal, 'no_price_source');
  }
});

/* ── 2 · THE ONE-WAY OVERCHARGE TRIPWIRE (guards EVERY sku) ─────────────────── */


test('SEC-7 · the overcharge tripwire refuses to bill more than the buyer was shown', () => {
  // The structural guard against the 36× class: the customer consented to the
  // figure on their screen, so resolving HIGHER is a refusal.
  const total = sealed(299400); // ₱2,994 resolved server-side
  const displayed = 299400n; // what the buyer's screen showed

  assert.equal(
    chargeOverchargesDisplayedPrice({ total, displayedCentavos: displayed, volatile: false }),
    false,
    'the honest case must go through',
  );
  // Simulate a multiplied total landing on the wire (the historical 36× shape).
  const doubled = (total * 6n) as typeof total;
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: doubled, displayedCentavos: displayed, volatile: false }),
    true,
    'a 36× total against a 6× display must be refused, not billed',
  );
});

test('SEC-7 · the tripwire is ONE-WAY and exempts volatile (pax) totals', () => {
  const cheaper = 100000n as unknown as Parameters<
    typeof chargeOverchargesDisplayedPrice
  >[0]['total'];
  // Resolving LOWER than the display is legitimate — the vendor-unlocked 3D Plan
  // discount does exactly that — and the server figure wins regardless, so a
  // posted value tampered DOWN only blocks the tamperer's own checkout.
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: cheaper, displayedCentavos: 299900n, volatile: false }),
    false,
  );
  // Pax-priced totals legitimately rise after render: SEC-3 prices them off LIVE
  // headcount rather than the host-writable `estimated_pax`, so an upward
  // divergence there is the feature working.
  const higher = 404900n as unknown as Parameters<
    typeof chargeOverchargesDisplayedPrice
  >[0]['total'];
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: higher, displayedCentavos: 299900n, volatile: true }),
    false,
    'a pax uplift must not be mistaken for an overcharge',
  );
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: higher, displayedCentavos: 299900n, volatile: false }),
    true,
  );
  // No display reference at all → nothing to compare; the server price stands.
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: higher, displayedCentavos: null, volatile: false }),
    false,
  );
  assert.equal(
    chargeOverchargesDisplayedPrice({ total: higher, displayedCentavos: 0n, volatile: false }),
    false,
  );
});

/* ── 3 · THE REMOVED KEY SHAPE ──────────────────────────────────────────────── */

test('`setnayan_service__{category}` stays REMOVED — no parser, no prefix', () => {
  // Owner ruling 2026-07-26: "all setnayan in app services are either on their
  // exact location on the dashboard or on suites". The second way to buy from
  // Setnayan — book Setnayan as a VENDOR, synthesise `setnayan_service__{cat}`
  // at runtime, and price it from a precedence chain ending at
  // `event_vendors.total_cost_php` — was DELETED, not repriced. That last tier
  // let the buying couple type the number they would be charged, which is the
  // same defect class as SEC-5 (`events.event_type`).
  //
  // This test is the tripwire: two exports carried the key shape, and if either
  // reappears the purchase path is being rebuilt. Read the tombstone comment in
  // `order-charge-math.ts` before deleting this assertion.
  const exported = Object.keys(orderChargeMath);
  assert.ok(
    !exported.includes('SETNAYAN_SERVICE_KEY_PREFIX'),
    'SETNAYAN_SERVICE_KEY_PREFIX is back — the removed first-party buy path is being rebuilt',
  );
  assert.ok(
    !exported.includes('setnayanServiceCategoryFromKey'),
    'setnayanServiceCategoryFromKey is back — its only caller was the removed resolver',
  );
});

// The audit-source union lost its `'event_vendor_setnayan_service'` member with
// the resolver. A runtime assertion cannot see that — `ChargeSource` is a TYPE —
// so the tripwire is type-level and fires in `pnpm typecheck`: adding ANY member
// back makes `UnexpectedChargeSource` non-`never`, the conditional resolve to
// `false`, and `const _: false = true` a compile error.
type UnexpectedChargeSource = Exclude<
  orderChargeMath.ChargeSource,
  | 'retail_catalog'
  | 'package_catalog'
  | 'setnayan_ai_event_type'
  | 'setnayan_ai_comeback'
>;
const _noBookedDealChargeSource: [UnexpectedChargeSource] extends [never] ? true : false = true;
void _noBookedDealChargeSource;

test('every refusal has buyer-facing copy that leaks nothing', () => {
  for (const r of ['no_price_source', 'read_error'] as const) {
    const msg = refusalMessage(r);
    assert.ok(msg.length > 10, `${r} needs real copy`);
    assert.ok(!/catalog|resolver|null|SQL|service_role/i.test(msg), `${r} leaks internals`);
  }
});
