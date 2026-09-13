import type { SupabaseClient } from '@supabase/supabase-js';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * ITEM 7c — the reads behind the linked-celebrations planning surface.
 *
 * 7a (20271189765490) made the link, 7b (20271191258098) made one guest one
 * person across it, and both were schema with no screen. This module is the
 * first code that ever reads either table.
 *
 * ─── ⚠ THE SPAN IS DERIVED HERE AND STORED NOWHERE ────────────────────────
 * 7a's comment block forbids a `year`/`season`/`starts_on`/`ends_on` column in
 * advance: "a stored span goes stale the first time a date moves." So
 * `clusterSpan()` below computes it from the rows on every read. It is cheap,
 * it is always right, and it must not be "optimised" into a column.
 *
 * ─── ⚠ AN EMPTY LIST AND A REFUSED READ ARE NOT THE SAME THING ────────────
 * Every fetcher here returns `{ …, measured: boolean }`, matching
 * fetchGuestsByEventMeasured in lib/guests.ts. `measured: false` means WE DO
 * NOT KNOW, never "zero" — the defect this repo has already paid for is a page
 * that tells a couple with 180 guests that their wedding is empty, in bytes
 * identical to a genuinely new event. A caller that renders `measured: false`
 * as a cheerful "nothing here yet" has reintroduced it.
 */

export type ClusterSummary = {
  event_cluster_id: string;
  public_id: string;
  display_name: string;
  created_at: string;
};

/** One celebration on a cluster's timeline. Mirrors public.cluster_timeline(). */
export type ClusterTimelineRow = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
  event_end_date: string | null;
  event_date_precision: string;
  is_anchor: boolean;
  range_start: string | null;
  range_end: string | null;
  /**
   * 🛑 A SORT KEY, NEVER A LABEL. It is the midpoint of the range the row's
   * precision claims, so rendering it to a human invents a July date the host
   * never chose. Use `timelineDateLabel()` for anything a person reads.
   */
  sort_key: string | null;
};

export type MeasuredClusters = { rows: ClusterSummary[]; measured: boolean };
export type MeasuredTimeline = { rows: ClusterTimelineRow[]; measured: boolean };
export type MeasuredLinkable = { rows: LinkableCelebration[]; measured: boolean };

/** A celebration of yours that is not yet in any cluster. */
export type LinkableCelebration = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  event_date_precision: string;
};

/* ── reads ───────────────────────────────────────────────────────────────── */

/** The clusters this person owns. RLS already scopes it; the filter is belt-and-braces. */
export async function fetchMyClusters(
  supabase: SupabaseClient,
  userId: string,
): Promise<MeasuredClusters> {
  const { data, error } = await supabase
    .from('event_clusters')
    .select('event_cluster_id, public_id, display_name, created_at')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    logQueryError('fetchMyClusters', error, { user_id: userId }, 'graceful_degrade');
    return { rows: [], measured: false };
  }
  return { rows: (data ?? []) as ClusterSummary[], measured: true };
}

export async function fetchCluster(
  supabase: SupabaseClient,
  clusterId: string,
): Promise<ClusterSummary | null> {
  const { data, error } = await supabase
    .from('event_clusters')
    .select('event_cluster_id, public_id, display_name, created_at')
    .eq('event_cluster_id', clusterId)
    .maybeSingle();

  if (error) {
    logQueryError('fetchCluster', error, { cluster_id: clusterId }, 'graceful_degrade');
    return null;
  }
  return (data as ClusterSummary | null) ?? null;
}

/**
 * The timeline itself. The ordering (and the precision-aware range) is the
 * database function's job, not this module's — see the migration's header for
 * why "Sometime in 2027" must not sort as if it were New Year's Day.
 */
export async function fetchClusterTimeline(
  supabase: SupabaseClient,
  clusterId: string,
): Promise<MeasuredTimeline> {
  const { data, error } = await supabase.rpc('cluster_timeline', {
    p_event_cluster_id: clusterId,
  });

  if (error) {
    logQueryError('fetchClusterTimeline', error, { cluster_id: clusterId }, 'graceful_degrade');
    return { rows: [], measured: false };
  }
  return { rows: (data ?? []) as ClusterTimelineRow[], measured: true };
}

/**
 * Celebrations this person could still link: ones where they are a COUPLE
 * member and which are not already in a cluster.
 *
 * 🔒 The second half is not a nicety — `event_cluster_members` carries
 * `UNIQUE (event_id)` (7a: at most one cluster per celebration), so offering an
 * already-linked celebration would offer a button that can only fail.
 */
export async function fetchLinkableCelebrations(
  supabase: SupabaseClient,
  userId: string,
): Promise<MeasuredLinkable> {
  const { data: memberships, error: memberErr } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  if (memberErr) {
    logQueryError('fetchLinkableCelebrations.members', memberErr, { user_id: userId }, 'graceful_degrade');
    return { rows: [], measured: false };
  }

  const myEventIds = (memberships ?? []).map((m) => (m as { event_id: string }).event_id);
  if (myEventIds.length === 0) return { rows: [], measured: true };

  const { data: taken, error: takenErr } = await supabase
    .from('event_cluster_members')
    .select('event_id')
    .in('event_id', myEventIds);

  if (takenErr) {
    logQueryError('fetchLinkableCelebrations.taken', takenErr, { user_id: userId }, 'graceful_degrade');
    return { rows: [], measured: false };
  }

  const takenIds = new Set((taken ?? []).map((t) => (t as { event_id: string }).event_id));
  const free = myEventIds.filter((id) => !takenIds.has(id));
  if (free.length === 0) return { rows: [], measured: true };

  const { data: events, error: eventErr } = await supabase
    .from('events')
    .select('event_id, display_name, event_date, event_date_precision')
    .in('event_id', free)
    .eq('archived', false)
    .order('display_name', { ascending: true });

  if (eventErr) {
    logQueryError('fetchLinkableCelebrations.events', eventErr, { user_id: userId }, 'graceful_degrade');
    return { rows: [], measured: false };
  }
  return { rows: (events ?? []) as LinkableCelebration[], measured: true };
}

/* ── labels ──────────────────────────────────────────────────────────────── */

const PRECISIONS = new Set<EventDatePrecision>(['year', 'month', 'day']);

/**
 * The human label for one row's date — "Sometime in 2027" / "August 2027" /
 * "Friday, August 15, 2027".
 *
 * 🔑 REUSES formatEventDateWithPrecision() rather than reimplementing it. That
 * function already knows to parse the ISO parts by hand so a DATE column does
 * not drift a day across timezones, and a second copy of that reasoning would
 * drift from the original the first time either was touched.
 *
 * An unrecognised precision renders the "to be confirmed" copy rather than
 * guessing, for the reason lib/join-door-meta.ts records: event_date holds a
 * placeholder day whenever precision is not 'day', so a wrong precision means
 * a confidently wrong date.
 */
export function timelineDateLabel(row: {
  event_date: string | null;
  event_date_precision: string;
  event_end_date?: string | null;
}): string {
  if (!row.event_date) return 'Date to be confirmed';
  const precision = row.event_date_precision as EventDatePrecision;
  if (!PRECISIONS.has(precision)) return 'Date to be confirmed';

  const start = formatEventDateWithPrecision(row.event_date, precision);
  if (!start) return 'Date to be confirmed';

  // A multi-day celebration says so, but only at day precision — a range on a
  // "Sometime in 2027" would be two placeholders pretending to be a plan.
  if (precision === 'day' && row.event_end_date && row.event_end_date !== row.event_date) {
    const end = formatEventDateWithPrecision(row.event_end_date, 'day');
    return `${start} – ${end}`;
  }
  return start;
}

/** True when the row's date is a window the host chose, not a day they picked. */
export function isApproximate(row: { event_date: string | null; event_date_precision: string }): boolean {
  return !!row.event_date && row.event_date_precision !== 'day';
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return iso;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * THE DERIVED SPAN — min(range_start) … max(range_end) across the members,
 * computed on every read and stored nowhere (see this file's header and 7a).
 *
 * Rendered at MONTH granularity on purpose. The endpoints come from rows of
 * MIXED precision, so a day-level span ("January 1 – December 31, 2027") would
 * state a precision the underlying data does not have.
 *
 * Returns null when no member has a date at all — the caller says "no dates
 * yet" in its own words rather than this function inventing copy.
 */
export function clusterSpan(rows: ClusterTimelineRow[]): string | null {
  const starts = rows.map((r) => r.range_start).filter((d): d is string => !!d);
  const ends = rows.map((r) => r.range_end).filter((d): d is string => !!d);
  if (starts.length === 0 || ends.length === 0) return null;

  const min = starts.reduce((a, b) => (a < b ? a : b));
  const max = ends.reduce((a, b) => (a > b ? a : b));

  const from = monthYear(min);
  const to = monthYear(max);
  return from === to ? from : `${from} – ${to}`;
}
