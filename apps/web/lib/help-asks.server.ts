import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { AskOutcome, HelpCoverage } from '@/lib/help-ask-core';

/**
 * THE HELP'S OWN LOG — `public.help_asks` (migration 20271344889246). What people asked, which account's help, web or
 * app, and what it found; no name, no email, no user id. Service-role only (RLS on, no policy, grants revoked).
 *
 *   write  every ask (so "People ask" can count the questions that found an answer) and every Yes / No press;
 *   read   the team's "No answer yet" (closest · near · none · No — most-asked first) and the "People ask" chips.
 *
 * A write never throws and never blocks the page: losing one log row must not cost a person their answer.
 * A read says when it failed (`failed: true`) — "No answer yet" with nothing in it and "the list did not load" must
 * never draw the same.
 */

export type HelpAskCoverage = HelpCoverage | 'team';
export type HelpAskOutcome = AskOutcome | 'yes' | 'no';

/** Outcomes that put a question on the team's "No answer yet" list. */
export const NO_ANSWER_YET_OUTCOMES: ReadonlyArray<HelpAskOutcome> = ['closest', 'near', 'none', 'no'];
/** Outcomes that count a question as answered (the "People ask" chips). */
const ANSWERED_OUTCOMES: ReadonlyArray<HelpAskOutcome> = ['best', 'yes'];

/** The words as stored: trimmed, one space, lower case, at most 120 characters. */
export function normalizeAskWords(words: string): string {
  return words.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
}

export async function logHelpAsk(row: {
  words: string;
  coverage: HelpAskCoverage;
  surface: 'web' | 'app';
  outcome: HelpAskOutcome;
  articleSlug?: string | null;
}): Promise<void> {
  const words = normalizeAskWords(row.words);
  if (!words) return;
  try {
    const { error } = await createAdminClient()
      .from('help_asks')
      .insert({
        words,
        coverage: row.coverage,
        surface: row.surface,
        outcome: row.outcome,
        article_slug: row.articleSlug ? row.articleSlug.slice(0, 120) : null,
      });
    if (error) logQueryError('logHelpAsk (help_asks)', error);
  } catch (e) {
    logQueryError('logHelpAsk (help_asks)', e as Error);
  }
}

/** How far back the counts look, and how many rows one read takes at most. */
const WINDOW_DAYS = 90;
const READ_CAP = 3000;

type AskRow = { words: string; coverage: HelpAskCoverage; outcome: HelpAskOutcome; created_at: string };

export type NoAnswerYetRow = {
  words: string;
  coverage: HelpAskCoverage;
  /** How many times it was asked (or answered No) in the window. */
  asked: number;
  /** The weakest thing it got: none → near → closest; a No on a shown answer reads as `no`. */
  outcome: HelpAskOutcome;
  lastAt: string;
};

const WEAKEST: HelpAskOutcome[] = ['none', 'no', 'near', 'closest'];

/** Group rows by (words, coverage), most-asked first, then most recent. Pure — the test reads it. */
export function groupNoAnswerYet(rows: ReadonlyArray<AskRow>, limit = 50): NoAnswerYetRow[] {
  const by = new Map<string, NoAnswerYetRow>();
  for (const r of rows) {
    if (!NO_ANSWER_YET_OUTCOMES.includes(r.outcome)) continue;
    const key = `${r.coverage}\u0000${r.words}`;
    const had = by.get(key);
    if (!had) {
      by.set(key, { words: r.words, coverage: r.coverage, asked: 1, outcome: r.outcome, lastAt: r.created_at });
      continue;
    }
    had.asked += 1;
    if (WEAKEST.indexOf(r.outcome) < WEAKEST.indexOf(had.outcome)) had.outcome = r.outcome;
    if (r.created_at > had.lastAt) had.lastAt = r.created_at;
  }
  return [...by.values()].sort((a, b) => b.asked - a.asked || b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
}

/** The questions most asked in this account's help that DID find an answer — at least twice, so one person is not "people". */
export function groupPeopleAsk(rows: ReadonlyArray<AskRow>, coverage: HelpAskCoverage, limit = 3): string[] {
  const count = new Map<string, number>();
  for (const r of rows) {
    if (r.coverage !== coverage || !ANSWERED_OUTCOMES.includes(r.outcome)) continue;
    count.set(r.words, (count.get(r.words) ?? 0) + 1);
  }
  return [...count.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

async function readRows(filter: { coverage?: HelpAskCoverage; outcomes: ReadonlyArray<HelpAskOutcome> }): Promise<{ rows: AskRow[]; failed: boolean }> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    let q = createAdminClient()
      .from('help_asks')
      .select('words, coverage, outcome, created_at')
      .gte('created_at', since)
      .in('outcome', [...filter.outcomes])
      .order('created_at', { ascending: false })
      .limit(READ_CAP);
    if (filter.coverage) q = q.eq('coverage', filter.coverage);
    const { data, error } = await q;
    if (error) {
      logQueryError('readHelpAsks (help_asks)', error);
      return { rows: [], failed: true };
    }
    return { rows: (data ?? []) as AskRow[], failed: false };
  } catch (e) {
    logQueryError('readHelpAsks (help_asks)', e as Error);
    return { rows: [], failed: true };
  }
}

/** The team's "No answer yet" list. */
export async function readNoAnswerYet(limit = 50): Promise<{ rows: NoAnswerYetRow[]; failed: boolean }> {
  const { rows, failed } = await readRows({ outcomes: NO_ANSWER_YET_OUTCOMES });
  return { rows: groupNoAnswerYet(rows, limit), failed };
}

/** The "People ask" chips for this account's help. A failed read draws no chips (they are a shortcut, not a fact). */
export async function readPeopleAsk(coverage: HelpAskCoverage, limit = 3): Promise<string[]> {
  const { rows } = await readRows({ coverage, outcomes: ANSWERED_OUTCOMES });
  return groupPeopleAsk(rows, coverage, limit);
}
