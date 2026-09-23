/**
 * command-match.ts — the ONE way a typed query is matched against the index.
 *
 * ─── 🔴 WHY THIS EXISTS: THE TWO FILTERS HAD ALREADY DRIFTED ─────────────
 * The palette dropdown and the results page each filtered the same index with
 * their own copy of the rule, and the copies were not the same. The dropdown
 * matched `label + sublabel + KIND_LABEL[kind]`; the results page matched
 * `label + sublabel`. So typing "event" listed your events in the dropdown and
 * returned ZERO of them when you pressed Enter — measured live on
 * www.setnayan.com 2026-09-23: `?q=event` → 21 results, none of them the
 * searcher's own.
 *
 * Directly above the results page's copy sat this comment:
 *
 *   "Filtered exactly as the palette filters them — the same fields, the same
 *    lowercase includes — so pressing Enter can never show fewer of your own
 *    things than the dropdown you pressed Enter from."
 *
 * 🔑 THE COMMENT DESCRIBED AN INTENTION THE CODE BESIDE IT DID NOT IMPLEMENT,
 * and nothing could notice, because each half passed its own tests. Two
 * mechanisms that disagree about one fact are each green. So the rule now
 * lives in ONE function that both call, and the intention is enforced by a
 * test that runs the real filter over the real shapes rather than by a
 * sentence promising they are identical.
 *
 * ⚠ NEUTRAL, AND STRUCTURALLY TYPED ON PURPOSE. `HomeCommandItem` is exported
 * from a `'use client'` module; importing its VALUES into a server component
 * yields a client-reference proxy rather than the real value (the RSC gotcha
 * `public-search-nouns.ts` documents). Matching on a minimal structural type
 * means this module imports nothing from either side, so there is no cycle and
 * no boundary to get wrong — `HomeCommandItem` satisfies it by shape.
 */

/** The fields matching reads. Anything with these fields can be matched. */
export type MatchableItem = {
  label: string;
  sublabel: string;
  kind: 'event' | 'space' | 'action';
  /**
   * Extra searchable words that are NEVER RENDERED.
   *
   * 🔑 THE INDEX MUST NOT BE BUILT FROM THE RENDERING. An event's subtitle
   * shows its type through `eventTypeBadge`, which translates `wedding` to
   * "KASAL" — so searching the subtitle searched the TRANSLATION, and typing
   * the English word could not find your own wedding (measured 2026-09-23:
   * `?q=wedding` → 0 of the owner's, `?q=kasal` → both). A badge is a display
   * decision; renaming one silently changed what a person could find, with
   * nothing to notice. This field carries the words the DATA has.
   */
  terms?: string;
};

/**
 * How a `kind` reads to a person typing. Part of the haystack, so "event"
 * finds your events and "space" finds your shop and Samahan.
 *
 * ⚠ ONE COPY. This used to live in the palette, which is why the results page
 * — which could not import from a `'use client'` module without dragging the
 * whole component across the boundary — went without it and silently matched
 * less.
 */
export const KIND_LABEL: Record<MatchableItem['kind'], string> = {
  event: 'Event',
  space: 'Space',
  action: 'Go to',
};

/** Everything one row can be matched on, lowercased once. */
export function commandHaystack(item: MatchableItem): string {
  return `${item.label} ${item.sublabel} ${KIND_LABEL[item.kind]} ${item.terms ?? ''}`.toLowerCase();
}

/**
 * Does this row answer this query?
 *
 * A trimmed, lowercased substring test — deliberately the shipped behaviour,
 * not an improvement. Ranking, stemming and typo tolerance are a different
 * change with a different risk, and folding them in here would mean the fix
 * for a measured divergence could not be reviewed on its own.
 *
 * An EMPTY query matches everything: a palette nobody has typed into shows the
 * list, it does not blank.
 */
export function matchesCommandQuery(item: MatchableItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return commandHaystack(item).includes(q);
}
