import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isVendorReachRingsEnabled } from '@/lib/vendor-reach-rings-flag';
import {
  resolveReachRing,
  resolveRingRadii,
  type ResolvedRingRadii,
  type TransportRingSummary,
} from '@/lib/vendor-reach-rings';

export type { TransportRingSummary };

/**
 * vendor-reach-rings.server.ts — the DB-touching half of the two-ring reach
 * model. Every decision lives in the pure resolver
 * (`lib/vendor-reach-rings.ts`); this module only fetches the four numbers the
 * resolver needs and hands them over.
 *
 * ── THREE INVARIANTS, ALL LOAD-BEARING ─────────────────────────────────────
 *
 * 1. FLAG-DARK, SHORT-CIRCUITED. Every export returns immediately (null) while
 *    `NEXT_PUBLIC_VENDOR_REACH_RINGS_V1` is off — before any query is issued.
 *    Flag off = not one extra round-trip, byte-identical behaviour.
 *
 * 2. THE RING COLUMNS ARE READ IN THEIR OWN QUERY, NEVER FOLDED INTO AN
 *    EXISTING SELECT. PostgREST answers a select naming an unknown column with
 *    42703 and NULLS THE WHOLE ROW — so adding `reach_ring1_km` to, say,
 *    `FULL_VENDOR_PROFILE_SELECT` would blank a vendor's entire profile on any
 *    deploy that lands ahead of the migration. An isolated query can only ever
 *    fail itself, and it fails soft to null.
 *
 * 3. THE VENUE PIN NEVER LEAVES THE SERVER. `resolveThreadTransportRing`
 *    returns only the RING (and the vendor's own radii) — not the venue
 *    coordinates and not the distance. The vendor is quoting an inquiry; they
 *    are entitled to know "this is inside your free-travel ring", not to the
 *    couple's exact venue coordinates. Keeping the pin server-side is also why
 *    the Proposal Maker takes a resolved summary prop instead of raw lat/lng.
 */

/** Vendor half of a ring resolution — HQ pin + stored radii + tier. */
export type VendorReachRow = {
  tier: string | null;
  ring1Km: number | null;
  ring2Km: number | null;
  hqLat: number | null;
  hqLng: number | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Read one vendor's reach inputs. Fail-soft: any error (missing columns on a
 * pre-migration deploy, RLS, transient PostgREST) degrades to `null`, and every
 * caller treats null as "no ring opinion" rather than as a lock.
 */
export async function fetchVendorReachRow(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorReachRow | null> {
  if (!isVendorReachRingsEnabled()) return null;
  try {
    const { data, error } = await client
      .from('vendor_profiles')
      .select('tier_state,reach_ring1_km,reach_ring2_km,hq_latitude,hq_longitude')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      tier: typeof row.tier_state === 'string' ? row.tier_state : null,
      ring1Km: num(row.reach_ring1_km),
      ring2Km: num(row.reach_ring2_km),
      hqLat: num(row.hq_latitude),
      hqLng: num(row.hq_longitude),
    };
  } catch {
    return null;
  }
}

/**
 * The vendor's own EFFECTIVE radii (tier cap applied) for the settings card.
 * Null while the flag is dark or the row can't be read.
 */
export async function fetchVendorRingSettings(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<(ResolvedRingRadii & { storedRing1Km: number | null; storedRing2Km: number | null }) | null> {
  const row = await fetchVendorReachRow(client, vendorProfileId);
  if (!row) return null;
  return {
    ...resolveRingRadii(row.tier, row.ring1Km, row.ring2Km),
    storedRing1Km: row.ring1Km,
    storedRing2Km: row.ring2Km,
  };
}

/**
 * Resolve the transport ring for one vendor ⇄ one event.
 *
 * Uses the SERVICE-ROLE client for the venue pin on purpose: a vendor holding a
 * pending inquiry is NOT an `event_members` row, so a caller-scoped read of
 * `events` returns nothing under their RLS and every quote would resolve
 * 'unknown'. The admin read is narrowly scoped — two coordinate columns of the
 * ONE event id the caller already proved thread ownership for — and the pin is
 * consumed server-side and discarded (only the ring is returned).
 *
 * Returns null when the flag is dark, when either side has no pin, or on any
 * error. Null means "no ring opinion" → the Proposal Maker keeps today's fully
 * editable transportation line.
 */
export async function resolveThreadTransportRing(args: {
  vendorProfileId: string;
  eventId: string;
}): Promise<TransportRingSummary | null> {
  if (!isVendorReachRingsEnabled()) return null;
  try {
    const admin = createAdminClient();
    const [vendor, venue] = await Promise.all([
      fetchVendorReachRow(admin, args.vendorProfileId),
      admin
        .from('events')
        .select('venue_latitude,venue_longitude')
        .eq('event_id', args.eventId)
        .maybeSingle(),
    ]);
    if (!vendor) return null;
    const ev = (venue.data ?? null) as Record<string, unknown> | null;

    const verdict = resolveReachRing({
      tier: vendor.tier,
      ring1Km: vendor.ring1Km,
      ring2Km: vendor.ring2Km,
      vendorLat: vendor.hqLat,
      vendorLng: vendor.hqLng,
      venueLat: num(ev?.venue_latitude),
      venueLng: num(ev?.venue_longitude),
    });

    return {
      ring: verdict.ring,
      transportLocked: verdict.transportLocked,
      ring1Km: verdict.ring1Km,
      ring2Km: verdict.ring2Km,
      coupleLabel: verdict.coupleLabel,
    };
  } catch {
    return null;
  }
}
