import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { manilaDay, type GrowthWindow } from '@/lib/analytics-growing';
import { pagedRows, type ByWindow } from '@/lib/vendor-analytics-graphs.server';
import { fetchInquiryHeatmap, fetchInquiryMissed } from '@/lib/vendor-inquiry-analytics';
import { fetchLeadTime } from '@/lib/vendor-conversion-analytics';
import { fetchReviewCoverage, fetchReviewMonthly } from '@/lib/vendor-reputation-analytics';
import { formatEventTypeLabel, readVendorCompletedEventTypes } from '@/lib/reviews';
import { eventsByKind } from '@/lib/shop-events-by-kind';
import { readVendorPaydayInstallments } from '@/lib/vendor-payday-read';
import { moneyPicture } from '@/lib/vendor-money';
import { heroPhotoUrl } from '@/lib/supplier-hero.server';
import type { BookingMonthPoint } from '@/lib/vendor-booking-series';
import { subStars, topPhotos, windowSeries, type EventKinds, type MonthValue, type OwedTotals, type StoreGraphs, type TopPhotos, type WindowSeries } from '@/lib/vendor-store-graphs';

/**
 * 🛍📊 THE STORE'S NEW GRAPHS' READS (owner 23 Nov 2026, Supplier Store drawing v10) — all started at once by
 * `readStoreGraphs`, beside the section's other reads. The words and buckets are `vendor-store-graphs.ts` (pure, tested).
 *
 * EACH FACT HAS ONE READER, and this file only calls it:
 *   · inquiries missed / by hour — `fetchInquiryMissed` · `fetchInquiryHeatmap` (lib/vendor-inquiry-analytics.ts)
 *   · lead time — `fetchLeadTime` (lib/vendor-conversion-analytics.ts)
 *   · reviews by month · replied — `fetchReviewMonthly` · `fetchReviewCoverage` (lib/vendor-reputation-analytics.ts)
 *   · events by kind — `readVendorCompletedEventTypes` → `eventsByKind` (the shop page's own count)
 *   · paid and still owed — `readVendorPaydayInstallments` → `moneyPicture` (Clients › Money's own picture)
 *   · booked value — the section's `fetchVendorBookingSeries` read, handed in (`withBookedValue`), never read twice
 * and reads three tables no screen counted over time before: `vendor_follows`, `guest_saved_vendors`,
 * `vendor_portfolio_photo_view_days`, plus the four part ratings of `vendor_reviews`.
 *
 * TWO CLIENTS, ON PURPOSE (as `vendor-analytics-graphs.server.ts`):
 *   · `session` — the shop's own RLS session: `vendor_follows` (vendor SELECT policy), `vendor_reviews` (public read),
 *     `vendor_completed_events` (granted view), every RPC above (each ownership-gated in SQL), the payday RPC (it
 *     resolves the shop from `auth.uid()`, so an admin client would read nothing).
 *   · `admin` — ONLY for `guest_saved_vendors` (owner-only RLS: a shop may not read a guest's bookmark) and
 *     `vendor_portfolio_photo_view_days` (no grant at all — only its writer and the service role). Both scoped by the
 *     `vendorProfileId` the page resolved from the shop's own session, and both read COUNTS only: no user id, no viewer
 *     hash ever leaves this file.
 *
 * 🔑 HONEST: any refused page → that graph is `null` ("Couldn’t load"), never a zero and never the Example picture.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

async function instantsSince(label: string, client: SupabaseClient, table: string, col: string, vendorProfileId: string, sinceIso: string): Promise<string[] | null> {
  const rows = await pagedRows(`store.${label}`, vendorProfileId, (a, b) =>
    client.from(table).select(col).eq('vendor_profile_id', vendorProfileId).gte(col, sinceIso).order(col, { ascending: true }).range(a, b),
  );
  return rows === null ? null : rows.map((r) => str(r[col])).filter((x): x is string => x !== null);
}

/** Per-photo views, the last 12 months and the last 30 days, from the dedupe ledger (one row = one view). */
async function readTopPhotos(admin: SupabaseClient, vendorProfileId: string, pageKeys: readonly string[], nowMs: number): Promise<ByWindow<TopPhotos & { urls: Record<string, string> }> | null> {
  if (pageKeys.length === 0) return { '30': { top: [], total: 0, urls: {} }, '12': { top: [], total: 0, urls: {} } };
  const since12 = manilaDay(nowMs - 365 * DAY_MS);
  const since30 = manilaDay(nowMs - 29 * DAY_MS);
  const rows = await pagedRows('store.photos', vendorProfileId, (a, b) =>
    admin
      .from('vendor_portfolio_photo_view_days')
      .select('photo_key, viewed_on')
      .eq('vendor_profile_id', vendorProfileId)
      .gte('viewed_on', since12)
      .order('viewed_on', { ascending: true })
      .range(a, b),
  );
  if (rows === null) return null;
  const clean = rows.flatMap((r) => {
    const k = str(r.photo_key);
    const d = str(r.viewed_on);
    return k && d ? [{ photo_key: k, viewed_on: d }] : [];
  });
  const w30 = topPhotos(clean, pageKeys, since30);
  const w12 = topPhotos(clean, pageKeys, since12);
  // A photo whose display URL will not sign is left out of the picture (never drawn broken); its views still count.
  const keys = [...new Set([...w30.top, ...w12.top].map((p) => p.key))];
  const signed = await Promise.all(keys.map(async (k) => [k, await heroPhotoUrl(k)] as const));
  const urls: Record<string, string> = {};
  for (const [k, u] of signed) if (u) urls[k] = u;
  return { '30': { ...w30, urls }, '12': { ...w12, urls } };
}

/** The four part ratings of every review this shop has. */
async function readSubStars(session: SupabaseClient, vendorProfileId: string) {
  const rows = await pagedRows('store.substars', vendorProfileId, (a, b) =>
    session
      .from('vendor_reviews')
      .select('review_id, rating_communication, rating_quality, rating_value, rating_on_time')
      .eq('vendor_profile_id', vendorProfileId)
      .order('review_id', { ascending: true })
      .range(a, b),
  );
  return rows === null ? null : subStars(rows as Record<'rating_communication' | 'rating_quality' | 'rating_value' | 'rating_on_time', number | null>[]);
}

async function readEventKinds(session: SupabaseClient, vendorProfileId: string): Promise<EventKinds | null> {
  const read = await readVendorCompletedEventTypes(session, vendorProfileId);
  if (read === null) return null;
  // Measured only: the shop's own declared wedding count is the shop page's "at least", not a completed event here.
  const k = eventsByKind({ completed: read.rows, completedCapped: read.capped, declaredWeddings: null, labelFor: (key) => (key ? formatEventTypeLabel(key) : 'Other') });
  if (k === null) return { kinds: [], total: 0, atLeast: false };
  return { kinds: k.kinds.map((x) => ({ key: x.key || 'other', label: x.label, count: x.count })), total: k.total, atLeast: k.atLeast };
}

async function readOwed(session: SupabaseClient, nowMs: number): Promise<OwedTotals | null> {
  const read = await readVendorPaydayInstallments(session);
  // A read that did not reach the end is not a smaller total (lib/vendor-payday-read.ts).
  if (!read.complete) return null;
  const t = moneyPicture(read.rows, 'all', manilaDay(nowMs)).totals;
  return t ? { receivedPhp: t.receivedPhp, toComePhp: t.toComePhp, overdue: t.overdue, unresolved: t.unresolved, bookings: t.bookings } : null;
}

/** The section's monthly booked series (zero-filled by its RPC) → the value graph; `[]` there means it was refused. */
export function monthValuesOf(points: readonly BookingMonthPoint[]): MonthValue[] | null {
  if (points.length === 0) return null;
  return points.slice(-12).map((p) => ({ key: p.month, label: p.label, php: Number(p.revenuePhp) || 0 }));
}

/** The value graph joins once the section's Batch B has its booked series — the same read, never a second one. */
export function withBookedValue(g: ByWindow<StoreGraphs>, points: readonly BookingMonthPoint[]): ByWindow<StoreGraphs> {
  const value = monthValuesOf(points);
  return { '30': { ...g['30'], value }, '12': { ...g['12'], value } };
}

/**
 * Every new graph's read at once; each degrades to its own `null`, never the page. Returned per WINDOW — the fixed
 * ones (`STORE_FIXED_WINDOW`) are the same in both. `value` is null here and filled by `withBookedValue`.
 */
export async function readStoreGraphs(input: {
  session: SupabaseClient;
  admin: SupabaseClient;
  vendorProfileId: string;
  /** `vendor_profiles.portfolio_r2_keys` — only photos still on the page count. */
  pageKeys: readonly string[];
  nowMs: number;
}): Promise<ByWindow<StoreGraphs>> {
  const { session, admin, vendorProfileId, pageKeys, nowMs } = input;
  const soft = <T>(p: Promise<T | null>, label: string): Promise<T | null> =>
    p.catch((err: unknown) => {
      logQueryError(`StoreGraphs.${label}`, err, { vendorProfileId }, 'graceful_degrade');
      return null;
    });
  const since12 = new Date(nowMs - 365 * DAY_MS).toISOString();
  const since30 = new Date(nowMs - 30 * DAY_MS).toISOString();
  const [follows, saves, photos, heat, missed30, missed12, owed, lead, types, revmonth, substars, coverage] = await Promise.all([
    soft(instantsSince('followers', session, 'vendor_follows', 'followed_at', vendorProfileId, since12), 'followers'),
    soft(instantsSince('saved', admin, 'guest_saved_vendors', 'saved_at', vendorProfileId, since12), 'saved'),
    soft(readTopPhotos(admin, vendorProfileId, pageKeys, nowMs), 'photos'),
    soft(fetchInquiryHeatmap(session, vendorProfileId, since12), 'whenask'),
    soft(fetchInquiryMissed(session, vendorProfileId, since30), 'missed30'),
    soft(fetchInquiryMissed(session, vendorProfileId, since12), 'missed12'),
    soft(readOwed(session, nowMs), 'owed'),
    soft(fetchLeadTime(session, vendorProfileId, since12), 'lead'),
    soft(readEventKinds(session, vendorProfileId), 'types'),
    soft(fetchReviewMonthly(session, vendorProfileId, 12), 'revmonth'),
    soft(readSubStars(session, vendorProfileId), 'substars'),
    soft(fetchReviewCoverage(session, vendorProfileId), 'replied'),
  ]);
  const series = (xs: string[] | null, w: GrowthWindow): WindowSeries | null => (xs === null ? null : windowSeries(xs, nowMs, w));
  const pick = (w: GrowthWindow): StoreGraphs => ({
    followers: series(follows, w),
    saved: series(saves, w),
    photos: photos ? photos[w] : null,
    whenask: heat,
    missed: w === '30' ? missed30 : missed12,
    value: null,
    owed,
    lead,
    types,
    revmonth: revmonth ? revmonth.map((m) => ({ key: m.month, label: m.label, count: m.count })) : null,
    substars,
    replied: coverage ? { replied: coverage.repliedCount, total: coverage.totalReviews } : null,
  });
  return { '30': pick('30'), '12': pick('12') };
}
