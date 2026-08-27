/**
 * rank-choices.ts — choose WHICH candidates the assistant gets to see, by
 * relevance to the question, never by where they happened to sort.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────
 * `ask-actions.ts` handed the model `choices.slice(0, 120)` over a list built
 * as `[...pages, ...jobs]`. Measured on the shipped data, not estimated:
 *
 *     86 page choices + 185 form-driven jobs = 271 combined
 *     slice(0, 120)  →  34 jobs survive, 151 (82%) never reach the model
 *
 * The cut fell in the middle of the JOBS, alphabetically, so which tasks the
 * assistant could offer a form for was decided by the first letter of the
 * function name. `createTaxonomyNode` sat at index 123 and was ALREADY CUT;
 * `createCanonicalLeaf` — the job behind the box's own flagship example — sat
 * at 116, four new admin pages away from going the same way.
 *
 * Worse where it matters most: of the 43 form-driven jobs on the taxonomy
 * surface, **37 sat beyond the cut**. The single most job-dense page in the
 * console was the one the assistant could least often help with.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Rank first, slice second. A candidate earns its place by sharing words with
 * the question — matched against its label AND its href, because the href
 * carries the surface's own name ("/admin/taxonomy" is how a taxonomy job
 * proves it is about taxonomy when its function name does not say so).
 *
 * 🔑 THE TIE-BREAK IS THE ORIGINAL POSITION, WHICH IS WHAT MAKES THIS SAFE.
 * A question that shares no words with anything leaves the list exactly as it
 * was, so this can only ever PROMOTE a relevant candidate — it never reorders
 * the neutral case out from under the answers the box already gives.
 *
 * ⚠ THE CAP IS 140 AND THAT NUMBER IS MEASURED, NOT ROUNDED. At 120 the
 * ranking pulls all 43 taxonomy jobs in and pushes **14 of the 86 pages out** —
 * trading a job-lookup fix for a page-lookup regression. 140 is the first cap
 * that holds every page AND leaves real room for jobs: measured, 86 pages + 54
 * jobs. ~140 lines of "name → address" is a few thousand tokens, fractions of
 * a centavo, and only on the rare question the free word matching could not
 * answer at all.
 */

import { searchTokens } from '@/lib/search-stop-words';

/**
 * How many candidates the model is shown. See the docblock — 140 is the
 * smallest cap that keeps every admin page in the list.
 *
 * 🔑 EXPORTED SO A GUARD CAN PIN THE REAL VALUE. The test that checks jobs are
 * never severed imports THIS constant; it does not keep its own copy, which is
 * exactly how the previous guard in this feature came to pass while the thing
 * it guarded was broken.
 */
export const MODEL_CHOICE_CAP = 140;

export type ModelChoice = { label: string; href: string };

/**
 * The best `cap` candidates for this question, most relevant first.
 *
 * Pure and total: no I/O, no model, no admin session — so it can be executed
 * by a test over the real shipped choice list rather than inspected as source.
 */
export function rankChoicesForModel<T extends ModelChoice>(
  choices: readonly T[],
  query: string,
  cap: number = MODEL_CHOICE_CAP,
): T[] {
  if (cap <= 0) return [];
  const tokens = searchTokens(query.trim().toLowerCase());
  if (tokens.length === 0) return choices.slice(0, cap);

  return choices
    .map((choice, index) => {
      // Label AND href: a job's function name often says nothing about the
      // surface it lives on, while its address always does.
      const hay = `${choice.label} ${choice.href}`.toLowerCase();
      let hits = 0;
      for (const token of tokens) if (hay.includes(token)) hits += 1;
      return { choice, index, hits };
    })
    .sort((a, b) => b.hits - a.hits || a.index - b.index)
    .slice(0, cap)
    .map((scored) => scored.choice);
}
