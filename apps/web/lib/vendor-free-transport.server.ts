import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { haversineKm } from '@/lib/geo';
import { isFreeTransportEnforcementEnabled } from '@/lib/vendor-free-transport-flag';
import {
  resolveFreeTransportDecision,
  type FreeTransportDecision,
} from '@/lib/vendor-free-transport';

/**
 * vendor-free-transport.server.ts — the DB-touching half of the inner-ring
 * free-travel enforcement. Every DECISION lives in the pure resolver
 * (`lib/vendor-free-transport.ts`); this module only fetches the six numbers the
 * resolver needs (tier, two rings, HQ pin, venue pin) and hands them over.
 *
 * ── THREE INVARIANTS, ALL LOAD-BEARING ─────────────────────────────────────
 *
 * 1. FLAG-DARK, SHORT-CIRCUITED. The export returns null immediately while
 *    `NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED` is off — BEFORE any query is
 *    issued. Flag off = not one extra round-trip on the proposal-send path, and
 *    behaviour byte-identical to before this file existed.
 *
 * 2. THE RING COLUMNS ARE READ IN THEIR OWN QUERY, NEVER FOLDED INTO AN
 *    EXISTING SELECT. PostgREST answers a select naming an unknown column with
 *    42703 and NULLS THE WHOLE ROW — so folding `inner_radius_km` into, say,
 *    `FULL_VENDOR_PROFILE_SELECT` would blank a vendor's entire profile on any
 *    deploy that lands ahead of its migration. An isolated query can only ever
 *    fail itself, and it fails soft to null. (Same rule the couple's bench
 *    already follows for these two columns — `vendors/page.tsx`.)
 *
 * 3. THE VERDICT NEVER REACHES THE VENDOR'S BROWSER — not the pin, not the
 *    distance, and not the ring.
 *
 *    This is the invariant worth reading twice, and it is why there is no UI in
 *    this PR. The vendor controls BOTH inputs to the comparison: the threshold
 *    (their own inner-radius field) and the origin (their own HQ pin). Hand them
 *    an on-demand "is this venue inside?" boolean and the settings form becomes
 *    a binary-search probe — a handful of saves pins the distance from one
 *    origin, and two HQ moves trilaterate the couple's venue to ~1 km. The
 *    couple never disclosed that. "We only return a boolean" is no defence,
 *    because the boolean IS the oracle.
 *
 *    So `resolveThreadFreeTransport` has exactly ONE caller —
 *    `sendCustomProposalCore` — and its result is consumed to rewrite line items
 *    and then discarded. A vendor can still infer one bit per SENT proposal (the
 *    ₱0 Transportation line on a quote the couple also receives), which is
 *    costly, rate-limited by the couple's patience, visible to the couple and
 *    auditable — rather than free and silent. DO NOT add a live readout to the
 *    Proposal Maker, a `transportRing` prop, or any endpoint that answers this
 *    question on demand. Making it safe to SHOW needs a different design:
 *    snapshot the verdict once, at accept time, from inputs the vendor can no
 *    longer move.
 */

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Resolve the free-travel decision for one vendor ⇄ one event.
 *
 * Uses the SERVICE-ROLE client for the venue pin on purpose: a vendor holding a
 * chat thread is NOT an `event_members` row, so a caller-scoped read of `events`
 * returns nothing under their RLS and every quote would resolve "unknown". The
 * admin read is narrowly scoped — two coordinate columns of the ONE event id the
 * caller already proved thread ownership for — and the pin is consumed
 * server-side and discarded (invariant 3).
 *
 * Returns null when the flag is dark, when the vendor row can't be read, or on
 * ANY error. Null means "no opinion" → `applyFreeTransportToQuote` passes the
 * vendor's own line items through untouched. Fail-soft is the correct direction
 * here: a transient PostgREST blip must not silently confiscate a legitimate
 * travel fee, and it must certainly not fail the send.
 */
export async function resolveThreadFreeTransport(args: {
  vendorProfileId: string;
  eventId: string;
}): Promise<FreeTransportDecision | null> {
  if (!isFreeTransportEnforcementEnabled()) return null;
  try {
    const admin = createAdminClient();
    const [vendorRes, venueRes] = await Promise.all([
      admin
        .from('vendor_profiles')
        .select('tier_state,inner_radius_km,outer_radius_km,hq_latitude,hq_longitude')
        .eq('vendor_profile_id', args.vendorProfileId)
        .maybeSingle(),
      admin
        .from('events')
        .select('venue_latitude,venue_longitude')
        .eq('event_id', args.eventId)
        .maybeSingle(),
    ]);
    if (vendorRes.error || !vendorRes.data) return null;

    const v = vendorRes.data as Record<string, unknown>;
    const ev = (venueRes.data ?? null) as Record<string, unknown> | null;

    const hqLat = num(v.hq_latitude);
    const hqLng = num(v.hq_longitude);
    const venueLat = num(ev?.venue_latitude);
    const venueLng = num(ev?.venue_longitude);

    // Same distance the couple's bench computes per candidate — straight-line
    // HQ → venue. Null whenever either pin is missing, which the pure resolver
    // reads as "can't tell" and therefore "don't enforce".
    const distanceKm =
      hqLat !== null && hqLng !== null && venueLat !== null && venueLng !== null
        ? haversineKm(venueLat, venueLng, hqLat, hqLng)
        : null;

    return resolveFreeTransportDecision({
      distanceKm,
      declaredInnerKm: num(v.inner_radius_km),
      declaredOuterKm: num(v.outer_radius_km),
      tier: typeof v.tier_state === 'string' ? v.tier_state : null,
    });
  } catch {
    return null;
  }
}
