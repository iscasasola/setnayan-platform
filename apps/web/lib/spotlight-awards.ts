/**
 * Spotlight Awards — recompute + read helpers (Wave 5 vendor benefit).
 *
 * Turns the LIVE-computed marketplace badges (apps/web/lib/vendor-badges.ts —
 * `top_pick` top-5% by review-weighted score, `most_booking` top-10% by
 * completed bookings) into a PERSISTED monthly recognition record in
 * `public.vendor_spotlight_awards`.
 *
 * CRON-FREE by design. There is no poller anywhere in this module. The snapshot
 * is written ONLY when:
 *   • an admin clicks "Run now" in /admin/spotlight-awards (runSpotlightRecompute
 *     called from the server action), or
 *   • opportunistically via Next 15 `after()` piggybacking on admin traffic
 *     (maybeRecomputeSpotlightAwards — throttled so it's a no-op once a month).
 * Never a scheduled cron, per the platform cron-free lock.
 *
 * IDEMPOTENT. Every write UPSERTs on the table's UNIQUE
 * (vendor_profile_id, award_type, period_month) key. Re-running in the same
 * month overwrites the same rows; it never duplicates. Admin-curated rows
 * (awarded_by='admin') and the homepage feature flag are PRESERVED across
 * re-runs — see the merge note in runSpotlightRecompute.
 *
 * RLS: the table is public-read; all writes are admin-only. This module always
 * writes with the service-role admin client (createAdminClient), which bypasses
 * RLS — callers MUST gate on admin/server context before invoking the writers.
 */

import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeVendorBadges,
  fetchCompletedBookingCounts,
  SPOTLIGHT_AWARD_BADGES,
  type VendorBadgeInput,
} from '@/lib/vendor-badges';

/** The award types persisted in `vendor_spotlight_awards.award_type`. */
export type SpotlightAwardType = 'top_pick' | 'most_booked' | 'rising';

/**
 * Maps the live badge keys (vendor-badges.ts) → the persisted award_type.
 * `most_booking` is renamed to `most_booked` for the awards vocabulary; the
 * `new`/`verified` badges are NOT awards (they're not exclusive recognitions).
 */
const BADGE_TO_AWARD: Partial<
  Record<'top_pick' | 'most_booking' | 'new' | 'verified', SpotlightAwardType>
> = {
  top_pick: 'top_pick',
  most_booking: 'most_booked',
};

// Defensive: keep the award-eligible badge set (vendor-badges.ts) and this
// mapping in lockstep. If a new exclusive badge is added to
// SPOTLIGHT_AWARD_BADGES without a BADGE_TO_AWARD entry, it would silently
// produce no award — assert at module load instead.
for (const b of SPOTLIGHT_AWARD_BADGES) {
  if (!BADGE_TO_AWARD[b]) {
    throw new Error(
      `[spotlight-awards] badge '${b}' is award-eligible but has no award_type mapping`,
    );
  }
}

export const AWARD_LABELS: Record<SpotlightAwardType, string> = {
  top_pick: "Setnayan's Top Pick",
  most_booked: 'Most Booked',
  rising: 'Rising Star',
};

export const AWARD_BLURBS: Record<SpotlightAwardType, string> = {
  top_pick:
    'Top 5% this month by review-weighted score — quality and volume combined.',
  most_booked: 'Top 10% this month by completed bookings on Setnayan.',
  rising: 'A standout newcomer gaining momentum fast.',
};

/** A persisted award row, enriched with the vendor's display fields for UI. */
export type SpotlightAwardRow = {
  award_id: string;
  public_id: string;
  vendor_profile_id: string;
  award_type: SpotlightAwardType;
  period_month: string; // 'YYYY-MM-01'
  awarded_at: string;
  awarded_by: 'auto' | 'admin';
  is_homepage_featured: boolean;
  // Joined vendor display fields (null when the profile row is gone — the FK is
  // ON DELETE CASCADE so this is effectively never null in practice).
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
};

/**
 * Returns the first-of-month DATE string ('YYYY-MM-01') for the given instant
 * (defaults to now). This is the canonical `period_month` bucket — the UNIQUE
 * key truncates to month so all runs in a month land on the same rows.
 */
export function currentPeriodMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Loads the GLOBAL verified-vendor pool for badge computation. Unlike the
 * /explore page (which computes badges against the page's VISIBLE set so
 * percentiles reflect what's on screen), the awards recompute must run against
 * the full verified pool so the monthly winners are platform-wide, not
 * page-relative.
 *
 * Reads `verification_state` + `created_at` from `vendor_profiles` and the
 * rating aggregates from the `vendor_review_stats` materialized view, joined on
 * vendor_profile_id. Only `verification_state = 'verified'` rows are returned —
 * the badge engine ignores everyone else anyway, and this keeps the pool small.
 */
async function fetchVerifiedVendorPool(
  admin: SupabaseClient,
): Promise<{
  badgeInputs: VendorBadgeInput[];
  display: Map<
    string,
    { business_name: string | null; business_slug: string | null; logo_url: string | null }
  >;
}> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, business_slug, logo_url, created_at, verification_state',
    )
    .eq('verification_state', 'verified');

  if (error) {
    throw new Error(`[spotlight-awards] verified pool fetch failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string | null;
    business_slug: string | null;
    logo_url: string | null;
    created_at: string | null;
    verification_state: string | null;
  }>;

  const display = new Map<
    string,
    { business_name: string | null; business_slug: string | null; logo_url: string | null }
  >();
  for (const r of rows) {
    display.set(r.vendor_profile_id, {
      business_name: r.business_name,
      business_slug: r.business_slug,
      logo_url: r.logo_url,
    });
  }

  // Rating aggregates from the materialized view (avg_rating_overall +
  // total_count). Vendors absent here have 0 reviews — defaulted below.
  const ids = rows.map((r) => r.vendor_profile_id);
  const ratings = new Map<string, { avg: number; count: number }>();
  if (ids.length > 0) {
    const { data: statRows, error: statErr } = await admin
      .from('vendor_review_stats')
      .select('vendor_profile_id, avg_rating_overall, total_count')
      .in('vendor_profile_id', ids);
    if (statErr) {
      // Fail-soft: missing ratings just disqualify top_pick (score 0). The
      // recompute still produces most_booked. Never blocks the whole run.
      console.error('[spotlight-awards] review stats fetch failed', statErr);
    } else {
      for (const s of (statRows ?? []) as Array<{
        vendor_profile_id: string;
        avg_rating_overall: number | null;
        total_count: number | null;
      }>) {
        ratings.set(s.vendor_profile_id, {
          avg: Number(s.avg_rating_overall ?? 0),
          count: Number(s.total_count ?? 0),
        });
      }
    }
  }

  const badgeInputs: VendorBadgeInput[] = rows.map((r) => {
    const rt = ratings.get(r.vendor_profile_id);
    return {
      vendor_profile_id: r.vendor_profile_id,
      verification_state: r.verification_state,
      created_at: r.created_at,
      avg_rating_overall: rt?.avg ?? 0,
      review_count: rt?.count ?? 0,
    };
  });

  return { badgeInputs, display };
}

export type RecomputeResult = {
  periodMonth: string;
  poolSize: number;
  /** Count of AUTO winners written this run, by award_type. */
  written: Record<SpotlightAwardType, number>;
  /** Admin-curated rows preserved (not overwritten) this run. */
  adminPreserved: number;
};

/**
 * Recomputes the current-period Spotlight Awards snapshot and UPSERTs the
 * AUTO winners (top_pick + most_booked) into `vendor_spotlight_awards`.
 *
 * MERGE SEMANTICS (so admin curation survives re-runs):
 *   • For each (vendor, award_type) the badge engine picks this month, we
 *     UPSERT an awarded_by='auto' row — but we DO NOT clobber a row an admin
 *     already touched (awarded_by='admin') or featured (is_homepage_featured).
 *     The UPSERT explicitly excludes those columns from the update set, and we
 *     never downgrade awarded_by from 'admin' back to 'auto'.
 *   • We do NOT delete auto rows that fell out of the winners set this run —
 *     a vendor's award is a record of that month; it isn't retroactively
 *     revoked mid-month by a later recompute. (Admins can remove via the
 *     console if needed.) Within the SAME month, re-runs simply re-affirm the
 *     same rows via the UNIQUE key.
 *   • 'rising' is never auto-written here (no auto formula yet — admin-only).
 *
 * Always writes with the service-role admin client → callers MUST be in an
 * admin/server context. Returns a summary for the admin toast.
 */
export async function runSpotlightRecompute(
  now: Date = new Date(),
): Promise<RecomputeResult> {
  const admin = createAdminClient();
  const periodMonth = currentPeriodMonth(now);

  const { badgeInputs } = await fetchVerifiedVendorPool(admin);
  const badgeIds = badgeInputs.map((b) => b.vendor_profile_id);
  const bookingCounts = await fetchCompletedBookingCounts(admin, badgeIds);

  const badgesByVendor = computeVendorBadges(badgeInputs, bookingCounts, {
    now: now.getTime(),
  });

  // Collect (vendor, award_type) winners from the engine output.
  const winners: Array<{ vendor_profile_id: string; award_type: SpotlightAwardType }> = [];
  for (const [vendorId, badges] of badgesByVendor) {
    for (const badge of badges) {
      const awardType = BADGE_TO_AWARD[badge as keyof typeof BADGE_TO_AWARD];
      if (awardType) winners.push({ vendor_profile_id: vendorId, award_type: awardType });
    }
  }

  const written: Record<SpotlightAwardType, number> = {
    top_pick: 0,
    most_booked: 0,
    rising: 0,
  };

  // Pull existing rows for this period so we can (a) skip overwriting
  // admin-curated/featured rows, and (b) count admin rows preserved.
  const { data: existing } = await admin
    .from('vendor_spotlight_awards')
    .select('vendor_profile_id, award_type, awarded_by, is_homepage_featured')
    .eq('period_month', periodMonth);

  const adminTouched = new Set<string>();
  let adminPreserved = 0;
  for (const e of (existing ?? []) as Array<{
    vendor_profile_id: string;
    award_type: string;
    awarded_by: string;
    is_homepage_featured: boolean;
  }>) {
    if (e.awarded_by === 'admin' || e.is_homepage_featured) {
      adminTouched.add(`${e.vendor_profile_id}:${e.award_type}`);
      if (e.awarded_by === 'admin') adminPreserved += 1;
    }
  }

  // Only insert auto rows that an admin hasn't already curated/featured. Use
  // ignoreDuplicates so the UNIQUE key makes this a true idempotent insert that
  // never clobbers awarded_by='admin' or is_homepage_featured on existing rows.
  const toInsert = winners
    .filter((w) => !adminTouched.has(`${w.vendor_profile_id}:${w.award_type}`))
    .map((w) => ({
      vendor_profile_id: w.vendor_profile_id,
      award_type: w.award_type,
      period_month: periodMonth,
      awarded_by: 'auto' as const,
    }));

  if (toInsert.length > 0) {
    const { error } = await admin
      .from('vendor_spotlight_awards')
      .upsert(toInsert, {
        onConflict: 'vendor_profile_id,award_type,period_month',
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`[spotlight-awards] upsert failed: ${error.message}`);
    }
    for (const w of toInsert) written[w.award_type] += 1;
  }

  return {
    periodMonth,
    poolSize: badgeInputs.length,
    written,
    adminPreserved,
  };
}

// ---- Opportunistic, cron-free monthly trigger (Next 15 after()) -------------

/**
 * In-process throttle so the after()-driven recompute fires AT MOST once per
 * server instance per period. This is a best-effort optimization on top of the
 * idempotent UPSERT — even without it, a re-run is a cheap no-op. Reset on
 * deploy (module reload), which is fine: at most one extra recompute per deploy.
 */
let lastAutoPeriod: string | null = null;

/**
 * Cron-free opportunistic recompute. Call this inside a Next 15 `after()` on a
 * high-traffic admin/server surface (e.g. the admin layout). It runs the
 * recompute ONCE per period per instance, then short-circuits for the rest of
 * the month. Never throws (swallows + logs) so it can't break the request it
 * piggybacks on.
 *
 * This is the cron-FREE monthly mechanism: the work happens on the first admin
 * page view of a new month, not on a timer. If no admin visits, the admin
 * "Run now" button is always available as the manual fallback.
 */
export async function maybeRecomputeSpotlightAwards(now: Date = new Date()): Promise<void> {
  const period = currentPeriodMonth(now);
  if (lastAutoPeriod === period) return; // already done this month on this instance
  lastAutoPeriod = period;
  try {
    await runSpotlightRecompute(now);
  } catch (err) {
    // Reset so a transient failure can retry on the next admin request.
    lastAutoPeriod = null;
    console.error('[spotlight-awards] opportunistic recompute failed', err);
  }
}

// ---- Read helpers (public surfaces) -----------------------------------------

/**
 * Loads the awards for a period, enriched with vendor display fields. Used by
 * the admin console (all rows) and the homepage strip (featured-only via
 * `featuredOnly`). Sorted: featured first, then top_pick → most_booked →
 * rising, then most-recent.
 */
export async function fetchSpotlightAwards(
  client: SupabaseClient,
  opts: { periodMonth?: string; featuredOnly?: boolean } = {},
): Promise<SpotlightAwardRow[]> {
  const periodMonth = opts.periodMonth ?? currentPeriodMonth();

  let query = client
    .from('vendor_spotlight_awards')
    .select(
      `award_id, public_id, vendor_profile_id, award_type, period_month,
       awarded_at, awarded_by, is_homepage_featured,
       vendor:vendor_profiles!inner ( business_name, business_slug, logo_url )`,
    )
    .eq('period_month', periodMonth);

  if (opts.featuredOnly) query = query.eq('is_homepage_featured', true);

  const { data, error } = await query;
  if (error) {
    console.error('[spotlight-awards] fetch awards failed', error);
    return [];
  }

  const rows: SpotlightAwardRow[] = ((data ?? []) as unknown[]).map((raw) => {
    const r = raw as {
      award_id: string;
      public_id: string;
      vendor_profile_id: string;
      award_type: SpotlightAwardType;
      period_month: string;
      awarded_at: string;
      awarded_by: 'auto' | 'admin';
      is_homepage_featured: boolean;
      vendor:
        | { business_name: string | null; business_slug: string | null; logo_url: string | null }
        | Array<{ business_name: string | null; business_slug: string | null; logo_url: string | null }>
        | null;
    };
    // PostgREST returns the embedded relation as an object for a to-one join,
    // but type generators often widen it to an array — normalize both.
    const v = Array.isArray(r.vendor) ? r.vendor[0] : r.vendor;
    return {
      award_id: r.award_id,
      public_id: r.public_id,
      vendor_profile_id: r.vendor_profile_id,
      award_type: r.award_type,
      period_month: r.period_month,
      awarded_at: r.awarded_at,
      awarded_by: r.awarded_by,
      is_homepage_featured: r.is_homepage_featured,
      business_name: v?.business_name ?? null,
      business_slug: v?.business_slug ?? null,
      logo_url: v?.logo_url ?? null,
    };
  });

  const typeRank: Record<SpotlightAwardType, number> = {
    top_pick: 0,
    most_booked: 1,
    rising: 2,
  };
  rows.sort((a, b) => {
    if (a.is_homepage_featured !== b.is_homepage_featured) {
      return a.is_homepage_featured ? -1 : 1;
    }
    if (typeRank[a.award_type] !== typeRank[b.award_type]) {
      return typeRank[a.award_type] - typeRank[b.award_type];
    }
    return b.awarded_at.localeCompare(a.awarded_at);
  });

  return rows;
}

/**
 * Returns the award TYPES a vendor holds in the current period (for the
 * vendor-dashboard "You earned a Spotlight Award" banner). Empty array when the
 * vendor has no current award. Read with the vendor's own RLS-scoped client —
 * the table is public-read so this resolves fine.
 */
export async function fetchVendorCurrentAwards(
  client: SupabaseClient,
  vendorProfileId: string,
  periodMonth: string = currentPeriodMonth(),
): Promise<SpotlightAwardType[]> {
  const { data, error } = await client
    .from('vendor_spotlight_awards')
    .select('award_type')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('period_month', periodMonth);

  if (error) {
    console.error('[spotlight-awards] vendor award fetch failed', error);
    return [];
  }
  return ((data ?? []) as Array<{ award_type: SpotlightAwardType }>).map(
    (r) => r.award_type,
  );
}

/** One homepage-strip card: a featured vendor + the award types they hold. */
export type SpotlightHomepageVendor = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  award_types: SpotlightAwardType[];
};

/**
 * Loads the PUBLIC homepage Spotlight strip, DOUBLE-GATED and inert by default:
 *
 *   1. Owner switch — `platform_settings.spotlight_homepage_enabled` (migration
 *      20270417213000, DEFAULT FALSE). Featuring vendors publicly needs owner
 *      sign-off; while OFF this returns [] and the strip renders nothing.
 *   2. Per-row curation — only `is_homepage_featured` award rows (admin-flipped
 *      in /admin/spotlight-awards) are read (featuredOnly), for the current
 *      period.
 *
 * Self-contained: the homepage is anonymous, so this reads with the service-role
 * admin client (mirrors fetchOnboardingBgMusicUrl) rather than depending on anon
 * RLS. Returns [] on ANY error / gate-off — the strip simply never mounts.
 * Rows are collapsed to one card per vendor (a vendor holding two featured
 * awards shows one card with both badges), preserving the fetchSpotlightAwards
 * sort (top_pick → most_booked → rising).
 */
// The homepage renders this on EVERY request (it's on the force-dynamic home
// page's critical path), but the strip is DOUBLE-GATED and inert by default, so
// the result is almost always []. Without caching, a normal visitor paid a live
// cross-region platform_settings round-trip just to read a default-OFF gate.
// Cache the result with a short 60s revalidate (fresh enough when an admin flips
// the toggle / features a vendor); SPOTLIGHT_HOMEPAGE_TAG lets admin actions bust
// it immediately via revalidateTag. (Perf sweep 2026-07-02, finding #9.)
export const SPOTLIGHT_HOMEPAGE_TAG = 'homepage-spotlight';

const loadHomepageSpotlight = unstable_cache(
  async (): Promise<SpotlightHomepageVendor[]> => {
    try {
      const { fetchPlatformSettings } = await import('./platform-settings');
      const admin = createAdminClient();

      const settings = await fetchPlatformSettings(admin);
      if (!settings.spotlight_homepage_enabled) return [];

      const rows = await fetchSpotlightAwards(admin, { featuredOnly: true });
      if (rows.length === 0) return [];

      // Collapse to one card per vendor, keeping fetchSpotlightAwards' order.
      const byVendor = new Map<string, SpotlightHomepageVendor>();
      for (const r of rows) {
        const existing = byVendor.get(r.vendor_profile_id);
        if (existing) {
          if (!existing.award_types.includes(r.award_type)) {
            existing.award_types.push(r.award_type);
          }
          continue;
        }
        byVendor.set(r.vendor_profile_id, {
          vendor_profile_id: r.vendor_profile_id,
          business_name: r.business_name,
          business_slug: r.business_slug,
          logo_url: r.logo_url,
          award_types: [r.award_type],
        });
      }
      return [...byVendor.values()];
    } catch (err) {
      console.error('[spotlight-awards] homepage strip load failed', err);
      return [];
    }
  },
  ['homepage-spotlight'],
  { tags: [SPOTLIGHT_HOMEPAGE_TAG], revalidate: 60 },
);

export async function fetchHomepageSpotlight(): Promise<SpotlightHomepageVendor[]> {
  return loadHomepageSpotlight();
}
