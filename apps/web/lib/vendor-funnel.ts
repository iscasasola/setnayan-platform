/**
 * Vendor Quote-to-Booking Funnel (Wave 6 "Soon" vendor benefit).
 *
 * Four stages — three already have data, VIEWS is the net-new one:
 *   VIEWS     → vendor_profile_views        (this PR's table)
 *   INQUIRIES → chat_threads                (one per couple→vendor inquiry)
 *   QUOTES    → vendor_proposals            (status sent/viewed/accepted)
 *   BOOKED    → event_vendors.status        (contracted+)
 *
 * This module owns the SHARED, surface-agnostic helpers used by the vendor-side
 * funnel + by-source breakdown (folded into /vendor-dashboard/performance and
 * /vendor-dashboard/demand · 2026-07-02) and the admin per-vendor drill-down
 * (/admin/funnels). It does NOT render anything.
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

/**
 * Per-service BOOKED count — the ONLY funnel stage that can be honestly
 * segmented by service. `event_vendors.service_id` records the exact
 * vendor_services row a couple booked, so the booked stage can filter to one
 * service; views / inquiries / quotes have no service_id on their source tables
 * and stay shop-level (the My Performance funnel shows a visible note that
 * "views/inquiries/quotes are shop-wide" when a service is selected).
 *
 * Mirrors the booked-stage query in fetchVendorFunnelTotals() EXACTLY
 * (marketplace_vendor_id + BOOKED_EVENT_VENDOR_STATUSES + created_at window),
 * plus `.eq('service_id', serviceId)`. Head/count-only (cheap, indexed via
 * event_vendors_service_id_idx). Same client contract as the funnel.
 */
export async function fetchServiceBookedCount(
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
  serviceId: string,
): Promise<number> {
  const { count } = await client
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('marketplace_vendor_id', vendorProfileId)
    .eq('service_id', serviceId)
    .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
    .gte('created_at', sinceIso);

  return count ?? 0;
}

/**
 * TRUE count of booked rows tied to NO specific service (service_id IS NULL) in
 * a window — the honest denominator for the "Excludes N bookings not tied to a
 * specific service" footnote on the per-service My Performance view.
 *
 * WHY a dedicated reader (not shopTotal − thisService): for a multi-service
 * vendor, shopTotal − thisService = (OTHER services' bookings) + (true
 * NULL-service bookings). Subtracting mislabels other services' bookings as "not
 * tied to a specific service," which is a false statement. This filters
 * `service_id IS NULL` directly, so the footnote counts ONLY genuinely
 * service-less bookings.
 *
 * Mirrors fetchServiceBookedCount() EXACTLY (marketplace_vendor_id +
 * BOOKED_EVENT_VENDOR_STATUSES + created_at window), swapping
 * `.eq('service_id', serviceId)` for `.is('service_id', null)`. Head/count-only.
 * Same client contract as the funnel.
 */
export async function fetchNullServiceBookedCount(
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
): Promise<number> {
  const { count } = await client
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('service_id', null)
    .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
    .gte('created_at', sinceIso);

  return count ?? 0;
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

// ── "By source" breakdown ────────────────────────────────────────────────────
// Shared between My Performance (/vendor-dashboard/performance) and Demand Radar
// (/vendor-dashboard/demand). Both slice the vendor's OWN bookings / views by
// the `source` axis (where the couple came from) and apply the same min-N floor,
// so the two surfaces never disagree on a label or a suppression call.

/** Friendly labels for the source axis (event_vendors.source /
 *  vendor_profile_views.source). Unknown keys fall back to a humanized form. */
export const SOURCE_LABELS: Record<string, string> = {
  profile_direct: 'Profile (direct)',
  host_manual: 'Added by couple',
  host_marketplace_search: 'Marketplace search',
  explore_card: 'Explore card',
  auto_cascade_from_finalize: 'Auto-added (you locked a related vendor)',
};

/** Humanize a raw source key. Null → "Unattributed". */
export function humanizeSource(src: string | null): string {
  if (!src) return 'Unattributed';
  return (
    SOURCE_LABELS[src] ??
    src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** One source row: a labeled count, plus whether it cleared the min-N floor.
 *  `shown=false` means render the count as "—" (suppressed thin slice). */
export type SourceSlice = {
  key: string;
  label: string;
  count: number;
  shown: boolean;
};

/** Aggregate `{ source }[]` rows into sorted, min-N-gated slices. */
function buildSourceSlices(rows: { source: string | null }[]): SourceSlice[] {
  const by = new Map<string, number>();
  for (const row of rows) {
    const key = row.source ?? '(unattributed)';
    by.set(key, (by.get(key) ?? 0) + 1);
  }
  return [...by.entries()]
    .map(([key, count]) => ({
      key,
      label: humanizeSource(key === '(unattributed)' ? null : key),
      count,
      shown: minNOk(count),
    }))
    .sort((a, b) => b.count - a.count);
}

// Loose client contract — a PostgREST query builder. Accepts either the
// RLS-scoped server client or the admin client (both expose this surface).
type SourceQueryClient = {
  from: (table: string) => {
    select: (cols: string) => any;
  };
};

/**
 * Booked rows sliced by `event_vendors.source` — where the vendor's booked
 * couples first found them. RLS/ownership-scoped by marketplace_vendor_id; each
 * slice is min-N gated. Same BOOKED_EVENT_VENDOR_STATUSES + created_at window as
 * the funnel's BOOKED stage, so the breakdown reconciles with the funnel total.
 */
export async function fetchBookedBySource(
  client: SourceQueryClient,
  vendorProfileId: string,
  sinceIso: string,
): Promise<SourceSlice[]> {
  const { data } = await client
    .from('event_vendors')
    .select('source')
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
    .gte('created_at', sinceIso);
  return buildSourceSlices((data ?? []) as { source: string | null }[]);
}

/**
 * Profile views sliced by `vendor_profile_views.source` — where the vendor's
 * top-of-funnel traffic comes from. RLS-gated to current_vendor_profile_ids();
 * each slice is min-N gated. Same viewed_at window as the funnel's VIEWS stage.
 */
export async function fetchViewsBySource(
  client: SourceQueryClient,
  vendorProfileId: string,
  sinceIso: string,
): Promise<SourceSlice[]> {
  const { data } = await client
    .from('vendor_profile_views')
    .select('source')
    .eq('vendor_profile_id', vendorProfileId)
    .gte('viewed_at', sinceIso);
  return buildSourceSlices((data ?? []) as { source: string | null }[]);
}
