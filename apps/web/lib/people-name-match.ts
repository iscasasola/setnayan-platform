/**
 * people-name-match.ts — does somebody on YOUR People list match what was typed?
 *
 * ONE matcher for the two places that ask it: the People page's thumb-row field
 * (typing filters the list — `people-roster-view.tsx`) and the shell's search,
 * whose People section lists the people on your list by the same words
 * (`lib/shell-people-search.ts`, owner 2026-10-22). Two copies would let the
 * search show "Ana" while the list it opens filters her away.
 *
 * It matches names you can already see (the roster's names come through
 * `visible_connection_names`, the one door for them) — it is not a way to find
 * strangers; that is `searchPeopleByName`, with its own fence.
 */
import { normalizeSearchText } from '@/lib/guest-search';

/** The typed words, normalised once. Empty → matches nothing (the caller decides what "no words" shows). */
export function rosterQuery(typed: string): string {
  return normalizeSearchText(typed.trim());
}

/** Whether a roster name contains the (already normalised) query. */
export function rosterNameMatches(name: string, normalisedQuery: string): boolean {
  if (!normalisedQuery) return false;
  return normalizeSearchText(name).includes(normalisedQuery);
}
