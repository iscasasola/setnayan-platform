import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { canSeeMarketIntel, canSeePerformanceAdvanced, canSeePerformanceTrends } from '@/lib/vendor-tier-caps';
import { fetchVendorCapacityAnalytics, type CapacityAnalytics } from '@/lib/vendor-capacity-analytics';
import { fetchVendorConversionAnalytics, type ConversionAnalytics } from '@/lib/vendor-conversion-analytics';
import { fetchVendorPricePosition, type PricePositionResult } from '@/lib/price-position';
import { fetchVendorSourceAttribution, type SourceAttribution } from '@/lib/vendor-source-attribution';
import { EMPTY_FUNNEL_BENCHMARK, FUNNEL_BENCHMARK_UNREADABLE, getVendorFunnelBenchmark, type FunnelBenchmark } from '@/lib/funnel-benchmark';
import { buildGrowthRecs, type GrowthRec, type GrowthRecStats } from '@/lib/vendor-growth-recs';
import { fetchUpcomingBookedDays, type SeriesClient } from '@/lib/vendor-growth-series';
import { manilaDay } from '@/lib/analytics-growing';
import { seriesSinceIso, type SeriesCard } from '@/lib/shop-analytics-series';

/**
 * 📊 SHOP › ANALYTICS — ONE batched loader for the five carousel cards and their sheets (THE ONE BUILD A3 W8/W9, lane C4;
 * spec §4: "Analytics = FIVE cards (What's ahead · deals · price · worth · compare)").
 *
 * 🔑 NO NEW QUERY SHAPE FOR THE CARDS — every card reads with the reader `/vendor-dashboard/performance` already uses
 * (`fetchVendorCapacityAnalytics`, `fetchVendorConversionAnalytics`, `fetchVendorPricePosition`,
 * `fetchVendorSourceAttribution`, `getVendorFunnelBenchmark`, `buildGrowthRecs`), under the SAME gates:
 *   · owner/admin only (`canManageVendor` — the cards surface booking revenue, as on Performance);
 *   · tier, only while the feature gate is on: trends (worth), advanced (ahead · deals), market (price · compare).
 * New here are only the 13-week strip (`fetchUpcomingBookedDays`, harvested from #7338) and the three sheet series
 * (instants, `lib/shop-analytics-series.ts`). Everything starts at once and is awaited once.
 *
 * 🔑 HONEST: a refused read is `null` (the card says "Couldn’t load"), a tier-locked card is `'locked'` (it says which
 * plan shows it), never a zero.
 */
export type Locked = 'locked';

export type ShopAnalytics =
  | { access: 'not_manager' }
  | {
      access: 'ok';
      todayIso: string;
      ahead: { capacity: CapacityAnalytics | null; booked: { date: string; bookings: number }[] | null } | Locked;
      deals: ConversionAnalytics | null | Locked;
      price: PricePositionResult | { status: 'unreadable' } | null | Locked;
      worth: SourceAttribution | null | Locked;
      compare: { benchmark: FunnelBenchmark; unreadable: boolean } | Locked;
      recs: GrowthRec[];
      /** The three sheets' instants (null = refused → "Couldn't load"; absent = the card is locked). */
      series: Partial<Record<SeriesCard, string[] | null>>;
    };

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PAGE = 1000;
const MAX_PAGES = 20;

function soft<T>(p: PromiseLike<T>, fallback: T, label: string, vendorId: string): Promise<T> {
  return Promise.resolve(p).catch((err) => {
    logQueryError(`ShopAnalytics.${label}`, err, { vendorId });
    return fallback;
  });
}

/** Every instant of `col` on the shop's rows since `sinceIso`, paged; null when any page was refused. */
async function instants(
  supabase: SupabaseClient,
  table: string,
  col: string,
  vendorId: string,
  sinceIso: string,
  filters: ReadonlyArray<[string, string | null]>,
): Promise<string[] | null> {
  const out: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabase.from(table).select(col).eq('vendor_profile_id', vendorId).gte(col, sinceIso);
    for (const [c, v] of filters) q = v === null ? q.is(c, null) : q.eq(c, v);
    const { data, error } = await q.order(col, { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) {
      logQueryError(`ShopAnalytics.series.${table}`, error, { vendorId }, 'graceful_degrade');
      return null;
    }
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of rows) if (typeof r[col] === 'string') out.push(r[col] as string);
    if (rows.length < PAGE) return out;
  }
  // Too many to bucket here — "Couldn't load", never a cut-short line.
  return null;
}

export async function loadShopAnalytics(
  supabase: SupabaseClient,
  profile: VendorProfileRow,
  userId: string,
  /** The shop's plan — or the promise of it: the role read starts at once, beside the plan read (one round trip). */
  tierIn: string | null | PromiseLike<string | null>,
  nowMs: number = Date.now(),
): Promise<ShopAnalytics> {
  const vendorId = profile.vendor_profile_id;
  const [role, tier] = await Promise.all([soft(resolveVendorRole(supabase, userId), null, 'role', vendorId), tierIn]);
  // A team member who is not an owner/admin: the cards carry booking revenue (Performance's own rule).
  if (role && !canManageVendor(role)) return { access: 'not_manager' };

  const gateOn = isVendorFeatureGateEnabled();
  const canTrends = !gateOn || canSeePerformanceTrends(tier);
  const canAdvanced = !gateOn || canSeePerformanceAdvanced(tier);
  const canMarket = !gateOn || canSeeMarketIntel(tier);
  const since = seriesSinceIso(nowMs);
  const yearAgo = new Date(nowMs - YEAR_MS).toISOString();
  const today = manilaDay(nowMs);

  const [capacity, booked, deals, price, worth, benchmark, stats, aheadSeries, dealsSeries, worthSeries] = await Promise.all([
    canAdvanced ? soft(fetchVendorCapacityAnalytics(supabase, vendorId), null, 'capacity', vendorId) : Promise.resolve(null),
    canAdvanced
      ? soft(fetchUpcomingBookedDays(supabase as unknown as SeriesClient, vendorId, nowMs), null, 'aheadStrip', vendorId)
      : Promise.resolve(null),
    canAdvanced ? soft(fetchVendorConversionAnalytics(supabase, vendorId, yearAgo), null, 'deals', vendorId) : Promise.resolve(null),
    canMarket
      ? soft<PricePositionResult | { status: 'unreadable' } | null>(fetchVendorPricePosition(profile), { status: 'unreadable' }, 'price', vendorId)
      : Promise.resolve(null),
    canTrends ? soft(fetchVendorSourceAttribution(supabase, vendorId, yearAgo, null), null, 'worth', vendorId) : Promise.resolve(null),
    canMarket
      ? soft<FunnelBenchmark | typeof FUNNEL_BENCHMARK_UNREADABLE>(getVendorFunnelBenchmark(supabase, vendorId), FUNNEL_BENCHMARK_UNREADABLE, 'compare', vendorId)
      : Promise.resolve(EMPTY_FUNNEL_BENCHMARK),
    // The growth tips' inputs — the same row Performance reads (`vendor_activity_stats`).
    soft(
      Promise.resolve(
        supabase
          .from('vendor_activity_stats')
          .select('response_rate_pct, avg_response_minutes, review_count, profile_completeness_pct, finalized_booking_count')
          .eq('vendor_profile_id', vendorId)
          .maybeSingle(),
      ).then(({ data, error }) => {
        if (error) logQueryError('ShopAnalytics.stats', error, { vendorId }, 'graceful_degrade');
        return error ? undefined : ((data as Partial<GrowthRecStats> | null) ?? null);
      }),
      undefined,
      'stats',
      vendorId,
    ),
    canAdvanced ? soft(instants(supabase, 'vendor_schedule_pool_bookings', 'booked_date', vendorId, since.slice(0, 10), [['released_at', null]]), null, 'aheadSeries', vendorId) : Promise.resolve(undefined),
    canAdvanced ? soft(instants(supabase, 'vendor_proposals', 'resolved_at', vendorId, since, [['status', 'accepted']]), null, 'dealsSeries', vendorId) : Promise.resolve(undefined),
    canTrends ? soft(instants(supabase, 'booking_fee_ledger', 'created_at', vendorId, since, [['attribution', 'sourced']]), null, 'worthSeries', vendorId) : Promise.resolve(undefined),
  ]);

  // Tips = only the shipped recs (spec §4), and never advice on an unread row (undefined = refused → no tips).
  const recs =
    stats === undefined
      ? []
      : // `partnership_count` is not read on Shop (one request fewer). Performance's own rule for an unread count:
        // report it above the threshold, so the partnership tip is suppressed rather than nagging a shop that has ten.
        buildGrowthRecs(stats ? ({ ...stats, partnership_count: 99 } as GrowthRecStats) : null);

  const series: Partial<Record<SeriesCard, string[] | null>> = {};
  if (aheadSeries !== undefined) series.ahead = aheadSeries;
  if (dealsSeries !== undefined) series.deals = dealsSeries;
  if (worthSeries !== undefined) series.worth = worthSeries;

  return {
    access: 'ok',
    todayIso: today,
    ahead: canAdvanced ? { capacity, booked } : 'locked',
    deals: canAdvanced ? deals : 'locked',
    price: canMarket ? price : 'locked',
    worth: canTrends ? worth : 'locked',
    compare: canMarket
      ? benchmark === FUNNEL_BENCHMARK_UNREADABLE
        ? { benchmark: EMPTY_FUNNEL_BENCHMARK, unreadable: true }
        : { benchmark, unreadable: false }
      : 'locked',
    recs,
    series,
  };
}
