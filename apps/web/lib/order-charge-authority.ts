/**
 * ⭐ SEC-7 — THE SERVER RESOLVES THE CHARGE, OR THERE IS NO SALE.
 *
 * ── THE HOLE THIS CLOSES ─────────────────────────────────────────────────────
 * `submitOrderAction` seeded its charge from `formData.get('original_centavos')`
 * and only OVERWROTE it when a catalog resolver returned a row. Its own comment
 * said the quiet part out loud: *"Only SKUs in NEITHER catalog … keep the client
 * value."* `resolveServiceSellability` returns `'unknown'` for exactly those
 * keys, and `'unknown'` is deliberately ALLOWED — so for any key with no catalog
 * row, the browser set the price.
 *
 * Verified in prod 2026-07-26: `SETNAYAN_AI_SUB` is in NEITHER
 * `platform_retail_catalog_v2` NOR `platform_package_catalog`, and its branch in
 * checkout SKIPS the `event_members` check (the SKU is eventless by design). So
 * a POST of `service_key=SETNAYAN_AI_SUB, original_centavos=1` minted a ₱0.01
 * order — and on approval `lib/sku-activation.ts` divided ₱0.01 by an unknown
 * unit price, hit `cyclesFromAmount`'s `return 1 // can't divide → grant one
 * cycle`, and stamped a full 28-day subscription. Repeatable; the windows stack.
 *
 * ── THE RULE (owner-standing) ────────────────────────────────────────────────
 * NOTHING THE CUSTOMER CAN EDIT MAY SET A PRICE OR UNLOCK A PRODUCT.
 * No server-resolvable price ⇒ REFUSE THE SALE.
 *
 * This module is the one place that decides what an order costs. It is a
 * TOTAL-OR-NOTHING resolver: every caller either gets a fully-multiplied total
 * or a refusal. There is no third state, so there is no client fallback left to
 * fall back to.
 *
 * ── WHERE THE PURE HALF LIVES ────────────────────────────────────────────────
 * Types, the branded `OrderTotalCentavos`, the AI-subscription math and the
 * overcharge tripwire are in `lib/order-charge-math.ts` (no I/O, no
 * `server-only`) so they can be unit-tested directly. Everything is re-exported
 * from here, so callers import one module.
 *
 * ── WHAT IS DELIBERATELY *NOT* HERE ──────────────────────────────────────────
 * The sellability gate (`resolveServiceSellability`) stays a separate REJECT
 * that runs BEFORE this module, exactly as `lib/v2-catalog.ts` explains at
 * length: `is_active=false` is OVERLOADED (on `SETNAYAN_AI_RENEW` it means "not
 * independently sellable", not "retired"), and filtering `is_active` inside a
 * resolver used to turn "retired SKU charged its real price" into "charged
 * whatever the browser sent". Both properties are preserved.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  resolveRetailChargeCentavos,
  resolveBundleChargeResolution,
} from '@/lib/v2-catalog';
import { resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import type { AiPriceContext } from './setnayan-ai-type-pricing';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypeChargeCentavos,
} from '@/lib/setnayan-ai-event-pricing';
import {
  sealServerResolvedTotal,
  type OrderChargeAuthority,
} from '@/lib/order-charge-math';

export {
  chargeOverchargesDisplayedPrice,
  orderTotalToPhp,
  refusalMessage,
} from '@/lib/order-charge-math';
export type {
  ChargeRefusal,
  ChargeSource,
  OrderChargeAuthority,
  OrderTotalCentavos,
} from '@/lib/order-charge-math';

// ─────────────────────────────────────────────────────────────────────────────
// The authority
// ─────────────────────────────────────────────────────────────────────────────

export type ChargeAuthorityInput = {
  serviceKey: string;
  /**
   * The event this line is billed against. Since the per-USER subscription was
   * retired (2026-08-01) there is no eventless SKU left, but the type stays
   * nullable: a null simply fails to resolve a price and is refused.
   */
  eventId: string | null;
  /**
   * 🔒 WHICH PRICE APPLIES — AND THIS FIELD IS NOT THE BROWSER'S TO SET.
   *
   * Setnayan AI is cheaper when bought while the event is being created
   * (owner-locked 2026-08-12). `'onboarding'` may be passed ONLY by the
   * server-side event-commit path, which is unreachable from a client: nothing
   * in a request body is ever mapped onto it. It DEFAULTS to `'regular'`, so a
   * future call site that forgets it charges full price — the safe direction.
   * Getting this backwards would let anyone buy at the discount for ever.
   */
  priceContext?: AiPriceContext;
};

/**
 * THE charge for one order line, in centavos, resolved entirely server-side.
 *
 * Resolution order (first hit wins, except the AI per-type override which
 * deliberately supersedes the flat catalog row):
 *
 *   1. `SETNAYAN_AI_SUB`              — catalog UNIT price × validated cycles
 *   2. `platform_retail_catalog_v2`   — the retail SKUs (flat + the pax curve)
 *   3. Setnayan AI per-EVENT-TYPE ladder — overrides (2) when the flag is on
 *   4. `platform_package_catalog`     — bundles (GUIDED_PACK / MEDIA_PACK / PAPIC_UNLOCK*)
 *   5. …nothing else. REFUSE.
 *
 * 🚫 There is deliberately NO resolver for `setnayan_service__{category}` any
 * more. It was step (5) until 2026-07-26, when the owner deleted the whole
 * "book Setnayan as a vendor" purchase path: its price fell back to
 * `event_vendors.total_cost_php`, a figure the buying couple types in
 * themselves. Every Setnayan service is now an ordinary admin-priced catalog SKU
 * sold from the suite or its own studio page, so it resolves at step (2).
 *
 * Every DB miss is distinguished from every DB error, and an error REFUSES.
 */
export async function resolveOrderChargeCentavos(
  input: ChargeAuthorityInput,
): Promise<OrderChargeAuthority> {
  const { serviceKey, eventId, priceContext = 'regular' } = input;

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key in this environment. Under SEC-7 that is a refusal,
    // not a licence to bill whatever the browser sent.
    return { ok: false, refusal: 'read_error', detail: 'no service-role client' };
  }

  // ── 🔒 The per-USER subscription branch was REMOVED 2026-08-01 ────────────
  // `SETNAYAN_AI_SUB` was the only eventless SKU and the only one with a cycle
  // multiplier (`resolveAiSubTotal(unit, parseCycles(cyclesRaw))`). Setnayan AI
  // is PER EVENT (owner: "it is per event"), so that product no longer exists.
  //
  // Removing the branch makes the key STRICTLY harder to charge, never easier:
  // it now falls through to (5) and is refused with `no_price_source`. The old
  // branch only refused when the catalog lookup missed — had anyone ever seeded
  // a `SETNAYAN_AI_SUB` retail row it would have started selling again.

  // ── (2) The retail catalog ────────────────────────────────────────────────
  const retail = await resolveRetailChargeCentavos(eventId ?? '', serviceKey);
  if (retail.status === 'error') {
    return { ok: false, refusal: 'read_error', detail: retail.message };
  }
  if (retail.status === 'resolved') {
    // ── (3) Per-EVENT-TYPE Setnayan AI (owner-locked 2026-07-22) ────────────
    // Supersedes the flat SETNAYAN_AI row when the flag is on. Resolved from the
    // event's STORED type so a tampered client can't force a cheaper tier.
    // Inert while the flag is off — the helper is never called and the flat
    // catalog charge stands, byte-identical to before.
    if (serviceKey === SETNAYAN_AI_SKU && eventId) {
      if (await resolveSetnayanAiPerEventPricingEnabled()) {
        const perType = await resolveSetnayanAiTypeChargeCentavos(
          admin,
          eventId,
          priceContext,
        );
        // THREE STATES, AND THE MIDDLE ONE IS WHY THIS IS NOT AN `if (x != null)`.
        //
        //   read_error -> REFUSE. Owner-ruled 2026-08-27. Previously this
        //     returned null and FELL THROUGH to the flat retail row below, so a
        //     failed read did not merely guess - it billed a DIFFERENT PRICE
        //     than the one this branch exists to charge, silently.
        //   absent -> fall through, exactly as the old `null` did. The event row
        //     is genuinely not there; the ordinary catalog charge stands.
        //   resolved -> seal it.
        if (perType.status === 'read_error') {
          return { ok: false, refusal: 'read_error', detail: perType.message };
        }
        if (perType.status === 'resolved') {
          return sealServerResolvedTotal(perType.centavos, 'setnayan_ai_event_type');
        }
      }
    }
    return sealServerResolvedTotal(retail.centavos, 'retail_catalog', {
      // SEC-3: the pax this order is PRICED at, frozen onto the order row.
      paxSnapshot: retail.is_pax_priced ? retail.pax : null,
      // Pax totals legitimately move after render (live headcount, not the
      // host-writable estimate) — the overcharge tripwire must not trip on them.
      volatile: retail.is_pax_priced,
    });
  }

  // ── (4) The bundle catalog ────────────────────────────────────────────────
  const bundle = await resolveBundleChargeResolution(serviceKey);
  if (bundle.status === 'error') {
    return { ok: false, refusal: 'read_error', detail: bundle.message };
  }
  if (bundle.status === 'resolved') {
    return sealServerResolvedTotal(bundle.centavos, 'package_catalog');
  }

  // ── (5) Nothing owns this key ─────────────────────────────────────────────
  //
  // This is the SEC-7 fix in one line. Previously this fell through and kept
  // `original_centavos` from the POST body. Keys that legitimately land here and
  // are therefore NOT buyable through this action — each already mints its own
  // orders from a SERVER-side price, with no InlineCheckoutDrawer mount, so
  // reaching this action with one means a forged POST:
  //
  //   • PAPIC_CAMERAS                    — app/dashboard/[eventId]/studio/papic/
  //                                        actions.ts, from a server-computed quote.
  //   • vendor_additional_branch__<uuid> — app/vendor-dashboard/branches/actions.ts,
  //                                        from fetchBranchFeePhp() (vendor_billing_catalog).
  //   • vendor_extra_seat__ / vendor_booking_fee__ / the vendor add-ons
  //                                      — their own vendor actions, same pattern.
  //   • 'save-the-date:<slug>'           — DOES NOT EXIST. The comment that named it
  //                                        was wrong; the real Save-the-Date SKU is
  //                                        STD_PREMIUM_OPENINGS, an ordinary retail row.
  //   • setnayan_service__{category}     — REMOVED 2026-07-26 (owner ruling). It had a
  //                                        resolver here until this change; now it is
  //                                        just another unowned key and lands on the
  //                                        refusal below, by design. Nothing mounts a
  //                                        drawer against it any more either, so a POST
  //                                        carrying one is forged.
  return {
    ok: false,
    refusal: 'no_price_source',
    detail: `no server-side price resolver owns service_key=${serviceKey.slice(0, 64)}`,
  };
}
