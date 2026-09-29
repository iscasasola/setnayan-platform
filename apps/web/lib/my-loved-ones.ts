/**
 * my-loved-ones.ts — WHICH `dependents` rows belong on MY People page. One rule,
 * read by every place that lists or counts them.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * RLS on `dependents` admits an ADMIN to every dependent on the platform, and
 * production's admin is the owner's own account. So "whatever the read
 * returned" is not "my loved ones" — it is everybody's.
 *
 *   · 2026-09-25 — the owner (no registered spouse) saw another user's business,
 *     "Indigo Caterers", on his People page tagged "Shared by your spouse".
 *     `dependents-section.tsx` was fixed to decide membership itself.
 *   · 2026-09-29 — the SAME row came back through a second reader. The People
 *     roster (`lib/people-roster.ts`) read `dependents` without that rule, so the
 *     picker said "Loved ones 1" while the Loved ones view (correctly) said "No
 *     loved ones yet." Before the People redesign it had shown the row itself,
 *     as "In your care · Business". Two readers, one rule, written once — and
 *     the second reader never got it.
 *
 * So the rule now lives HERE, and both readers call it: the view lists
 * `myLovedOnes(rows)`, and the picker's count is `myLovedOnes(rows).length` —
 * the count can never claim a row the list cannot show.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * A row is on my page when it is: MINE · one I HANDED OVER (read-only history) ·
 * one my ACTUAL spouse (`current_spouse_user_ids()`) marked shared. Nothing else.
 * The rows still IN MY CARE (not handed over) are the ones I can act for — the
 * guest list's "Add from people" sheet offers only those.
 *
 * Pure — no Supabase, no React — so it is executed by a unit test.
 */

export type DependentOwnership = {
  owner_user_id: string | null;
  handed_over_by_user_id: string | null;
  shared_with_spouse: boolean | null;
  handed_over_at: string | null;
};

/** Is this row on MY People page? */
export function belongsOnMyPeoplePage(
  d: DependentOwnership,
  myUserId: string,
  spouseIds: ReadonlySet<string>,
): boolean {
  if (!myUserId) return false;
  return (
    d.owner_user_id === myUserId ||
    d.handed_over_by_user_id === myUserId ||
    (d.shared_with_spouse === true && d.owner_user_id !== null && spouseIds.has(d.owner_user_id))
  );
}

/** The Loved ones view's list — and, by construction, its count. */
export function myLovedOnes<T extends DependentOwnership>(
  rows: readonly T[],
  myUserId: string,
  spouseIds: ReadonlySet<string>,
): T[] {
  return rows.filter((d) => belongsOnMyPeoplePage(d, myUserId, spouseIds));
}

/** The ones still in my care (not handed over) — what I can add to a guest list. */
export function lovedOnesInMyCare<T extends DependentOwnership>(
  rows: readonly T[],
  myUserId: string,
  spouseIds: ReadonlySet<string>,
): T[] {
  return myLovedOnes(rows, myUserId, spouseIds).filter((d) => !d.handed_over_at);
}

/** `current_spouse_user_ids()` returns SETOF uuid — PostgREST hands back strings. */
export function spouseIdSet(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? (raw as unknown[]) : []).filter((v): v is string => typeof v === 'string'));
}
