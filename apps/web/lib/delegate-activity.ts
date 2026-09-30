/**
 * delegate-activity.ts — ONE line of "what your helpers did", the pure half.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "HOSTS FOLD — THREE OWNER ANSWERS"): the
 * Hosts page folds into the Guest list, and what a helper did while they had
 * access stays as a READ-ONLY record. The stream itself never changed: the
 * `log_delegate_write` trigger writes `delegate_*` rows into the 0016
 * `event_action_log` (migration 20260518500000), with the area in
 * `payload_json.area`. The Hosts page used to word those rows inline; the
 * wording lives here now so the Overview feed (and, later, each person's guest
 * card) says the SAME sentence about the same row.
 *
 * PURE so a test can run it — `delegate-activity.test.ts`. The read is
 * `delegate-activity.server.ts`.
 */

/** The `event_action_log` columns the feed reads. */
export type DelegateActivityRow = {
  id: string;
  performed_by_user_id: string | null;
  action_type: string;
  action_target_table: string | null;
  notes: string | null;
  payload_json: { area?: string | null } | null;
  performed_at: string;
};

export type DelegateActivityLine = {
  key: string;
  /** Who did it — their name, or a plain stand-in when it could not be read. */
  who: string;
  /** "added a guest" · "updated the seat plan" — what they did. */
  did: string;
  /** The trigger's own note, when it left one. */
  note: string | null;
  /** ISO timestamp; the screen formats it. */
  at: string;
};

/** What a person is called when their name could not be read. */
export const UNNAMED_HELPER = 'A helper';

/** The verb the action type ends in (`delegate_insert` → added). */
export function delegateVerb(actionType: string): 'added' | 'removed' | 'updated' {
  if (actionType.endsWith('insert')) return 'added';
  if (actionType.endsWith('delete')) return 'removed';
  return 'updated';
}

/** What was touched, in the couple's words; the table name when no area says. */
export function delegateObject(area: string | null | undefined, table: string | null): string {
  switch (area) {
    case 'guest_list':
      return 'a guest';
    case 'seat_plan':
      return 'the seat plan';
    case 'schedule':
      return 'a schedule block';
    case 'vendors':
      return 'a vendor record';
    default:
      return table ?? 'the plan';
  }
}

export function delegateActivityLine(
  row: DelegateActivityRow,
  actorName: string | null | undefined,
): DelegateActivityLine {
  return {
    key: row.id,
    who: actorName?.trim() || UNNAMED_HELPER,
    did: `${delegateVerb(row.action_type)} ${delegateObject(row.payload_json?.area, row.action_target_table)}`,
    note: row.notes?.trim() || null,
    at: row.performed_at,
  };
}
