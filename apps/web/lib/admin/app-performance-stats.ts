import { createAdminClient } from '@/lib/supabase/admin';
import {
  GROWTH_BUCKETS,
  GROWTH_RANGE_OPTIONS,
  bucketBoundaries,
  type GrowthRangeKey,
} from '@/lib/admin/growth-stats';

/**
 * App Performance cockpit — sibling fetchers to growth-stats.ts
 * (/admin/app-performance · plan: spec corpus
 * 0023_admin_console/App_Performance_Plan_2026-07-03.md · decision log
 * 2026-07-03 "1 of the 6 admin menus").
 *
 * WHY: the cockpit's Growth zone needs metrics /admin/growth doesn't compute —
 * monetization (3-table union), completed-service lifecycle, content & trust
 * counts, and first-pick rate. Per the plan these EXTEND the growth-stats
 * layer (same GROWTH_BUCKETS boundaries, same degrade-per-section error
 * shape) rather than forking a parallel stats stack.
 *
 * APPROACH: unlike growth-stats' head-count fan-out, most metrics here need
 * SUMs (peso revenue) or GROUP BYs (report status), so each metric is ONE
 * bounded read (≤ ROW_CAP rows) bucketed/summed in JS — the same pattern as
 * growth-stats' fetchBreakdowns. Every read spans 2× the selected range so
 * "vs previous period" deltas are real previous-window numbers, not
 * half-window approximations. `sampled` flags any read that hit its cap
 * (counts are then a floor, not exact — the UI must say so).
 *
 * MONEY IS PESOS: orders.confirmed_total_php / requested_total_php and the
 * vendor tables' amount_php are NUMERIC pesos, NOT centavos (verified vs
 * migrations 20260513150000 / 20261010000000 / 20260916000000). No ÷100.
 *
 * COMPLETION: the real completed-service signal is
 * event_vendors.completion_status IN ('confirmed','auto_confirmed')
 * (migration 20270101000000 handshake). There is NO completed-event state on
 * events — the cockpit deliberately charts completed SERVICES.
 *
 * FIRST PICK: event_vendors.selection_match_rank = 1 (the booked vendor was
 * the recommendation engine's #1 match). NULL = manual/off-platform booking,
 * so the rate's denominator is recommendation-flow bookings only.
 */

/** Bounded-read row cap per metric query (soft-launch scale; sampled-flagged). */
const ROW_CAP = 5000;

/** Min denominator before a rate/%-delta is shown (honest-empty rule). */
export const MIN_N = 8;

/** Realized-order statuses — money actually received. */
const REALIZED_ORDER_STATUSES = ['paid', 'fulfilled'] as const;

/** The Setnayan AI SKU family (service_key values on orders). */
const AI_SERVICE_KEYS = new Set([
  'SETNAYAN_AI_SUB',
  'SETNAYAN_AI',
  'SETNAYAN_AI_RENEW',
  'TODAYS_FOCUS', // retired ₱1,499 SKU — kept for historical totals
]);

export type StreamKey = 'ai' | 'vendor' | 'other';

export type MoneyStream = {
  key: StreamKey;
  label: string;
  /** Peso revenue per current-window bucket (length GROWTH_BUCKETS). */
  php: number[];
  /** Realized purchase count per current-window bucket. */
  count: number[];
  totalPhp: number;
  totalCount: number;
  prevTotalPhp: number;
  prevTotalCount: number;
};

export type Monetization = {
  streams: MoneyStream[];
  totalPhp: number;
  totalCount: number;
  prevTotalPhp: number;
  prevTotalCount: number;
  sampled: boolean;
};

export type CompletedServices = {
  /** Completions per current-window bucket (confirmed + auto_confirmed). */
  count: number[];
  total: number;
  prevTotal: number;
  /** All-time completed handshakes (window-independent). */
  allTime: number;
  /** Currently disputed rows — NOT completed; surfaced beside the chart. */
  disputed: number;
  sampled: boolean;
};

export type FirstPick = {
  /** Ranked bookings (selection_match_rank NOT NULL) in the current window. */
  den: number;
  /** …of which the engine's #1 match was booked. */
  picks: number;
  /** picks ÷ den, or null below the MIN_N floor. */
  rate: number | null;
  prevRate: number | null;
  allTimePicks: number;
  sampled: boolean;
};

export type ReviewsStats = {
  count: number[];
  total: number;
  prevTotal: number;
  /** Average rating over current-window reviews, or null when none. */
  avgRating: number | null;
  allTime: number;
  sampled: boolean;
};

export type ReportsStats = {
  /** Per-bucket stacked series by status (current window). */
  open: number[];
  actioned: number[];
  dismissed: number[];
  total: number;
  prevTotal: number;
  /** Open queue right now (all-time, not window-scoped) — an act-now number. */
  openNow: number;
  sampled: boolean;
};

export type EditorialStats = {
  total: number;
  published: number;
  newInRange: number;
};

export type AppPerfStats = {
  range: GrowthRangeKey;
  rangeDays: number;
  sinceIso: string;
  generatedAtIso: string;
  /** Current-window bucket end boundaries (ISO), length GROWTH_BUCKETS. */
  bucketEndsIso: string[];
  monetization: Monetization;
  completedServices: CompletedServices;
  firstPick: FirstPick;
  reviews: ReviewsStats;
  reports: ReportsStats;
  editorials: EditorialStats;
  errors: string[];
};

type Admin = ReturnType<typeof createAdminClient>;

const HEAD = { count: 'exact' as const, head: true };

async function headCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) throw new Error(String((error as { message?: string })?.message ?? error));
  return count ?? 0;
}

/**
 * Two adjacent equal-length windows sharing the growth-stats boundary math:
 * previous (prevStart → start) + current (start → now), each GROWTH_BUCKETS
 * buckets wide. All bounded reads fetch since prevStart and split in JS.
 */
type Windows = {
  prevStart: Date;
  start: Date;
  now: Date;
  /** Current-window bucket end boundaries. */
  ends: Date[];
  bucketMs: number;
};

function windows(now: Date, days: number): Windows {
  const { start, ends } = bucketBoundaries(now, days);
  const rangeMs = days * 86_400_000;
  return {
    prevStart: new Date(start.getTime() - rangeMs),
    start,
    now,
    ends,
    bucketMs: rangeMs / GROWTH_BUCKETS,
  };
}

/** Which current-window bucket a timestamp falls in; -1 = previous window; -2 = outside both. */
function bucketIndex(iso: string | null, w: Windows): number {
  if (!iso) return -2;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return -2;
  if (t < w.prevStart.getTime()) return -2;
  if (t < w.start.getTime()) return -1;
  const i = Math.floor((t - w.start.getTime()) / w.bucketMs);
  // clamp the exact-now edge into the final bucket
  return Math.min(i, GROWTH_BUCKETS - 1);
}

function zeros(): number[] {
  return Array.from({ length: GROWTH_BUCKETS }, () => 0);
}

function emptyStream(key: StreamKey, label: string): MoneyStream {
  return {
    key,
    label,
    php: zeros(),
    count: zeros(),
    totalPhp: 0,
    totalCount: 0,
    prevTotalPhp: 0,
    prevTotalCount: 0,
  };
}

/**
 * Monetization — the 3-table union (plan § 3 Growth · G4):
 *   orders (couple/app SKUs · AI split by service_key)
 *   + vendor_subscriptions (tier subs) + vendor_token_purchases (packs),
 * both vendor tables folded into ONE 'vendor' stream. Realized only
 * (orders paid/fulfilled · vendor rows paid). Comp entitlements never create
 * paid orders, so no comp exclusion is needed on the realized set.
 */
async function fetchMonetization(admin: Admin, w: Windows): Promise<Monetization> {
  const streams: Record<StreamKey, MoneyStream> = {
    ai: emptyStream('ai', 'Setnayan AI'),
    vendor: emptyStream('vendor', 'Vendor subs & tokens'),
    other: emptyStream('other', 'All other purchases'),
  };
  let sampled = false;

  const add = (stream: MoneyStream, iso: string | null, php: number) => {
    const i = bucketIndex(iso, w);
    if (i === -2) return;
    if (i === -1) {
      stream.prevTotalPhp += php;
      stream.prevTotalCount += 1;
      return;
    }
    stream.php[i] = (stream.php[i] ?? 0) + php;
    stream.count[i] = (stream.count[i] ?? 0) + 1;
    stream.totalPhp += php;
    stream.totalCount += 1;
  };

  // Couple/app orders — bucket on created_at (orders carry no paid_at; at
  // 24-hr reconciliation SLA the drift is ≤ 1 bucket at every range).
  const { data: orders, error: ordersErr } = await admin
    .from('orders')
    .select('created_at, service_key, status, confirmed_total_php, requested_total_php')
    .in('status', [...REALIZED_ORDER_STATUSES])
    .gte('created_at', w.prevStart.toISOString())
    .limit(ROW_CAP);
  if (ordersErr) throw new Error(ordersErr.message);
  sampled = sampled || (orders ?? []).length >= ROW_CAP;
  for (const row of orders ?? []) {
    const php = Number(row.confirmed_total_php ?? row.requested_total_php ?? 0);
    if (!Number.isFinite(php)) continue;
    const key = row.service_key ?? '';
    add(AI_SERVICE_KEYS.has(key) ? streams.ai : streams.other, row.created_at, php);
  }

  // Vendor-side streams — bucket on paid_at (falls back to created_at for
  // legacy rows that predate the paid_at stamp).
  for (const table of ['vendor_subscriptions', 'vendor_token_purchases'] as const) {
    const { data, error } = await admin
      .from(table)
      .select('created_at, paid_at, amount_php, status')
      .eq('status', 'paid')
      .gte('created_at', w.prevStart.toISOString())
      .limit(ROW_CAP);
    if (error) throw new Error(error.message);
    sampled = sampled || (data ?? []).length >= ROW_CAP;
    for (const row of data ?? []) {
      const php = Number(row.amount_php ?? 0);
      if (!Number.isFinite(php)) continue;
      add(streams.vendor, row.paid_at ?? row.created_at, php);
    }
  }

  const all = [streams.ai, streams.vendor, streams.other];
  return {
    streams: all,
    totalPhp: all.reduce((s, x) => s + x.totalPhp, 0),
    totalCount: all.reduce((s, x) => s + x.totalCount, 0),
    prevTotalPhp: all.reduce((s, x) => s + x.prevTotalPhp, 0),
    prevTotalCount: all.reduce((s, x) => s + x.prevTotalCount, 0),
    sampled,
  };
}

/**
 * ONE bounded event_vendors read serves BOTH completed-services and
 * first-pick (same table). Completion trend buckets on the completion
 * handshake timestamp (customer confirm → vendor mark → row created_at
 * fallback for backfilled legacy rows).
 */
async function fetchLifecycleAndFirstPick(
  admin: Admin,
  w: Windows,
): Promise<{ completed: CompletedServices; firstPick: FirstPick }> {
  const [allTimeCompleted, disputed, allTimePicks] = await Promise.all([
    headCount(
      admin
        .from('event_vendors')
        .select('*', HEAD)
        .in('completion_status', ['confirmed', 'auto_confirmed']),
    ),
    headCount(
      admin.from('event_vendors').select('*', HEAD).eq('completion_status', 'disputed'),
    ),
    headCount(admin.from('event_vendors').select('*', HEAD).eq('selection_match_rank', 1)),
  ]);

  const { data, error } = await admin
    .from('event_vendors')
    .select(
      'created_at, completion_status, customer_confirmed_received_at, service_marked_complete_at, selection_match_rank',
    )
    .gte('created_at', w.prevStart.toISOString())
    .limit(ROW_CAP);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const sampled = rows.length >= ROW_CAP;

  const count = zeros();
  let total = 0;
  let prevTotal = 0;
  let den = 0;
  let picks = 0;
  let prevDen = 0;
  let prevPicks = 0;

  for (const row of rows) {
    if (
      row.completion_status === 'confirmed' ||
      row.completion_status === 'auto_confirmed'
    ) {
      const at =
        row.customer_confirmed_received_at ??
        row.service_marked_complete_at ??
        row.created_at;
      const i = bucketIndex(at, w);
      if (i >= 0) {
        count[i] = (count[i] ?? 0) + 1;
        total += 1;
      } else if (i === -1) {
        prevTotal += 1;
      }
    }
    if (row.selection_match_rank !== null && row.selection_match_rank !== undefined) {
      const i = bucketIndex(row.created_at, w);
      if (i >= 0) {
        den += 1;
        if (row.selection_match_rank === 1) picks += 1;
      } else if (i === -1) {
        prevDen += 1;
        if (row.selection_match_rank === 1) prevPicks += 1;
      }
    }
  }

  return {
    completed: { count, total, prevTotal, allTime: allTimeCompleted, disputed, sampled },
    firstPick: {
      den,
      picks,
      rate: den >= MIN_N ? picks / den : null,
      prevRate: prevDen >= MIN_N ? prevPicks / prevDen : null,
      allTimePicks,
      sampled,
    },
  };
}

/** Reviews — volume per bucket + average rating (vendor_reviews has no status column; every row is live). */
async function fetchReviews(admin: Admin, w: Windows): Promise<ReviewsStats> {
  const allTime = await headCount(admin.from('vendor_reviews').select('*', HEAD));
  const { data, error } = await admin
    .from('vendor_reviews')
    .select('created_at, rating_overall')
    .gte('created_at', w.prevStart.toISOString())
    .limit(ROW_CAP);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const count = zeros();
  let total = 0;
  let prevTotal = 0;
  let ratingSum = 0;
  for (const row of rows) {
    const i = bucketIndex(row.created_at, w);
    if (i >= 0) {
      count[i] = (count[i] ?? 0) + 1;
      total += 1;
      ratingSum += Number(row.rating_overall ?? 0);
    } else if (i === -1) {
      prevTotal += 1;
    }
  }
  return {
    count,
    total,
    prevTotal,
    avgRating: total > 0 ? ratingSum / total : null,
    allTime,
    sampled: rows.length >= ROW_CAP,
  };
}

/** Reports — stacked by status per bucket; a RISING line is a health warning (inverse-good). */
async function fetchReports(admin: Admin, w: Windows): Promise<ReportsStats> {
  const openNow = await headCount(
    admin.from('user_reports').select('*', HEAD).eq('status', 'open'),
  );
  const { data, error } = await admin
    .from('user_reports')
    .select('created_at, status')
    .gte('created_at', w.prevStart.toISOString())
    .limit(ROW_CAP);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const open = zeros();
  const actioned = zeros();
  const dismissed = zeros();
  let total = 0;
  let prevTotal = 0;
  for (const row of rows) {
    const i = bucketIndex(row.created_at, w);
    if (i === -1) {
      prevTotal += 1;
      continue;
    }
    if (i < 0) continue;
    total += 1;
    if (row.status === 'actioned') actioned[i] = (actioned[i] ?? 0) + 1;
    else if (row.status === 'dismissed') dismissed[i] = (dismissed[i] ?? 0) + 1;
    else open[i] = (open[i] ?? 0) + 1;
  }
  return {
    open,
    actioned,
    dismissed,
    total,
    prevTotal,
    openNow,
    sampled: rows.length >= ROW_CAP,
  };
}

/** Editorials — event_editorial is UNIQUE(event_id): one recap per event. Headline = published. */
async function fetchEditorials(admin: Admin, w: Windows): Promise<EditorialStats> {
  const [total, published, newInRange] = await Promise.all([
    headCount(admin.from('event_editorial').select('*', HEAD)),
    headCount(admin.from('event_editorial').select('*', HEAD).eq('status', 'published')),
    headCount(
      admin
        .from('event_editorial')
        .select('*', HEAD)
        .gte('created_at', w.start.toISOString()),
    ),
  ]);
  return { total, published, newInRange };
}

/**
 * The one entry point the /admin/app-performance page calls (alongside
 * fetchGrowthStats). Same degrade-per-section contract: a failing metric
 * lands in `errors` and its card renders the honest empty state — one bad
 * table never blanks the cockpit.
 */
export async function fetchAppPerformanceStats(
  range: GrowthRangeKey,
): Promise<AppPerfStats> {
  const admin = createAdminClient();
  const opt = GROWTH_RANGE_OPTIONS.find((o) => o.value === range) ?? {
    value: '6m' as GrowthRangeKey,
    label: 'Past 6 months',
    days: 180,
  };
  const now = new Date();
  const w = windows(now, opt.days);
  const errors: string[] = [];

  const fallback = {
    monetization: {
      streams: [
        emptyStream('ai', 'Setnayan AI'),
        emptyStream('vendor', 'Vendor subs & tokens'),
        emptyStream('other', 'All other purchases'),
      ],
      totalPhp: 0,
      totalCount: 0,
      prevTotalPhp: 0,
      prevTotalCount: 0,
      sampled: false,
    } satisfies Monetization,
    completed: {
      count: zeros(),
      total: 0,
      prevTotal: 0,
      allTime: 0,
      disputed: 0,
      sampled: false,
    } satisfies CompletedServices,
    firstPick: {
      den: 0,
      picks: 0,
      rate: null,
      prevRate: null,
      allTimePicks: 0,
      sampled: false,
    } satisfies FirstPick,
    reviews: {
      count: zeros(),
      total: 0,
      prevTotal: 0,
      avgRating: null,
      allTime: 0,
      sampled: false,
    } satisfies ReviewsStats,
    reports: {
      open: zeros(),
      actioned: zeros(),
      dismissed: zeros(),
      total: 0,
      prevTotal: 0,
      openNow: 0,
      sampled: false,
    } satisfies ReportsStats,
    editorials: { total: 0, published: 0, newInRange: 0 } satisfies EditorialStats,
  };

  const [monetization, lifecycle, reviews, reports, editorials] = await Promise.all([
    fetchMonetization(admin, w).catch((e) => {
      errors.push(`monetization: ${e instanceof Error ? e.message : String(e)}`);
      return fallback.monetization;
    }),
    fetchLifecycleAndFirstPick(admin, w).catch((e) => {
      errors.push(`lifecycle: ${e instanceof Error ? e.message : String(e)}`);
      return { completed: fallback.completed, firstPick: fallback.firstPick };
    }),
    fetchReviews(admin, w).catch((e) => {
      errors.push(`reviews: ${e instanceof Error ? e.message : String(e)}`);
      return fallback.reviews;
    }),
    fetchReports(admin, w).catch((e) => {
      errors.push(`reports: ${e instanceof Error ? e.message : String(e)}`);
      return fallback.reports;
    }),
    fetchEditorials(admin, w).catch((e) => {
      errors.push(`editorials: ${e instanceof Error ? e.message : String(e)}`);
      return fallback.editorials;
    }),
  ]);

  return {
    range: opt.value,
    rangeDays: opt.days,
    sinceIso: w.start.toISOString(),
    generatedAtIso: now.toISOString(),
    bucketEndsIso: w.ends.map((e) => e.toISOString()),
    monetization,
    completedServices: lifecycle.completed,
    firstPick: lifecycle.firstPick,
    reviews,
    reports,
    editorials,
    errors,
  };
}
