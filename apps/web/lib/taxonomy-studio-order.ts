/**
 * taxonomy-studio-order.ts — the PURE (no I/O, no Next imports) reorder logic
 * behind the Taxonomy Studio's drag-to-reorder. Kept client-safe + unit-testable
 * so the `reorderCategories` server action AND the node:test suite both import
 * the exact same validation + diff, instead of the action re-deriving it inline
 * where a test can't reach it.
 *
 * Two responsibilities:
 *   • validateReorder — the set the client sent must be EXACTLY the parent's
 *     current children (a permutation): no adds, no drops, no dupes. A drag can
 *     only shuffle — never invent or lose a tile — so a mismatched set is a bug
 *     or a tampered POST and must be rejected, never partially applied.
 *   • computeReorder — turn the accepted order into the minimal set of
 *     `{ id, sort_order }` writes (only the tiles whose position actually
 *     changed), so a drop that moves one card doesn't rewrite all N rows.
 */

export type ReorderValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * The `ordered` set must be a permutation of `current` — same members, no
 * duplicates, same length. Order is what differs; membership must not.
 */
export function validateReorder(current: string[], ordered: string[]): ReorderValidation {
  if (ordered.length === 0) {
    return { ok: false, reason: 'Empty order.' };
  }
  const dupe = new Set<string>();
  for (const id of ordered) {
    if (dupe.has(id)) return { ok: false, reason: `Duplicate id "${id}".` };
    dupe.add(id);
  }
  if (ordered.length !== current.length) {
    return { ok: false, reason: 'Order length does not match the folder’s children.' };
  }
  const currentSet = new Set(current);
  for (const id of ordered) {
    if (!currentSet.has(id)) {
      return { ok: false, reason: `"${id}" is not a child of this folder.` };
    }
  }
  return { ok: true };
}

/**
 * Given the accepted new order, return only the rows whose sort_order changes.
 * sort_order is a dense 0..n-1 index of the new position; a row already at its
 * target index is skipped so we never issue a no-op UPDATE. `current` supplies
 * the existing sort_order per id (defaults to its current index when absent).
 */
export function computeReorder(
  ordered: string[],
  currentSort: Record<string, number>,
): Array<{ id: string; sort_order: number }> {
  const writes: Array<{ id: string; sort_order: number }> = [];
  ordered.forEach((id, idx) => {
    if (currentSort[id] !== idx) writes.push({ id, sort_order: idx });
  });
  return writes;
}
