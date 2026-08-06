/**
 * lib/ugat/data-pure.ts — the pure, DB-free helpers used by the Ugat data layer.
 *
 * Split out of lib/ugat/data.ts (which is `server-only`) so the ranking logic
 * is unit-testable in the node test runner without pulling the server client.
 * It is also the ONLY Ugat module a `'use client'` component may import a VALUE
 * from — `data.ts` cannot be, and doing so fails the production build.
 */

/**
 * The Ugat console's entity tables — ONE list, and the type derives from it.
 *
 * 🔴 There used to be three hand-typed copies of these nine keys: the type
 * union, `TABLE_META` in ugat-console.tsx (which renders the tabs), and
 * `VALID_TABLES` in ugat/actions.ts (which authorises the fetch).
 * **`VALID_TABLES` had eight.** `communities` was missing, so the Samahan tab
 * rendered, and clicking it threw `Unknown table` — or left the previous
 * table's rows sitting under the Samahan heading, which is worse, because it
 * looks like data.
 *
 * A runtime tuple is the fix: the type is now DERIVED from the array, so adding
 * a table in one place is the only way to add it at all. Two lists that must
 * agree eventually disagree — this repo has paid for that with a status
 * vocabulary spelled 15 times under 6 names, and a ceremony list that reached
 * the database and not the schedule.
 *
 * 🔑 It lives HERE, not in `data.ts`, because the tabs are rendered by a
 * `'use client'` component. A value imported from a `server-only` module is a
 * build failure that no local typecheck or unit test can see — `tsc` is not a
 * bundler, so CI was the only thing that caught it. `lint-server-only-boundary`
 * now catches it in seconds instead.
 */
export const UGAT_TABLE_KEYS = [
  'users',
  'events',
  'guests',
  'vendors',
  'services',
  'orders',
  'threads',
  'billing',
  'communities',
] as const;

export type UgatTableKey = (typeof UGAT_TABLE_KEYS)[number];

/**
 * Pure ranking helper for the ⌘K omnibox — higher is better. Exact
 * (case-insensitive) match wins, then prefix, then contained, then per-token
 * overlap. Deterministic + side-effect free so search ordering is testable.
 */
export function scoreUgatMatch(haystack: string, query: string): number {
  const h = haystack.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q || !h) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 70;
  if (h.includes(q)) return 45;
  let s = 0;
  for (const tok of q.split(/\s+/).filter((t) => t.length > 1)) {
    if (h.includes(tok)) s += 8;
  }
  return s;
}
