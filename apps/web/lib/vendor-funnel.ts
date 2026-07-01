/**
 * Vendor Quote-to-Booking Funnel (Wave 6 "Soon" vendor benefit).
 *
 * Four stages — three already have data, VIEWS is the net-new one:
 *   VIEWS     → vendor_profile_views        (this PR's table)
 *   INQUIRIES → chat_threads                (one per couple→vendor inquiry)
 *   QUOTES    → vendor_proposals            (status sent/viewed/accepted)
 *   BOOKED    → event_vendors.status        (contracted+)
 *
 * This module owns the SHARED, surface-agnostic helpers used by both the
 * vendor-side funnel panel (/vendor-dashboard/funnel) and the admin per-vendor
 * drill-down (/admin/funnels). It does NOT render anything.
 *
 * Behavioral-data lock (project_setnayan_behavioral_data_edge):
 *   - The viewer is de-identified: hashViewer() returns sha256(salt || id);
 *     the raw user/session id is NEVER persisted.
 *   - Vendor-facing aggregates are minimum-N suppressed via minNOk(): a slice
 *     below the floor reads as null (suppressed) rather than a precise small
 *     count that could re-identify or mislead on a thin sample.
 */

import { createHash } from 'node:crypto';

/**
 * Booked statuses on event_vendors that count as the BOOKED funnel stage.
 * "Contracted+" — a real commercial commitment, not a shortlist/save. Mirrors
 * the set the vendor activity stats + booking surfaces treat as a finalized
 * booking. Kept here so both funnel surfaces agree on the definition.
 */
export const BOOKED_EVENT_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'paid',
  'delivered',
  'complete',
] as const;

/**
 * Proposal statuses that count as the QUOTES funnel stage — a quote that was
 * actually sent to the couple (not a draft).
 */
export const SENT_PROPOSAL_STATUSES = ['sent', 'viewed', 'accepted'] as const;

/**
 * Minimum-N suppression floor for vendor-facing funnel aggregates. A slice with
 * fewer than this many events is suppressed (shown as "—") so a thin segment
 * can't re-identify a viewer or read as a reliable trend. Vendors still see
 * their OWN totals; the floor only gates the sliced-by-source breakdown.
 */
export const FUNNEL_MIN_N = 5;

/**
 * De-identify a viewer. Returns sha256(salt || id) — a stable, non-reversible
 * hash so unique-viewer counts work without ever storing the raw user_id /
 * anon-session id. NEVER store or expose the input `id`.
 *
 * Salt resolves from VIEWER_HASH_SALT, falling back to SUPABASE_SERVICE_ROLE_KEY
 * (mirrors lib/guest-session.ts) — the hash is non-reversible either way; the
 * dedicated salt just decouples it from the service key for rotation.
 */
export function hashViewer(id: string): string {
  const salt =
    process.env.VIEWER_HASH_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHash('sha256').update(`${salt}:${id}`).digest('hex');
}

/**
 * Minimum-N gate — TS mirror of the shipped SQL public.min_n_ok(count, floor).
 * Returns true when `count` clears the floor (so the aggregate may be shown).
 */
export function minNOk(count: number | null | undefined, floor = FUNNEL_MIN_N): boolean {
  return (count ?? 0) >= Math.max(floor, 1);
}

/** One funnel stage — a labeled count. */
export type FunnelStep = {
  label: string;
  count: number;
};

/** A whole funnel — title + ordered stages. */
export type VendorFunnel = {
  key: string;
  title: string;
  blurb: string;
  steps: FunnelStep[];
};

/**
 * Aggregate the four funnel stages for ONE vendor within a time window. Reads
 * are head/count-only (cheap, indexed). Pass an admin-or-RLS-scoped client; the
 * caller is responsible for ensuring the client may read the vendor's rows
 * (vendor surface uses its own RLS-scoped session; admin uses the admin client).
 *
 * `sliceBySource` (default false) is intentionally NOT applied here — the
 * sliced breakdown is computed separately by the surfaces so each can apply its
 * own min-N suppression presentation. This returns the four whole-vendor totals.
 */
export async function fetchVendorFunnelTotals(
  // Loosely typed to accept either the RLS server client or the admin client —
  // both share the PostgREST query surface we use here.
  client: {
    from: (table: string) => {
      select: (
        cols: string,
        opts?: { count?: 'exact'; head?: boolean },
      ) => any;
    };
  },
  vendorProfileId: string,
  sinceIso: string,
): Promise<{ views: number; inquiries: number; quotes: number; booked: number }> {
  const [viewsRes, inquiriesRes, quotesRes, bookedRes] = await Promise.all([
    client
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .gte('viewed_at', sinceIso),
    client
      .from('chat_threads')
      .select('thread_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .gte('created_at', sinceIso),
    client
      .from('vendor_proposals')
      .select('proposal_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .in('status', SENT_PROPOSAL_STATUSES as unknown as string[])
      .gte('created_at', sinceIso),
    client
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
      .gte('created_at', sinceIso),
  ]);

  return {
    views: viewsRes.count ?? 0,
    inquiries: inquiriesRes.count ?? 0,
    quotes: quotesRes.count ?? 0,
    booked: bookedRes.count ?? 0,
  };
}

/** Build the canonical 4-step funnel from the raw totals. */
export function buildFunnelSteps(totals: {
  views: number;
  inquiries: number;
  quotes: number;
  booked: number;
}): FunnelStep[] {
  return [
    { label: 'Profile views', count: totals.views },
    { label: 'Inquiries', count: totals.inquiries },
    { label: 'Quotes sent', count: totals.quotes },
    { label: 'Booked', count: totals.booked },
  ];
}

// ---------------------------------------------------------------------------
// Time-window range keys + labels (shared by the standalone /funnel route and
// the vendor Overview's inline funnel section so both agree on the windows).
// ---------------------------------------------------------------------------

export type FunnelRangeKey = 'week' | 'month' | 'quarter';

export const FUNNEL_RANGE_OPTIONS: {
  value: FunnelRangeKey;
  label: string;
  days: number;
}[] = [
  { value: 'week', label: 'This week', days: 7 },
  { value: 'month', label: 'Past 4 weeks', days: 28 },
  { value: 'quarter', label: 'Past 12 weeks', days: 84 },
];

/** Coerce an arbitrary `?range` value to a valid key (default 'month'). */
export function coerceFunnelRange(raw: string | null | undefined): FunnelRangeKey {
  return raw === 'week' || raw === 'quarter' || raw === 'month' ? raw : 'month';
}

/** Friendly labels for the event_vendors.source / vendor_profile_views.source
 *  axis. Unknown sources fall back to a humanized version of the raw key. */
const SOURCE_LABELS: Record<string, string> = {
  profile_direct: 'Profile (direct)',
  host_manual: 'Added by couple',
  host_marketplace_search: 'Marketplace search',
  explore_card: 'Explore card',
  auto_cascade_from_finalize: 'Auto-added (you locked a related vendor)',
};

export function humanizeFunnelSource(src: string | null): string {
  if (!src) return 'Unattributed';
  return (
    SOURCE_LABELS[src] ??
    src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** One source slice (booked or views), with the min-N suppression flag baked
 *  in so both surfaces render the same "—" for thin segments. */
export type FunnelSourceSlice = {
  key: string;
  label: string;
  count: number;
  shown: boolean;
};

/** The fully-assembled funnel view — everything both surfaces need to render:
 *  the 4-step funnel with time-over-time deltas, plus the booked + views
 *  source breakdowns. All live, no hardcoded numbers. */
export type VendorFunnelView = {
  range: FunnelRangeKey;
  days: number;
  sinceIso: string;
  steps: FunnelStep[];
  sourceSlices: FunnelSourceSlice[];
  viewSourceSlices: FunnelSourceSlice[];
};

/** A PostgREST-ish client that supports the filtered `.select()` reads below.
 *  Loosely typed to accept either the RLS server client or the admin client. */
type FunnelClient = {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => any;
  };
};

function toSlices(
  bySource: Map<string, number>,
): FunnelSourceSlice[] {
  return [...bySource.entries()]
    .map(([key, count]) => ({
      key,
      label: humanizeFunnelSource(key === '(unattributed)' ? null : key),
      count,
      shown: minNOk(count),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute the whole funnel VIEW for one vendor in a range — the shared live
 * read used by BOTH the standalone /vendor-dashboard/funnel route and the
 * vendor Overview's inline funnel section. One source of truth so the two
 * surfaces never drift.
 *
 * Reads run on the RLS-scoped session client: vendor_profile_views is gated to
 * current_vendor_profile_ids(), and chat_threads / vendor_proposals /
 * event_vendors already RLS-scope to the vendor's own rows. Each sliced-by-
 * source breakdown is min-N suppressed (thin segments → shown:false).
 */
export async function computeVendorFunnelView(
  client: FunnelClient,
  vendorProfileId: string,
  range: FunnelRangeKey,
): Promise<VendorFunnelView> {
  const days = FUNNEL_RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 28;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  // Whole-funnel totals (the vendor always sees their OWN totals).
  const totals = await fetchVendorFunnelTotals(
    client as Parameters<typeof fetchVendorFunnelTotals>[0],
    vendorProfileId,
    sinceIso,
  );
  const steps = buildFunnelSteps(totals);

  // Booked, sliced by source (event_vendors.source).
  const { data: bookedRows } = await client
    .from('event_vendors')
    .select('source')
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
    .gte('created_at', sinceIso);
  const bySource = new Map<string, number>();
  for (const row of (bookedRows ?? []) as { source: string | null }[]) {
    const key = row.source ?? '(unattributed)';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  // Views, sliced by source (vendor_profile_views.source).
  const { data: viewRows } = await client
    .from('vendor_profile_views')
    .select('source')
    .eq('vendor_profile_id', vendorProfileId)
    .gte('viewed_at', sinceIso);
  const viewsBySource = new Map<string, number>();
  for (const row of (viewRows ?? []) as { source: string | null }[]) {
    const key = row.source ?? '(unattributed)';
    viewsBySource.set(key, (viewsBySource.get(key) ?? 0) + 1);
  }

  return {
    range,
    days,
    sinceIso,
    steps,
    sourceSlices: toSlices(bySource),
    viewSourceSlices: toSlices(viewsBySource),
  };
}
