/**
 * 🔖 SAVED SUPPLIERS GO FIRST IN LINE — but only when they can actually do the event.
 *
 * Owner, 20 Nov 2026 (DECISION_LOG): *"saved makes them show first when they find supplier"* → *"make them first in
 * line to show"* → *"they show if they match the requirements of the place. you are within the are and you are
 * available on that date."*
 *
 * So, in an event's supplier lists (Find's categories, an open category, and the category search), a supplier SAVED to
 * that event goes ahead of every other supplier only when BOTH are known true:
 *   (a) the venue is inside the supplier's reach — the shipped reach read (`resolveReachBadge` on the bench, the
 *       search's `withinRadius` with a known distance), and
 *   (b) the supplier is free on the event's date — the shipped date fit (`dateFit === 'free'` on the bench, the
 *       search's calendar check when the event has a date to judge).
 * Unknown is NOT true: a saved supplier whose reach or calendar cannot be read gets no special place and keeps the
 * normal order. This file holds only the rule; the reads stay where they already are (one batched read per screen).
 *
 * 🔒 lib/saved-first.test.ts
 */

export type SavedFirstFacts = {
  /** On this event's list (an `event_vendors` row). */
  saved: boolean;
  /** The venue is inside the supplier's reach. null = unknown. */
  inReach: boolean | null | undefined;
  /** Free on the event's date. null = unknown (no date, no calendar, a failed read). */
  freeOnDate: boolean | null | undefined;
};

/** True only when the supplier is saved AND both checks are known to pass. */
export function savedGoesFirst(f: SavedFirstFacts): boolean {
  return f.saved === true && f.inReach === true && f.freeOnDate === true;
}

/**
 * A stable partition: the rows that qualify move to the front in the order they already had; every other row keeps
 * its place in the normal order behind them. Never re-sorts either half.
 *
 * `staysFirst` — rows that already lead and must keep leading. On the bench that is the ★ Chosen (locked) card: the
 * 2026-09-06 "hoist it" ruling (`bench-sort.ts` `hoistLocked`) puts it first, and saved-first never pushes it down
 * (controller ruling 20 Nov: Chosen → saved → the rest). Those rows are left out of the partition and kept ahead.
 */
export function savedFirst<T>(
  rows: readonly T[],
  qualifies: (row: T) => boolean,
  staysFirst?: (row: T) => boolean,
): T[] {
  const kept: T[] = [];
  const first: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (staysFirst?.(r) ? kept : qualifies(r) ? first : rest).push(r);
  return first.length === 0 ? [...rows] : [...kept, ...first, ...rest];
}
