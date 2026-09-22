/**
 * TWO COUNTS, TWO NAMES — and neither of them is "open".
 *
 * A couple meets two different numbers wearing one word. Measured on
 * `origin/main` 2026-09-22:
 *
 *   · the Overview's book group     → "23 categories still open"
 *   · the Overview's digest tile    → "4 open decisions"
 *   · the Your Team page            → "27" (…and 23 more to decide)
 *
 * ── THESE ARE NOT THE SAME QUESTION, AND MAKING THEM AGREE WOULD DELETE ONE ──
 * The Overview's category count excludes the 12 plan groups carrying
 * `countsTowardLockable: false` and is scoped by event type. Your Team's
 * `stillNeedsDecision()` counts a different set — groups that are engaged or
 * inside their action window, minus locked, minus covered. Both are correct
 * answers to different questions. The defect is the shared word, so the fix is
 * naming, not a reconciliation: a resolver merge would silently destroy one of
 * two working measures.
 *
 * ── WHY THE WORDS LIVE HERE AND NOT AT THE THREE RENDER SITES ───────────────
 * ⚠ THE OWNER HAS NOT APPROVED THIS WORDING. The controller did, on his behalf,
 * while he was asked only to start the wave. So the words are in ONE place that
 * every surface reads, and changing them costs a string rather than a refactor
 * across two pages. If he wants "still to book" or "waiting on you", that is an
 * edit to the template below and nothing else.
 *
 * ── THE DENOMINATOR IS THE SAFETY ──────────────────────────────────────────
 * "23 categories not booked" is still ambiguous — 23 of what? "23 of 25" is
 * not, and it is what makes this rename safe rather than merely different: the
 * reader can see the set being counted instead of inferring it.
 */

/**
 * The Overview's bookable-category count.
 *
 * `lockable` is the denominator AFTER the event-type scope and the
 * `countsTowardLockable: false` exclusions — i.e. the set this number is drawn
 * from. Showing it is the point; a bare numerator is the thing being fixed.
 */
export function notBookedLabel(notBooked: number, lockable: number): string {
  const n = Math.max(0, Math.trunc(notBooked));
  const total = Math.max(0, Math.trunc(lockable));
  if (n === 0) return total === 0 ? 'Nothing to book' : `All ${total} categories booked`;
  /*
    No denominator is better than a wrong one, and there are TWO ways to have a
    wrong one. A zero total means the event-type scope could not be resolved.
    A total BELOW the numerator means the two numbers were counted over
    different sets — they are computed by different expressions in different
    files (see the test's "numerator and denominator" case), and the existing
    `Math.max(0, total - remaining)` clamp beside them is the codebase already
    conceding that mismatch is expressible. Neither may reach a couple as
    "27 of 25": the count is still true, so it is shown without the set.
  */
  if (total <= 0 || total < n) return `${n} ${n === 1 ? 'category' : 'categories'} not booked`;
  /*
    ⚠ THE NOUN AGREES WITH THE DENOMINATOR, NOT THE NUMERATOR. The first cut
    pluralised on `n` and rendered "1 of 25 category not booked" — the test
    below caught it on its first run. In "1 of 25 categories", the noun belongs
    to the set being drawn from, which is exactly the thing this label exists to
    show. Adding the denominator moved the agreement, and nothing in the old
    wording could have warned about it.
  */
  return `${n} of ${total} ${total === 1 ? 'category' : 'categories'} not booked`;
}

/**
 * The Overview's digest count — cockpit decisions plus payments.
 *
 * It said "open decisions", which is the SAME word the category count used for
 * a different set two inches away. The section's own heading ("Decisions
 * waiting on you") and the tile's eyebrow ("Needs you this week") already
 * supply the urgency, so the count states the noun and stops.
 */
export function decisionsCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return 'Nothing waiting';
  return n === 1 ? '1 decision' : `${n} decisions`;
}

/**
 * The same noun, without the number, for the one surface that renders its
 * figure separately (the digest tile animates the number in its own element).
 *
 * ⚠ IT EXISTS SO NOBODY STRIPS THE NUMBER BACK OFF. The first cut of this
 * called `decisionsCountLabel` and removed the leading digits with a regex —
 * which works until a label starts with a word, as the zero case already does
 * ("Nothing waiting"), and then silently renders the whole sentence.
 */
export function decisionsCountNoun(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return 'nothing waiting';
  return n === 1 ? 'decision' : 'decisions';
}

/**
 * Your Team's count — groups engaged or inside their action window, minus
 * locked, minus covered.
 *
 * Exported from here, unused by the Overview, so that page can import the
 * wording rather than spell it. That is the whole mechanism: one edit, both
 * surfaces. Your Team's slice 4 removes "Decide next" and needs this name to
 * exist, or a couple is left with one number and nothing saying which set it
 * counts.
 */
export function needsDecisionLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return 'Nothing needs a decision';
  return n === 1 ? '1 needs a decision' : `${n} need a decision`;
}

/**
 * The word this rename exists to remove, named once so a guard can assert the
 * property — "no surface calls its count "open"" — instead of pattern-matching
 * a sentence. A guard pinned to a literal string is how the stale ₱499 upsell
 * is still protected by four assertions across two tests.
 */
export const BANNED_COUNT_WORD = 'open';

/** True when a rendered count label leans on the ambiguous word. */
export function labelUsesBannedWord(label: string): boolean {
  return new RegExp(`\\b${BANNED_COUNT_WORD}\\b`, 'i').test(label);
}
