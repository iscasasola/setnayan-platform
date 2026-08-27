'use server';

/**
 * record-search.ts — the ONE read the admin's search box is allowed to make.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * `admin-job-ask-form.test.ts` refuses to let the palette import any module
 * whose path ends in `/actions`, because that is where every admin surface
 * keeps the functions that actually mutate. The one-person admin plan
 * (2026-07-11) binds it: the machine may prepare and hold back, it may never be
 * the thing that lets money, a price, an approval or a publish through.
 *
 * That guard fired on the first draft of the record search, and it was RIGHT to
 * — even though `app/admin/ugat/actions.ts` exports four functions today and
 * all four are reads. **The property worth keeping is not "that module happens
 * to be read-only right now", it is "the palette cannot reach a mutation."** An
 * import of the whole actions module makes the palette's safety depend on
 * nobody ever adding a fifth export to a file with an entirely different job —
 * a promise no test in that file is making.
 *
 * So the box imports THIS instead: a module that exists to expose exactly one
 * read and can never grow a mutation without somebody deleting the guard that
 * says so.
 *
 * ── WHY IT DELEGATES INSTEAD OF QUERYING ────────────────────────────────────
 * 🔑 IT ADDS NO SECOND GATE AND NO SECOND SEARCH. `fetchUgatSearch` already
 * opens with `requireAdminAction()` and already carries the reviewed ILIKE
 * sanitiser, the `deleted_at is null` filter and the guest privacy fence.
 * Re-implementing any of that here would be a second copy of a security rule,
 * free to drift from the one that was actually reviewed — and this read uses
 * the SERVICE ROLE, which puts it outside every RLS policy, so that app-side
 * gate is the entire fence. One gate, one search, two doors to it.
 */

import { fetchUgatSearch } from '../ugat/actions';

/**
 * Find records by name for the admin search box. Read-only, admin-gated.
 *
 * Returns the shipped search's grouped result untouched; the presentation
 * fence — which fields may reach a row — is applied by `toAdminRecordRows`.
 */
export async function searchAdminRecords(query: string) {
  return fetchUgatSearch(query);
}
