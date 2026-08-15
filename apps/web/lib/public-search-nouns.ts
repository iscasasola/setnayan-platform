// The public search box's PROMISE, in one place — and the thing its mechanism
// is checked against.
//
// ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
// The box on every public doorway read "Search suppliers, stories and guides"
// while its form went to the supplier marketplace and nothing else. Measured
// 2026-08-15: /explore?q=doves answered "No vendors match exactly" while
// /blog/release-of-doves-filipino-wedding was live and indexed. Two of the
// three nouns had never been connected to anything.
//
// 🔑 THE WORDS ARE NOW DERIVED FROM THE LIST, NOT TYPED BESIDE IT. A guard
// that compares two hand-typed strings is not a guard — this repo has paid for
// that lesson twice (the llms.txt drift, the doorway palette). So the
// placeholder is BUILT from PUBLIC_SEARCH_NOUNS, and `site-search.ts` declares
// which nouns it actually resolves. `site-search.test.ts` fails when a noun is
// promised with no source behind it, which is exactly the state this file was
// written to end.
//
// ⚠ NEUTRAL BY DESIGN — no 'server-only'. The placeholder is read by the
// 'use client' shell; the resolvers are server-side. A value exported from a
// server-only module cannot cross into a client component, and a value
// exported from a 'use client' module arrives at a Server Component as a
// client-reference proxy rather than the real value (the RSC value-export
// gotcha `stories-search-config.ts` already documents). This module is
// importable from both, which is why the shared constant lives here and not
// beside either consumer.

/** One noun the public search box promises. Adding one here changes the words. */
export type PublicSearchNoun = 'suppliers' | 'stories' | 'guides';

/**
 * What the box claims to search, in the order the placeholder reads them.
 *
 * ⚠ THIS IS A PROMISE TO A STRANGER, NOT A CONFIG. Every entry must have a
 * resolver — the marketplace query for `suppliers`, a source in
 * `site-search.ts` for the rest. Adding a noun with nothing behind it
 * recreates the original defect and the test will refuse it.
 */
export const PUBLIC_SEARCH_NOUNS: ReadonlyArray<PublicSearchNoun> = [
  'suppliers',
  'stories',
  'guides',
];

/**
 * The placeholder, built from the promise.
 *
 * Renders "Search suppliers, stories and guides" for the current list — the
 * exact string that shipped, so this change moves no pixels. Drop a noun from
 * the list and the words drop with it, in the same commit, with no second
 * place to remember.
 */
export function publicSearchPlaceholder(): string {
  const nouns = [...PUBLIC_SEARCH_NOUNS];
  if (nouns.length === 0) return 'Search Setnayan';
  if (nouns.length === 1) return `Search ${nouns[0]}`;
  const last = nouns.pop() as PublicSearchNoun;
  return `Search ${nouns.join(', ')} and ${last}`;
}
