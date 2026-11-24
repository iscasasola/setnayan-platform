/**
 * Supplier on-the-day Papic — the DB reads behind the pure model in lib/vendor-papic-tier.ts.
 *
 * 📸 OWNER 2026-11-23: what a shop may capture at one event is its PLAN's rule (`eventCaptureRule`, TIER_CAPS) —
 * Free · Verified 10 photos and no videos, Plus · Pro · Ultra no limit (storage only). So the capture allowance reads
 * two things only: the shop's plan (`vendor_profiles.tier_state`) and how many photos it has taken here
 * (`vendor_papic_captures`, not hidden). 🔁 The old reads — the founder-comp Lite/Ltd tier from
 * `vendor_event_unlocks`, the paid Unli row in `vendor_papic_capture_grants` (dropped) and the capture POINTS spent —
 * are retired with the points model.
 *
 * The per-event CREDIT ledger below (`vendor_papic_portfolio_credit_grants`) stays: it is the portfolio-import
 * album's meter (G3), which captures no longer share.
 *
 * Every read is honest: an unread count is `null`, never 0. Run on the SERVICE-ROLE admin client — the live console
 * can run as a per-event grantee, not the owner, so an RLS read would see nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
  VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
  offerPack,
  type ShopPapicPack,
  type VendorPapicPortfolioCredits,
} from '@/lib/vendor-papic-credits';
import { portfolioCreditsSpent } from '@/lib/vendor-papic-portfolio-album';
import { eventCaptureAllowance, type EventCaptureAllowance } from '@/lib/vendor-papic-tier';

/**
 * The shop's plan (`vendor_profiles.tier_state`). `null` = could not be read — the caller refuses; a limit that cannot
 * see the plan is not allowed to guess the most generous one.
 */
export async function fetchShopPlan(admin: SupabaseClient, vendorProfileId: string): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[supabase-error] lib/vendor-papic-grants.ts · from:vendor_profiles.select(tier_state)', error);
      return null;
    }
    return (data as { tier_state: string | null }).tier_state ?? 'free';
  } catch {
    return null;
  }
}

/**
 * Photos this shop has taken at this event — the rows that count against a limited plan's 10 (not hidden: a shot the
 * screen blocked, or the shop took down, gives its place back). Clips never count (a limited plan takes none).
 * `null` on a read error — NEVER 0, which would hand a fresh 10 to a shop that already used them.
 */
export async function fetchVendorEventPhotosTaken(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number | null> {
  try {
    const { count, error } = await client
      .from('vendor_papic_captures')
      .select('capture_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      .is('hidden_at', null);
    if (error) {
      console.error('[supabase-error] lib/vendor-papic-grants.ts · from:vendor_papic_captures.count', error);
      return null;
    }
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

/**
 * What this shop may still capture at this event — the plan's rule plus the count, in one read. What the supplier SEES
 * (their camera, the on-the-day badge) and what the capture route ENFORCES both come from here, so they cannot drift.
 * `plan` null = the plan could not be read; the caller says so rather than drawing a limit.
 */
export async function fetchVendorEventCaptureAllowance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<{ plan: string | null; allowance: EventCaptureAllowance }> {
  const [plan, taken] = await Promise.all([
    fetchShopPlan(admin, vendorProfileId),
    fetchVendorEventPhotosTaken(admin, vendorProfileId, eventId),
  ]);
  // An unread plan reads as Free's rule (the narrowest) — withholding, never granting.
  return { plan, allowance: eventCaptureAllowance(plan ?? 'free', taken) };
}

/**
 * THE CREDITS THIS SUPPLIER HOLDS FOR THIS EVENT — the sum of their ledger,
 * `vendor_papic_portfolio_credit_grants` (owner 2026-09-05: 5% of the booking
 * fee paid, cap 1,000, no floor; plus ₱500 packs (100 credits since
 * 2026-09-06); written only on admin
 * payment approval by lib/sku-activation.ts).
 *
 * 🔁 This replaced `fetchVendorBookingFeePaidPhp` on 2026-09-05 (owner:
 * *"replace it"*). That reader derived the allowance LIVE from
 * `booking_fee_charges` at ₱5/point; the rate is retired and the credits are
 * now a written ledger, so the allowance reads what was granted rather than
 * re-deriving it. Two of its rules survive unchanged, because they were never
 * about the rate:
 *
 * ⚠ RETURNS null ON A READ ERROR, NEVER 0 — and null is NOT "they hold
 * nothing". `fetchVendorPapicPortfolioCredits` turns null into nothing to
 * spend, so a transient failure can never MINT credits, and the card says it
 * could not read.
 *
 * 🔑 `waived_free5` / `waived_import` STILL MEAN THEY PAID NOTHING — enforced
 * one step earlier now: the activation hook grants only from a charge whose
 * status is `paid`, so a waived charge never produces a ledger row to sum.
 *
 * ⚠ Supabase does not throw on a failed read — it resolves with `{ error }` —
 * so the explicit error check below is the only one that exists.
 */
export async function fetchVendorPapicCreditsGranted(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number | null> {
  if (!vendorProfileId || !eventId) return null;
  try {
    const { data, error } = await client
      .from('vendor_papic_portfolio_credit_grants')
      .select('credits')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId);
    if (error) {
      console.error('[supabase-error] vendor-papic-grants: portfolio credit grants', error);
      return null; // unproven — never an uplift
    }
    return (data ?? []).reduce(
      (sum, r) => sum + Math.max(0, Math.floor(Number((r as { credits?: number }).credits) || 0)),
      0,
    );
  } catch {
    return null;
  }
}

/**
 * The ₱ price of the credit pack, read from `vendor_billing_catalog` — the only
 * place a vendor price is allowed to live (admin-managed at /admin/pricing).
 * `null` when the row is missing, inactive or unreadable: render "unavailable",
 * never a remembered number.
 */
export async function fetchVendorPapicPackPricePhp(
  client: SupabaseClient,
): Promise<number | null> {
  try {
    const { data, error } = await client
      .from('vendor_billing_catalog')
      .select('price_php, is_active')
      .eq('sku_code', VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] vendor-papic-grants: portfolio pack price', error);
      return null;
    }
    if (!data) return null;
    const row = data as { price_php?: number | string | null; is_active?: boolean | null };
    if (row.is_active !== true) return null;
    const price = Number(row.price_php);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/**
 * 🛍 The Papic packs a SHOP may buy into its wallet — the SAME packs couples buy (owner 2026-11-04): every active,
 * unretired `PAPIC_GUEST*` catalogue row with an active, non-top-up tier row, smallest first. Price and credits are
 * READ; `null` on any read error (render "unavailable", never a remembered figure).
 *
 * 📦 One price per gift since 2026-11-14 — the list price; `gift_price_php` is no longer read here (owner: "we only have
 * the 10+1"). The service-role requirement stays (history below): it costs nothing and keeps every caller on one client.
 *
 * 🔒 `admin` MUST BE THE SERVICE-ROLE CLIENT (G6, 2026-11-10). `gift_price_php` is withheld from `anon` +
 * `authenticated` on purpose — 20271201188010 grants the catalogue column by column, the final price sheet
 * (20271308555594) added the gift price after it, and `the-catalog-keeps-its-margin.db.test.ts` lists it in
 * DENIED_COLUMNS: a supplier's gift price is shown to that supplier from the server, never readable by a browser.
 * PostgREST refuses the WHOLE query that names it, so the five callers that passed the supplier's SESSION client
 * were each refused (42501 — ~105 production errors from 4 Nov: Shop › Promote, a new card, a bundle's Gift row) and
 * the packs read "unavailable" for every supplier; a bundle's gift could not be saved at all. Guard:
 * `lib/catalog-denied-columns-read-by-service-role.test.ts` (every caller passes a service-role client).
 */
export async function fetchShopPapicPacks(admin: SupabaseClient): Promise<ShopPapicPack[] | null> {
  try {
    const [catalog, tiers] = await Promise.all([
      admin
        .from('platform_retail_catalog_v2')
        .select('service_code, title, retail_price_php, is_active, retired_at')
        .like('service_code', 'PAPIC_GUEST%'),
      admin.from('papic_pass_tiers').select('service_code, points, is_active, is_topup').like('service_code', 'PAPIC_GUEST%'),
    ]);
    if (catalog.error || tiers.error) {
      console.error('[supabase-error] vendor-papic-grants: shop packs', catalog.error ?? tiers.error);
      return null;
    }
    const points = new Map<string, number>();
    for (const t of (tiers.data ?? []) as Array<{ service_code: string; points: number | null; is_active: boolean | null; is_topup: boolean | null }>) {
      if (t.is_active === true && t.is_topup !== true && Number.isInteger(t.points) && (t.points as number) > 0) {
        points.set(t.service_code, t.points as number);
      }
    }
    const packs: ShopPapicPack[] = [];
    for (const c of (catalog.data ?? []) as Array<{ service_code: string; title: string | null; retail_price_php: number | string | null; is_active: boolean | null; retired_at: string | null }>) {
      if (c.is_active !== true || c.retired_at) continue;
      const credits = points.get(c.service_code);
      const pricePhp = Number(c.retail_price_php);
      if (credits === undefined || !Number.isFinite(pricePhp) || pricePhp <= 0) continue;
      packs.push({ code: c.service_code, title: c.title ?? c.service_code, credits, pricePhp });
    }
    return packs.sort((a, b) => a.credits - b.credits);
  } catch (e) {
    console.error('[vendor-papic-grants] shop packs threw', e);
    return null;
  }
}

/**
 * Credits spent importing photos into the private portfolio album
 * (`vendor_papic_portfolio_photos`, G3) — the only thing that spends this
 * meter since 2026-11-23 (the on-the-day camera spends nothing). A hidden row
 * (NSFW-blocked, or the supplier's own takedown) does not count.
 *
 * Money logic: fails CLOSED on a read error (ASSUME_EXHAUSTED) — a metering
 * outage must block new spend, never silently un-meter it.
 */
export async function fetchVendorPapicPortfolioPhotosSpent(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number> {
  const ASSUME_EXHAUSTED = Number.MAX_SAFE_INTEGER;
  try {
    const { data, error } = await client
      .from('vendor_papic_portfolio_photos')
      .select('credits_spent, hidden_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .is('hidden_at', null);
    if (error) return ASSUME_EXHAUSTED;
    return portfolioCreditsSpent(
      (data ?? []) as { credits_spent: number | null; hidden_at: string | null }[],
    );
  } catch {
    return ASSUME_EXHAUSTED;
  }
}

/**
 * WHAT G3 CALLS — the supplier's portfolio-import credits, spend and pack, in ONE read.
 *
 * Owner 2026-09-05: a grant under a pack's worth still lands and the pack is the CTA beside it. Since 2026-11-23 the
 * on-the-day camera spends NOTHING (its limit is the plan's — lib/vendor-papic-tier.ts), so this meter is the album's
 * alone: `left` = the ledger total − what the portfolio-import album has spent. An unread ledger (`credits: null`)
 * leaves nothing to spend (`left: 0`) and the card says it could not read — a metering outage never mints credits.
 *
 * Run on the SERVICE-ROLE admin client, like every reader in this module.
 */
export async function fetchVendorPapicPortfolioCredits(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<VendorPapicPortfolioCredits> {
  const [credits, packs, portfolioSpent] = await Promise.all([
    fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
    fetchShopPapicPacks(admin),
    fetchVendorPapicPortfolioPhotosSpent(admin, vendorProfileId, eventId),
  ]);
  return {
    credits,
    spent: portfolioSpent,
    left: credits === null ? 0 : Math.max(0, credits - portfolioSpent),
    packCredits: VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
    packs,
    offerPack: offerPack(credits ?? 0),
  };
}
