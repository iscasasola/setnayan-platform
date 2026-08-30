/**
 * WILL THIS CELEBRATION HAVE ENOUGH CREDITS? — pure, no I/O.
 *
 * The couple's Home shows what they HOLD (`papicCreditsHeld`). It has never
 * said whether that is ENOUGH, so "1,240 credits" meant nothing to anybody
 * who does not already know what a credit buys. This module answers the
 * question the number was standing in for.
 *
 * ── IT RECOMMENDS ONLY WHEN SHORT (owner 2026-08-30) ───────────────────────
 * "if they need to add more … not over not under. if their count is good,
 * then do not recommend." So `recommendTopUp` returns NULL when the estimate
 * is already covered — a surface that always suggests buying more is an
 * advert, not an estimate, and the couple stops believing the number.
 *
 * ── EVERY CREDIT WEIGHT IS PASSED IN, NEVER WRITTEN HERE ───────────────────
 * `PAPIC_POINTS_PER_PHOTO` / `PAPIC_POINTS_PER_CLIP` live in ONE place
 * (lib/papic-cameras-pure.ts) and `lib/papic-copy-guardrails.test.ts` fails CI
 * when a surface re-grows a literal for them. The clip weight has already moved
 * twice by owner call. So this module takes the weights as inputs and states no
 * digit of its own for what a capture costs.
 *
 * ⚠ WHAT *IS* AN ASSUMPTION HERE, AND IS THE OWNER'S TO SET: how much a guest
 * shoots. `DEFAULT_CAPTURE_MIX` below is a starting default, in the same spirit
 * as `FAMILY_DISCOUNT_DEFAULT_PCT` — a reasonable number the owner can tune once
 * real events produce real data. It is deliberately the ONLY behavioural guess
 * in the file, and it is isolated so changing it is a one-line edit.
 */

export type CaptureMix = {
  /** Photos an average guest is expected to shoot. */
  photosPerGuest: number;
  /** Ten-second clips an average guest is expected to shoot. */
  clipsPerGuest: number;
  /**
   * Credits reserved for the couple's own coverage that is not per-guest —
   * prep, portraits, the pre-event shoot. A flat allowance, not a rate.
   */
  baseCredits: number;
};

/**
 * ⚖ OWNER-TUNABLE STARTING DEFAULTS — not measured, and honestly labelled as
 * such. No production event has yet run to completion with Papic, so there is
 * no real distribution to fit; these are a deliberate first guess that errs
 * slightly generous (a couple told they are short buys a top-up they can still
 * spend later; a couple told they are covered and then runs dry mid-reception
 * loses the photos permanently, which is the unrecoverable direction).
 */
export const DEFAULT_CAPTURE_MIX: Readonly<CaptureMix> = Object.freeze({
  photosPerGuest: 6,
  clipsPerGuest: 1,
  baseCredits: 150,
});

export type CreditWeights = {
  /** `PAPIC_POINTS_PER_PHOTO` — passed in, never restated. */
  pointsPerPhoto: number;
  /** `PAPIC_POINTS_PER_CLIP` — passed in, never restated. */
  pointsPerClip: number;
};

/**
 * Credits this celebration is expected to spend.
 *
 * Returns `null` when it cannot be computed honestly — an unusable guest count
 * or a non-positive credit weight. A caller must render "we cannot estimate
 * this yet", never a zero dressed up as "you need nothing".
 */
export function estimateCreditsNeeded(
  guestCount: number,
  weights: CreditWeights,
  mix: CaptureMix = DEFAULT_CAPTURE_MIX,
): number | null {
  if (!Number.isFinite(guestCount) || guestCount < 0) return null;
  if (!Number.isFinite(weights.pointsPerPhoto) || weights.pointsPerPhoto <= 0) return null;
  if (!Number.isFinite(weights.pointsPerClip) || weights.pointsPerClip <= 0) return null;
  const perGuest =
    mix.photosPerGuest * weights.pointsPerPhoto + mix.clipsPerGuest * weights.pointsPerClip;
  if (!Number.isFinite(perGuest) || perGuest < 0) return null;
  const base = Number.isFinite(mix.baseCredits) && mix.baseCredits > 0 ? mix.baseCredits : 0;
  return Math.ceil(guestCount * perGuest + base);
}

export type CreditVerdict =
  /** Held credits meet or exceed the estimate. Say so; recommend nothing. */
  | { status: 'covered'; needed: number; held: number }
  /** Short by `shortfall` credits. */
  | { status: 'short'; needed: number; held: number; shortfall: number }
  /** Not estimable (no guest count yet, unusable weights). Show nothing. */
  | { status: 'unknown' };

/**
 * The smallest catalog rung that covers a shortfall — "not over, not under"
 * expressed against the rungs that ACTUALLY EXIST.
 *
 * ⚠ THIS TAKES THE REAL LADDER AND DOES NOT ROUND TO AN INCREMENT. An earlier
 * draft rounded the shortfall up to a fixed 150 — the Papic ONE *camera* rung —
 * and would have recommended figures nobody can buy: the shared pool sells on a
 * SIXTEEN-rung `PAPIC_GUEST*` ladder whose sizes are admin-editable catalog
 * data, not multiples of anything. A recommendation the checkout cannot honour
 * is worse than no recommendation.
 *
 * Returns the largest rung when none covers the gap (buy the biggest, then
 * top up again — every rung is additive and repeatable), and `null` for an
 * empty ladder.
 */
export function smallestRungCovering(
  shortfall: number,
  rungCredits: readonly number[],
): number | null {
  const usable = rungCredits
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  if (!Number.isFinite(shortfall) || shortfall <= 0) return null;
  return usable.find((n) => n >= shortfall) ?? usable[usable.length - 1]!;
}

/**
 * The whole answer for one celebration: covered, short, or not knowable yet.
 *
 * 🔑 `covered` CARRIES NO RECOMMENDATION AT ALL — not a zero, not a "you could
 * still add more". The type makes over-recommending unrepresentable rather than
 * merely discouraged. A caller that wants a purchasable figure passes the
 * shortfall through {@link smallestRungCovering} with the live ladder.
 */
export function papicCreditVerdict(
  held: number,
  guestCount: number,
  weights: CreditWeights,
  mix: CaptureMix = DEFAULT_CAPTURE_MIX,
): CreditVerdict {
  const needed = estimateCreditsNeeded(guestCount, weights, mix);
  if (needed == null) return { status: 'unknown' };
  const heldSafe = Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
  if (heldSafe >= needed) return { status: 'covered', needed, held: heldSafe };
  return { status: 'short', needed, held: heldSafe, shortfall: needed - heldSafe };
}
