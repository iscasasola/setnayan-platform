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
import { AI_SUB_SKU, parseCycles } from '@/lib/setnayan-ai-subscription';
import { resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypeChargeCentavos,
} from '@/lib/setnayan-ai-event-pricing';
import {
  resolveAiSubTotal,
  sealServerResolvedTotal,
  setnayanServiceCategoryFromKey,
  type OrderChargeAuthority,
} from '@/lib/order-charge-math';

export {
  chargeOverchargesDisplayedPrice,
  orderTotalToPhp,
  refusalMessage,
  resolveAiSubTotal,
  setnayanServiceCategoryFromKey,
  SETNAYAN_SERVICE_KEY_PREFIX,
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
 *   1. `SETNAYAN_AI_SUB`              — catalog UNIT price × validated cycles
 *   2. `platform_retail_catalog_v2`   — the retail SKUs (flat + the pax curve)
 *   3. Setnayan AI per-EVENT-TYPE ladder — overrides (2) when the flag is on
 *   4. `platform_package_catalog`     — bundles (GUIDED_PACK / MEDIA_PACK / PAPIC_UNLOCK*)
 *   5. `setnayan_service__{category}` — the booked first-party event_vendors deal
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

  // ── (1) The per-USER subscription — the SEC-7 key itself ──────────────────
  // Handled FIRST: it is the only eventless SKU and the only one with a cycle
  // multiplier. `resolveAiSubTotal` is pure and owns the ONE `unit × cycles`.
  if (serviceKey === AI_SUB_SKU) {
    const unit = await resolveRetailChargeCentavos(eventId ?? '', AI_SUB_SKU);
    return resolveAiSubTotal(unit, parseCycles(cyclesRaw));
  }

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
        const perType = await resolveSetnayanAiTypeChargeCentavos(admin, eventId);
        if (perType != null) {
          return sealServerResolvedTotal(perType, 'setnayan_ai_event_type');
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

  // ── (5) The booked first-party Setnayan service ───────────────────────────
  const category = setnayanServiceCategoryFromKey(serviceKey);
  if (category && eventId) {
    const booked = await resolveSetnayanServiceChargeCentavos(admin, eventId, category);
    if (booked.status === 'error') {
      return { ok: false, refusal: 'read_error', detail: booked.message };
    }
    if (booked.status === 'resolved') {
      return sealServerResolvedTotal(booked.centavos, 'event_vendor_setnayan_service');
    }
  }

  // ── (6) Nothing owns this key ─────────────────────────────────────────────
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
 * and folding it in would widen a security patch into a product change.
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
  // category. Anything other than exactly one match → refuse: an ambiguous key
  // is never a licence to guess a price.
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
