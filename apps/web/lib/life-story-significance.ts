/**
 * Life Story · significance engine — pure, deterministic, tunable.
 *
 * Decides which moments surface first (and dwell longest) in the Life Story
 * renderings. NO chronology here by design: the cinematic modes order by
 * significance; "by time" is a separate reel toggle.
 *
 * Every weight is exported for tuning; the tests pin ORDERING behavior
 * (what outranks what), not exact floats, so weights can be re-tuned without
 * rewriting the suite.
 *
 * Research anchors (Life_Story_Strategy_2026-07-08.md §1 — adversarially
 * verified 2026-07-08):
 *   · memoriam    — the ✦ held-beat is the design's quietest, heaviest signal
 *   · recurrence  — relational memory: "the people who kept showing up"
 *   · eventType   — cultural life script (kasal/binyag/debut rank high)
 *   · bump        — reminiscence bump: events at viewer age 10–30 carry a
 *                   bounded positive-salience prior (golden-20s); silently
 *                   off when birth_date is absent
 *   · curation over completeness — the positivity effect REVERSES for
 *                   exhaustive whole-life narratives, so this engine feeds
 *                   *curated highlights*, never an everything-reel
 *
 * Pure module: no Date.now(), no I/O, no randomness.
 */

import type { Moment, ScoredMoment } from './life-story-types';

export type SignificanceWeights = {
  memoriam: number;
  recurrence: number;
  people: number;
  eventType: number;
  coverage: number;
  pin: number;
};

/** Weights sum to 1.0 (the bump rides on top as a bounded bonus). */
export const SIGNIFICANCE_WEIGHTS: SignificanceWeights = {
  memoriam: 0.28,
  recurrence: 0.24,
  people: 0.18,
  eventType: 0.16,
  coverage: 0.08,
  pin: 0.06, // reserved — pin signal is hard 0 until the v1.1 pinned_at column
};

/** Bounded reminiscence-bump bonus, applied only when age-at-event ∈ [10,30]. */
export const REMINISCENCE_BUMP_BONUS = 0.05;
export const REMINISCENCE_BUMP_MIN_AGE = 10;
export const REMINISCENCE_BUMP_MAX_AGE = 30;

/**
 * Event-type priors. Keys beyond the live events.event_type enum
 * ('wedding'|'birthday'|'celebration'|'travel'|'corporate') are pre-tuned for
 * types the enum is expected to grow into; unknown types take the default.
 */
export const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  wedding: 1.0,
  christening: 0.86,
  debut: 0.82,
  anniversary: 0.6,
  celebration: 0.55,
  reunion: 0.5,
  graduation: 0.5,
  birthday: 0.42,
  travel: 0.4,
  corporate: 0.3,
};
export const DEFAULT_EVENT_TYPE_WEIGHT = 0.5;

/** Caps normalize open-ended counts into [0,1] so no signal can run away. */
export const PEOPLE_PRESENT_CAP = 8;
export const RECURRENCE_CAP = 6;
export const COVERAGE_CAP = 5;

export type ScoreContext = {
  /** Viewer's people.birth_date (ISO date) — null disables the bump silently. */
  viewerBirthDate: string | null;
};

/**
 * Full years old the viewer was on the event date. Null when either date is
 * unparseable. Deterministic — derived purely from the two inputs.
 */
export function ageAtEvent(eventDateIso: string, birthDateIso: string): number | null {
  const event = new Date(eventDateIso);
  const birth = new Date(birthDateIso);
  if (Number.isNaN(event.getTime()) || Number.isNaN(birth.getTime())) return null;
  let age = event.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = event.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && event.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Significance ∈ [0, 1 + REMINISCENCE_BUMP_BONUS]. Higher surfaces first, dwells longer. */
export function scoreMoment(
  moment: Moment,
  ctx: ScoreContext,
  weights: SignificanceWeights = SIGNIFICANCE_WEIGHTS,
): number {
  const peopleSignal =
    Math.min(moment.peoplePresent.length, PEOPLE_PRESENT_CAP) / PEOPLE_PRESENT_CAP;

  const meanRecurrence = moment.peoplePresent.length
    ? moment.peoplePresent.reduce((sum, p) => sum + p.recurrence, 0) /
      moment.peoplePresent.length
    : 0;
  const recurrenceSignal = Math.min(meanRecurrence, RECURRENCE_CAP) / RECURRENCE_CAP;

  const memoriamSignal = moment.peoplePresent.some((p) => p.inMemoriam) ? 1 : 0;

  const typeSignal = EVENT_TYPE_WEIGHTS[moment.eventType] ?? DEFAULT_EVENT_TYPE_WEIGHT;

  const coverageSignal = Math.min(moment.coverage, COVERAGE_CAP) / COVERAGE_CAP;

  // v1: pins have no storage yet (pinned_at is v1.1). Weight stays reserved so
  // the tuning ratios of the other signals hold when pins arrive.
  const pinSignal = 0;

  let bump = 0;
  if (ctx.viewerBirthDate) {
    const age = ageAtEvent(moment.eventDate, ctx.viewerBirthDate);
    if (age !== null && age >= REMINISCENCE_BUMP_MIN_AGE && age <= REMINISCENCE_BUMP_MAX_AGE) {
      bump = REMINISCENCE_BUMP_BONUS;
    }
  }

  return (
    weights.memoriam * memoriamSignal +
    weights.recurrence * recurrenceSignal +
    weights.people * peopleSignal +
    weights.eventType * typeSignal +
    weights.coverage * coverageSignal +
    weights.pin * pinSignal +
    bump
  );
}

/**
 * Deterministic ordering: significance desc → capturedAt desc (newer first)
 * → id asc. Stable across recomputes so the flash/reel never reshuffle
 * between renders of the same data.
 */
export function sortBySignificance<T extends ScoredMoment>(moments: T[]): T[] {
  return [...moments].sort(
    (a, b) =>
      b.significance - a.significance ||
      b.capturedAt.localeCompare(a.capturedAt) ||
      a.id.localeCompare(b.id),
  );
}

/** Score + order a set of moments in one pass. */
export function scoreMoments(
  moments: Moment[],
  ctx: ScoreContext,
  weights: SignificanceWeights = SIGNIFICANCE_WEIGHTS,
): ScoredMoment[] {
  return sortBySignificance(
    moments.map((m) => ({ ...m, significance: scoreMoment(m, ctx, weights) })),
  );
}
