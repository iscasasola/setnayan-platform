import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Growth + population statistics for the admin Growth surface (/admin/growth).
 *
 * WHY: owner directive 2026-06-04 — surface platform progress as both
 * "actual population" (current totals) AND "growth" (cumulative curve over a
 * selectable window) for the five core entities (customers · vendors ·
 * services · events · guests), plus the guest → account-holder conversion.
 *
 * APPROACH (no migration): every metric is computed from the `created_at`
 * timestamp already present on each entity table, bucketed in JS. Each bucket
 * boundary is a single `count: 'exact', head: true` query — exact (no row
 * pulling, so no silent truncation at the PostgREST 1000-row ceiling) and
 * cheap (indexed-only). A fixed GROWTH_BUCKETS count keeps the sparkline shape
 * stable and bounds the query fan-out regardless of the selected range.
 *
 * SCALE NOTE: this fans out to ~80 head-counts per page load. Fine for an
 * admin-only, non-hot surface at pilot scale. If the platform grows large
 * enough that this matters, fold the per-bucket counts into one Postgres RPC
 * (date_trunc + GROUP BY) — the shapes returned here are RPC-ready.
 *
 * CONVERSION (owner-locked definition 2026-06-04 · "any linked account"): a
 * guest converts when their guest-list row becomes tied to a real account via
 * `event_members.guest_id` with `member_type = 'guest'` (joined by QR scan OR
 * invite link). Conversion time is `event_members.joined_at`.
 */

export type GrowthRangeKey = '3m' | '6m' | '12m';

export const GROWTH_RANGE_OPTIONS: {
  value: GrowthRangeKey;
  label: string;
  days: number;
}[] = [
  { value: '3m', label: 'Past 3 months', days: 90 },
  { value: '6m', label: 'Past 6 months', days: 180 },
  { value: '12m', label: 'Past 12 months', days: 365 },
];

/** Fixed bucket count — stable sparkline + bounded query fan-out. */
export const GROWTH_BUCKETS = 12;

export type EntityKey = 'customers' | 'vendors' | 'services' | 'events' | 'guests';

const ENTITY_KEYS: EntityKey[] = [
  'customers',
  'vendors',
  'services',
  'events',
  'guests',
];

const ENTITY_LABELS: Record<EntityKey, string> = {
  customers: 'Customers',
  vendors: 'Vendors',
  services: 'Services',
  events: 'Events',
  guests: 'Guests',
};

/** One sampled point on a cumulative curve. `at` = the bucket's end boundary. */
export type SeriesPoint = { at: string; cumulative: number; added: number };

export type GrowthSeries = {
  key: EntityKey;
  label: string;
  /** Current total = cumulative value at the final boundary (now). */
  total: number;
  /** Total that existed before the window opened. */
  baseline: number;
  /** Net new within the window (total − baseline). */
  newInRange: number;
  points: SeriesPoint[];
};

export type Population = {
  accountHolders: number;
  customers: number;
  vendors: number;
  vendorsPublished: number;
  services: number;
  servicesActive: number;
  events: number;
  guests: number;
};

export type ConversionStats = {
  totalGuests: number;
  converted: number;
  /** converted ÷ totalGuests, 0..1. 0 when there are no guests. */
  rate: number;
  baseline: number;
  newInRange: number;
  points: SeriesPoint[];
  /** Median days from guest-add to account creation, over conversions in the window. */
  medianDaysToConvert: number | null;
  sampleSize: number;
};

export type GrowthStats = {
  range: GrowthRangeKey;
  rangeDays: number;
  sinceIso: string;
  generatedAtIso: string;
  population: Population;
  series: GrowthSeries[];
  conversion: ConversionStats;
  errors: string[];
};

type Admin = ReturnType<typeof createAdminClient>;

const HEAD = { count: 'exact' as const, head: true };

const DAY_MS = 86_400_000;

/**
 * Base count query per entity. Each entity's filter is applied to EVERY
 * boundary count so the curve's final point equals the live population tile
 * (e.g. guests excludes soft-deleted rows everywhere, not just at the end).
 */
function entityBase(admin: Admin, key: EntityKey) {
  switch (key) {
    case 'customers':
      return admin.from('users').select('*', HEAD).eq('account_type', 'customer');
    case 'vendors':
      return admin.from('vendor_profiles').select('*', HEAD);
    case 'services':
      return admin.from('vendor_services').select('*', HEAD);
    case 'events':
      return admin.from('events').select('*', HEAD);
    case 'guests':
      return admin.from('guests').select('*', HEAD).is('deleted_at', null);
  }
}

async function entityCountBefore(
  admin: Admin,
  key: EntityKey,
  beforeIso: string,
): Promise<number> {
  const { count, error } = await entityBase(admin, key).lt('created_at', beforeIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Converted-guest base query — a guest-list row linked to a real account. */
function conversionBase(admin: Admin) {
  return admin
    .from('event_members')
    .select('*', HEAD)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null);
}

async function conversionCountBefore(admin: Admin, beforeIso: string): Promise<number> {
  const { count, error } = await conversionBase(admin).lt('joined_at', beforeIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function headCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) throw new Error(String((error as { message?: string })?.message ?? error));
  return count ?? 0;
}

/** start = window open; ends = the GROWTH_BUCKETS end boundaries (last = now). */
function bucketBoundaries(now: Date, days: number): { start: Date; ends: Date[] } {
  const rangeMs = days * DAY_MS;
  const start = new Date(now.getTime() - rangeMs);
  const ends: Date[] = [];
  for (let i = 1; i <= GROWTH_BUCKETS; i++) {
    ends.push(new Date(start.getTime() + (rangeMs * i) / GROWTH_BUCKETS));
  }
  return { start, ends };
}

/** Turn a baseline + 12 cumulative boundary counts into curve points. */
function toPoints(baseline: number, cumulative: number[], ends: Date[]): SeriesPoint[] {
  // Iterate `ends` (each a Date) so the boundary is never undefined; index
  // into cumulative with a baseline fallback to satisfy noUncheckedIndexedAccess.
  return ends.map((end, i) => {
    const c = cumulative[i] ?? baseline;
    const prev = i === 0 ? baseline : (cumulative[i - 1] ?? baseline);
    return { at: end.toISOString(), cumulative: c, added: c - prev };
  });
}

async function buildSeries(
  admin: Admin,
  key: EntityKey,
  start: Date,
  ends: Date[],
): Promise<GrowthSeries> {
  const boundaries = [start, ...ends]; // index 0 = baseline boundary
  const counts = await Promise.all(
    boundaries.map((b) => entityCountBefore(admin, key, b.toISOString())),
  );
  const baseline = counts[0] ?? 0;
  const cumulative = counts.slice(1);
  const total = cumulative[cumulative.length - 1] ?? baseline;
  return {
    key,
    label: ENTITY_LABELS[key],
    total,
    baseline,
    newInRange: total - baseline,
    points: toPoints(baseline, cumulative, ends),
  };
}

function emptySeries(key: EntityKey, ends: Date[]): GrowthSeries {
  return {
    key,
    label: ENTITY_LABELS[key],
    total: 0,
    baseline: 0,
    newInRange: 0,
    points: ends.map((e) => ({ at: e.toISOString(), cumulative: 0, added: 0 })),
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

/**
 * Median days from guest-add (guests.created_at) to account creation
 * (event_members.joined_at), sampled over conversions inside the window via a
 * bounded embedded read. Defensive — any failure degrades to null rather than
 * breaking the page.
 */
async function medianDaysToConvert(
  admin: Admin,
  sinceIso: string,
): Promise<{ median: number | null; sampleSize: number }> {
  try {
    const { data, error } = await admin
      .from('event_members')
      .select('joined_at, guests(created_at)')
      .eq('member_type', 'guest')
      .not('guest_id', 'is', null)
      .gte('joined_at', sinceIso)
      .limit(2000);
    if (error) throw new Error(error.message);
    const diffs = (data ?? [])
      .map((row) => {
        const g = Array.isArray(row.guests) ? row.guests[0] : row.guests;
        if (!g?.created_at || !row.joined_at) return null;
        return (
          (new Date(row.joined_at).getTime() - new Date(g.created_at).getTime()) /
          DAY_MS
        );
      })
      .filter((d): d is number => d !== null && d >= 0);
    return {
      median: diffs.length ? median(diffs) : null,
      sampleSize: diffs.length,
    };
  } catch {
    return { median: null, sampleSize: 0 };
  }
}

/**
 * The one entry point the /admin/growth page calls. Computes population,
 * per-entity growth series, and guest→account conversion for the given range.
 * Errors are collected per-section so a single failing query degrades that
 * card rather than the whole surface.
 */
export async function fetchGrowthStats(range: GrowthRangeKey): Promise<GrowthStats> {
  const admin = createAdminClient();
  const opt = GROWTH_RANGE_OPTIONS.find((o) => o.value === range) ?? {
    value: '6m' as GrowthRangeKey,
    label: 'Past 6 months',
    days: 180,
  };
  const now = new Date();
  const { start, ends } = bucketBoundaries(now, opt.days);
  const sinceIso = start.toISOString();
  const errors: string[] = [];

  // Per-entity growth series (each self-contained so one failure is isolated).
  const series = await Promise.all(
    ENTITY_KEYS.map(async (key) => {
      try {
        return await buildSeries(admin, key, start, ends);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
        return emptySeries(key, ends);
      }
    }),
  );
  const totalByKey = Object.fromEntries(series.map((s) => [s.key, s.total])) as Record<
    EntityKey,
    number
  >;

  // Population extras not covered by a series total.
  let accountHolders = 0;
  let vendorsPublished = 0;
  let servicesActive = 0;
  try {
    [accountHolders, vendorsPublished, servicesActive] = await Promise.all([
      headCount(admin.from('users').select('*', HEAD)),
      headCount(admin.from('vendor_profiles').select('*', HEAD).eq('is_published', true)),
      headCount(admin.from('vendor_services').select('*', HEAD).eq('is_active', true)),
    ]);
  } catch (e) {
    errors.push(`population: ${e instanceof Error ? e.message : String(e)}`);
  }

  const population: Population = {
    accountHolders,
    customers: totalByKey.customers ?? 0,
    vendors: totalByKey.vendors ?? 0,
    vendorsPublished,
    services: totalByKey.services ?? 0,
    servicesActive,
    events: totalByKey.events ?? 0,
    guests: totalByKey.guests ?? 0,
  };

  // Guest → account conversion.
  let conversion: ConversionStats;
  try {
    const boundaries = [start, ...ends];
    const counts = await Promise.all(
      boundaries.map((b) => conversionCountBefore(admin, b.toISOString())),
    );
    const baseline = counts[0] ?? 0;
    const cumulative = counts.slice(1);
    const converted = cumulative[cumulative.length - 1] ?? baseline;
    const totalGuests = population.guests;
    const { median: medianDays, sampleSize } = await medianDaysToConvert(admin, sinceIso);
    conversion = {
      totalGuests,
      converted,
      rate: totalGuests > 0 ? converted / totalGuests : 0,
      baseline,
      newInRange: converted - baseline,
      points: toPoints(baseline, cumulative, ends),
      medianDaysToConvert: medianDays,
      sampleSize,
    };
  } catch (e) {
    errors.push(`conversion: ${e instanceof Error ? e.message : String(e)}`);
    conversion = {
      totalGuests: population.guests,
      converted: 0,
      rate: 0,
      baseline: 0,
      newInRange: 0,
      points: ends.map((en) => ({ at: en.toISOString(), cumulative: 0, added: 0 })),
      medianDaysToConvert: null,
      sampleSize: 0,
    };
  }

  return {
    range: opt.value,
    rangeDays: opt.days,
    sinceIso,
    generatedAtIso: now.toISOString(),
    population,
    series,
    conversion,
    errors,
  };
}
