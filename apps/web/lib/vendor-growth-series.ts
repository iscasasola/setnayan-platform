/**
 * lib/vendor-growth-series.ts — the readers the Analytics hero's lanes were missing (owner-APPROVED redesign, 6 Nov
 * 2026: "views and inquiries per bucket — no reader buckets `vendor_profile_views` or `chat_threads` by time; the rows
 * exist, the grouping does not").
 *
 *   fetchViewsSeries      — profile views, per Manila day (last 30) and per Manila month (last 12)
 *   fetchInquiriesSeries  — inquiries (`chat_threads.created_at`, the funnel's INQUIRIES stage), same buckets
 *   fetchBookedSeries     — bookings (`event_vendors`, the funnel's BOOKED stage), for last year and three years
 *   Each also carries the same buckets last year and the three seasons (vs last year, owner 21 Nov 2026).
 *   fetchUpcomingBookedDays — the next 13 weeks' booked dates (`vendor_schedule_pool_bookings`, the SAME rows
 *                             `vendor_upcoming_load` counts) for the §4 calendar strip
 *
 * The bucket shape is the booked series' (`ChartPoint` key/label: `YYYY-MM-DD` days labelled "6 Nov", `YYYY-MM-01`
 * months labelled "Nov"), in Manila time like `vendor_booking_*_series`, so all three lanes share one x-axis.
 *
 * HONEST (`vendor-dashboard/reads-are-honest.test.ts`): a refused read is `null` — the lane says "Couldn’t load" —
 * never an all-zero series that would draw "Your first profile view lands here" to a shop with hundreds. The reads
 * are RLS-scoped exactly as the funnel's own counts (`fetchVendorFunnelTotalsResult`) and `fetchViewsBySource` are.
 * 🔒 lib/vendor-growth-series.test.ts
 */
import { manilaDay, STRIP_DAYS, type BucketPoint } from './analytics-growing';
import { buildCompareSeries, compareStartMs, type CompareSeries, type InstantRow } from './analytics-vs-last-year';
import { BOOKED_EVENT_VENDOR_STATUSES, countDistinctViewers } from './vendor-funnel';

/**
 * The lanes (`day` · `month`), plus — from the SAME read — last year's buckets and totals and the three seasons
 * (`lib/analytics-vs-last-year.ts`, owner 21 Nov 2026 "vs last year — YES"). Fixtures may leave the last two out.
 */
export type GrowthSeries = { day: BucketPoint[]; month: BucketPoint[] } & Partial<Pick<CompareSeries, 'lastYear' | 'years'>>;

/** The loose PostgREST surface these reads use (the RLS server client in the page, a fake in the test). */
type Query = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }> & {
  eq: (c: string, v: string) => Query;
  gte: (c: string, v: string) => Query;
  lt: (c: string, v: string) => Query;
  is: (c: string, v: null) => Query;
  in: (c: string, v: readonly string[]) => Query;
  order: (c: string, o: { ascending: boolean }) => Query;
  range: (from: number, to: number) => Query;
};
export type SeriesClient = { from: (table: string) => { select: (cols: string) => Query } };

/** PostgREST returns at most 1,000 rows a request — page through, so a busy shop's year is never cut short. */
const PAGE = 1000;
/** Past this many pages the read is too big to bucket here — said "Couldn’t load", never a truncated lane. */
const MAX_PAGES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every row of the vendor in `[sinceIso, untilIso)` — its instant, and (for views) who opened — or null when any page
 * was refused. `statusIn` narrows to the booked statuses (the funnel's Booked stage).
 */
async function rowsBetween(
  client: SeriesClient,
  t: SeriesTable,
  vendorProfileId: string,
  sinceIso: string,
  untilIso: string | null,
): Promise<InstantRow[] | null> {
  const out: InstantRow[] = [];
  const cols = t.who ? `${t.col}, ${t.who}` : t.col;
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = client.from(t.table).select(cols).eq(t.vendorCol, vendorProfileId);
    if (t.statusIn) q = q.in('status', t.statusIn);
    q = q.gte(t.col, sinceIso);
    if (untilIso) q = q.lt(t.col, untilIso);
    const { data, error } = await q.order(t.col, { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) {
      // Recorded, then null — the lanes draw "Couldn’t load", never an empty lane (ugat both-ends: no silent drop).
      console.error(`[supabase-error] lib/vendor-growth-series.ts · from:${t.table}.select`, error);
      return null;
    }
    if (!data) return null;
    for (const r of data as Record<string, unknown>[]) {
      if (typeof r[t.col] === 'string') out.push({ at: r[t.col] as string, who: t.who && typeof r[t.who] === 'string' ? (r[t.who] as string) : null });
    }
    if (data.length < PAGE) return out;
  }
  return null;
}

type SeriesTable = { table: string; col: string; vendorCol: string; who?: string; statusIn?: readonly string[] };

/** The read is cut in three spans read side by side — three years of a busy shop's rows page in a third of the time. */
const CHUNKS = 3;

async function series(client: SeriesClient, t: SeriesTable, vendorProfileId: string, nowMs: number): Promise<GrowthSeries | null> {
  const start = compareStartMs(nowMs);
  const step = Math.ceil((nowMs - start) / CHUNKS);
  const edges = Array.from({ length: CHUNKS }, (_, i) => new Date(start + i * step).toISOString());
  const parts = await Promise.all(edges.map((from, i) => rowsBetween(client, t, vendorProfileId, from, edges[i + 1] ?? null)));
  if (parts.some((p) => p === null)) return null;
  const rows = parts.flat() as InstantRow[];
  // Opens total as couples — the card's own count (`countDistinctViewers`), never rows.
  return t.who ? buildCompareSeries(rows, nowMs, (r) => countDistinctViewers(r.map((x) => ({ viewer_hash: x.who })))) : buildCompareSeries(rows, nowMs);
}

/** Profile views per day (30) and per month (12) — the funnel's VIEWS stage, over time. null = refused. */
export function fetchViewsSeries(client: SeriesClient, vendorProfileId: string, nowMs = Date.now()): Promise<GrowthSeries | null> {
  return series(client, { table: 'vendor_profile_views', col: 'viewed_at', vendorCol: 'vendor_profile_id', who: 'viewer_hash' }, vendorProfileId, nowMs);
}

/** Inquiries per day (30) and per month (12) — the funnel's INQUIRIES stage, over time. null = refused. */
export function fetchInquiriesSeries(client: SeriesClient, vendorProfileId: string, nowMs = Date.now()): Promise<GrowthSeries | null> {
  return series(client, { table: 'chat_threads', col: 'created_at', vendorCol: 'vendor_profile_id' }, vendorProfileId, nowMs);
}

/**
 * Bookings per day and month with last year and the three seasons — the funnel's BOOKED stage (`event_vendors` in
 * `BOOKED_EVENT_VENDOR_STATUSES`, by `created_at`, exactly as the card's own number counts it). Read on the ADMIN
 * client: `event_vendors` has no vendor SELECT policy (see the section's `bookingsAdmin`). null = refused.
 */
export function fetchBookedSeries(client: SeriesClient, vendorProfileId: string, nowMs = Date.now()): Promise<GrowthSeries | null> {
  return series(client, { table: 'event_vendors', col: 'created_at', vendorCol: 'marketplace_vendor_id', statusIn: BOOKED_EVENT_VENDOR_STATUSES }, vendorProfileId, nowMs);
}

/**
 * The live booked dates in the next 13 weeks, with how many bookings each holds — the rows `vendor_upcoming_load`
 * counts (`released_at IS NULL`, `booked_date >= today`, Manila). null = refused.
 */
export async function fetchUpcomingBookedDays(
  client: SeriesClient,
  vendorProfileId: string,
  nowMs = Date.now(),
): Promise<{ date: string; bookings: number }[] | null> {
  const today = manilaDay(nowMs);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + STRIP_DAYS * DAY_MS).toISOString().slice(0, 10);
  const { data, error } = await client
    .from('vendor_schedule_pool_bookings')
    .select('booked_date')
    .eq('vendor_profile_id', vendorProfileId)
    .is('released_at', null)
    .gte('booked_date', today)
    .lt('booked_date', end)
    .order('booked_date', { ascending: true })
    .range(0, PAGE * 5 - 1);
  if (error) {
    console.error('[supabase-error] lib/vendor-growth-series.ts · from:vendor_schedule_pool_bookings.select', error);
    return null;
  }
  if (!data) return null;
  const by = new Map<string, number>();
  for (const r of data as { booked_date?: unknown }[]) {
    if (typeof r.booked_date !== 'string') continue;
    const d = r.booked_date.slice(0, 10);
    by.set(d, (by.get(d) ?? 0) + 1);
  }
  return [...by.entries()].map(([date, bookings]) => ({ date, bookings }));
}
