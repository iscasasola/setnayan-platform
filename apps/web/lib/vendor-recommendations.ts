import type { SupabaseClient } from '@supabase/supabase-js';
import { displayLogoUrl } from '@/lib/uploads';
import { isPubliclyVisible, type VendorPublicVisibility } from '@/lib/vendor-visibility';

/**
 * Couple recommendations for a vendor (Event Lifecycle Menu §6.3).
 *
 * The marketplace "recommended by N couples" trust signal + the vendor-dashboard
 * badge both read this. "N couples" = DISTINCT events with a recommendation (one
 * event ≈ one couple; both partners could each recommend, so we dedupe by
 * event_id rather than counting rows). `vendor_recommendations` is public-read by
 * RLS, so this works from any client. Graceful-degrade to 0 on a missing/legacy
 * table.
 *
 * Recommendations per vendor are bounded (a vendor serves a finite number of
 * events), so fetching event_ids and deduping in JS avoids a materialized view +
 * refresh trigger for a number that changes rarely.
 */
export async function countVendorRecommendingCouples(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('vendor_recommendations')
    .select('event_id')
    .eq('vendor_profile_id', vendorProfileId);
  if (error || !data) return 0;
  return new Set((data as { event_id: string }[]).map((r) => r.event_id)).size;
}

/** One recommended vendor for the Editorial "vendors we loved" block. */
export type EventRecommendation = {
  vendorProfileId: string;
  businessName: string;
  /** Couple's one-line endorsement; null when they recommended without words. */
  endorsement: string | null;
  /** Resolved, displayable logo (presigned r2:// or legacy URL); null → initials. */
  logoUrl: string | null;
  /** `/v/[slug]` link, or null when the vendor has no public profile. */
  href: string | null;
};

type RecommendationJoinRow = {
  vendor_profile_id: string;
  endorsement: string | null;
  created_at: string;
  vendor_profiles: {
    business_name: string | null;
    business_slug: string | null;
    logo_url: string | null;
    public_visibility: VendorPublicVisibility | null;
  } | null;
};

/**
 * The vendors a couple explicitly recommended for an event — the Editorial
 * "vendors we loved" block (Event Lifecycle Menu §6.3, the referral loop).
 *
 * `vendor_recommendations` is public-read by RLS (the write was completion-gated,
 * so any row here is a real, opt-in endorsement), joined to vendor_profiles for
 * the display card. Dedupes per vendor — the UNIQUE key is per (vendor, event,
 * recommender), so both partners recommending the same vendor yield two rows;
 * we keep one card, preferring one that carries endorsement text. Only publicly-
 * visible vendors surface (a vendor may have gone hidden/archived since). Never
 * exposes `recommended_by_user_id`. Server-only (logo resolution presigns r2://);
 * graceful-degrade to `[]` on a missing/legacy table.
 */
export async function fetchEventRecommendations(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventRecommendation[]> {
  const { data, error } = await supabase
    .from('vendor_recommendations')
    .select(
      'vendor_profile_id, endorsement, created_at, ' +
        'vendor_profiles:vendor_profile_id ( business_name, business_slug, logo_url, public_visibility )',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  // Dedupe per vendor — keep the most-recent row (already ordered desc), but
  // upgrade to a row that has endorsement text if the first one had none.
  const byVendor = new Map<string, RecommendationJoinRow>();
  for (const row of data as unknown as RecommendationJoinRow[]) {
    const vp = row.vendor_profiles;
    if (!vp || !vp.business_name) continue;
    // LOAD-BEARING, not defense-in-depth: the editorial loader reads through the
    // service-role admin client (it renders for anonymous visitors), so RLS is
    // bypassed — this JS check is the ONLY thing keeping hidden/archived vendors
    // off a fully public wedding page. Do not drop it. (coming_soon + verified
    // surface, matching the /v/[slug] gate; hidden + archived are excluded.)
    if (!isPubliclyVisible(vp.public_visibility)) continue;
    const prev = byVendor.get(row.vendor_profile_id);
    if (!prev) {
      byVendor.set(row.vendor_profile_id, row);
    } else if (!prev.endorsement && row.endorsement) {
      byVendor.set(row.vendor_profile_id, row);
    }
  }

  const rows = [...byVendor.values()];
  const logos = await Promise.all(
    rows.map((r) => displayLogoUrl({ logo_url: r.vendor_profiles?.logo_url ?? null })),
  );

  return rows.map((r, i) => {
    const vp = r.vendor_profiles!;
    return {
      vendorProfileId: r.vendor_profile_id,
      businessName: vp.business_name as string,
      endorsement: r.endorsement,
      logoUrl: logos[i] ?? null,
      href: vp.business_slug ? `/v/${vp.business_slug}` : null,
    };
  });
}
