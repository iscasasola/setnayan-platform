/**
 * lib/demo-booth-rotation — PURE logic for "3D Booth Ads · Part B" (slice 9,
 * owner-locked 2026-07-08): the homepage "Maria & Jose" 3D demo's booths show
 * REAL marketplace vendors on ROTATION — "your booth, inside every demo".
 * Pro/Enterprise ranked first, token/ad boosts buy more airtime, and everyone
 * eligible still cycles through over time.
 *
 * React/DOM/Supabase-free so the ranking + rotation is 100% unit-testable; the
 * data fetch + booth mapping live in `plan3d-demo-actions.ts` (a later phase).
 * Every function takes the clock as a parameter (never reads it) so tests are
 * deterministic and the rotation is stable for all visitors in a window.
 *
 * The airtime model is a WEIGHTED ROTATION RING: each eligible vendor is placed
 * in a ring `rotationWeight` times (Enterprise 3 · Pro/Custom 2 · +1 for an ad
 * boost · Verified 1), so paid/boosted vendors recur more often but no vendor is
 * ever locked out. A window offset slides which ring segment is on-air; within
 * one window a vendor is shown at most once.
 */

import type { VendorCategory } from './vendors';

/** How long a rotation window lasts — the demo booths change lineup this often
 *  (and are identical for every visitor within the window, so a vendor can point
 *  someone at "the demo" and see their booth). 1 hour. */
export const ROTATION_PERIOD_MS = 60 * 60 * 1000;

export type RotatableVendor = {
  vendorProfileId: string;
  name: string;
  slug: string | null; // /v/[slug] — null when not publicly bookable
  logoRef: string | null; // raw stored logo ref (resolved to a URL downstream)
  category: VendorCategory; // coerced from vendor_profiles.services[]
  tier: string | null; // vendor_profiles.tier_state
  adRank: number; // vendor_market_stats.ad_rank (0 = no boost)
};

/** Ring copies for a vendor — more copies = more airtime. Enterprise leads, then
 *  Pro/Custom, an ad boost adds one, and a plain verified vendor gets one. */
export function rotationWeight(tier: string | null, adRank: number): number {
  let w = 1;
  if (tier === 'enterprise') w = 3;
  else if (tier === 'pro' || tier === 'custom') w = 2;
  if (adRank > 0) w += 1;
  return w;
}

/** Deterministic rank order (premium first) — weight desc, then ad_rank desc,
 *  then id asc as a stable tiebreak so the ring is identical run-to-run. */
export function rankVendors(pool: readonly RotatableVendor[]): RotatableVendor[] {
  return [...pool].sort((a, b) => {
    const wa = rotationWeight(a.tier, a.adRank);
    const wb = rotationWeight(b.tier, b.adRank);
    if (wa !== wb) return wb - wa;
    if (a.adRank !== b.adRank) return b.adRank - a.adRank;
    return a.vendorProfileId < b.vendorProfileId ? -1 : a.vendorProfileId > b.vendorProfileId ? 1 : 0;
  });
}

/**
 * The weighted rotation ring: each vendor appears `rotationWeight` times, spread
 * EVENLY via stride scheduling (weighted fair queueing), NOT clustered. Each
 * vendor gets a virtual `stride = total / weight` and, step by step, the vendor
 * with the smallest accumulated pass-time is emitted next — so a weight-3 vendor
 * recurs every ~total/3 positions, evenly. Even spread is load-bearing: it keeps
 * a premium vendor's copies ≥ its stride apart, so a window's distinct-pick walk
 * never dedups its own run and its weight always converts to airtime.
 */
export function buildRotationRing(ranked: readonly RotatableVendor[]): RotatableVendor[] {
  const weightOf = (v: RotatableVendor) => rotationWeight(v.tier, v.adRank);
  const total = ranked.reduce((s, v) => s + weightOf(v), 0);
  if (total === 0) return [];
  const state = ranked.map((v, i) => {
    const stride = total / weightOf(v);
    return { v, rank: i, stride, pass: stride / 2 }; // centre the first appearance
  });
  const ring: RotatableVendor[] = [];
  for (let step = 0; step < total; step++) {
    let best = state[0]!;
    for (const s of state) {
      if (s.pass < best.pass || (s.pass === best.pass && s.rank < best.rank)) best = s;
    }
    ring.push(best.v);
    best.pass += best.stride;
  }
  return ring;
}

/** The window index for a timestamp — the rotation advances one per period. */
export function rotationWindow(nowMs: number, periodMs: number = ROTATION_PERIOD_MS): number {
  return Math.floor(nowMs / Math.max(1, periodMs));
}

/**
 * The vendors on-air in the demo's `slots` booths for a given window: distinct,
 * ranked-then-rotated. When the pool fits in the slots, everyone shows (ranked
 * order). Otherwise a window offset walks the weighted ring, collecting distinct
 * vendors — premium recur across windows, everyone eventually cycles in. Pure +
 * deterministic per `(pool, slots, window)`.
 */
export function selectDemoRotation(
  pool: readonly RotatableVendor[],
  slots: number,
  window: number,
): RotatableVendor[] {
  if (slots <= 0 || pool.length === 0) return [];
  const ranked = rankVendors(pool);
  if (ranked.length <= slots) return ranked;

  const ring = buildRotationRing(ranked);
  const n = ring.length;
  // Each slot samples the ring at an EVENLY-STRIDED offset (not adjacent), so a
  // vendor next to a premium one doesn't always ride along. The base offset
  // advances one position per window, sweeping every vendor into view over time.
  const gap = n / slots;
  const picked: RotatableVendor[] = [];
  const seen = new Set<string>();
  for (let j = 0; j < slots; j++) {
    const base = (((Math.round(window + j * gap) % n) + n) % n);
    for (let p = 0; p < n; p++) {
      const v = ring[(base + p) % n]!; // linear-probe forward for the next distinct
      if (seen.has(v.vendorProfileId)) continue;
      seen.add(v.vendorProfileId);
      picked.push(v);
      break;
    }
  }
  return picked;
}

/** Build-time flag (default OFF → the homepage demo shows its normal sample
 *  booths, byte-identical). SEPARATE from Part A's lab flag: the public homepage
 *  is more sensitive, so demo-room ads flip on their own. */
export const PLAN3D_DEMO_ADS_ENABLED = process.env.NEXT_PUBLIC_PLAN3D_DEMO_ADS === 'true';
