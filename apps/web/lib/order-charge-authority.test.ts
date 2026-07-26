/**
 * ⭐ SEC-7 — ₱0.01 BOUGHT A 28-DAY SETNAYAN AI SUBSCRIPTION.
 *
 * ── THE EXPLOIT, END TO END (verified against prod 2026-07-26) ───────────────
 *  1. `submitOrderAction` seeded its charge from
 *     `formData.get('original_centavos')`.
 *  2. It overwrote that ONLY when a catalog row resolved. Its own comment: *"Only
 *     SKUs in NEITHER catalog … keep the client value."*
 *  3. `resolveServiceSellability` returns `'unknown'` for keys in neither
 *     catalog, and `'unknown'` is deliberately ALLOWED (PAPIC_CAMERAS, the
 *     vendor branch keys, and this one all legitimately have no row).
 *  4. `SETNAYAN_AI_SUB` is in NEITHER `platform_retail_catalog_v2` NOR
 *     `platform_package_catalog`.
 *  5. Its branch also SKIPS the `event_members` check — the SKU is eventless by
 *     design — so no event, no membership, nothing to forge.
 *  6. On approval, `lib/sku-activation.ts` read the unit price (null) and called
 *     `cyclesFromAmount(0.01, null)`, whose guard was
 *     `return 1; // can't divide → grant one cycle`.
 *  7. → a full 28-day cycle for one centavo. Repeatable;
 *     `extendUserAiSubscription` STACKS the windows.
 *
 * ── WHAT THESE TESTS HOLD ────────────────────────────────────────────────────
 * The structural half (the charge traces to the server, the sale refuses without
 * one) lives in `order-price-authority.test.ts`. THIS file holds the BEHAVIOUR:
 * the exact arithmetic that made a centavo into a month, and the 36× overcharge
 * that a naive fix creates on the way out.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as orderChargeMath from './order-charge-math';
import {
  resolveAiSubTotal,
  chargeOverchargesDisplayedPrice,
  orderTotalToPhp,
  refusalMessage,
  type CatalogChargeResolution,
} from './order-charge-math';
import { AI_SUB_MAX_CYCLES, parseCycles } from './setnayan-ai-subscription';

const resolved = (centavos: number): CatalogChargeResolution => ({
  status: 'resolved',
  is_pax_priced: false,
  centavos,
  pax: null,
});
const MISSING: CatalogChargeResolution = { status: 'not_in_catalog' };
const ERRORED: CatalogChargeResolution = { status: 'error', message: 'connection reset' };

/* ── 1 · THE EXPLOIT IS DEAD ────────────────────────────────────────────────── */

test('SEC-7 · SETNAYAN_AI_SUB with NO catalog row REFUSES the sale', () => {
  // The live production state. Previously this is the branch that fell through
  // and kept `original_centavos` — i.e. the browser named the price.
  const out = resolveAiSubTotal(MISSING, 6);
  assert.equal(out.ok, false);
  assert.equal(out.ok === false && out.refusal, 'no_price_source');
  assert.match(
    out.ok === false ? (out.detail ?? '') : '',
    /no admin-managed unit price/,
    'the refusal must say WHY, so an owner can fix it by seeding the price',
  );
});

test('SEC-7 · there is NO hardcoded ₱499 fallback to slip through', () => {
  // A "sensible default" here would just be a second way for an unpriced SKU to
  // be sellable — and it would silently disagree with whatever the admin later
  // sets. Owner rule 2026-06-14: every price is admin-managed, never hardcoded.
  for (const cycles of [1, 2, 6, 12, AI_SUB_MAX_CYCLES]) {
    assert.equal(
      resolveAiSubTotal(MISSING, cycles).ok,
      false,
      `an unpriced SKU must refuse at ${cycles} cycles too`,
    );
  }
  assert.equal(resolveAiSubTotal(resolved(0), 6).ok, false, 'a ₱0 unit price is not a price');
  assert.equal(resolveAiSubTotal(resolved(-1), 6).ok, false, 'a negative unit price is not a price');
});

test('SEC-7 · a catalog READ ERROR refuses too — fail closed, never fall back', () => {
  const out = resolveAiSubTotal(ERRORED, 6);
  assert.equal(out.ok, false);
  assert.equal(
    out.ok === false && out.refusal,
    'read_error',
    'a transient read failure must block the checkout, not leave the POSTed price standing. ' +
      'An attacker can cause a "transient" failure.',
  );
});

test('SEC-7 · a missing/garbage cycle count refuses instead of defaulting to 1', () => {
  // parseCycles is the ONLY way a raw form value becomes a count; everything it
  // rejects must reach resolveAiSubTotal as null and refuse there.
  for (const bad of [null, undefined, '', 'abc', 0, -3, 2.5, {}]) {
    const out = resolveAiSubTotal(resolved(49900), parseCycles(bad));
    assert.equal(out.ok, false, `cycles=${JSON.stringify(bad)} must refuse`);
    assert.equal(out.ok === false && out.refusal, 'cycles_required');
  }
  // And directly: an unparsed/absent count is never quietly treated as 1.
  assert.equal(resolveAiSubTotal(resolved(49900), null).ok, false);
});

/* ── 2 · THE 36× OVERCHARGE A NAIVE FIX CREATES ─────────────────────────────── */

test('SEC-7 · unit × cycles happens ONCE — 6 cycles is 6×, never 36×', () => {
  // `setnayan-ai-subscribe.tsx` computes `totalCentavos = unit × cycles` and
  // passes it as `originalPriceCentavos`; the drawer forwards it verbatim as
  // `original_centavos`. Checkout then multiplied by `cycles` AGAIN. Default
  // preset = 6 cycles → 36×. Unreachable only while the unit was unresolvable —
  // making the price server-resolved is precisely what would have armed it.
  const unitCentavos = 49900; // ₱499
  const out = resolveAiSubTotal(resolved(unitCentavos), 6);
  assert.equal(out.ok, true);
  assert.ok(out.ok);
  assert.equal(out.total, 299400n, '₱499 × 6 = ₱2,994');
  assert.equal(orderTotalToPhp(out.total), 2994);
  assert.notEqual(out.total, 1796400n, '₱499 × 36 would be the double-multiply bug');
});

test('SEC-7 · the cycle count is clamped, so a huge posted count cannot inflate the bill', () => {
  const out = resolveAiSubTotal(resolved(49900), parseCycles('9999'));
  assert.ok(out.ok);
  assert.equal(
    out.total,
    BigInt(49900 * AI_SUB_MAX_CYCLES),
    'parseCycles clamps to AI_SUB_MAX_CYCLES — a posted 9999 buys the cap, not 9999 cycles',
  );
});

test('SEC-7 · the overcharge tripwire refuses to bill more than the buyer was shown', () => {
  // The structural guard against the 36× class: the customer consented to the
  // figure on their screen, so resolving HIGHER is a refusal.
  const out = resolveAiSubTotal(resolved(49900), 6);
  assert.ok(out.ok);
  const displayed = 299400n; // what setnayan-ai-subscribe.tsx renders

  assert.equal(
    chargeOverchargesDisplayedPrice({ total: out.total, displayedCentavos: displayed, volatile: false }),
    false,
    'the honest case must go through',
  );
  // Simulate the double-multiply landing on the wire.
  const doubled = (out.total * 6n) as typeof out.total;
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
  | 'setnayan_ai_subscription_unit'
>;
const _noBookedDealChargeSource: [UnexpectedChargeSource] extends [never] ? true : false = true;
void _noBookedDealChargeSource;

test('every refusal has buyer-facing copy that leaks nothing', () => {
  for (const r of ['no_price_source', 'read_error', 'cycles_required'] as const) {
    const msg = refusalMessage(r);
    assert.ok(msg.length > 10, `${r} needs real copy`);
    assert.ok(!/catalog|resolver|null|SQL|service_role/i.test(msg), `${r} leaks internals`);
  }
});
