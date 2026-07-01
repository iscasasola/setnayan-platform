/**
 * Category Benchmarks vs Peers (Enterprise vendor benefit) — server-side assembly.
 *
 * "How does my funnel rank against anonymized peers in my exact category?" — a
 * first-party, de-identified read of peer funnel percentiles for the vendor's
 * (category, region, pax_bucket): reply-rate, avg reply-time, and
 * inquiry→booking conversion. The hard privacy contract lives in SQL (migration
 * 20270414204217_market_funnel_bands):
 *
 *   • Every band is quantiles-only (p25/p50/p75) + a distinct-peer sample_n. No
 *     peer identity by construction.
 *   • A band only surfaces if it clears the admin-managed min-N floor
 *     (platform_settings.radar_min_n_floor, held >= 3) via public.min_n_ok().
 *     The band TABLE is RLS-locked with zero policies; the ONLY door is
 *     funnel_benchmark_for_vendor(), which applies the gate — so there is no
 *     path to un-suppressed rows from the client.
 *   • Cron-free recompute: recompute_market_funnel_bands() (admin "Run now"),
 *     mirrors market_price_bands / demand-radar.
 *
 * Founder-only marketplace today → nearly every bucket is below floor and gets
 * suppressed. getVendorFunnelBenchmark() handles that honestly: a suppressed
 * band returns hasBand=false so the card renders a truthful "not enough peer
 * data yet" state — it never fabricates a ranking.
 *
 * Surface gate: the CARD is Enterprise (canSeeMarketIntel) — enforced by the caller
 * (vendor-stats-panel.tsx); this module carries no gating, just the read + the
 * percentile math.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Row shape (mirrors the SQL RETURNS TABLE of funnel_benchmark_for_vendor)
// ---------------------------------------------------------------------------

/** Raw single-row output of the funnel_benchmark_for_vendor RPC. */
type FunnelBenchmarkRow = {
  has_band: boolean;
  category: string | null;
  region_slug: string | null;
  pax_bucket: string | null;
  sample_n: number | null;
  own_reply_rate: number | null;
  own_reply_mins: number | null;
  own_conversion: number | null;
  reply_rate_p25: number | null;
  reply_rate_p50: number | null;
  reply_rate_p75: number | null;
  reply_mins_p25: number | null;
  reply_mins_p50: number | null;
  reply_mins_p75: number | null;
  conversion_p25: number | null;
  conversion_p50: number | null;
  conversion_p75: number | null;
};

// ---------------------------------------------------------------------------
// Assembled shapes handed to the UI
// ---------------------------------------------------------------------------

/** Which end of the band is "good" — reply-time is inverted (lower is better). */
export type MetricDirection = 'higher_better' | 'lower_better';

/**
 * A vendor's position for one funnel metric vs the peer band. `percentile` is
 * "you rank at/above X% of peers" (0-100), oriented so higher is always better
 * regardless of the metric's raw direction. `band` is the {p25,p50,p75} the
 * marker sits inside. Null when the metric has no own value or no band edges.
 */
export type MetricBenchmark = {
  key: 'reply_rate' | 'reply_mins' | 'conversion';
  label: string;
  direction: MetricDirection;
  /** The vendor's own raw value (pct or minutes). Null = no data for this metric. */
  own: number | null;
  band: { p25: number; p50: number; p75: number } | null;
  /** 0-100, higher = better than more peers. Null when own or band is missing. */
  percentile: number | null;
  /** 'top' | 'above_median' | 'below_median' | 'bottom' — for badge copy. */
  tier: 'top' | 'above_median' | 'below_median' | 'bottom' | null;
};

/** The assembled benchmark handed to the card. */
export type FunnelBenchmark = {
  /** True when a peer band cleared min-N for the vendor's bucket. */
  hasBand: boolean;
  /** The category being benchmarked (the vendor's primary), or null. */
  category: string | null;
  /** Distinct peers in the band. 0 when suppressed. */
  sampleN: number;
  metrics: MetricBenchmark[];
};

/** The honest empty benchmark — used when suppressed / founder-only / errored. */
export const EMPTY_FUNNEL_BENCHMARK: FunnelBenchmark = {
  hasBand: false,
  category: null,
  sampleN: 0,
  metrics: [],
};

// ---------------------------------------------------------------------------
// Percentile math (pure)
// ---------------------------------------------------------------------------

/**
 * Place `own` inside a {p25,p50,p75} band and return a 0-100 percentile oriented
 * so HIGHER is always better. For higher-is-better metrics that's the raw
 * position; for lower-is-better (reply-time) it's inverted.
 *
 * We only have three quantile edges (not the full peer array — by design, for
 * privacy), so we piecewise-linearly interpolate between them and clamp the
 * tails. This gives a smooth, honest "roughly where you sit" marker without ever
 * needing a single peer's value.
 */
export function percentileInBand(
  own: number,
  band: { p25: number; p50: number; p75: number },
  direction: MetricDirection,
): number {
  const { p25, p50, p75 } = band;
  // Raw percentile assuming higher-is-better, interpolating across the edges.
  let raw: number;
  if (own <= p25) {
    // Below the 25th edge: clamp into [0,25], scaled by how far below p25.
    // Without a p0 we approximate the lower tail width as (p50 - p25).
    const width = Math.max(p50 - p25, 1);
    raw = Math.max(0, 25 - ((p25 - own) / width) * 25);
  } else if (own <= p50) {
    raw = 25 + ((own - p25) / Math.max(p50 - p25, 1)) * 25;
  } else if (own <= p75) {
    raw = 50 + ((own - p50) / Math.max(p75 - p50, 1)) * 25;
  } else {
    const width = Math.max(p75 - p50, 1);
    raw = Math.min(100, 75 + ((own - p75) / width) * 25);
  }
  const oriented = direction === 'lower_better' ? 100 - raw : raw;
  return Math.round(Math.max(0, Math.min(100, oriented)));
}

function tierFromPercentile(
  p: number,
): 'top' | 'above_median' | 'below_median' | 'bottom' {
  if (p >= 75) return 'top';
  if (p >= 50) return 'above_median';
  if (p >= 25) return 'below_median';
  return 'bottom';
}

// ---------------------------------------------------------------------------
// Assembly — fold the single RPC row into the card shape
// ---------------------------------------------------------------------------

function buildMetric(
  key: MetricBenchmark['key'],
  label: string,
  direction: MetricDirection,
  own: number | null,
  p25: number | null,
  p50: number | null,
  p75: number | null,
): MetricBenchmark {
  const band =
    p25 !== null && p50 !== null && p75 !== null
      ? { p25, p50, p75 }
      : null;
  const percentile =
    own !== null && band !== null
      ? percentileInBand(own, band, direction)
      : null;
  return {
    key,
    label,
    direction,
    own,
    band,
    percentile,
    tier: percentile !== null ? tierFromPercentile(percentile) : null,
  };
}

/** Fold the (already min-N gated) RPC row into the benchmark card shape. */
export function assembleFunnelBenchmark(
  row: FunnelBenchmarkRow | null,
): FunnelBenchmark {
  if (!row || !row.has_band) {
    return {
      ...EMPTY_FUNNEL_BENCHMARK,
      category: row?.category ?? null,
    };
  }
  return {
    hasBand: true,
    category: row.category,
    sampleN: row.sample_n ?? 0,
    metrics: [
      buildMetric(
        'reply_rate',
        'Response rate',
        'higher_better',
        row.own_reply_rate,
        row.reply_rate_p25,
        row.reply_rate_p50,
        row.reply_rate_p75,
      ),
      buildMetric(
        'reply_mins',
        'Avg reply time',
        'lower_better',
        row.own_reply_mins,
        row.reply_mins_p25,
        row.reply_mins_p50,
        row.reply_mins_p75,
      ),
      buildMetric(
        'conversion',
        'Inquiry → booking',
        'higher_better',
        row.own_conversion,
        row.conversion_p25,
        row.conversion_p50,
        row.conversion_p75,
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Read path — vendor
// ---------------------------------------------------------------------------

/**
 * Vendor-facing category benchmark, scoped to the caller's OWN vendor profile
 * (the RPC enforces ownership + min-N; the band table is RLS-locked). Any RPC
 * error degrades to the empty benchmark so the card stays calm — never throws
 * into the page.
 *
 * @param category optional — benchmark a specific one of the vendor's
 *   categories; omit to use the vendor's primary (most-listed) category.
 */
export async function getVendorFunnelBenchmark(
  client: SupabaseClient,
  vendorProfileId: string,
  category?: string,
): Promise<FunnelBenchmark> {
  const { data, error } = await client.rpc('funnel_benchmark_for_vendor', {
    p_vendor_profile_id: vendorProfileId,
    p_category: category ?? null,
  });
  if (error || !Array.isArray(data) || data.length === 0) {
    return EMPTY_FUNNEL_BENCHMARK;
  }
  return assembleFunnelBenchmark(data[0] as FunnelBenchmarkRow);
}
