import 'server-only';

import { getPeopleRoster } from '@/lib/people-roster';
import { readPeopleByName } from '@/lib/people-search';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { shellPeopleResults, type ShellPeopleResults } from '@/lib/shell-people-results';

/**
 * shell-people-search.ts — the People half of the shell's search.
 *
 * Owner, 22 Oct 2026 ("follow your recommendation"): the shell's search — "search
 * the place you're standing in" (DECISION_LOG 2026-09-23), whose Discover field
 * reads "Search events, people, suppliers" — includes PEOPLE, and a person
 * result opens that person's card on the People page.
 *
 * 🔒 NOTHING NEW DECIDES WHO MAY BE FOUND. Two shipped reads, each with its own
 * fence, and no third:
 *   · YOUR PEOPLE — `getPeopleRoster`, whose names come only through
 *     `visible_connection_names` (the one door for a connection's name), matched
 *     by the People page's own field matcher (`rosterNameMatches`);
 *   · ON SETNAYAN — `readPeopleByName`, i.e. `searchPeopleByName` (the 2026-09-23
 *     row: "The top bar calls `searchPeopleByName`; it does not learn how to
 *     match names") — its five refusals, its four fields, never an email.
 * Both are skipped when connections are switched off, exactly as the People page
 * shows no roster then.
 *
 * 🔴 A REFUSED READ IS NOT AN EMPTY ANSWER. Either read failing marks the section
 * `unavailable`, and the results page says it could not search people — never
 * "nothing", which would tell somebody with forty connections that nobody matched.
 */
export async function searchShellPeople(query: string, viewerUserId: string): Promise<ShellPeopleResults | null> {
  if (!peopleConnectionsEnabled()) return null;
  const [roster, found] = await Promise.all([
    getPeopleRoster(viewerUserId).catch(() => null),
    readPeopleByName(query, viewerUserId).catch(() => ({ hits: [], failed: true })),
  ]);
  return shellPeopleResults({ query, roster, found });
}
