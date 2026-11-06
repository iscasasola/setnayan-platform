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
 * Renders "Suppliers, stories, guides" for the current list. Drop a noun from
 * the list and the words drop with it, in the same commit, with no second place
 * to remember.
 *
 * 📏 IT MUST FIT THE NARROWEST PHONE (live check 2026-10-23). It read "Search
 * suppliers, stories and guides" and was cut to "…and guid" at 375 px: on a
 * touch screen the box's input is 16 px (below that iOS zooms in on focus), and
 * at 16 px that sentence needs ~262 px while the box holds 255 at 375 and 200 at
 * 320. "Suppliers, stories, guides" needs ~182. The verb is carried by the
 * magnifier button and the box's own `aria-label` ("Search Setnayan"), so the
 * words are only the promise — what comes back. Held by
 * `lib/the-search-placeholder-fits-a-phone.test.ts` (it carries the
 * re-measure steps).
 */
export function publicSearchPlaceholder(): string {
  const nouns = [...PUBLIC_SEARCH_NOUNS];
  if (nouns.length === 0) return 'Search Setnayan';
  const words = nouns.join(', ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
