/**
 * explore-event-type-scope.ts — which event type /explore is scoped to, and
 * how a person gets OUT of that scope.
 *
 * ─── THE DEFECT THIS EXISTS TO FIX ───────────────────────────────────────
 * A signed-in couple whose celebration is not a wedding had their event type
 * auto-applied to the marketplace. With two active services on the whole
 * platform — both tagged wedding — that means zero cards and a "COMING SOON"
 * panel. Fine so far; the empty state offers a way out:
 *
 *     Or browse all vendors instead →   href="/explore"
 *
 * 🔑 THAT LINK WAS THE TRIGGER. The auto-apply fires on `!filters.eventType`,
 * and the escape works by **dropping** `event_type` from the URL — which is
 * precisely the condition that re-applies it. Following it reproduces the
 * identical empty page, forever. The comment above the block says the link
 * "drops the event_type from the URL" as though that were the solution; it is
 * the mechanism of the bug.
 *
 * Verified against production: adding `?event_type=wedding` by hand restores
 * the cards, proving the auto-apply is what empties the page.
 *
 * ⚖ SO "NO FILTER" AND "I ASKED FOR EVERYTHING" MUST STOP BEING THE SAME
 * STATE. An absent parameter means *"I have not chosen"* — scope me to my
 * celebration. `?event_type=all` means *"I chose everything"* — and a choice
 * has to be expressible, or the escape hatch is a loop.
 */

/** The sentinel that means "I asked for the whole marketplace". */
export const BROWSE_ALL_EVENT_TYPES = 'all';

export type ExploreScope = {
  /** The type to filter on, or null for the whole marketplace. */
  eventType: string | null;
  /** True when the person explicitly asked for everything. */
  browseAll: boolean;
};

/**
 * Resolve the scope from the URL alone.
 *
 * 🔴 2026-11-16 (owner, "Fix them too" — walk EB-062/069/073): the couple's own event type NO LONGER scopes Discover.
 * It used to be auto-applied whenever `?event_type=` was absent, so a Get-together couple who picked "Florists" got
 * "Florists · Get-together", "Clear all filters" could not remove it (clearing the parameter IS the absent state),
 * and searching "flower" found no florists. A filter now applies only when the address names it: picking a
 * category adds only that category, and Clear all clears every filter.
 *
 * @param urlEventType   raw `?event_type=` (already shape-checked upstream)
 * @param knownTypes     the ACTIVE vocab keys — an unknown type is not a filter
 */
export function resolveExploreScope(
  urlEventType: string | null | undefined,
  knownTypes: ReadonlySet<string>,
): ExploreScope {
  const raw = (urlEventType ?? '').trim().toLowerCase();

  // 1 · An explicit "everything" (the old escape link's sentinel — still honoured, now the same as no filter).
  if (raw === BROWSE_ALL_EVENT_TYPES) return { eventType: null, browseAll: true };

  // 2 · An explicit, known type.
  if (raw && knownTypes.has(raw)) return { eventType: raw, browseAll: false };

  // 3 · Nothing chosen, or a type that is not in the vocab: the whole marketplace.
  return { eventType: null, browseAll: false };
}

/**
 * The href for "browse all vendors instead".
 *
 * ⚠ NEVER a bare `/explore`. That is the URL that started this.
 */
export function browseAllVendorsHref(focusedMode: boolean): string {
  return focusedMode
    ? `/explore?event_type=${BROWSE_ALL_EVENT_TYPES}&from=plan`
    : `/explore?event_type=${BROWSE_ALL_EVENT_TYPES}`;
}
