/**
 * 🧠 THE ⌘K BOX'S WHOLE ANSWER, AS ONE PURE FUNCTION (ASK-BRAIN, owner 14 Nov 2026).
 *
 * Owner, verbatim: *"we still need a fully comprehensive database for the search bar to be able to simulate all the
 * possible text i will place and to produce the most accurate output. create a brain that also learns"*.
 *
 * `rankPalette` is what the box draws, in order, for what was typed:
 *   1. **You picked this before** — the place this exact phrase was last taken to by an admin (`admin_search_phrases`,
 *      written by the box itself through the existing `teachSearchPhraseAction`). The owner's own choice outranks
 *      everything; a different pick un-teaches it (`learnPick`), and "Forget this" deletes it.
 *   2. **Recommended** — one action read off the keyword table (`ask-keywords.ts`) when the sentence carries a verb and
 *      a noun: "Add a service → Catalogue › Categories". It opens a page or prepares a form; it never performs.
 *   3. **The page** that recommendation lives on, then the ranker's other pages (`rankBySentence`), then records.
 *
 * The SAME function is run by the phrase-bank simulator (`ask-phrase-bank.test.ts`) over every generated phrase, so
 * the accuracy it measures is the accuracy of the shipped box — no copy of the scorer, no copy of the order.
 *
 * Pure: no I/O, no React, no model. Client-safe (the palette is a client component).
 */

import type { AdminJob } from './scan-admin-jobs';
import { rankBySentence } from './rank-by-sentence';
import { matchJobs, type JobMatch } from './match-job';
import { paletteScore } from './palette-score';
import { normalisePhrase } from './phrase';
import {
  ASK_VERBS,
  contentWords,
  intentOf,
  normaliseAskQuery,
  recommendAction,
  tableKnowsWord,
  type AskDest,
  type AskRecommendation,
} from './ask-keywords';
import { jobDisplayLabel } from './match-job';
import { samePlace } from './ask-phrase-bank';
import type { AdminRoute } from './scan-admin-routes';

/** One remembered pick: this phrase → that place. Nothing else is ever stored. */
export type LearnedPick = { phrase: string; href: string; label: string; timesUsed: number };

export type PaletteRanking<D extends AskDest> = {
  /** The query every part of the box read (misspellings mended). */
  query: string;
  /** The place an admin picked for this exact phrase before, when it is still a place the box offers. */
  learned: (LearnedPick & { dest: D | null }) | null;
  recommendation: AskRecommendation<D> | null;
  /** Pages, in the order the box draws them — the learned place and the recommended page moved to the front. */
  hits: D[];
  unknown: string[];
  jobHits: JobMatch[];
  /** Where the FIRST row goes — what Enter opens. `null` when nothing matched. */
  firstHref: string | null;
};

/** Pages drawn on screen per query (unchanged from before). */
export const PALETTE_HIT_LIMIT = 30;

const sameWords = (a: readonly string[], b: readonly string[]) =>
  a.length > 0 && a.length === b.length && a.every((w) => b.includes(w)) && b.every((w) => a.includes(w));

/**
 * The sentence IS a job's own words ("create expense" = "add expense", "approve payment from work list"): that job, on
 * the page it lives on. Its verb must agree with the sentence's when both have one. Two jobs on different pages that
 * both match are a question, not an answer.
 */
export function jobBySentence<D extends AskDest>(
  query: string,
  dests: readonly D[],
  jobs: readonly AdminJob[],
  routes: readonly AdminRoute[],
): AskRecommendation<D> | null {
  const said = contentWords(query);
  if (said.length === 0) return null;
  const intent = intentOf(query);
  const found: { job: AdminJob; page: D }[] = [];
  for (const job of jobs) {
    if (!sameWords(said, contentWords(job.phrase))) continue;
    const jobIntent = ASK_VERBS[job.phrase.split(' ')[0] ?? ''];
    if (intent && jobIntent && intent !== jobIntent) continue;
    const page = dests.find((d) => d.source !== 'row' && samePlace(d.href, job.resolvedPath, routes));
    if (page) found.push({ job, page });
  }
  if (found.length === 0) return null;
  if (found.some((f) => f.page !== found[0]!.page)) return null;
  const { job, page } = found[0]!;
  return { intent, place: null, say: jobDisplayLabel(job), page, row: null, job, href: page.href };
}

/** The sentence, once its verbs and filler are gone, is a page's whole name ("open today", "where is id documents"). */
export function pageBySentence<D extends AskDest>(query: string, dests: readonly D[]): D | null {
  const said = contentWords(query).join(' ');
  if (!said) return null;
  return (
    dests.find(
      (d) =>
        d.source === 'menu' &&
        d.label.toLowerCase().replace(/[^a-z0-9 -]+/g, ' ').replace(/\s+/g, ' ').trim() === said,
    ) ?? null
  );
}

export function rankPalette<D extends AskDest>(
  all: readonly D[],
  typed: string,
  jobs: readonly AdminJob[],
  routes: readonly AdminRoute[],
  learnedPicks: readonly LearnedPick[] = [],
): PaletteRanking<D> {
  const query = normaliseAskQuery(typed);
  const { hits: ranked, unknown: unread } = rankBySentence(all, query, paletteScore, PALETTE_HIT_LIMIT);
  // A word the keyword table understands ("gawa", "presyo") is not "a word no page has".
  const unknown = unread.filter((w) => !tableKnowsWord(w));
  const jobHits = matchJobs(jobs, query, 3);
  // A job's own words first, then the keyword table.
  const recommendation = query.trim()
    ? (jobBySentence(query, all, jobs, routes) ?? recommendAction(query, all, jobs))
    : null;
  // No recommendation, but the sentence names a page outright → that page leads.
  const pageNamed = recommendation ? null : pageBySentence(query, all);

  const phrase = normalisePhrase(typed);
  const pick = phrase.length >= 2 ? learnedPicks.find((p) => p.phrase === phrase) : undefined;
  const learnedDest = pick ? (all.find((d) => d.href === pick.href) ?? null) : null;
  // A remembered place the box no longer offers (a page that moved) is not put first — it is simply not used.
  const learned = pick && learnedDest ? { ...pick, dest: learnedDest } : null;

  const front: D[] = [];
  if (learnedDest) front.push(learnedDest);
  if (recommendation && !front.includes(recommendation.page) && all.includes(recommendation.page)) {
    front.push(recommendation.page);
  }
  if (pageNamed && !front.includes(pageNamed)) front.push(pageNamed);
  const hits = [...front, ...ranked.filter((d) => !front.includes(d) && d !== recommendation?.row)].slice(
    0,
    PALETTE_HIT_LIMIT,
  );

  const firstHref = learned ? learned.href : recommendation ? recommendation.href : (hits[0]?.href ?? null);
  return { query, learned, recommendation, hits, unknown, jobHits, firstHref };
}

/**
 * How one pick changes what is remembered — "most-used wins" on the ONE row the table keeps per phrase:
 *   · the same place again → its count goes up;
 *   · a different place, while the remembered one has been used more than once → the remembered count goes DOWN
 *     (one wrong pick does not erase a habit);
 *   · a different place, once the remembered one is down to one use → the phrase now means the new place.
 * Pure, so the rule is tested without a database; `teachSearchPhraseAction` applies exactly this.
 */
export function learnPick(
  existing: { href: string; timesUsed: number } | null,
  pickedHref: string,
): { href: string; timesUsed: number; replaced: boolean } {
  if (!existing) return { href: pickedHref, timesUsed: 1, replaced: true };
  if (existing.href === pickedHref) return { href: existing.href, timesUsed: existing.timesUsed + 1, replaced: false };
  if (existing.timesUsed > 1) return { href: existing.href, timesUsed: existing.timesUsed - 1, replaced: false };
  return { href: pickedHref, timesUsed: 1, replaced: true };
}
