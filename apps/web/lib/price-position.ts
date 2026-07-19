/**
 * Price-Position Meter reader (Wave 6 vendor benefit · the last "Soon" one).
 *
 * Tells a vendor where their OWN price sits inside the published market for the
 * same (category, region, pax_bucket): the low / median / high of their peers,
 * a coarse position (below-band / in-band / above-band), and an estimated
 * percentile inside the band. Reads ONE pre-computed row from
 * public.market_price_bands (rebuilt by recompute_market_price_bands() — see
 * 20270324043850_market_price_bands.sql); it does not aggregate at request time.
 *
 * BEHAVIORAL HONESTY — the band only exists above the min-N floor
 * --------------------------------------------------------------
 * The rollup suppresses any bucket below the admin-managed min-N sample floor,
 * so a thin or founder-only market simply has NO row. This reader returns a
 * { status: 'no_data' } result in that case and the UI says "not enough market
 * data yet" — it NEVER fabricates a range or a percentile from nothing. Today
 * the platform is founder-only, so almost every bucket is suppressed and most
 * vendors will correctly see the no-data state. That is expected.
 *
 * The band thresholds (low/median/high) are admin-managed — recomputed from real
 * vendor prices and reviewable/triggerable at /admin/price-bands. Nothing here
 * is hardcoded.
 *
 * SECURITY: market_price_bands is readable by any authenticated user (RLS:
 * de-identified aggregates, no peer identity). We still gate the vendor's own
 * price read on ownership at the page layer (the page passes a profile the
 * caller owns). This module reads via the admin client only for the band row +
 * the vendor's own packages/services (the vendor already owns those rows; the
 * admin client just avoids RLS friction on the aggregate read).
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { regionBySlug, resolveRegion } from '@/lib/region-source';

/** The '__all__' pax bucket — a price with no guest-count dimension (most categories). */
export const PAX_BUCKET_ALL = '__all__';

/** A vendor's resolved coordinates in the band space. */
export type PricePositionKey = {
  category: string;
  /** Canonical region slug ('c-visayas'), or null when unresolved. */
  regionSlug: string | null;
  /** Friendly region label for the UI ('Central Visayas'), or null. */
  regionLabel: string | null;
  paxBucket: string;
  /** The vendor's own representative price in PHP (lowest package/service), or null. */
  ownPricePhp: number | null;
};

/** The market band row (PHP). */
export type MarketBand = {
  lowPhp: number;
  medianPhp: number;
  highPhp: number;
  sampleN: number;
  computedAt: string;
};

export type PricePositionResult =
  // Band exists AND the vendor has a price → full position read.
  | {
      status: 'positioned';
      key: PricePositionKey;
      band: MarketBand;
      /** 'below_band' < low · 'in_band' within [low,high] · 'above_band' > high. */
      position: 'below_band' | 'in_band' | 'above_band';
      /** Estimated percentile (0–100) of the vendor's price inside [low,high].
       *  Clamped; null when high==low (a degenerate single-price band). */
      percentile: number | null;
    }
  // Band exists but the vendor hasn't priced this category yet.
  | { status: 'no_own_price'; key: PricePositionKey; band: MarketBand }
  // No band above the min-N floor for this bucket (the founder-only reality).
  | { status: 'no_data'; key: PricePositionKey };

/**
 * Pax bucket for a guest count, mirroring the DB price_band_pax_bucket():
 * 100 floor, per-50 steps to a '500+' ceiling. null pax → '__all__'.
 * Kept in sync with the SQL function so a TS caller can label/match buckets.
 */
export function paxBucketFor(pax: number | null | undefined): string {
  if (pax === null || pax === undefined || !Number.isFinite(pax)) return PAX_BUCKET_ALL;
  if (pax >= 500) return '500+';
  if (pax <= 100) return '100';
  return String(Math.ceil(pax / 50) * 50);
}

/** Human label for a pax bucket ('__all__' → 'All sizes', '500+' → '500+ pax'). */
export function paxBucketLabel(bucket: string): string {
  if (bucket === PAX_BUCKET_ALL) return 'All sizes';
  if (bucket === '500+') return '500+ pax';
  return `~${bucket} pax`;
}

type ProfileLike = {
  vendor_profile_id: string;
  /** TEXT[] of the vendor's offered categories (vendor_profiles.services). */
  services?: string[] | null;
};

/**
 * Resolve a vendor's Price-Position band for their PRIMARY category.
 *
 * @param profile  The vendor's own profile (ownership already established by caller).
 * @param opts.category  Optional explicit category to band on (defaults to the
 *                       first of profile.services).
 */
export async function fetchVendorPricePosition(
  profile: ProfileLike,
  opts?: { category?: string | null },
): Promise<PricePositionResult | null> {
  const admin = createAdminClient();

  // 1 · Resolve the vendor's region (hq_region) + capacity (venues) via a soft
  // probe — neither is on the shared profile select.
  const { data: vpRow } = await admin
    .from('vendor_profiles')
    .select('hq_region, capacity_max, services')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();

  const hqRegion = (vpRow as { hq_region?: string | null } | null)?.hq_region ?? null;
  const capacityMax =
    (vpRow as { capacity_max?: number | null } | null)?.capacity_max ?? null;
  const servicesArr =
    (vpRow as { services?: string[] | null } | null)?.services ??
    profile.services ??
    [];

  const category =
    opts?.category ?? (Array.isArray(servicesArr) ? servicesArr[0] : null) ?? null;
  if (!category) {
    // Nothing to band on — no category listed yet.
    return null;
  }

  const region = resolveRegion(hqRegion);
  const regionSlug = region?.slug ?? null;
  const regionLabel = region?.display_label ?? null;

  // 2 · The vendor's own representative price = the LOWEST active priced offering
  // in this category (their entry-point "starting at" number — the same number a
  // couple compares against). Reads both sources; null when neither is priced.
  const ownPricePhp = await fetchOwnLowestPricePhp(
    admin,
    profile.vendor_profile_id,
    category,
  );

  // Pax bucket: a priced PACKAGE for a venue carries capacity; otherwise the
  // base price has no guest dimension → '__all__'. We band on the bucket the
  // vendor's own price would land in, so the comparison is apples-to-apples.
  const paxBucket = capacityMax != null ? paxBucketFor(capacityMax) : PAX_BUCKET_ALL;

  const key: PricePositionKey = {
    category,
    regionSlug,
    regionLabel,
    paxBucket,
    ownPricePhp,
  };

  // No resolvable region → can't key into the band table.
  if (!regionSlug) {
    return { status: 'no_data', key };
  }

  // 3 · Read the one band row.
  const { data: bandRow } = await admin
    .from('market_price_bands')
    .select('low_php, median_php, high_php, sample_n, computed_at')
    .eq('category', category)
    .eq('region_slug', regionSlug)
    .eq('pax_bucket', paxBucket)
    .maybeSingle();

  if (!bandRow) {
    // Suppressed / absent → not enough market data yet (the founder-only reality).
    return { status: 'no_data', key };
  }

  const band: MarketBand = {
    lowPhp: Number((bandRow as { low_php: number }).low_php),
    medianPhp: Number((bandRow as { median_php: number }).median_php),
    highPhp: Number((bandRow as { high_php: number }).high_php),
    sampleN: Number((bandRow as { sample_n: number }).sample_n),
    computedAt: String((bandRow as { computed_at: string }).computed_at),
  };

  if (ownPricePhp == null) {
    return { status: 'no_own_price', key, band };
  }

  const { position, percentile } = positionInBand(ownPricePhp, band);
  return { status: 'positioned', key, band, position, percentile };
}

/**
 * Pure scorer: where does `pricePhp` sit inside [low,high]?
 * Exported for unit-style reuse + so the math is testable without a DB.
 */
export function positionInBand(
  pricePhp: number,
  band: Pick<MarketBand, 'lowPhp' | 'highPhp'>,
): {
  position: 'below_band' | 'in_band' | 'above_band';
  percentile: number | null;
} {
  const { lowPhp, highPhp } = band;
  if (pricePhp < lowPhp) return { position: 'below_band', percentile: 0 };
  if (pricePhp > highPhp) return { position: 'above_band', percentile: 100 };
  // In-band. Degenerate single-price band (high==low) → no meaningful percentile.
  if (highPhp <= lowPhp) return { position: 'in_band', percentile: null };
  const pct = ((pricePhp - lowPhp) / (highPhp - lowPhp)) * 100;
  return { position: 'in_band', percentile: Math.round(Math.min(100, Math.max(0, pct))) };
}

/** Lowest active priced offering (PHP) for a vendor in a category, or null. */
async function fetchOwnLowestPricePhp(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
  category: string,
): Promise<number | null> {
  const prices: number[] = [];

  // vendor_services.starting_price_php (PHP integer).
  const { data: svc } = await admin
    .from('vendor_services')
    .select('starting_price_php')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('category', category)
    .eq('is_active', true);
  for (const r of (svc ?? []) as { starting_price_php: number | null }[]) {
    if (r.starting_price_php != null && r.starting_price_php > 0) {
      prices.push(Number(r.starting_price_php));
    }
  }

  // vendor_packages.total_price_centavos (→ PHP), keyed by primary_canonical_service.
  const { data: pkg } = await admin
    .from('vendor_packages')
    .select('total_price_centavos')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('primary_canonical_service', category)
    .eq('is_active', true);
  for (const r of (pkg ?? []) as { total_price_centavos: number | null }[]) {
    if (r.total_price_centavos != null && r.total_price_centavos > 0) {
      prices.push(Math.round(Number(r.total_price_centavos) / 100));
    }
  }

  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** Friendly category label — falls back to a title-cased slug. */
export function prettyCategory(category: string): string {
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Re-export so a UI can resolve a region slug → label without re-importing.
export { regionBySlug };
