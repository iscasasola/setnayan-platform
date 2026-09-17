import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * B2 — "a shop with no active service is not a card."
 *
 * ── THE BUG THIS EXISTS TO KILL, MEASURED IN PROD (2026-09-17) ────────────
 * `vendor_market_stats` (and `vendor_profiles.services`, which several
 * recommendation surfaces overlap against instead) says what a shop CLAIMS
 * to sell. Whether it has anything a couple can actually inquire about is a
 * different question — `vendor_services.is_active` — and nothing in the
 * shared listing paths asked it:
 *
 *     select vp.business_name, (select count(*) from vendor_services s
 *       where s.vendor_profile_id = vp.vendor_profile_id and s.is_active)
 *     from vendor_profiles vp;
 *     -- SetnaProd   verified   0 active services
 *
 * SetnaProd is fully verified, so every visibility gate (`isShopLive`,
 * `LIVE_SHOP_GATE`, `PUBLIC_SURFACE_VISIBILITIES`) waves it through. It still
 * cannot be booked and cannot be messaged — inquiry is keyed to a service —
 * so a couple who lands on it hits a dead end the marketplace itself invited
 * them into. On `?event_type=simple_event`, where SetnaProd is currently the
 * ONLY match, that dead end is the entire result set.
 *
 * ── ONE PLACE, REUSED ───────────────────────────────────────────────────────
 * `fetchMarketplaceServiceCards` (lib/marketplace-service-cards.ts) never had
 * this bug — it lists SERVICES, so a shop with zero active ones simply
 * contributes zero rows. The defect is confined to the surfaces that list
 * SHOPS instead: the `/explore` vendor-grid (`vendor_market_stats`) and
 * `fetchWizardVendorRecommendations` (shared by onboarding, the wizard, and
 * the event's own Category Search vendor browser). Both call this helper
 * instead of re-deriving the rule.
 *
 * Pilot-scale marketplace (see `lib/ghost-listing-detector.ts`'s own docblock
 * — "the marketplace vendor set is small + near-static during the
 * founder-only pilot") — one unscoped read of `vendor_services` is cheap and
 * never paginated elsewhere in this codebase either.
 *
 * Fails closed on error: an unreadable result returns an EMPTY set, which
 * every caller here treats as "nobody is inquirable" rather than crashing —
 * matching the fail-soft shape `fetchDemoVendorIds` / `fetchFraudFrozenVendorIds`
 * already use for exclusion lists on this same page.
 */
export async function fetchVendorIdsWithActiveService(
  admin: Pick<SupabaseClient, 'from'>,
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('vendor_services')
      .select('vendor_profile_id')
      .eq('is_active', true);
    if (error || !data) return [];
    const ids = new Set(
      (data as { vendor_profile_id: string }[]).map((r) => r.vendor_profile_id),
    );
    return Array.from(ids);
  } catch {
    return [];
  }
}
