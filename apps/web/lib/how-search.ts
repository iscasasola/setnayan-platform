import 'server-only';

import type { HelpRole } from '@/lib/help';
import { isStoreShellRequest } from '@/lib/request-platform';
import { searchReadsWithStatus } from '@/lib/site-search';
import { composeHowSearch, HOW_SEARCH_LIMIT, type HowHit } from '@/lib/how-search-core';
import { HELP_TOPICS } from '@/lib/help';
import { askHelp, askTopicsFor, topicsForCoverage, type AskResult, type HelpCoverage } from '@/lib/help-ask-core';

/**
 * The /help · /features search, with its IO: which reader this is (the iPhone
 * app answers in its own words) and the guides + stories read. The matching
 * and the ranking are `lib/how-search-core.ts`.
 *
 * ⚠ HONEST ABOUT A FAILED READ. Help answers and feature pages live in code and
 * cannot fail; the stories are a database read. A failed story read costs the
 * stories only — and `storiesFailed` travels to the page, so "nothing matched"
 * is never printed over a read that broke.
 */
export async function runHowSearch(
  query: string,
  opts: { role?: HelpRole; coverage?: HelpCoverage } = {},
): Promise<{ hits: HowHit[]; storiesFailed: boolean; ask: AskResult | null; storeShell: boolean }> {
  const storeShell = await isStoreShellRequest();
  // Read wide, then drop its help hits (the help kind answers those) before the cap.
  const { hits: reads, storiesFailed } = await searchReadsWithStatus(query, HOW_SEARCH_LIMIT * 4);
  return {
    hits: composeHowSearch({ query, storeShell, role: opts.role, reads }),
    storiesFailed,
    // ❓ ASK FIRST (/help, 13 Nov 2026): the help answers, ranked for a QUESTION — the app's words, Taglish, typos,
    // a floor — inside the active account's coverage only (lib/help-ask-core.ts). Features and guides stay this
    // search's own rows.
    ask: opts.coverage ? askHelp(query, askTopicsFor(topicsForCoverage(HELP_TOPICS, opts.coverage), storeShell)) : null,
    storeShell,
  };
}
