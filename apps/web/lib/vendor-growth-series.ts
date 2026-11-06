/**
 * lib/vendor-growth-series.ts — the readers the Analytics hero's lanes were missing (owner-APPROVED redesign, 6 Nov
 * 2026: "views and inquiries per bucket — no reader buckets `vendor_profile_views` or `chat_threads` by time; the rows
 * exist, the grouping does not").
 *
 *   fetchViewsSeries      — profile views, per Manila day (last 30) and per Manila month (last 12)
 *   fetchInquiriesSeries  — inquiries (`chat_threads.created_at`, the funnel's INQUIRIES stage), same buckets
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
import { bucketInstants, dayBuckets, manilaDay, monthBuckets, STRIP_DAYS, type BucketPoint } from './analytics-growing';

export type GrowthSeries = { day: BucketPoint[]; month: BucketPoint[] };

/** The loose PostgREST surface these reads use (the RLS server client in the page, a fake in the test). */
type Query = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }> & {
  eq: (c: string, v: string) => Query;
  gte: (c: string, v: string) => Query;
  lt: (c: string, v: string) => Query;
  is: (c: string, v: null) => Query;
  order: (c: string, o: { ascending: boolean }) => Query;
  range: (from: number, to: number) => Query;
};
export type SeriesClient = { from: (table: string) => { select: (cols: string) => Query } };

/** PostgREST returns at most 1,000 rows a request — page through, so a busy shop's year is never cut short. */
const PAGE = 1000;
/** Past this many pages the read is too big to bucket here — said "Couldn’t load", never a truncated lane. */
const MAX_PAGES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Every `col` instant for the vendor since `sinceIso`, or null when any page was refused. */
async function instantsSince(
  client: SeriesClient,
  table: string,
  col: string,
  vendorCol: string,
  vendorProfileId: string,
  sinceIso: string,
): Promise<string[] | null> {
  const out: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client
      .from(table)
      .select(col)
      .eq(vendorCol, vendorProfileId)
      .gte(col, sinceIso)
      .order(col, { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) return null;
    for (const r of data as Record<string, unknown>[]) if (typeof r[col] === 'string') out.push(r[col] as string);
    if (data.length < PAGE) return out;
  }
  return null;
}

/** The first instant the 12-month buckets cover (the first of the month eleven months back, Manila). */
function yearStartIso(nowMs: number): string {
  const first = monthBuckets(nowMs, 12)[0]!.key; // YYYY-MM-01, Manila
  return new Date(Date.parse(`${first}T00:00:00+08:00`)).toISOString();
}

async function series(client: SeriesClient, table: string, col: string, vendorCol: string, vendorProfileId: string, nowMs: number): Promise<GrowthSeries | null> {
  const instants = await instantsSince(client, table, col, vendorCol, vendorProfileId, yearStartIso(nowMs));
  if (instants === null) return null;
  return {
    day: bucketInstants(instants, dayBuckets(nowMs, 30), 'day'),
    month: bucketInstants(instants, monthBuckets(nowMs, 12), 'month'),
  };
}

/** Profile views per day (30) and per month (12) — the funnel's VIEWS stage, over time. null = refused. */
export function fetchViewsSeries(client: SeriesClient, vendorProfileId: string, nowMs = Date.now()): Promise<GrowthSeries | null> {
  return series(client, 'vendor_profile_views', 'viewed_at', 'vendor_profile_id', vendorProfileId, nowMs);
}

/** Inquiries per day (30) and per month (12) — the funnel's INQUIRIES stage, over time. null = refused. */
export function fetchInquiriesSeries(client: SeriesClient, vendorProfileId: string, nowMs = Date.now()): Promise<GrowthSeries | null> {
  return series(client, 'chat_threads', 'created_at', 'vendor_profile_id', vendorProfileId, nowMs);
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
  if (error || !data) return null;
  const by = new Map<string, number>();
  for (const r of data as { booked_date?: unknown }[]) {
    if (typeof r.booked_date !== 'string') continue;
    const d = r.booked_date.slice(0, 10);
    by.set(d, (by.get(d) ?? 0) + 1);
  }
  return [...by.entries()].map(([date, bookings]) => ({ date, bookings }));
}
