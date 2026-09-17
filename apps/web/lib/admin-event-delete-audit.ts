/**
 * admin-event-delete-audit.ts — the shape of the record an admin hard-delete
 * leaves behind. PURE on purpose: no `server-only`, no Supabase import, no
 * request scope.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `admin_audit_log` has recorded admin ACTIONS since June and carries 23
 * distinct action values in production — SKU edits, taxonomy remaps, a
 * verification bypass grant, a forced vendor completion. It is append-only,
 * enforced by a database trigger (`admin_audit_log_append_only`), so a row
 * written here cannot later be tidied away.
 *
 * The single most destructive thing an admin can do was NOT among those 23.
 * `deleteEvent` hard-deletes a celebration — guests, members, seating, budget,
 * schedule all cascade, and the R2 objects are swept afterwards — and wrote
 * nothing anywhere. Measured 2026-09-17:
 *
 *     select action, count(*) from admin_audit_log group by action;
 *     -- 23 rows, none of them an event deletion
 *
 * `events` carries NINE `BEFORE DELETE` triggers and every one of them is about
 * PRESERVING something (supplier paperwork, bookings, the reply clock, the
 * address hold, arm's-length reviews). Substantial, deliberate machinery — and
 * none of it records that the deletion happened at all. With no database backup
 * behind it (the project is on the Supabase free plan), an event could vanish
 * with no trace of who removed it, when, or what was in it.
 *
 * ── WHY THE SHAPE IS PURE AND THE WRITE IS NOT ──────────────────────────────
 * `lib/periodic-jobs.ts` and `lib/admin-data-access.ts` both import
 * 'server-only', so a `tsx --test` file cannot import them and a guard over
 * them can only grep. Everything here that can be got WRONG — the action name,
 * that the actor is carried, that the snapshot is taken before the row dies —
 * is in a pure function a test can EXECUTE. The insert itself lives in the
 * server action, where the client does.
 *
 * ── SCOPE, STATED RATHER THAN ASSUMED ───────────────────────────────────────
 * ⚠ This covers the ADMIN path only, and that is deliberate, not an oversight.
 * Production also carries an RLS policy (`couple_can_delete_event`) letting a
 * couple delete their own celebration straight through PostgREST with no server
 * action involved — the same door `actions.ts` documents for the address hold
 * ("Removing the button closes the button, not the door"). A couple removing
 * their own wedding is NOT an admin action and must not appear in an admin
 * audit log; if that path needs its own trail it wants a different table and a
 * BEFORE DELETE trigger, which is a separate decision and not this one.
 */

/** The one action value. Never inline the string — the guard reads this. */
export const EVENT_HARD_DELETE_ACTION = 'event_hard_delete';

/** What we could read off the celebration before it stopped existing. */
export type EventDeleteSnapshot = {
  public_id: string | null;
  display_name: string | null;
  event_date: string | null;
  event_type: string | null;
  slug: string | null;
  archived: boolean | null;
  created_at: string | null;
  /** Null (not 0) when the count could not be read — absence is not emptiness. */
  guest_count: number | null;
  vendor_count: number | null;
};

export type EventDeleteMediaOutcome = {
  collected: number;
  swept: number;
  failed: number;
};

export type AdminAuditRow = {
  action: string;
  target_table: string;
  target_id: string;
  actor_user_id: string | null;
  before_json: EventDeleteSnapshot | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Build the append-only row for one admin hard-delete.
 *
 * 🔑 IT ALWAYS RETURNS A ROW. There is no input — a missing actor, an
 * unreadable snapshot, a failed media sweep — that makes this return null or
 * throw. A deletion that happened and was not written down is the exact defect
 * this file exists to close, so an incomplete record always beats no record;
 * what could not be established is carried as an explicit null and flagged in
 * `metadata`, never quietly omitted.
 */
export function buildEventDeleteAuditRow(input: {
  eventId: string;
  adminUserId: string | null;
  snapshot: EventDeleteSnapshot | null;
  media: EventDeleteMediaOutcome | null;
  reason?: string | null;
}): AdminAuditRow {
  const reason =
    typeof input.reason === 'string' && input.reason.trim().length > 0
      ? input.reason.trim().slice(0, 2000)
      : null;

  return {
    action: EVENT_HARD_DELETE_ACTION,
    target_table: 'events',
    target_id: input.eventId,
    actor_user_id: input.adminUserId ?? null,
    before_json: input.snapshot,
    reason,
    metadata: {
      // Each of these says "we could not establish this", which is a different
      // statement from "this was zero" and has to survive as one.
      snapshot_read: input.snapshot !== null,
      actor_resolved: input.adminUserId !== null,
      media_collected: input.media?.collected ?? null,
      media_swept: input.media?.swept ?? null,
      media_failed: input.media?.failed ?? null,
      // An admin removal with files left behind in R2 is recoverable evidence
      // of a partial wipe; the sweep is best-effort by design (see actions.ts),
      // so whether it fully succeeded belongs in the permanent record.
      media_fully_swept:
        input.media === null ? null : input.media.failed === 0,
    },
  };
}
