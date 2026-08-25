/**
 * search-stop-words.ts — the ONE list of words a search query drops, and the
 * ONE way a query becomes words.
 *
 * ── WHY IT IS ITS OWN FILE ──────────────────────────────────────────────────
 * This list and this splitter were written for the public site search and live
 * in `lib/site-search-core.ts`. The admin command palette needs exactly the same
 * two things — and it CANNOT import that module: its first two lines pull in
 * `@/lib/blog` and `@/lib/help`, so importing it into a `'use client'` palette
 * would drag the whole article and help-article corpora into the admin bundle.
 *
 * 🔑 THE ANSWER IS A LEAF, NOT A COPY. A second hand-typed stop list is the
 * exact failure this repo has already paid for twice — two vocabularies that
 * drifted apart until a surface became unreachable. site-search-core now imports
 * from here, so there is one list with two readers, and a word added for the
 * admin is a word the public search drops too.
 */

/**
 * Function words that carry no destination.
 *
 * ⚠ THE NAVIGATION VERBS ARE DELIBERATELY ABSENT — "take", "show", "find",
 * "open", "go". They read like filler in *"take me to the pricing"*, and they
 * are also words the admin's own pages use: `take ownership` is a real job on
 * Force majeure, and dropping the verb would make that page unfindable by the
 * only word that distinguishes it. Measured before deciding: "take" appears in
 * 5 destinations, "show" in 7. A filler word that is also a page's word is not
 * filler. They survive as ordinary low-value tokens instead, which costs
 * nothing — an unmatched token is simply reported as unknown.
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'get', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'so', 'that', 'the',
  'their', 'them', 'then', 'there', 'they', 'this', 'to', 'up', 'we', 'what',
  'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
]);

/**
 * Split a query into the tokens a document must actually contain.
 *
 * Single characters are dropped: a stray letter matches almost every document
 * and would turn one keystroke into a page of noise. 🪤 Mutation-proved on the
 * public search and again here — without the 2-character minimum, "what's
 * pending" splits to [what, s] and a bare `s` prefix-matches every page whose
 * name starts with S.
 *
 * ⚠ IF THE QUERY IS *ONLY* FUNCTION WORDS, THEY ARE KEPT. Someone searching
 * "the one" means those words; stripping them would leave nothing and silently
 * turn a real query into an empty one — the same "returns nothing, explains
 * nothing" shape this whole change exists to remove.
 */
export function searchTokens(query: string): string[] {
  const all = query
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const content = all.filter((t) => !STOP_WORDS.has(t));
  return content.length > 0 ? content : all;
}
