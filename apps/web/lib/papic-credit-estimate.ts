/**
 * WILL THIS CELEBRATION HAVE ENOUGH CREDITS? — pure, no I/O.
 *
 * The couple's Home shows what they HOLD. It has never said whether that is
 * ENOUGH, so "1,240 credits" meant nothing to anybody who does not already
 * know what a credit buys. This module answers the question the number was
 * standing in for.
 *
 * ── IT INVENTS NO NUMBER (owner 2026-08-31: "don't guess") ─────────────────
 * An earlier cut of this module carried its own capture-mix assumption — how
 * many photos and clips an average guest shoots — as a "reasonable default".
 * That was a GUESS dressed as a constant, on a surface that tells couples to
 * spend money, and it is gone.
 *
 * The app already holds an owner-set answer to "how many credits does an event
 * of N guests want", and has since migration 20270826385580:
 *
 *     papic_event_pool_config: clamp(guests × points_per_guest, floor, ceiling)
 *
 * Every one of those three numbers is admin-editable, PRICING-RELEVANT by its
 * own table comment, and already live in prod. `computeEventPool` in
 * lib/papic-event-pool.ts is the pure, unit-tested implementation that the SQL
 * function `papic_event_pool_status` mirrors — so the figure a couple is shown
 * here is the same figure the capture fence enforces, and neither can drift
 * from the other or from what the owner configured.
 *
 * This module therefore contributes NO arithmetic of its own about what an
 * event needs. It only compares that owner-derived figure against the balance
 * and words the result.
 *
 * ── IT RECOMMENDS ONLY WHEN SHORT (owner 2026-08-30) ───────────────────────
 * "if they need to add more … not over not under. if their count is good, then
 * do not recommend." A covered event yields a verdict that carries no top-up
 * figure at all — the union makes over-recommending unrepresentable rather
 * than merely discouraged.
 */

import { computeEventPool, type EventPoolConfig } from './papic-event-pool';

export type CreditVerdict =
  /** Held credits meet or exceed what the event wants. Recommend nothing. */
  | { status: 'covered'; needed: number; held: number }
  /** Short by `shortfall` credits. */
  | { status: 'short'; needed: number; held: number; shortfall: number }
  /** Not knowable yet — no guest count. Say nothing at all. */
  | { status: 'unknown' };

/**
 * Credits this celebration wants, per the OWNER-CONFIGURED pool formula.
 *
 * Delegates entirely to `computeEventPool` — this function exists to name the
 * intent ("what the event needs") at the call site, not to do sums. `config`
 * is the live `papic_event_pool_config` row; omitting a field falls back to
 * that module's own documented last-resort value, exactly as every other
 * caller of the formula does.
 *
 * `null` when there is no guest count to work from. A caller must render
 * nothing in that case — never a zero dressed up as "you need nothing".
 */
export function estimateCreditsNeeded(
  guestCount: number,
  config: Partial<EventPoolConfig> = {},
): number | null {
  if (!Number.isFinite(guestCount) || guestCount <= 0) return null;
  return computeEventPool(guestCount, config).basePoints;
}

/**
 * The smallest catalog rung that covers a shortfall — "not over, not under"
 * expressed against the rungs that ACTUALLY EXIST.
 *
 * ⚠ TAKES THE REAL LADDER; DOES NOT ROUND TO AN INCREMENT. An earlier draft
 * rounded the shortfall up to a fixed 150 — the Papic ONE *camera* rung — and
 * would have recommended figures nobody can buy: the shared pool sells on a
 * sixteen-rung `PAPIC_GUEST*` ladder whose sizes are admin-editable catalog
 * data, not multiples of anything. A recommendation the checkout cannot honour
 * is worse than no recommendation.
 *
 * Returns the largest rung when none covers the gap (every rung is additive
 * and repeatable, so the honest advice is "buy the biggest, then top up
 * again"), and `null` for an empty ladder or a non-positive gap.
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
 * still add more". A caller that wants a purchasable figure passes the
 * shortfall through {@link smallestRungCovering} with the live ladder.
 */
export function papicCreditVerdict(
  held: number,
  guestCount: number,
  config: Partial<EventPoolConfig> = {},
): CreditVerdict {
  const needed = estimateCreditsNeeded(guestCount, config);
  if (needed == null) return { status: 'unknown' };
  const heldSafe = Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
  if (heldSafe >= needed) return { status: 'covered', needed, held: heldSafe };
  return { status: 'short', needed, held: heldSafe, shortfall: needed - heldSafe };
}
