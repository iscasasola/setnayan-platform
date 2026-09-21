/**
 * A DATE IS NOT A DECISION — the split, as a pure function.
 *
 * Owner-approved 2026-09-22. Measured on the live Overview the same day
 * (event 044f7e64): the board said **"9 open decisions"**. Six of the nine were
 * recommended deadlines and scheduled blocks — rows nobody resolves by reading
 * them. Four things actually needed the couple.
 *
 * 🔑 THE PAGE WAS ALREADY DISAGREEING WITH ITSELF. Two inches above the "9",
 * the Sai briefing said "2 decisions need you" — it counts `cockpitModel.decisions`,
 * which never included payments or dates. One screen, two counts of the same
 * noun, neither wrong on its own terms.
 *
 * ── WHY THIS IS A FILE AND NOT FOUR LINES INSIDE THE COMPONENT ──────────────
 * `event-dashboard.tsx` is a 3,000-line `server-only` React server component; a
 * test cannot import it, so anything decided in there can only ever be guarded
 * by grepping its source. The regression that matters is one line —
 * `groupsUnordered.push(deadlineGroup)` — putting the dates back among the
 * decisions. Split here, that line cannot be written: the dates never reach the
 * board array in the first place, and this file's test EXECUTES the rule instead
 * of pattern-matching it.
 *
 * NOTHING IS HIDDEN. `datesGroup` comes back out of this function and the page
 * renders it under its own heading, with the same rows, ids and links.
 */

/** The shape both the board and the dates block are made of. */
export type SplitGroup<Item> = {
  id: string;
  items: ReadonlyArray<Item>;
};

export type DecisionSplit<G> = {
  /** book / pick / pay / role — the things only the couple can close. */
  decisionGroups: G[];
  /** The dates, or null when there are none. Rendered, never counted. */
  datesGroup: G | null;
  /** What "N open decisions" is allowed to mean. Dates are NOT in it. */
  openDecisionCount: number;
  /** What the "N dates" chip says. Never folded into the count above. */
  datesCount: number;
};

/**
 * The id the dates group carries. Exported so the component and the test agree
 * on one spelling rather than each holding their own copy of the string.
 */
export const DATES_GROUP_ID = 'deadline';

/**
 * Split a board's groups into decisions and dates.
 *
 * `groups` may contain a dates group or not — passing one in is how a future
 * edit would re-introduce the bug, so it is handled here rather than trusted
 * not to happen: any group whose id is `DATES_GROUP_ID` is pulled OUT of the
 * board and returned as `datesGroup`, wherever it came from.
 *
 * @param groups      the board's groups, in render order
 * @param datesGroup  the dates group resolved separately (may be null)
 */
export function splitDecisionsAndDates<Item, G extends SplitGroup<Item>>(
  groups: ReadonlyArray<G>,
  datesGroup: G | null,
): DecisionSplit<G> {
  const decisionGroups: G[] = [];
  let dates: G | null = datesGroup;

  for (const g of groups) {
    if (g.id === DATES_GROUP_ID) {
      // Belt and braces: a dates group that arrived through the board array is
      // still a dates group. Prefer the one passed explicitly, so a caller that
      // supplies both does not silently lose rows.
      if (!dates) dates = g;
      continue;
    }
    decisionGroups.push(g);
  }

  return {
    decisionGroups,
    datesGroup: dates,
    openDecisionCount: decisionGroups.reduce((acc, g) => acc + g.items.length, 0),
    datesCount: dates?.items.length ?? 0,
  };
}

/**
 * The rank mark a group header shows.
 *
 * Owner-approved 2026-09-22: ONE rank mark, not two. The board used to print
 * "PRIORITY 1", "PRIORITY 2"… down a list that is already in that order — the
 * word and the position said the same thing, and the word was the widest element
 * in the header.
 *
 * Returns the 1-based rank when Sai ranked the list, and `null` when it did not.
 * `null` is not "hide the mark" — it is "there is no ranking here", and the
 * caller shows the group's item count instead. The dates are in DATE order, so
 * they always get `null`: a priority number there would be a claim nobody made.
 */
export function rankMarkFor(aiActive: boolean, index: number | null): number | null {
  if (!aiActive) return null;
  if (index === null) return null;
  return index + 1;
}
