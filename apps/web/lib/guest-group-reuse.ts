/**
 * Resolve which existing guest_group a quick-add insert collided with.
 *
 * The `guest_groups` uniqueness key is `(event_id, lower(label), team_side)`
 * (migration 20260607050000 — the same label is allowed across team sides, so a
 * bride-side "Friends" and a groom-side "Friends" legitimately coexist).
 * `quickCreateGroup` inserts `team_side = 'both'`, so a 23505 there means a row
 * with the same `(lower(label), 'both')` key already exists — and THAT is the
 * row to reuse.
 *
 * The pre-fix reuse-lookup matched label-only (`.ilike('label').maybeSingle()`),
 * which returned every same-label row across all team sides; with a cross-side
 * namesake present that is >1 row, `.maybeSingle()` threw, and a legitimate
 * reuse of the 'both' group failed. This pure picker matches the FULL unique key
 * instead: exact `team_side` + case-insensitive exact `label`. Because the label
 * compare is an exact JS string match (not a SQL `LIKE`), it also neutralizes
 * the pre-existing wildcard hazard where a label containing `%`/`_` made an
 * `ilike` fetch over-match unrelated groups.
 */
export type GuestGroupReuseCandidate = {
  group_id: string;
  label: string;
  team_side: string;
};

/**
 * From the same-label candidate rows fetched for an event, return the single
 * group that a `(label, teamSide)` insert collided with, or `null` if none of
 * the candidates matches that exact key (label case-insensitive, team_side
 * exact). Never returns a cross-side namesake.
 */
export function pickReuseGroup(
  candidates: ReadonlyArray<GuestGroupReuseCandidate>,
  label: string,
  teamSide: string,
): GuestGroupReuseCandidate | null {
  const target = label.trim().toLowerCase();
  for (const c of candidates) {
    if (c.team_side === teamSide && c.label.trim().toLowerCase() === target) {
      return c;
    }
  }
  return null;
}
