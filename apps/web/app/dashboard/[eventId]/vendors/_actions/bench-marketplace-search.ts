'use server';

/**
 * searchMarketplaceForBench — a lean, whole-marketplace text search for the
 * Shortlist bench's inline results (2026-07-10). A couple typing in the bench
 * search sees, below their filtered shortlist, the top matching vendors from the
 * WHOLE marketplace — so they can discover a vendor they haven't shortlisted
 * without leaving the flow (the "See all in the marketplace" row still deep-links
 * to /explore for the full ranked experience).
 *
 * Correctness — reuses the SAME primitives the category-search overlay uses so
 * behaviour can't drift:
 *   • Published scope: the market read goes through the couple's RLS client, so
 *     `vendor_market_stats`'s public-read policy (is_published = TRUE) filters to
 *     published vendors automatically — no hand-rolled published filter.
 *   • Demo exclusion: `fetchDemoVendorIds` (real couples never see is_demo rows).
 *   • Hybrid anonymity: `resolveVendorDisplayName` / `isVendorNameRevealed` — a
 *     Free/Verified vendor's real name + logo stay hidden until first reply.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchDemoVendorIds } from '@/lib/demo-vendors';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';

export type BenchMarketResult = {
  vendorProfileId: string;
  name: string;
  /** TRUE when `name` is still the hybrid-anonymity placeholder (logo also hidden). */
  nameAnonymized: boolean;
  city: string | null;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  slug: string | null;
};

type StatsRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  location_city: string | null;
  avg_rating_overall: number | string | null;
  review_count: number | null;
  services: string[] | null;
};

const MAX_RESULTS = 8;

export async function searchMarketplaceForBench(rawQuery: string): Promise<BenchMarketResult[]> {
  const tokens = (rawQuery ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  if (tokens.length === 0) return [];

  // Couple-only + RLS-scoped market read → published vendors only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from('vendor_market_stats')
    .select(
      'vendor_profile_id, business_name, business_slug, logo_url, location_city, avg_rating_overall, review_count, services',
    )
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(24);
  // Each token must match name/tagline/city somewhere (AND across tokens, OR within).
  for (const token of tokens) {
    q = q.or(`business_name.ilike.%${token}%,tagline.ilike.%${token}%,location_city.ilike.%${token}%`);
  }
  const { data: rows, error } = await q;
  if (error) return [];

  const admin = createAdminClient();
  const demoIds = new Set(await fetchDemoVendorIds(admin));
  const stats = ((rows as StatsRow[] | null) ?? [])
    .filter((r) => !demoIds.has(r.vendor_profile_id))
    .slice(0, MAX_RESULTS);
  if (stats.length === 0) return [];

  const ids = stats.map((r) => r.vendor_profile_id);
  const { data: profRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, screen_name, name_revealed_at, tier_state, verification_state')
    .in('vendor_profile_id', ids);
  const profById = new Map<
    string,
    {
      screen_name: string | null;
      name_revealed_at: string | null;
      tier_state: string | null;
      verification_state: string | null;
    }
  >();
  for (const p of (profRows as {
    vendor_profile_id: string;
    screen_name: string | null;
    name_revealed_at: string | null;
    tier_state: string | null;
    verification_state: string | null;
  }[] | null) ?? []) {
    profById.set(p.vendor_profile_id, {
      screen_name: p.screen_name,
      name_revealed_at: p.name_revealed_at,
      tier_state: p.tier_state,
      verification_state: p.verification_state,
    });
  }

  return stats.map((r) => {
    const prof = profById.get(r.vendor_profile_id);
    const isPaidTier = isTrueNameTier(prof?.tier_state ?? null);
    // Open-it-up lock: a VERIFIED vendor's name is never gated. Keyed on
    // verification_state (not tier) so an UNVERIFIED vendor surfaced here (this
    // discovery read is NOT verification-gated at the query layer) stays a
    // placeholder — the de-gate can't leak an unverified real business name.
    const isVerified = prof?.verification_state === 'verified';
    const name = resolveVendorDisplayName({
      business_name: r.business_name,
      screen_name: prof?.screen_name ?? null,
      name_revealed_at: prof?.name_revealed_at ?? null,
      services: r.services,
      isPaidTier,
      is_verified: isVerified,
      primary_canonical_service: r.services?.[0] ?? null,
      location_city: r.location_city,
    });
    const revealed = isVendorNameRevealed({
      name_revealed_at: prof?.name_revealed_at ?? null,
      isPaidTier,
      is_verified: isVerified,
      services: r.services,
    });
    const rating = r.avg_rating_overall != null ? Number(r.avg_rating_overall) : null;
    return {
      vendorProfileId: r.vendor_profile_id,
      name,
      nameAnonymized: !revealed,
      city: r.location_city ?? null,
      // Logo is as identifying as the name — hide it until the name is revealed.
      logoUrl: revealed ? (r.logo_url ?? null) : null,
      rating: rating != null && rating > 0 ? rating : null,
      reviewCount: r.review_count ?? null,
      slug: r.business_slug ?? null,
    };
  });
}
