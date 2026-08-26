/**
 * match-job.ts — does this sentence want a PAGE, or a JOB the box can prepare?
 *
 * The search box already answers "where is X" by ranking pages (`rank-by-
 * sentence.ts` over `admin-destinations.ts`). This ranks the same sentence
 * against `admin-jobs.generated.ts` instead, so the box can also recognise
 * "create canonical leaf" or "add leaf attribute option" as a JOB with fields
 * to gather, not merely a page to open.
 *
 * 🔑 ONLY FORM-DRIVEN JOBS ARE OFFERED. A job with no `fields` has nothing to
 * ask about — pressing its own button on its own page is exactly as fast as
 * anything this file could prepare, so those are left to ordinary page search.
 *
 * ⚠ THE WORD GAP IS REAL AND NOT PRETENDED AWAY. `phraseFor()` turns
 * `createCanonicalLeaf` into "create canonical leaf" — the CODE's words, not
 * the OWNER's ("add a category"). This is deliberately a COVERAGE match, not
 * a substring one: a single shared filler word like "add" is not evidence — 43
 * jobs start with it — so a hit needs at least two shared, non-filler words
 * AND most of what was typed. That still cannot bridge every gap ("add a
 * category" and `addExpense`'s own `category` field share two real words and
 * would tie) — closing THAT gap is the assistant's job
 * (`ask-the-admin.ts`), which is handed these same jobs as extra choices, so a
 * semantic match still lands here once and is remembered for free after.
 */

import type { AdminJob } from './scan-admin-jobs';
import { searchTokens } from '@/lib/search-stop-words';
import { humanizeFieldLabel } from './humanize-field';

export type JobHay = {
  job: AdminJob;
  label: string;
  hayTokens: ReadonlySet<string>;
};

/** `createCanonicalLeaf` → "Create canonical leaf" — the phrase stays visible
 *  so the admin can see WHY this job was offered. */
export function jobDisplayLabel(job: AdminJob): string {
  return job.phrase.charAt(0).toUpperCase() + job.phrase.slice(1);
}

/** Only jobs with something to ask about — see the file docblock. */
export function formDrivenJobs(jobs: readonly AdminJob[]): JobHay[] {
  return jobs
    .filter((j) => j.fields.length > 0)
    .map((job) => ({
      job,
      label: jobDisplayLabel(job),
      hayTokens: new Set(
        `${job.phrase} ${job.fields.map(humanizeFieldLabel).join(' ')}`
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean),
      ),
    }));
}

export type JobMatch = { job: AdminJob; label: string };

/** A hit needs real evidence, not one borrowed filler word. */
const MIN_SHARED_WORDS = 2;
const MIN_COVERAGE = 0.6;

/** Best few jobs for a sentence, best first. Empty when the sentence does not
 *  share enough of the job's own words — see the file docblock for what this
 *  cannot bridge, and why that is the assistant's job, not this file's. */
export function matchJobs(jobs: readonly AdminJob[], query: string, limit = 3): JobMatch[] {
  const tokens = searchTokens(query.trim().toLowerCase());
  if (tokens.length === 0) return [];

  const scored = formDrivenJobs(jobs)
    .map((item) => {
      const shared = tokens.filter((t) => item.hayTokens.has(t) || [...item.hayTokens].some((h) => h.includes(t)));
      return { item, hits: shared.length, coverage: shared.length / tokens.length };
    })
    // 🪤 `Math.min(MIN_SHARED_WORDS, tokens.length)` DEGRADES ON A ONE-WORD
    // QUERY — "add" alone has tokens.length===1, so the floor would drop to
    // 1 and "add" (the phrase every "add*" job starts with) would crown one
    // of them by coverage 1.0. The floor stays fixed at MIN_SHARED_WORDS
    // regardless of how short the query is: a one-word query simply cannot
    // reach it, which is correct — a bare verb is not evidence for a job.
    .filter((s) => s.hits >= MIN_SHARED_WORDS && s.coverage >= MIN_COVERAGE);

  scored.sort(
    (a, b) => b.coverage - a.coverage || b.hits - a.hits || a.item.label.localeCompare(b.item.label),
  );

  return scored.slice(0, limit).map((s) => ({ job: s.item.job, label: s.item.label }));
}
