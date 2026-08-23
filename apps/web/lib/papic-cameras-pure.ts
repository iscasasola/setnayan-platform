/**
 * lib/papic-cameras-pure.ts — what a Papic capture COSTS, and how many cameras
 * are free, with no database in the module graph.
 *
 * Split out of lib/papic-cameras.ts, which resolves the unlock bundles through
 * `eventSkuActive` and so reaches the service-role client. This half is the
 * money vocabulary, and money vocabulary is exactly what the SURFACES need:
 *
 *   • `papic-gallery-grid.tsx` ('use client') prices a clip;
 *   • `lib/papic-tier-copy.ts` writes every points phrase from these constants,
 *     and IT is what `extra-cameras-picker.tsx` / `guest-camera-tier-picker.tsx`
 *     / the onboarding services step read;
 *   • `lib/vendor-papic-tier.ts` bills a vendor's captures against them.
 *
 * 🔑 THIS IS STILL THE ONLY PLACE THE WEIGHTS ARE WRITTEN. The point of moving
 * them was to let the client surfaces reach them WITHOUT a second copy — a
 * re-typed `8` is how the screen and the till come to disagree, and
 * lib/papic-copy-guardrails.test.ts fails CI if a surface re-grows a literal.
 *
 * Server callers keep importing from `@/lib/papic-cameras`, which re-exports
 * everything here.
 */

/** First N cameras are free (the funnel taste); paid orders require >= MIN. */
export const PAPIC_FREE_CAMERA_COUNT = 3; // owner 2026-07-17 (was 5)
export const PAPIC_MIN_PAID_CAMERAS = 1; // owner 2026-07-17 (was 5) — 1-camera minimum

/** Points one capture costs.
 *
 *  The clip weight has moved twice, always by owner call, always upward as the
 *  clip itself got longer: 5-second/3 pts -> 10-second/7 pts (2026-07-22,
 *  Papic_One_Pool_Model_Spec §0) -> 10-second/8 pts (owner-locked 2026-07-29,
 *  with the two-type Pool/One model). 8 is what a 10-second clip costs against
 *  EVERY balance — the shared Papic Pool and a Papic One camera's own dedicated
 *  bucket alike, because there is one currency, not two.
 *
 *  This is the ONLY place either weight is written. Both enforcement seams
 *  (app/api/upload presign + app/papic/actions record) and every display surface
 *  derive from here via papicCaptureCost / lib/papic-tier-copy.ts, and
 *  lib/papic-copy-guardrails.test.ts fails CI if a surface re-grows a literal. */
export const PAPIC_POINTS_PER_PHOTO = 1;
export const PAPIC_POINTS_PER_CLIP = 8;

/**
 * A VIDEO NOW COSTS WHAT ITS LENGTH COSTS (owner-locked 2026-08-11).
 *
 * Owner's table, verbatim — seconds → credits:
 *   1–2 → 2 · 3 → 3 · 4–6 → 5 · 7–10 → 8
 *
 * ── NOTHING GOT MORE EXPENSIVE ─────────────────────────────────────────────
 * Ten seconds still costs 8, exactly what every clip cost before. Only shorter
 * clips got cheaper. That matters for what this change actually DOES: until
 * now there was no reason on earth to shoot short — a two-second clip and a
 * ten-second clip both cost 8 — so everyone held the button down. This is a
 * price cut in practice, and a deliberate one.
 *
 * ── THE BANDS ARE MONOTONIC AND SPLIT-PROOF, AND BOTH ARE CHECKED ──────────
 * Never cheaper to shoot longer, and never cheaper to shoot one long clip as
 * several short ones (5 × 2s = 10 credits vs 1 × 10s = 8). A ladder that pays
 * you to game it is a ladder people will game. See papic-clip-cost.test.ts.
 */
export const PAPIC_CLIP_COST_BANDS: readonly { maxSeconds: number; points: number }[] =
  Object.freeze([
    { maxSeconds: 2, points: 2 },
    { maxSeconds: 3, points: 3 },
    { maxSeconds: 6, points: 5 },
    { maxSeconds: 10, points: 8 },
  ]);

/**
 * What the LONGEST clip costs — and therefore what an UNMEASURED one costs.
 *
 * Equal to PAPIC_POINTS_PER_CLIP by construction (asserted in the test), because
 * the top band is the price every clip used to pay.
 */
export const PAPIC_CLIP_COST_MAX = PAPIC_POINTS_PER_CLIP;

/** What the SHORTEST clip costs — the floor the presign gate uses. */
export const PAPIC_CLIP_COST_MIN = 2;

/**
 * Points a clip of `durationMs` spends.
 *
 * 🔑 AN UNKNOWN LENGTH COSTS THE MOST, NEVER THE LEAST. Null, NaN, negative,
 * zero, absent — every one of them bills the top band. This is the only
 * direction that is safe: the duration reaches the server as a number the
 * BROWSER stamped (app/papic/actions.ts already says so in as many words —
 * "spoofable by a hostile direct caller"), so the one thing a tampered client
 * must never be able to do is make a capture cheaper by omitting it. Failing
 * expensive costs an honest guest a few credits on a broken recorder; failing
 * cheap hands every client a free discount for sending nothing.
 *
 * Seconds are rounded UP — you pay for the second you are in. A 2.4s clip is a
 * 3-second clip. Rounding down would make 2.9s cost the same as 2.0s and put a
 * real cliff at the band edge for anyone watching the counter.
 */
export function papicClipCost(durationMs: number | null | undefined): number {
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    return PAPIC_CLIP_COST_MAX;
  }
  const seconds = Math.ceil(durationMs / 1000);
  for (const band of PAPIC_CLIP_COST_BANDS) {
    if (seconds <= band.maxSeconds) return band.points;
  }
  // Past the 10-second cap. The cap is enforced elsewhere (the record seam
  // rejects it outright); here it simply costs the most.
  return PAPIC_CLIP_COST_MAX;
}

/**
 * Points a capture of `kind` spends.
 *
 * ⚠ `durationMs` is OPTIONAL and its absence is not neutral — it means "bill a
 * clip at the top band". Two callers rely on that and both are correct to:
 *
 *   • the PRESIGN seam (app/api/upload), which runs before any file exists and
 *     genuinely cannot know a length;
 *   • preservationUnits (lib/papic-storage-telemetry), which bills STORAGE from
 *     a row that carries `is_clip` and no duration at all.
 *
 * Preservation staying at the ceiling is deliberate, not an oversight — see
 * PAPIC_PRESERVATION_UNITS_PER_CLIP.
 */
export function papicCaptureCost(
  kind: 'photo' | 'clip',
  durationMs?: number | null,
): number {
  return kind === 'clip' ? papicClipCost(durationMs) : PAPIC_POINTS_PER_PHOTO;
}

/**
 * What one stored clip costs to KEEP, as opposed to to shoot.
 *
 * 🔒 FLAT, AND NOT AN ACCIDENT. Capture is billed by length; preservation is
 * not, because it CANNOT be: `preservationUnits` bills from a stored row whose
 * only shape information is `is_clip` — there is no duration on it. Billing
 * storage at the cheapest band because the length is unreadable would
 * under-charge every kept video, so it bills at the ceiling.
 *
 * Named rather than left to fall out of `papicCaptureCost('clip')` returning
 * the max for a missing duration. It would — but then a reader would have to
 * infer a pricing decision from a default, and the next person to make the
 * default cheaper would silently reprice a ₱500 product.
 */
export const PAPIC_PRESERVATION_UNITS_PER_CLIP = PAPIC_CLIP_COST_MAX;

/**
 * ⚠ WHAT A CHALLENGE COSTS THE COUPLE'S SHARED POOL.
 *
 * Every mission a couple puts on the board is a shot a guest will spend, and the
 * shots come out of the ONE shared pool. Until 2026-08-10 the authoring screen
 * said nothing about that: the board lives in Set up, the balance lives in
 * Cameras, and a couple could commit their guests to hundreds of shots on a
 * screen with no number anywhere on it.
 *
 * 🔑 DERIVED FROM papicCaptureCost, NEVER RE-TYPED. A second hand-written 8 is
 * how the screen and the till come to disagree.
 *
 * A third kind, `pabati`, was priced here as a clip until the Pabati SKU was
 * retired on 2026-08-21 and its one library row became an ordinary clip. Any
 * kind added later must be a deliberate decision about money, spelled out here
 * rather than left to whatever the fallback happened to be.
 */
export function papicMissionCost(kind: 'photo' | 'clip' | null | undefined): number {
  switch (kind) {
    case 'clip':
      return papicCaptureCost('clip');
    case 'photo':
      return papicCaptureCost('photo');
    default:
      // No kind recorded yet — the guest board treats it as a photo.
      return papicCaptureCost('photo');
  }
}
