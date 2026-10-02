/**
 * event-type-scope.ts — the one rule for "offer / hide a category for ONE
 * event type" (`service_categories.applicable_event_types`).
 *
 * Pure, so the event type panel's action (setTileEventTypeOffered /
 * setFolderEventTypeOffered in app/admin/categories/event-type-actions.ts) and
 * the tests run the same code. Moved out of that 'use server' file on
 * 2026-10-02, unchanged, because a server-action module may export only async
 * functions.
 */

/**
 * Compute the next `applicable_event_types` for a tile when toggling ONE type's
 * membership. `applicable_event_types` is an ALLOW-list (NULL/empty = universal,
 * serves all); there is no "deny" — hiding a universal tile materializes "all
 * active types except T". Always sanitizes to active keys so the write passes
 * the validation trigger, and normalizes "covers every active type" → NULL so a
 * fully-offered tile reverts to the clean universal state.
 */
export function nextEventTypes(
  current: string[] | null,
  type: string,
  offered: boolean,
  activeTypes: string[],
): string[] | null {
  const activeSet = new Set(activeTypes);
  const curActive = (current ?? []).filter((t) => activeSet.has(t));
  const universal = curActive.length === 0;

  if (offered) {
    if (universal) return null; // already serves all → stays universal
    const set = new Set(curActive);
    set.add(type);
    if (activeTypes.every((t) => set.has(t))) return null; // now covers all → universal
    return [...set];
  }
  // hide T
  if (universal) return activeTypes.filter((t) => t !== type);
  const next = curActive.filter((t) => t !== type);
  // Degenerate: removing T would empty the list (= universal = serves T again).
  // Materialize "all except T" instead so T stays hidden.
  return next.length === 0 ? activeTypes.filter((t) => t !== type) : next;
}
