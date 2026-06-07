'use server';

/**
 * searchCategoryVendors — backend for the in-place Category Search overlay
 * (the full-page sheet that replaces the marketplace JUMP from the Vendors
 * tab + event-Home vendor buttons). Results are HARD-SCOPED to one plan
 * group's canonical services so the couple can never drift to another
 * category.
 *
 * Result order (owner-locked 2026-05-31):
 *   1. Favorites          — cross-event personal favorites (V1.x; no backing
 *                           table yet, so this tier is empty for now and the
 *                           list starts at Boosted — graceful).
 *   2. Boosted services   — vendors with an active ad (ad_rank > 0), in
 *                           ad_rank order.
 *   3. Top 10 reviews     — of the rest, the 10 highest by review_count then
 *                           avg rating.
 *   4. The rest           — ordered by distance from the reception venue →
 *                           ceremony venue → target location → wherever the
 *                           couple is (we use the event's stored coords; when
 *                           there are none we keep the review order).
 *
 * Reuses the canonical per-category ranked query (fetchWizardVendorRecommendations)
 * + hybrid-anonymity name resolution (resolveVendorDisplayName) so a Free /
 * Verified vendor's real name stays hidden until first reply.
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';
import { fetchDemoVendorIds } from '@/lib/demo-vendors';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import { computeCompatScore } from '@/lib/compat-score';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  canonicalServicesForTile,
  canonicalServicesForFolder,
} from '@/lib/vendor-counts';

export type CategoryVendorResult = {
  vendorProfileId: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** km from the event's reception/ceremony/target coords; null when unknown. */
  distanceKm: number | null;
  verified: boolean;
  boosted: boolean;
  /** Compatibility score (0–100) + tier · lib/compat-score · the §2 GATE+SCORE
   *  soft layer (Customer_Vendor_Marketplace_Architecture_2026-06-04 §2).
   *  DISPLAY-only in this PR — the result ORDER stays the owner-locked
   *  2026-05-31 tier ladder (Favorites → Boosted → top-reviews → nearest).
   *  Re-ranking the non-boosted tier by score is a separate, sign-off-gated
   *  change. */
  /** null when Setnayan Assist is OFF (Manual mode) — the pill is hidden. */
  compatScore: number | null;
  compatTier: 'strong' | 'good' | 'fair' | null;
  /** Already in this event's picks → render "✓ Added", not an Add button. */
  alreadyAdded: boolean;
};

export type CategorySearchResult = {
  results: CategoryVendorResult[];
  total: number;
  /** Null when the event has no stored coords (distance tier falls back to
   *  review order + the overlay hides distance chips). */
  hasReceptionCoords: boolean;
};

const EMPTY: CategorySearchResult = {
  results: [],
  total: 0,
  hasReceptionCoords: false,
};

/** Forward group → canonical services. Tightest-first: a leaf's single
 *  canonical hint, else its tile's canonical set, else the whole parent
 *  folder (guarantees a non-empty scope for parent-level groups). Mirrors
 *  the marketplace [Search] deep-link's scoping sources. */
function canonicalsForGroup(groupId: string): string[] {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  if (g.subcategoryHint) return [g.subcategoryHint];
  if (g.catalogTile) return canonicalServicesForTile(g.catalogTile);
  return canonicalServicesForFolder(g.catalogFolder);
}

/** Haversine great-circle distance in km. */
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function searchCategoryVendors(input: {
  eventId: string;
  groupId: string;
  query?: string;
  verifiedOnly?: boolean;
  maxKm?: number | null;
}): Promise<CategorySearchResult> {
  const eventId = String(input.eventId ?? '').trim();
  const groupId = String(input.groupId ?? '').trim();
  if (!eventId || !groupId) return EMPTY;

  const canonicals = canonicalsForGroup(groupId);
  if (canonicals.length === 0) return EMPTY;

  // Auth + membership gate in one RLS-bounded read: events RLS restricts to
  // members, so a non-member gets `ev === null` and we bail. This also gives
  // us the reception coords + compat context for the query.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data: ev } = await supabase
    .from('events')
    .select(
      'venue_latitude, venue_longitude, ceremony_type, secondary_ceremony_type, venue_setting, event_type, estimated_pax, planning_mode',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return EMPTY; // not a member of this event

  // Setnayan Assist OFF (Manual mode) → drop the per-candidate "% match" pill
  // (owner 2026-06-05). The result ORDER is unchanged (the tier ladder).
  const assistOff =
    (ev as { planning_mode?: string | null }).planning_mode === 'manual';

  const lat = (ev.venue_latitude as number | null) ?? null;
  const lng = (ev.venue_longitude as number | null) ?? null;
  const hasCoords = lat !== null && lng !== null;

  // Vendors already in this event's picks (RLS-bounded to the user's events)
  // → render "✓ Added" instead of an Add button.
  const { data: pickRows } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  const addedIds = new Set<string>(
    (pickRows ?? [])
      .map((r) => (r as { marketplace_vendor_id: string | null }).marketplace_vendor_id)
      .filter((v): v is string => typeof v === 'string'),
  );

  // Ranked category query (boosted → review_count → rating) + live search.
  const admin = createAdminClient();

  // Demo-vendor exclusion — mirror the public `/vendors` browse: real couples
  // never see `is_demo = TRUE` vendors; only an admin in demo mode (admin
  // profile + the demo cookie) does. Cheap fast-path: skip the admin lookup
  // unless the demo cookie is present.
  const cookieStore = await cookies();
  const hasDemoCookie =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';
  let inDemoMode = false;
  if (hasDemoCookie) {
    const { data: viewerProfile } = await supabase
      .from('users')
      .select('account_type, is_internal, is_team_member')
      .eq('user_id', user.id)
      .maybeSingle();
    inDemoMode = isAdminProfile(viewerProfile);
  }
  const excludeVendorIds: ReadonlyArray<string> = inDemoMode
    ? []
    : await fetchDemoVendorIds(admin);

  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: canonicals,
    excludeVendorIds,
    ceremonyType: (ev.ceremony_type as string | null) ?? null,
    // Mixed/interfaith weddings: admit vendors fit for the secondary rite too
    // (additive — never excludes). CLAUDE.md 2026-06-01 + 2026-06-02.
    secondaryCeremonyType: (ev.secondary_ceremony_type as string | null) ?? null,
    venueSetting: (ev.venue_setting as string | null) ?? null,
    // Leaf-match parity with onboarding (2026-06-04): event-type + pax. Region
    // is intentionally NOT forced here — the dashboard already scopes location
    // via the reception coords + the grid's client-side region picker; a
    // server-side region filter would fight that picker. Venue_type is
    // onboarding-only (the dashboard stores just the coarse venue_setting).
    eventType: (ev.event_type as string | null) ?? null,
    pax: (ev.estimated_pax as number | null) ?? null,
    searchQuery: input.query,
    limit: 60,
  });
  if (recs.length === 0) return { ...EMPTY, hasReceptionCoords: hasCoords };

  // Resolve hybrid-anonymity display names: a Free / Verified vendor's real
  // name is hidden until first reply, so we need screen_name + name_revealed_at
  // (+ services for the venue-exemption) — the rec view doesn't carry them.
  const ids = recs.map((r) => r.vendor_profile_id);
  const { data: profRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, screen_name, name_revealed_at, services')
    .in('vendor_profile_id', ids);
  const profById = new Map<
    string,
    { screen_name: string | null; name_revealed_at: string | null; services: string[] | null }
  >();
  for (const p of profRows ?? []) {
    const row = p as {
      vendor_profile_id: string;
      screen_name: string | null;
      name_revealed_at: string | null;
      services: string[] | null;
    };
    profById.set(row.vendor_profile_id, {
      screen_name: row.screen_name,
      name_revealed_at: row.name_revealed_at,
      services: row.services,
    });
  }

  // Shape every rec, then partition into the locked tier ladder.
  type Shaped = CategoryVendorResult & { _adRank: number; _reviews: number; _rating: number };
  const shaped: Shaped[] = recs.map((r) => {
    const prof = profById.get(r.vendor_profile_id);
    const name = resolveVendorDisplayName({
      business_name: r.business_name ?? null,
      screen_name: prof?.screen_name ?? null,
      name_revealed_at: prof?.name_revealed_at ?? null,
      services: prof?.services ?? null,
      primary_canonical_service: prof?.services?.[0] ?? null,
      location_city: r.location_city ?? null,
    });
    const vLat = (r.hq_latitude as number | null) ?? null;
    const vLng = (r.hq_longitude as number | null) ?? null;
    const dKm =
      hasCoords && vLat !== null && vLng !== null
        ? Math.round(distanceKm(lat as number, lng as number, vLat, vLng) * 10) / 10
        : null;
    const adRank = (r.ad_rank as number | null) ?? 0;
    const compat = assistOff
      ? null
      : computeCompatScore({
          distanceKm: dKm,
          avgRating: r.avg_rating_overall ?? null,
          reviewCount: r.review_count ?? null,
          verified: r.public_visibility === 'verified',
          boosted: adRank > 0,
        });
    const compatScore: number | null = compat ? compat.score : null;
    const compatTier: 'strong' | 'good' | 'fair' | null = compat ? compat.tier : null;
    return {
      vendorProfileId: r.vendor_profile_id,
      name,
      city: r.location_city ?? null,
      logoUrl: r.logo_url ?? null,
      rating: r.avg_rating_overall ?? null,
      reviewCount: r.review_count ?? null,
      distanceKm: dKm,
      verified: r.public_visibility === 'verified',
      boosted: adRank > 0,
      compatScore,
      compatTier,
      alreadyAdded: addedIds.has(r.vendor_profile_id),
      _adRank: adRank,
      _reviews: r.review_count ?? 0,
      _rating: r.avg_rating_overall ?? 0,
    };
  });

  // Tier 1 favorites: empty until the cross-event favorites table ships (V1.x).
  // Tier 2 boosted: ad_rank desc.
  const boosted = shaped
    .filter((s) => s.boosted)
    .sort((a, b) => b._adRank - a._adRank);
  const rest0 = shaped.filter((s) => !s.boosted);
  // Tier 3 top-10 by review_count then rating.
  const byReview = [...rest0].sort(
    (a, b) => b._reviews - a._reviews || b._rating - a._rating,
  );
  const top10 = byReview.slice(0, 10);
  const top10Ids = new Set(top10.map((s) => s.vendorProfileId));
  // Tier 4 the rest, nearest-first when we have coords, else keep review order.
  const tail = rest0.filter((s) => !top10Ids.has(s.vendorProfileId));
  tail.sort((a, b) => {
    if (hasCoords) {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    return b._reviews - a._reviews || b._rating - a._rating;
  });

  let ordered = [...boosted, ...top10, ...tail];

  // Client filters (applied here so the count + tiers stay coherent).
  if (input.verifiedOnly) ordered = ordered.filter((s) => s.verified);
  if (typeof input.maxKm === 'number' && hasCoords) {
    ordered = ordered.filter(
      (s) => s.distanceKm !== null && s.distanceKm <= (input.maxKm as number),
    );
  }

  const results: CategoryVendorResult[] = ordered.map((s) => ({
    vendorProfileId: s.vendorProfileId,
    name: s.name,
    city: s.city,
    logoUrl: s.logoUrl,
    rating: s.rating,
    reviewCount: s.reviewCount,
    distanceKm: s.distanceKm,
    verified: s.verified,
    boosted: s.boosted,
    compatScore: s.compatScore,
    compatTier: s.compatTier,
    alreadyAdded: s.alreadyAdded,
  }));

  return { results, total: results.length, hasReceptionCoords: hasCoords };
}
