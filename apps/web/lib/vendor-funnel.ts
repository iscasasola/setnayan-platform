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
