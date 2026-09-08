/**
 * a-write-that-matched-nothing.ts — telling a supplier "saved" is a claim, and
 * a claim needs evidence.
 *
 * ── THE SHAPE, MEASURED 2026-09-08 ─────────────────────────────────────────
 * `updateVendorService` did this:
 *
 *     const { error } = await supabase.from('vendor_services')
 *       .update({ … }).eq('vendor_service_id', id).eq('vendor_profile_id', vp);
 *     if (error) { …show it… }
 *     redirect('…?saved=1');
 *
 * PostgREST does not treat "matched no rows" as an error. `error` is `null`
 * whether the update changed one row or none, so that code redirects to
 * `?saved=1` in both cases and the supplier is told their card was written when
 * it was not.
 *
 * 🔑 THE ABSENCE OF AN ERROR IS NOT THE PRESENCE OF A WRITE. This is the same
 * disease as the refused reads catalogued across this codebase — `data ?? []`
 * turning a 42501 into "no rows" — pointed the other way: a write nobody made,
 * reported as a write that happened.
 *
 * Two ways to match nothing are live right now, neither exotic:
 *   · a stale or wrong `vendor_service_id` in a long-lived form;
 *   · an RLS `USING` clause that excludes the row — `vendor_services_manage`
 *     resolves through `current_vendor_profile_ids()`, so a lost team
 *     membership silently empties the match.
 *
 * The fix is `.select()` on the update and a check that something came back.
 * This module holds the check and the sentence, so a caller cannot invent its
 * own wording for the same event.
 */

/**
 * What the supplier is told when the write matched no row.
 *
 * Names the ONE fact we are sure of — nothing changed — and does not guess at
 * the cause, because from here a wrong id and a refused row look identical.
 * Reloading genuinely is the right first move: it re-reads the card and issues
 * a fresh id.
 */
export const SERVICE_UPDATE_MATCHED_NOTHING =
  'That did not save — the card was not found under your shop, so nothing changed. Reload the page and try again; if it keeps happening, the card may have been removed or your access to this shop changed.';

/**
 * Did the write actually touch a row?
 *
 * Takes what a Supabase `.update().select()` returns. `null` (the shape on an
 * error, and on a client that was never asked for rows) counts as NOT written —
 * fail closed, because the whole point is refusing to claim a write we cannot
 * see.
 */
export function wroteSomething(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length > 0;
}
