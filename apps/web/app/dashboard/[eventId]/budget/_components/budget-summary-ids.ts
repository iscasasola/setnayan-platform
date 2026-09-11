/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/

/**
 * The DOM id `BudgetTopSummary` (page.tsx) sets on its `<header>` — the
 * element with no border of its own. BA4: the pinned condensed bar below
 * measures THIS box, never the outer `.sn-tile` card, because that card's
 * rect includes its 1px border and every measurement drawn from it drifts a
 * pixel off the real content edge.
 */
export const BUDGET_TOP_SUMMARY_HEADER_ID = 'budget-top-summary-header';
