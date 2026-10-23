/**
 * people-remove.ts — REMOVE ON THE PEOPLE PAGE REMOVES, OR SAYS IT DID NOT.
 *
 * Owner, 2026-10-23, on account › People: *"why can't i delete anyone"*. A row
 * like "Marco Testing · No label yet" carried ✎ and a red ✕; ✕ → Remove closed
 * the sheet, drew no error, and Marco was still there. Two halves of one disease
 * (a failure that renders identically to success — #4579–#4585):
 *
 *   1. THE SERVER WROTE NOTHING AND SAID "ok". `withdrawConnection` filtered on
 *      `from_person_id = me` — the DECLARER's side only. A connection somebody
 *      ELSE asked for, that I accepted, has me as `to_person_id`: the UPDATE
 *      matched zero rows, PostgREST returned no error, and the action returned
 *      `{ ok: true }`. Its own docblock already said the opposite ("a confirmed
 *      connection is a mutual fact and comes down the same way, from whichever
 *      side asks"); RLS (`person_connections_update`) has always let the
 *      recipient reach a non-draft row, and the transition guard never forbade
 *      `deleted_at`. Only the action's filter was wrong.
 *   2. THE SCREEN COULD REPORT SUCCESS FOR NOBODY. The confirm built
 *      `ids = toRemove.map(p => p.connectionId ?? '').filter(Boolean)` — a row
 *      with no id became an empty list, the loop ran zero times, and `run()`
 *      got `{ ok: true }`.
 *
 * So both halves now count: the server returns the rows it changed and treats
 * zero as a failure (`removalWriteResult`), and the screen refuses an empty
 * or partial id list before calling anything (`removeFromPeople`).
 *
 * ── WHO MAY END WHICH ROW (`removableConnectionFilter`) ─────────────────────
 *   · the DECLARER — any of their rows: a request still waiting is WITHDRAWN,
 *     a confirmed connection is ENDED. (Unchanged.)
 *   · the RECIPIENT — a CONFIRMED connection only, which ends it for both
 *     sides (every read filters `deleted_at`). A request still waiting on the
 *     recipient is answered with Decline (`declineConnection`), never quietly
 *     soft-deleted: a decline is the fact the asker's row reads.
 *
 * ── LOVED ONES (alaga) AND GODPARENTS ──────────────────────────────────────
 * Somebody with no account is never a connection (`kin_pilot_mutual_accounts`,
 * owner 2026-08-21: "these people must have an account to be listed as
 * people") — a person added by hand is an alaga. Alaga are not roster rows
 * (the Loved ones section draws them) and they already had a
 * remove: `deleteDependent` / `deleteGodparent`, a real DELETE scoped to the
 * owner by RLS. They landed on `removed=1` whatever the delete did; they now
 * pass their answer through `removalWriteResult` too, so a refused or zero-row
 * delete (a spouse's shared loved one, one already gone) says so.
 *
 * ── WHAT REMOVE NEVER TOUCHES ──────────────────────────────────────────────
 * Only `person_connections.deleted_at`. The other person's `people` node, their
 * account, and any event's guest list stay exactly as they were — a guest row
 * is its own record (`guests.person_id` points at the person, never at the
 * connection), and no ruling ties leaving someone's People to leaving an event.
 *
 * Held by `lib/people-remove.test.ts` (the empty / partial / zero-row cases) and
 * `tests/db/people-remove-removes.db.test.ts` (each row kind, in the database).
 */

export type RemoveResult = { ok: true } | { ok: false; error: string };

/**
 * The PostgREST `.or()` for the rows `myPerson` may end: every row they
 * declared, and a confirmed row they were asked into. `myPerson` is a
 * `people.person_id` read from the database, never user input.
 */
export function removableConnectionFilter(myPerson: string): string {
  return `from_person_id.eq.${myPerson},and(to_person_id.eq.${myPerson},status.eq.confirmed)`;
}

/** The write's answer, counted — an UPDATE that changed nothing is not a success. */
export function removalWriteResult(
  data: unknown[] | null,
  error: unknown,
): RemoveResult {
  if (error) return { ok: false, error: 'Couldn’t remove them. Nothing changed — try again.' };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Couldn’t remove them — they may already be gone. Nothing changed; refresh to see your people as they are.',
    };
  }
  return { ok: true };
}

type Removable = { connectionId: string | null; name: string };

/**
 * Remove every picked person, one call each, and say what happened. Refuses
 * BEFORE calling anything when the list is empty or a row carries no id, so a
 * half-built list can never come back as "done".
 */
export async function removeFromPeople(
  rows: readonly Removable[],
  remove: (connectionId: string) => Promise<RemoveResult>,
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: false, error: 'Nobody was picked to remove.' };
  const missing = rows.find((r) => !r.connectionId);
  if (missing) {
    return { ok: false, error: `Couldn’t remove ${missing.name}. Nothing changed — refresh and try again.` };
  }
  let removed = 0;
  for (const r of rows) {
    const res = await remove(r.connectionId!);
    if (!res.ok) {
      return removed === 0
        ? res
        : { ok: false, error: `Removed ${removed} of ${rows.length}. ${r.name}: ${res.error}` };
    }
    removed += 1;
  }
  return { ok: true, removed };
}
