/**
 * vendor-part-read.ts — WHAT A SUPPLIER'S PART-OF-THEIR-EVENT READ MEANS (supplier pages set two, 21 Nov 2026, "When a
 * read fails: the page stays, and says so").
 *
 * The part RPCs (`get_vendor_cocktail_editor`, `get_vendor_catering_metrics`, `get_vendor_seat_plan`, …) refuse their
 * GATES on purpose, with a named exception: `not_a_vendor` · `not_booked` · `category_not_*` · `fee_unsettled`
 * (SQLSTATE 42501) and `event_not_found` · `not_published` (P0002). A gate is an answer — "this part is not yours" — and
 * the page keeps doing what it always did with it (back to the client's brief). Anything ELSE — a timeout, a dropped
 * connection, a 5xx, an unapplied migration — is a read that did not happen, and the page must say so in place: never a
 * redirect that makes a failure look like "this page does not exist".
 *
 *   'ok'     — the read answered with a payload;
 *   'gate'   — the read answered "no" (a gate's SQLSTATE, or no error and no payload);
 *   'failed' — the read did not answer.
 *
 * 🔒 lib/vendor-part-read.test.ts · app/vendor-dashboard/set-two-reads-are-honest.test.ts
 */
export type PartRead = 'ok' | 'gate' | 'failed';

/** The SQLSTATEs the part RPCs raise for their gates — insufficient_privilege and no_data_found. */
export const GATE_SQLSTATES: readonly string[] = ['42501', 'P0002'];

export function partReadOutcome(error: { code?: string | null } | null | undefined, data: unknown): PartRead {
  if (error) return error.code && GATE_SQLSTATES.includes(error.code) ? 'gate' : 'failed';
  return data == null ? 'gate' : 'ok';
}
