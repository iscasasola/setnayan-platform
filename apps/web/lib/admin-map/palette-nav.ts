/**
 * palette-nav.ts — what the admin search box offers, and in what ORDER.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
 * All of this used to live inside `admin-command-palette.tsx`, which is a
 * `'use client'` React component and therefore cannot be imported by a
 * node:test file. So its guard re-declared `MIN_SENTENCE_TOKENS = 3` locally
 * and re-derived the rule beside it.
 *
 * 🪤 THAT GUARD WAS DECORATION, AND IT WAS MEASURED: changing the palette's
 * real threshold to 6 — which silently breaks the owner's own flagship
 * sentence, five words long — left the suite at `# pass 4 # fail 0`. Its
 * fourth test grepped the source for `searchTokens(q).length >=
 * MIN_SENTENCE_TOKENS`, which matches the IDENTIFIER and can never see the
 * NUMBER. **A test that keeps its own copy of the value it is pinning is
 * pinning its own copy.**
 *
 * Everything below is pure and importable, so the guard executes the shipped
 * rule instead of describing it.
 */

import { searchTokens } from '@/lib/search-stop-words';

/**
 * How many real words make a query "a sentence describing a task" rather than
 * "a couple of words naming a thing".
 *
 * Two content words is exactly what "papic pricing" and "vendor payouts" are —
 * ordinary lookups that must NOT grow an assistant offer beside their answer.
 * `MIN_SHARED_WORDS` in match-job.ts draws the same 2-vs-more line one layer
 * down.
 *
 * ⚠ THE OWNER'S FLAGSHIP SENTENCE TOKENISES TO FIVE WORDS, so this has very
 * little headroom upward: at 6 the feature silently stops existing for the
 * exact query it was built for. `palette-nav.test.ts` pins both directions.
 */
export const MIN_SENTENCE_TOKENS = 3;

/** Enough words to be describing a task. */
export function isSentenceShaped(query: string): boolean {
  return searchTokens(query).length >= MIN_SENTENCE_TOKENS;
}

/**
 * Should the box offer to hand this question to the assistant?
 *
 * Only when (a) a deterministic job has NOT already answered it — a real job
 * match is strictly better and needs no model — and (b) the query reads as a
 * task. The page hits being non-empty is what made the original bug invisible:
 * "add a new category on the taxonomy service" always finds the Taxonomy page,
 * because "taxonomy" is a literal page name, so a gate on "nothing matched"
 * could never fire for the one case it existed to bridge.
 */
export function shouldOfferAssistant(args: {
  hitCount: number;
  jobHitCount: number;
  query: string;
}): boolean {
  return args.hitCount > 0 && args.jobHitCount === 0 && isSentenceShaped(args.query);
}

export type PaletteNavRow<T, R = never> =
  | { kind: 'ask' }
  | { kind: 'dest'; dest: T }
  /**
   * A found RECORD — a guest, a shop, a celebration, an account. Last in the
   * list on purpose: the box's headline job is still navigation, and a record
   * must never outrank the page you were reaching for.
   */
  | { kind: 'record'; record: R };

/**
 * The rows the keyboard walks, IN THE ORDER THEY RENDER.
 *
 * 🔑 THE ASK ROW IS FIRST, WHICH MAKES IT DEFAULT-SELECTED — the palette resets
 * its selection to 0 on every keystroke. That is the product call: a person who
 * typed a sentence described a task, nothing matched deterministically, and the
 * page is one arrow press away. Reversing it is one line — move the ask row to
 * the end of this array — and nothing else has to change.
 *
 * 🔒 IDENTICAL FOR EVERY ORDINARY LOOKUP. When `offerAsk` is false and no
 * record matched, this returns exactly `hits`, so short noun-shaped queries
 * keep today's indices, today's highlight and today's Enter target.
 *
 * 🔑 RECORDS JOIN THIS LIST RATHER THAN SITTING BESIDE IT, and that is the
 * whole reason they are here at all. Rendering them as their own block below
 * would leave them in neither the arrow-key ring nor the Enter path — which is
 * EXACTLY the defect this file was split out to fix, when the assistant offer
 * was visible on screen and unreachable by the only gesture the owner uses.
 * One list for the ring, for Enter and for the renderer, or it happens again.
 */
export function buildNavRows<T, R = never>(
  offerAsk: boolean,
  hits: readonly T[],
  records: readonly R[] = [],
): PaletteNavRow<T, R>[] {
  return [
    ...(offerAsk ? [{ kind: 'ask' as const }] : []),
    ...hits.map((dest) => ({ kind: 'dest' as const, dest })),
    ...records.map((record) => ({ kind: 'record' as const, record })),
  ];
}

/**
 * How far page hit `i` is pushed down the nav list — DERIVED FROM THE ROWS.
 *
 * 🔑 THE HIGHLIGHT AND THE THING ENTER OPENS ARE TWO READINGS OF ONE LIST, and
 * the palette computes the second one as `i + offset`. An offset kept as its
 * own literal is a second opinion about the same fact: get it wrong and every
 * page row paints its highlight one place away from the row Enter actually
 * opens — the palette's own comment calls that "its own live bug", and nothing
 * executed it.
 *
 * Counting the non-destination rows makes the two impossible to disagree, and
 * `the highlighted row is the row Enter opens` in the escape-hatch guard walks
 * every hit through it rather than asserting the number 1.
 *
 * 🪤 IT COUNTS ONLY THE ROWS **BEFORE** THE HITS, AND IT HAS TO. This used to
 * be `rows.filter(kind !== 'dest').length` — every non-destination row,
 * wherever it sat. That was correct while the ask row was the only one and it
 * was always first. Record rows are appended AFTER the hits, so the old count
 * added them to the offset too: the box would have shipped with every page row
 * highlighting N places away from the row Enter opened, the exact bug this
 * function's own docblock says it exists to make unwritable — reintroduced by
 * adding a row somewhere else entirely. Leading-count, never total-count.
 */
export function hitOffsetOf<T, R = never>(rows: readonly PaletteNavRow<T, R>[]): number {
  const firstDest = rows.findIndex((row) => row.kind === 'dest');
  // No destinations at all ⇒ the offset indexes nothing. Returning the leading
  // count keeps it equal to the old behaviour for that case.
  return firstDest === -1 ? rows.filter((row) => row.kind !== 'dest').length : firstDest;
}
