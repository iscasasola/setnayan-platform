/**
 * WHAT THE CREDIT RECOMMENDATION LEARNS — pure, no I/O.
 *
 * Owner, 2026-09-22: *"we will set the initial value. then create an average
 * depending on the total credits used on actual events."*
 *
 * The mechanism is built and **starts dormant**: with no usable observations
 * this returns the owner's initial figure and says so.
 *
 * ── 🛑 TRAP 1 · THERE IS NO DATA, AND THE NAIVE MEAN IS ZERO ──────────────
 * Measured in prod 2026-09-22: nine weddings hold **100,362 credits GRANTED and
 * ONE credit USED**. An unguarded average over that recommends about nothing per
 * head, and a couple is told their wedding needs no credits. So a type needs
 * `minSample` UNCENSORED observations before anything overrides the initial,
 * the initial stays as the fallback rather than being overwritten, and the
 * verdict names which of the two is in force. A learned number that silently
 * replaced a set one is unreviewable.
 *
 * ── 🛑 TRAP 2 · USAGE MEASURES SUPPLY, NOT DEMAND ────────────────────────
 * An event that spent its whole pool might have wanted twice as much: we
 * observe what it COULD spend, not what it WANTED. That is a censored
 * observation, and averaging censored data spirals downward —
 *
 *     recommend less → they buy less → they use less → recommend less again
 *
 * — with every step looking like the loop working. So an EXHAUSTED celebration
 * never enters the mean. It enters as a LOWER BOUND: evidence of *"wanted at
 * least X"*, able to push the figure UP and never able to pull it down.
 *
 * 🔑 BOTH TRAPS ARE INVISIBLE UNDER GENEROUS FIXTURES. Every event comfortably
 * under its pool makes the naive mean look correct. The test beside this file
 * carries the fixture that EXHAUSTS a pool and asserts the average does not
 * fall — that assertion is the whole build.
 *
 * ── A SAMPLE IS A FINISHED CELEBRATION ───────────────────────────────────
 * An event still shooting has not finished wanting, so only closed capture
 * windows count. `papic_pool_learning_samples()` applies that filter in SQL;
 * {@link learnPointsPerGuest} re-applies it here rather than trusting its
 * caller, because a pure function that silently accepts a live event is a
 * function whose unit tests prove nothing about the real query.
 */

/** One finished celebration, as `papic_pool_learning_samples()` returns it. */
export type PoolUsageSample = {
  eventType: string;
  guestCount: number;
  usedPoints: number;
  totalPoints: number;
  /** Has the capture window closed? A live event is never an observation. */
  windowClosed: boolean;
};

export type LearningVerdict = {
  /** The figure that should be used right now. */
  pointsPerGuest: number;
  /** Where it came from. `'learned'` only ever appears above the minimum sample. */
  source: 'initial' | 'learned';
  /** Uncensored observations — closed celebrations that did NOT run out. */
  sampleSize: number;
  /** Closed celebrations that spent everything they held. */
  censoredCount: number;
  /**
   * The largest per-head figure among the exhausted celebrations, or null.
   * These wanted AT LEAST this much; the learned figure may never sit below it.
   */
  censoredFloor: number | null;
  /** Plain English, for the admin screen. */
  reason: string;
};

/** Below this, a type keeps the owner's number. Mirrors `learning_min_sample`. */
export const DEFAULT_LEARNING_MIN_SAMPLE = 12;

function perHead(s: PoolUsageSample): number | null {
  if (!Number.isFinite(s.guestCount) || s.guestCount <= 0) return null;
  if (!Number.isFinite(s.usedPoints) || s.usedPoints < 0) return null;
  return s.usedPoints / s.guestCount;
}

/** A celebration that spent everything it held. Its demand is unobserved. */
export function isExhausted(s: PoolUsageSample): boolean {
  return (
    Number.isFinite(s.totalPoints) &&
    s.totalPoints > 0 &&
    s.usedPoints >= s.totalPoints
  );
}

/**
 * The learned per-head figure for ONE event type, or the initial when there is
 * not enough evidence to move off it.
 *
 * `samples` may contain any types; only `eventType` matches are considered, so
 * a caller can hand over the whole set without pre-filtering and get the same
 * answer the SQL gives.
 */
export function learnPointsPerGuest(
  eventType: string,
  samples: readonly PoolUsageSample[],
  opts: { initial: number; minSample?: number },
): LearningVerdict {
  const minSample = Math.max(
    1,
    Math.floor(opts.minSample ?? DEFAULT_LEARNING_MIN_SAMPLE),
  );
  const initial = Math.max(0, Math.floor(opts.initial));

  const mine = samples.filter(
    (s) =>
      s.eventType === eventType &&
      s.windowClosed &&
      Number.isFinite(s.totalPoints) &&
      s.totalPoints > 0 &&
      perHead(s) != null,
  );

  const censored = mine.filter(isExhausted);
  const uncensored = mine.filter((s) => !isExhausted(s));

  const censoredFloor = censored.length
    ? Math.max(...censored.map((s) => perHead(s)!))
    : null;

  if (uncensored.length < minSample) {
    return {
      pointsPerGuest: initial,
      source: 'initial',
      sampleSize: uncensored.length,
      censoredCount: censored.length,
      censoredFloor,
      reason:
        `too few uncensored observations (${uncensored.length} of ${minSample}) — ` +
        `the owner's initial of ${initial} stands`,
    };
  }

  const mean =
    uncensored.reduce((acc, s) => acc + perHead(s)!, 0) / uncensored.length;

  // 🔑 THE ONE LINE THAT STOPS THE SPIRAL. An exhausted celebration can only
  // raise the answer. Without this `Math.max`, a type whose events all run dry
  // would be taught to recommend less every time it is recomputed.
  const floor = censoredFloor == null ? 0 : Math.ceil(censoredFloor);
  const learned = Math.max(Math.ceil(mean), floor);

  return {
    pointsPerGuest: learned,
    source: 'learned',
    sampleSize: uncensored.length,
    censoredCount: censored.length,
    censoredFloor,
    reason:
      floor > Math.ceil(mean)
        ? `raised by ${censored.length} exhausted celebration(s) — they wanted at least ${floor} a head`
        : `mean of ${uncensored.length} celebration(s) that finished with credits to spare`,
  };
}
