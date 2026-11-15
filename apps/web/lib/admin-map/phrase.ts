/**
 * How a typed phrase is stored and looked up in `admin_search_phrases` — lowercased, whitespace collapsed.
 *
 * Its own client-safe module because BOTH the server (`ask-the-admin.ts`, `search-memory/actions.ts`) and the ⌘K box
 * (`palette-rank.ts`, a client file) must normalise a phrase the same way: if they disagreed, a pick the box taught
 * could never be found again by the box. `ask-the-admin.ts` re-exports this — one definition.
 */
export function normalisePhrase(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}
