import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Person-spine · Phase 2 · TRUSTED-CIRCLE VENDOR RECOMMENDATIONS — signal read
 * layer + feature flag.
 *
 * ⚠ PHASE 2 IS COUNSEL-GATED. `trustedCircleRecsEnabled()` defaults OFF and
 * MIRRORS the same `NEXT_PUBLIC_PEOPLE_CONNECTIONS` env flag that gates the whole
 * Phase-2 connections flow (people-connections.ts / PR #2823). Until PH counsel
 * signs off and the owner sets `NEXT_PUBLIC_PEOPLE_CONNECTIONS=1` as a Vercel
 * project env var, `getTrustedCircleVendorSignal()` returns `null` WITHOUT
 * touching the database — so this feature is fully INERT in production and no
 * circle-based recommendation can surface. This is the counsel gate; do not flip
 * the flag on here. See 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md §11.
 *
 * WHAT THIS IS — the graph's marketplace payoff, extending (not forking) the
 * existing vendor recommendation engine (`vendor-recommendations.ts`) + Bayesian
 * quality rating (`vendor_reviews`) + coverage (`vendor-coverages.ts`). For a
 * host planning an event, it triangulates three explicit signals for a vendor:
 *
 *   • NEAR      — vendor coverage/region matches the event (vendor_coverages,
 *                 vendor_profiles.hq_region).
 *   • TRUSTED   — an EXPLICIT endorsement (`vendor_recommendations`, opt-in) or
 *                 an explicit review (`vendor_reviews`, rating ≥ 4). NEVER mere
 *                 booking co-occurrence — hiring ≠ endorsing.
 *   • CONNECTED — how many of the host's confirmed circle (degree ≤ 2) left one
 *                 of those explicit signals.
 *
 * LOCKED CONSTRAINTS (enforced in the SQL fn `trusted_circle_vendor_signal`, not
 * here — this is a thin flag-gated wrapper):
 *   • min-N — circle aggregates below the floor come back as 0, never a name.
 *   • degree ≤ 2 — 3rd degree is never traversed. 1st = named only via opt-in
 *     vouch; 2nd = anonymized aggregate only.
 *   • trust is NEVER purchasable — the fn reads no subscription/boost/ad data.
 *   • private to the host — the fn is SECURITY DEFINER but scoped to the caller's
 *     own claimed person + owned event; never a browsable social graph.
 *
 * PACKAGING (locked principle): this SIGNAL is FREE (never lose a free row).
 * Setnayan AI sells the ORCHESTRATION on top (cross-category shortlisting,
 * budget/style/date weighting) — not this raw signal. Keep it free.
 */

/**
 * OFF until PH counsel clears Phase 2 and the owner flips the shared env flag.
 * Kept as a function (not a module const) so it is re-read per request rather
 * than captured at module load. Mirrors `peopleConnectionsEnabled()`.
 */
export function trustedCircleRecsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PEOPLE_CONNECTIONS === '1';
}

/** A named 1st-degree opt-in voucher (only surfaced when they explicitly
 *  endorsed the vendor AND are a confirmed 1st-degree connection). */
export type CircleVoucher = {
  personId: string;
  displayName: string | null;
};

/**
 * The private trusted-circle signal for one (host-event, vendor) pair. Every
 * numeric field is already min-N-gated + degree-scoped by the SQL fn; the caller
 * treats these as safe-to-render aggregates.
 */
export type TrustedCircleVendorSignal = {
  /** NEAR: vendor HQ region == the event's region. */
  nearRegionMatch: boolean;
  /** NEAR: vendor's coverage includes this event type. */
  nearCoversEventType: boolean;
  /** TRUSTED context: distinct events that opt-in-endorsed this vendor. */
  trustedEndorsementCount: number;
  /** TRUSTED context: average review rating (null when no reviews). */
  trustedReviewAvg: number | null;
  /** TRUSTED context: number of explicit reviews. */
  trustedReviewCount: number;
  /** CONNECTED: 1st-degree circle who explicitly trusted the vendor (0 if < min-N). */
  connected1stCount: number;
  /** CONNECTED: 2nd-degree circle who explicitly trusted the vendor (0 if < min-N). */
  connected2ndCount: number;
  /** Named 1st-degree opt-in vouchers (consented to attribution). May be empty. */
  vouchedBy: CircleVoucher[];
  /** True when ANY explicit circle trust exists (named vouch OR min-N aggregate). */
  hasCircleTrust: boolean;
};

type SignalRow = {
  near_region_match: boolean;
  near_covers_event_type: boolean;
  trusted_endorsement_count: number | null;
  trusted_review_avg: number | string | null;
  trusted_review_count: number | null;
  connected_1st_count: number | null;
  connected_2nd_count: number | null;
  vouched_by: { person_id: string; display_name: string | null }[] | null;
};

/**
 * Read the trusted-circle signal for a (event, vendor) pair.
 *
 * Returns `null` when the feature flag is OFF (production default) — the DB is
 * NOT queried, keeping the feature inert. When ON, calls the flag-gated SQL fn
 * `public.trusted_circle_vendor_signal`, which enforces every privacy constraint
 * (min-N, degree ≤ 2, explicit-trust-only, host/person/event scoping) server-
 * side. Graceful-degrade to `null` on any error or when the fn declines to
 * compute (unauthorized caller / not the host's event / missing table).
 */
export async function getTrustedCircleVendorSignal(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<TrustedCircleVendorSignal | null> {
  // Flag gate FIRST — never hit the DB while counsel-gated.
  if (!trustedCircleRecsEnabled()) return null;

  const { data, error } = await supabase.rpc('trusted_circle_vendor_signal', {
    p_event_id: eventId,
    p_vendor_profile_id: vendorProfileId,
  });
  if (error || !data) return null;

  // SETOF fn → array; the boundary check returns 0 rows (inert) for a caller who
  // isn't the host of this event. No row ⇒ no signal.
  const rows = data as SignalRow[];
  const row = rows[0];
  if (!row) return null;

  const connected1st = row.connected_1st_count ?? 0;
  const connected2nd = row.connected_2nd_count ?? 0;
  const vouchedBy: CircleVoucher[] = (row.vouched_by ?? []).map((v) => ({
    personId: v.person_id,
    displayName: v.display_name,
  }));
  const avgRaw = row.trusted_review_avg;

  return {
    nearRegionMatch: !!row.near_region_match,
    nearCoversEventType: !!row.near_covers_event_type,
    trustedEndorsementCount: row.trusted_endorsement_count ?? 0,
    trustedReviewAvg: avgRaw == null ? null : Number(avgRaw),
    trustedReviewCount: row.trusted_review_count ?? 0,
    connected1stCount: connected1st,
    connected2ndCount: connected2nd,
    vouchedBy,
    hasCircleTrust: connected1st > 0 || connected2nd > 0 || vouchedBy.length > 0,
  };
}
