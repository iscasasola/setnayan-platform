import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { AskOutcome, HelpCoverage } from '@/lib/help-ask-core';

/**
 * THE HELP'S OWN LOG — `public.help_asks` (migration 20271350667658). What people asked, which account's help, web or
 * app, and what it found; no name, no email, no user id. Service-role only (RLS on, no policy, grants revoked).
 *
 *   write  every ask a person PRESSES (never a page render) and every Yes / No press — one row per words + account +
 *          outcome per hour;
 *   read   the team's "No answer yet" (closest · near · none · No — most-asked first). (The 13 Nov "People ask" chips
 *          and their reader went with the Guide & Help drawing, approved 21 Nov 2026: "Start here guides take their place".)
 *
 * A write never throws and never blocks the page: losing one log row must not cost a person their answer.
 * A read says when it failed (`failed: true`) — "No answer yet" with nothing in it and "the list did not load" must
 * never draw the same.
 */

export type HelpAskCoverage = HelpCoverage | 'team';
export type HelpAskOutcome = AskOutcome | 'yes' | 'no';

/** Outcomes that put a question on the team's "No answer yet" list. */
export const NO_ANSWER_YET_OUTCOMES: ReadonlyArray<HelpAskOutcome> = ['closest', 'near', 'none', 'no'];

/** The words as stored: trimmed, one space, lower case, at most 120 characters. */
export function normalizeAskWords(words: string): string {
  return words.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
}

/** One row per words + account + outcome per this window. */
export const ASK_BUCKET_MS = 60 * 60 * 1000;

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
    const admin = createAdminClient();
    // 🔒 BOUNDED: at most ONE row per words + account + outcome per hour. A repeat inside the hour adds nothing, so a
    // loop of the same ask cannot fill the table (prod is on the free plan). The outcome is in the key so a "Yes" /
    // "No" press still lands after the ask it answers. A failed check skips the write — losing a log row is cheaper
    // than an unbounded insert. (Guard: lib/help-asks-are-written-only-when-asked.test.ts.)
    const since = new Date(Date.now() - ASK_BUCKET_MS).toISOString();
    const { data: seen, error: seenError } = await admin
      .from('help_asks')
      .select('ask_id')
      .eq('words', words)
      .eq('coverage', row.coverage)
      .eq('outcome', row.outcome)
      .gte('created_at', since)
      .limit(1);
    if (seenError) {
      logQueryError('logHelpAsk (help_asks bucket check)', seenError);
      return;
    }
    if ((seen ?? []).length > 0) return;
    const { error } = await admin
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

type AskRow = { words: string; coverage: HelpAskCoverage; outcome: HelpAskOutcome; created_at: string; article_slug?: string | null };

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

async function readRows(filter: { coverage?: HelpAskCoverage; outcomes: ReadonlyArray<HelpAskOutcome> }): Promise<{ rows: AskRow[]; failed: boolean }> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    let q = createAdminClient()
      .from('help_asks')
      .select('words, coverage, outcome, created_at, article_slug')
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
