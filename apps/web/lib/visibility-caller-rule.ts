/**
 * visibility-caller-rule.ts — does this file ASK the one visibility predicate,
 * or spell the rule out itself?
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * `lib/vendor-visibility.ts` already holds the rule — `PUBLIC_SURFACE_VISIBILITIES`,
 * `isPubliclyVisible`, `isShopLive`. The problem was never a missing predicate.
 * It was that a caller can write `.eq('public_visibility', 'verified')` by hand,
 * get the SAME ANSWER today, and therefore never fail — right up until the rule
 * learns a second condition, at which point that caller keeps answering the old
 * question and nothing anywhere goes red.
 *
 * That is the shape the owner asked about on 2026-09-23: a supplier who owes a
 * settled fee should vanish from every public find-me surface. The moment that
 * condition exists, every hand-spelled filter becomes a hole — a shop gone from
 * search and still reachable, or still linked from a story.
 *
 * ─── IT ASSERTS A PROPERTY, NOT A PHRASING ───────────────────────────────
 * The tempting guard forbids the literal `'verified'`. That fails in both
 * directions: it misses `.eq('public_visibility', someConst)` and it convicts a
 * file that mentions the word in prose. This asks the question that actually
 * matters — *does the decision come from the one module?* — by looking for a
 * query-shaped filter on the column and then for an import of the predicate.
 *
 * ⚠ IT IS DELIBERATELY NOT A CLASSIFIER OF INTENT. Plenty of callers SHOULD
 * filter on this column without the public gate: the admin console legitimately
 * lists hidden shops, the fraud runner and the Ugat map count every row whatever
 * its state. This rule cannot tell those apart from a public surface that simply
 * forgot, and it does not try. It reports who spells it themselves; a human
 * decides which of those is correct, and records that decision in the baseline.
 */

/** What a file does about `public_visibility`. */
export type VisibilityCallerVerdict =
  /** No query-shaped filter on the column — nothing to say about it. */
  | 'not-a-caller'
  /** Filters on the column AND imports the shared predicate. */
  | 'asks'
  /** Filters on the column and does not import the predicate. */
  | 'spells-it-itself';

/**
 * A query-shaped filter on the column.
 *
 * Matches the PostgREST builder forms this codebase actually uses —
 * `.eq('public_visibility', …)`, `.in('public_visibility', …)`, `.neq(…)` — and
 * the `or()` string form `public_visibility.neq.verified`.
 *
 * ⚠ It deliberately does NOT match a bare mention of the column: a `.select()`
 * list naming it, a TypeScript field, or prose in a comment. Those read the
 * value; they do not decide with it, and convicting them would train the next
 * reader to add exemptions rather than think.
 */
const FILTERS_ON_COLUMN =
  /\.(?:eq|in|neq|not|filter)\(\s*['"]public_visibility['"]|public_visibility\.(?:eq|neq|in)\./;

/** Imports anything from the one module that owns the rule. */
const IMPORTS_PREDICATE = /from\s+['"](?:@\/lib\/vendor-visibility|\.\.?\/[^'"]*vendor-visibility)['"]/;

export function visibilityCallerVerdict(source: string): VisibilityCallerVerdict {
  if (!FILTERS_ON_COLUMN.test(source)) return 'not-a-caller';
  return IMPORTS_PREDICATE.test(source) ? 'asks' : 'spells-it-itself';
}

/**
 * The baseline's own format: one path per line, `#` comments ignored, blank
 * lines ignored. Kept here rather than in the test so the parser is executable
 * on its own — a baseline file that silently parses to the empty set is the
 * classic way a guard passes while checking nothing.
 */
export function parseBaseline(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter((l) => l.length > 0);
}
