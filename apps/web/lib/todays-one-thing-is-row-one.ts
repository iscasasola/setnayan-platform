/**
 * TODAY'S ONE THING IS ROW ①, NOT A SECOND CARD — safely.
 *
 * Owner-approved 2026-09-22. The Overview rendered the resolver's #1 pick
 * TWICE: as a gold-hairlined "Today's one thing" tile below the top grid, and
 * again as a row on the Decisions board. Measured live the same day, that made
 * "Lock your coordinator" the third rendering of one task on one page.
 *
 * They are the same task BY CONSTRUCTION, not by coincidence:
 * `buildCockpitModel` receives `topPriorityTask` and builds its `start`
 * decision straight from it — `id: \`start:${topPriorityTask.id}\``.
 *
 * ── 🔑 WHY THIS IS A FUNCTION AND NOT "JUST MARK ROW 1" ─────────────────────
 * The board does not always contain it. Two branches in the cockpit can leave
 * the resolver's pick with no row of its own:
 *
 *   · the group already has saved options, so it surfaces as `pick:<id>`
 *     instead of `start:<id>` — same group, different framing; and
 *   · the group has an OUTSTANDING ASK (the couple asked, the supplier has not
 *     answered). That branch adds the group to `decidedGroupIds` and pushes NO
 *     decision at all, so nothing on the board represents it.
 *
 * Folding the tile away unconditionally would, in that third case, delete
 * today's one thing from the page. So this resolves the row FIRST and the
 * caller keeps the standalone tile whenever the answer is null. Nothing can be
 * lost by the fold; at worst the page looks exactly as it did before.
 */

export type RowLike = { id: string };
export type GroupLike<R extends RowLike> = { items: ReadonlyArray<R> };

/**
 * The board row that IS today's one thing, or null when the board does not
 * carry it.
 *
 * Cockpit decision ids are `<kind>:<planGroupId>`; `topPriorityTask.id` is the
 * plan-group id. Only the two kinds that can stand for a booking task are
 * accepted — a `pay` or `role` row that happened to share a suffix is not this
 * task, and matching it would promote the wrong row.
 */
export function findTodaysOneThingRowId<R extends RowLike>(
  groups: ReadonlyArray<GroupLike<R>>,
  topPriorityTaskId: string | null | undefined,
): string | null {
  if (!topPriorityTaskId) return null;
  const wanted = [`start:${topPriorityTaskId}`, `pick:${topPriorityTaskId}`];
  for (const g of groups) {
    for (const item of g.items) {
      if (wanted.includes(item.id)) return item.id;
    }
  }
  return null;
}
