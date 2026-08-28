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
 * function name. `createTaxonomyNode` — the job the owner's own sentence asks
 * for — sat at index 123 and was ALREADY CUT; `createCanonicalLeaf` sat at
 * 116, four new admin pages away from going the same way.
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
import { jobNameFromAskHref } from './humanize-field';
import { jobPrefillIsRead } from './prefill-consumers';

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
 * How much a candidate that can actually DELIVER a filled form is worth,
 * measured in shared words.
 *
 * ── WHY CAPABILITY BELONGS IN THE RANKING ───────────────────────────────────
 * Word overlap alone is blind to whether a candidate can help. Measured on the
 * shipped data for the owner's sentence — *"add a new category on the taxonomy
 * service"* — the tokens are `add · new · category · taxonomy · service`, and:
 *
 *     createTaxonomyNode   1 hit  ("Create taxonomy node")   ← what he asked for
 *     createCanonicalLeaf  1 hit  ("Create canonical leaf")
 *     setCategoryIcon      2 hits ("Set category icon")
 *     …12 more at 2 hits, every one of them prefill-INCAPABLE
 *
 * The two jobs that open a form already filled in score ONE, because the
 * generated label for a category says *node* — the internal word — while the
 * thirteen that can only drop him on the page carry the literal word he typed.
 * So pure overlap ranked **13 candidates that cannot help above the two that
 * can**, and ranking by relevance alone made that worse rather than better: it
 * promoted ten of them past the flagship job that used to sit above them.
 *
 * 🔑 IT IS A NUDGE, NOT A VETO. One shared word — exactly enough to settle a
 * near-tie between candidates on the same surface, never enough to lift an
 * irrelevant job over a genuinely better match several words ahead. The
 * incapable candidates are still offered; they are just no longer offered
 * FIRST when something that can finish the job is sitting behind them.
 *
 * 🔒 AND IT IS GATED ON `hits > 0`, WHICH IS WHAT KEEPS IT SAFE. A capable job
 * that shares no word with the question earns nothing, so a neutral question
 * still returns the list exactly as it arrived. Without that gate this becomes
 * a second, invisible opinion about what the box offers for every query.
 */
export const PREFILL_CAPABILITY_BONUS = 1;

/**
 * Does this candidate's destination read the answers back?
 *
 * Pages are never capable — they have no job marker and no form to fill — so
 * this is only ever true for a job the registry has wired.
 */
export function choiceIsPrefillCapable(choice: ModelChoice): boolean {
  const name = jobNameFromAskHref(choice.href);
  return name !== null && jobPrefillIsRead(name);
}

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
      // Capability counts only once the candidate is already relevant — see
      // PREFILL_CAPABILITY_BONUS for why the `hits > 0` gate is load-bearing.
      const capable = hits > 0 && choiceIsPrefillCapable(choice);
      return { choice, index, hits, capable, score: hits + (capable ? PREFILL_CAPABILITY_BONUS : 0) };
    })
    // Score, then capability, then the original position. The capability key
    // is NOT redundant with the bonus: two candidates can reach the same score
    // from different sides (a capable one at 1 hit and an incapable one at 2),
    // and without it the tie falls back to alphabetical position — which is
    // the very thing this file exists to stop deciding what the box offers.
    .sort((a, b) => b.score - a.score || Number(b.capable) - Number(a.capable) || a.index - b.index)
    .slice(0, cap)
    .map((scored) => scored.choice);
}
