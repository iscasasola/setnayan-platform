/**
 * ⭐ SEC-7 — THE SERVER RESOLVES THE CHARGE, OR THERE IS NO SALE.
 *
 * ── THE HOLE THIS CLOSES ─────────────────────────────────────────────────────
 * `submitOrderAction` seeded its charge from `formData.get('original_centavos')`
 * and only OVERWROTE it when a catalog resolver returned a row. Its own comment
 * said the quiet part out loud: *"Only SKUs in NEITHER catalog … keep the client
 * value."* `resolveServiceSellability` returns `'unknown'` for exactly those
 * keys and `'unknown'` is deliberately ALLOWED — so for any key with no catalog
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
 * ── WHY THE RETURN VALUE IS A BRANDED bigint ─────────────────────────────────
 * Fixing SEC-7 naively creates a 36× OVERCHARGE. `setnayan-ai-subscribe.tsx`
 * already computes `unit × cycles` client-side and ships it as
 * `original_centavos`; checkout then multiplied by `cycles` AGAIN. Unreachable
 * while the unit was unresolvable — but the moment the price becomes
 * server-resolved, a 6-cycle default preset bills 36×.
 *
 * So the cycle multiply now happens in EXACTLY ONE PLACE: inside
 * {@link resolveOrderChargeCentavos}, which owns `parseCycles` too. The value it
 * returns is an {@link OrderTotalCentavos} — a bigint branded with a private
 * symbol. Any arithmetic on it (`total * BigInt(n)`) yields a plain `bigint`,
 * which is NOT assignable back to `OrderTotalCentavos`, and the brand's
 * constructor is module-private. A caller therefore cannot multiply a total and
 * keep calling it a total: double-multiplication is a COMPILE ERROR, not a code
 * review item.
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
  type CatalogChargeResolution,
} from '@/lib/v2-catalog';
import { AI_SUB_SKU, parseCycles, AI_SUB_MAX_CYCLES } from '@/lib/setnayan-ai-subscription';
import { resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypeChargeCentavos,
} from '@/lib/setnayan-ai-event-pricing';

// ─────────────────────────────────────────────────────────────────────────────
// The branded total
// ─────────────────────────────────────────────────────────────────────────────

declare const ORDER_TOTAL_BRAND: unique symbol;

/**
 * A FULLY-RESOLVED, FULLY-MULTIPLIED order total in centavos.
 *
 * The brand is a private `unique symbol`, so this type can only be produced by
 * `sealTotal` below — no caller can construct one, and no caller can derive one
 * from another (`a * b` is a plain `bigint`). That is what makes the 36× cycles²
 * bug unrepresentable rather than merely absent.
 */
export type OrderTotalCentavos = bigint & { readonly [ORDER_TOTAL_BRAND]: true };

/** The ONLY constructor for {@link OrderTotalCentavos}. Module-private on purpose. */
function sealTotal(centavos: bigint): OrderTotalCentavos {
  return centavos as OrderTotalCentavos;
}

/** Plain-number escape hatch for the peso columns (`NUMERIC(12,2)`). */
export function orderTotalToPhp(total: OrderTotalCentavos): number {
  return Number(total) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// The result shape
// ─────────────────────────────────────────────────────────────────────────────

/** Which authoritative source produced the price. Recorded for the ledger + audits. */
export type ChargeSource =
  | 'retail_catalog'
  | 'package_catalog'
  | 'setnayan_ai_event_type'
  | 'setnayan_ai_subscription_unit'
  | 'event_vendor_setnayan_service';

export type ChargeRefusal =
  /** No resolver owns this service_key. A NEW key must fail the sale, never fall
   *  back to the browser — that is the whole of SEC-7. */
  | 'no_price_source'
  /** A resolver's read errored. Fail CLOSED: a checkout blocked for thirty
   *  seconds beats an order created at a client-supplied price. */
  | 'read_error'
  /** The per-user subscription needs a validated cycle count and did not get one. */
  | 'cycles_required';

export type OrderChargeAuthority =
  | {
      ok: true;
      /** The full amount to bill. Already includes any cycle multiplier. */
      total: OrderTotalCentavos;
      /** SEC-3 pax snapshot to freeze on the order row. Null for non-pax SKUs. */
      paxSnapshot: number | null;
      source: ChargeSource;
      /**
       * TRUE when the total legitimately moves after the page rendered (the pax
       * curve reads live headcount via `resolveLivePax`). The overcharge tripwire
       * below skips these — see {@link chargeOverchargesDisplayedPrice}.
       */
      volatile: boolean;
    }
  | { ok: false; refusal: ChargeRefusal; detail?: string };

/** Human copy for a refusal. Brand voice; never leaks internals to the buyer. */
export function refusalMessage(refusal: ChargeRefusal): string {
  switch (refusal) {
    case 'cycles_required':
      return 'Pick how many cycles to subscribe for.';
    case 'read_error':
      return 'We could not confirm the price for this right now. Please try again in a moment.';
    case 'no_price_source':
    default:
      return 'This service is not available to buy right now. Please pick it from your dashboard instead.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-catalog key shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `setnayan_service__{category}` — a FIRST-PARTY Setnayan service the couple
 * booked as an `event_vendors` row and pays Setnayan for through the same
 * apply-then-pay drawer (owner 2026-06-04). It has no catalog row because its
 * price is the booked deal, not a list price — so the authoritative source is
 * the event_vendors row itself, re-read server-side with the SAME precedence the
 * workspace page displays (locked package total → itemized line items →
 * `total_cost_php`).
 */
export const SETNAYAN_SERVICE_KEY_PREFIX = 'setnayan_service__';

export function setnayanServiceCategoryFromKey(serviceKey: string): string | null {
  if (!serviceKey.startsWith(SETNAYAN_SERVICE_KEY_PREFIX)) return null;
  const category = serviceKey.slice(SETNAYAN_SERVICE_KEY_PREFIX.length);
  return category.length > 0 ? category : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The authority
// ─────────────────────────────────────────────────────────────────────────────

export type ChargeAuthorityInput = {
  serviceKey: string;
  /** Null for the eventless per-user subscription. */
  eventId: string | null;
  /** RAW form value. Parsed + clamped HERE so no caller ever holds a cycle count. */
  cyclesRaw: unknown;
};

/**
 * THE charge for one order line, in centavos, resolved entirely server-side.
 *
 * Resolution order (first hit wins, except the AI per-type override which
 * deliberately supersedes the flat catalog row):
 *
 *   1. `platform_retail_catalog_v2`  — the 19 retail SKUs (flat + the pax curve)
 *   2. `platform_package_catalog`    — the bundles (GUIDED_PACK / MEDIA_PACK / PAPIC_UNLOCK*)
 *   3. Setnayan AI per-EVENT-TYPE ladder — overrides (1) when the flag is on
 *   4. `SETNAYAN_AI_SUB`             — catalog UNIT price × validated cycles
 *   5. `setnayan_service__{category}` — the booked event_vendors deal
 *   6. …nothing else. REFUSE.
 *
 * Every DB miss is distinguished from every DB error, and an error REFUSES.
 */
export async function resolveOrderChargeCentavos(
  input: ChargeAuthorityInput,
): Promise<OrderChargeAuthority> {
  const { serviceKey, eventId, cyclesRaw } = input;

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key in this environment. Under SEC-7 that is a refusal,
    // not a licence to bill whatever the browser sent.
    return { ok: false, refusal: 'read_error', detail: 'no service-role client' };
  }

  // ── (4) The per-USER subscription — the SEC-7 key itself ──────────────────
  //
  // Handled FIRST because it is the only eventless SKU and the only one with a
  // cycle multiplier. The UNIT price is admin-managed (`platform_retail_catalog_v2`
  // row `SETNAYAN_AI_SUB`); there is NO hardcoded ₱499 fallback, deliberately —
  // owner rule 2026-06-14 "every price is admin-managed · never hardcoded in
  // code", and a fallback here would be a second way for an unpriced SKU to be
  // sellable. Today that row does NOT exist in prod, so this SKU refuses. That
  // is correct: the surface is flag-gated and has never sold, and seeding a
  // price is a product decision for the owner, not a security patch.
  if (serviceKey === AI_SUB_SKU) {
    const cycles = parseCycles(cyclesRaw);
    if (cycles === null) return { ok: false, refusal: 'cycles_required' };

    const unit = await resolveRetailChargeCentavos(eventId ?? '', AI_SUB_SKU);
    if (unit.status === 'error') {
      return { ok: false, refusal: 'read_error', detail: unit.message };
    }
    if (unit.status === 'not_in_catalog' || unit.centavos <= 0) {
      return {
        ok: false,
        refusal: 'no_price_source',
        detail: `${AI_SUB_SKU} has no admin-managed unit price`,
      };
    }
    // ⚠ THE ONLY PLACE unit × cycles HAPPENS. `sealTotal` brands the product, and
    // the brand cannot be re-derived — so no caller can multiply it a second
    // time. `parseCycles` already clamped to [1, AI_SUB_MAX_CYCLES]; the assert
    // is a belt-and-braces guard against a future edit loosening that.
    const safeCycles = Math.min(Math.max(1, cycles), AI_SUB_MAX_CYCLES);
    return {
      ok: true,
      total: sealTotal(BigInt(unit.centavos) * BigInt(safeCycles)),
      paxSnapshot: null,
      source: 'setnayan_ai_subscription_unit',
      volatile: false,
    };
  }

  // ── (1) The retail catalog ────────────────────────────────────────────────
  const retail: CatalogChargeResolution = await resolveRetailChargeCentavos(
    eventId ?? '',
    serviceKey,
  );
  if (retail.status === 'error') {
    return { ok: false, refusal: 'read_error', detail: retail.message };
  }
  if (retail.status === 'resolved') {
    // ── (3) Per-EVENT-TYPE Setnayan AI (owner-locked 2026-07-22) ────────────
    // Supersedes the flat SETNAYAN_AI row when the flag is on. Resolved from the
    // event's STORED type so a tampered client can't force a cheaper tier.
    if (serviceKey === SETNAYAN_AI_SKU && eventId) {
      if (await resolveSetnayanAiPerEventPricingEnabled()) {
        const perType = await resolveSetnayanAiTypeChargeCentavos(admin, eventId);
        if (perType != null) {
          return {
            ok: true,
            total: sealTotal(BigInt(perType)),
            paxSnapshot: null,
            source: 'setnayan_ai_event_type',
            volatile: false,
          };
        }
      }
    }
    return {
      ok: true,
      total: sealTotal(BigInt(retail.centavos)),
      paxSnapshot: retail.is_pax_priced ? retail.pax : null,
      source: 'retail_catalog',
      volatile: retail.is_pax_priced,
    };
  }

  // ── (2) The bundle catalog ────────────────────────────────────────────────
  const bundle = await resolveBundleChargeResolution(serviceKey);
  if (bundle.status === 'error') {
    return { ok: false, refusal: 'read_error', detail: bundle.message };
  }
  if (bundle.status === 'resolved') {
    return {
      ok: true,
      total: sealTotal(BigInt(bundle.centavos)),
      paxSnapshot: null,
      source: 'package_catalog',
      volatile: false,
    };
  }

  // ── (5) The booked first-party Setnayan service ───────────────────────────
  const category = setnayanServiceCategoryFromKey(serviceKey);
  if (category && eventId) {
    const booked = await resolveSetnayanServiceChargeCentavos(admin, eventId, category);
    if (booked.status === 'error') {
      return { ok: false, refusal: 'read_error', detail: booked.message };
    }
    if (booked.status === 'resolved') {
      return {
        ok: true,
        total: sealTotal(BigInt(booked.centavos)),
        paxSnapshot: null,
        source: 'event_vendor_setnayan_service',
        volatile: false,
      };
    }
  }

  // ── (6) Nothing owns this key ─────────────────────────────────────────────
  //
  // This is the SEC-7 fix in one line. Previously this fell through and kept
  // `original_centavos` from the POST body. Keys that legitimately land here and
  // are therefore NOT buyable through this action:
  //
  //   • PAPIC_CAMERAS                     — minted by app/dashboard/[eventId]/studio/
  //                                         papic/actions.ts from a SERVER-computed
  //                                         quote. It has no InlineCheckoutDrawer
  //                                         mount; reaching here means a forged POST.
  //   • vendor_additional_branch__<uuid>  — minted by app/vendor-dashboard/branches/
  //                                         actions.ts from fetchBranchFeePhp().
  //                                         Same: no drawer mount.
  //   • vendor_extra_seat__ / vendor_booking_fee__ / vendor_* add-ons
  //                                       — all minted by their own vendor actions
  //                                         from vendor_billing_catalog.
  //   • 'save-the-date:<slug>'            — DOES NOT EXIST. The comment that named
  //                                         it was wrong; the real Save-the-Date SKU
  //                                         is STD_PREMIUM_OPENINGS, a normal retail
  //                                         catalog row.
  return {
    ok: false,
    refusal: 'no_price_source',
    detail: `no server-side price resolver owns service_key=${serviceKey.slice(0, 64)}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The booked-deal resolver
// ─────────────────────────────────────────────────────────────────────────────

type BookedResolution =
  | { status: 'resolved'; centavos: number }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * The authoritative charge for `setnayan_service__{category}`.
 *
 * Mirrors the price precedence the vendor workspace page renders, but re-read
 * here from the DB so the POST body cannot set it:
 *
 *   1. the LOCKED package total on `event_vendor_packages` (falling back to the
 *      package's list `total_price_centavos`)
 *   2. the sum of `event_vendor_line_items`
 *   3. `event_vendors.total_cost_php`
 *
 * ⚠ KNOWN, SEPARATE ISSUE (documented, not fixed here): (2) and (3) are
 * host-writable. Re-reading them server-side removes the POST-body hole this PR
 * is about — a buyer can no longer name a price in the request — but a host can
 * still edit their own declared deal value before paying. That is a different
 * bug with a different fix (locking the declared total once an order exists),
 * and folding it in here would widen a security patch into a product change.
 */
export async function resolveSetnayanServiceChargeCentavos(
  admin: SupabaseClient,
  eventId: string,
  category: string,
): Promise<BookedResolution> {
  const { data: vendorRows, error: vErr } = await admin
    .from('event_vendors')
    .select('vendor_id, total_cost_php, event_vendor_package_id, marketplace_vendor_id')
    .eq('event_id', eventId)
    .eq('category', category);
  if (vErr) return { status: 'error', message: `event_vendors: ${vErr.message}` };
  const rows = (vendorRows ?? []) as Array<{
    vendor_id: string;
    total_cost_php: number | string | null;
    event_vendor_package_id: string | null;
    marketplace_vendor_id: string | null;
  }>;
  if (rows.length === 0) return { status: 'not_found' };

  // The drawer only renders for a FIRST-PARTY Setnayan service, so require the
  // same thing here rather than pricing off any vendor that happens to share the
  // category. Multiple matches → refuse (ambiguous key, never guess a price).
  const marketplaceIds = rows
    .map((r) => r.marketplace_vendor_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (marketplaceIds.length === 0) return { status: 'not_found' };

  const { data: profiles, error: pErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, is_setnayan_service')
    .in('vendor_profile_id', marketplaceIds);
  if (pErr) return { status: 'error', message: `vendor_profiles: ${pErr.message}` };
  const firstParty = new Set(
    ((profiles ?? []) as Array<{ vendor_profile_id: string; is_setnayan_service: boolean | null }>)
      .filter((p) => p.is_setnayan_service === true)
      .map((p) => p.vendor_profile_id),
  );
  const candidates = rows.filter(
    (r) => r.marketplace_vendor_id != null && firstParty.has(r.marketplace_vendor_id),
  );
  if (candidates.length !== 1) return { status: 'not_found' };
  const vendor = candidates[0]!;

  // (1) Locked package total.
  if (vendor.event_vendor_package_id) {
    const { data: bookingRow, error: bErr } = await admin
      .from('event_vendor_packages')
      .select('package_id, status, total_locked_centavos')
      .eq('booking_id', vendor.event_vendor_package_id)
      .maybeSingle();
    if (bErr) return { status: 'error', message: `event_vendor_packages: ${bErr.message}` };
    const booking = bookingRow as {
      package_id: string | null;
      status: string | null;
      total_locked_centavos: number | string | null;
    } | null;
    if (booking && booking.status === 'locked' && booking.package_id) {
      const locked =
        booking.total_locked_centavos != null ? Number(booking.total_locked_centavos) : null;
      if (locked != null && Number.isFinite(locked) && locked > 0) {
        return { status: 'resolved', centavos: Math.round(locked) };
      }
      const { data: pkgRow, error: pkErr } = await admin
        .from('vendor_packages')
        .select('total_price_centavos')
        .eq('package_id', booking.package_id)
        .maybeSingle();
      if (pkErr) return { status: 'error', message: `vendor_packages: ${pkErr.message}` };
      const list = (pkgRow as { total_price_centavos: number | string | null } | null)
        ?.total_price_centavos;
      const listNum = list != null ? Number(list) : null;
      if (listNum != null && Number.isFinite(listNum) && listNum > 0) {
        return { status: 'resolved', centavos: Math.round(listNum) };
      }
    }
  }

  // (2) Itemized line items.
  const { data: items, error: iErr } = await admin
    .from('event_vendor_line_items')
    .select('amount_php')
    .eq('event_id', eventId)
    .eq('vendor_id', vendor.vendor_id);
  if (iErr) return { status: 'error', message: `event_vendor_line_items: ${iErr.message}` };
  const itemized = ((items ?? []) as Array<{ amount_php: number | string | null }>).reduce(
    (acc, li) => acc + Number(li.amount_php ?? 0),
    0,
  );
  if (Number.isFinite(itemized) && itemized > 0) {
    return { status: 'resolved', centavos: Math.round(itemized * 100) };
  }

  // (3) The headline declared total.
  const headline = Number(vendor.total_cost_php ?? 0);
  if (Number.isFinite(headline) && headline > 0) {
    return { status: 'resolved', centavos: Math.round(headline * 100) };
  }

  return { status: 'not_found' };
}

// ─────────────────────────────────────────────────────────────────────────────
// The display cross-check (tripwire, never the price)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Would billing `total` OVERCHARGE a buyer who was shown `displayedCentavos`?
 *
 * `original_centavos` is no longer read for the charge anywhere. What remains
 * useful about it is as a one-way tripwire: the customer consented to the number
 * their screen showed, so the server resolving something HIGHER is a refusal —
 * this is the structural guard against the 36× cycles² class (client shows
 * ₱2,994, a double-multiply resolves ₱107,784 → refuse instead of bill).
 *
 * The check is deliberately ONE-WAY. Resolving LOWER than the display is safe
 * and legitimate (the vendor-unlocked 3D Plan discount does exactly that), and
 * the server value wins regardless — so tampering the posted value DOWN only
 * blocks your own checkout.
 *
 * `volatile` results are exempt: the pax curve reads live headcount
 * (`resolveLivePax`, SEC-3) precisely so a deflated `estimated_pax` cannot lower
 * the bill, which means an upward divergence from the rendered price is the
 * feature working, not a bug.
 */
export function chargeOverchargesDisplayedPrice(args: {
  total: OrderTotalCentavos;
  displayedCentavos: bigint | null;
  volatile: boolean;
}): boolean {
  const { total, displayedCentavos, volatile: isVolatile } = args;
  if (isVolatile) return false;
  if (displayedCentavos == null) return false;
  if (displayedCentavos <= 0n) return false; // nothing meaningful was displayed
  return (total as bigint) > displayedCentavos;
}
