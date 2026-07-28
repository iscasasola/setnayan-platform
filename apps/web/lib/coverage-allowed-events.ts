/**
 * coverage-allowed-events.ts — the ONE definition of "which event-type chips may
 * render for this coverage leaf".
 *
 * Why this exists (2026-07-28 adversarial review, inherited shipped gap): the
 * coverage CREATE flow filtered its chips to the leaf's `allowedEventTypes`
 * ("Only the events this category can serve are shown"), but the serves EDIT
 * sheet — and the canvas maker's audience sheet — rendered the FULL vocab. The
 * server (`parseEventTypes` in coverage-actions.ts) enforces the allowed set
 * either way, so a vendor could check "Corporate" on a restricted leaf, save,
 * see `?saved=1`, and the key was silently dropped — success reported, nothing
 * persisted, and re-opening just shows the chip unchecked with no explanation.
 *
 * Both surfaces now render through these helpers, so the chips a vendor can
 * touch are exactly the keys the server will keep.
 *
 * The rule (identical to the server's `parseEventTypes` and the create flow):
 * `allowed` null or EMPTY = no restriction — every vocab option renders.
 */

/** Options that may render as chips: the vocab intersected with the allowed set. */
export function allowedEventOptions<T extends { key: string }>(
  options: ReadonlyArray<T>,
  allowed: ReadonlyArray<string> | null | undefined,
): T[] {
  if (!allowed || allowed.length === 0) return [...options];
  const allow = new Set(allowed);
  return options.filter((o) => allow.has(o.key));
}

/**
 * Keys the coverage currently CARRIES that the server would drop on the next
 * save (the admin narrowed the leaf's allowed set after the row was saved).
 * The UI cannot preserve them — no chip may render for them, and the server
 * filters them out — so the honest move is to SAY so before the vendor saves,
 * instead of the silent strip this module exists to end.
 */
export function droppedEventTypes(
  current: ReadonlyArray<string>,
  allowed: ReadonlyArray<string> | null | undefined,
): string[] {
  if (!allowed || allowed.length === 0) return [];
  const allow = new Set(allowed);
  return current.filter((k) => !allow.has(k));
}

/** True when the allowed set actually restricts the vocab (drives the note). */
export function isRestricted(
  optionCount: number,
  renderedCount: number,
): boolean {
  return renderedCount < optionCount;
}
