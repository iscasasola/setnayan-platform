/**
 * lib/ugat/data-pure.ts — the pure, DB-free helpers used by the Ugat data layer.
 *
 * Split out of lib/ugat/data.ts (which is `server-only`) so the ranking logic
 * is unit-testable in the node test runner without pulling the server client.
 */

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
