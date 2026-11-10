/**
 * EVERY CHANGE KEEPS ITS HISTORY — the pure half.
 *
 * ⚖ Owner 2026-11-08/09: Details shows what is agreed NOW; a row that moved
 * reads "Changed N×" and opens to the earlier values. Those earlier values
 * live in `public.booking_changes` (migration 20271329937802), written only by
 * database triggers on the columns that are overwritten in place:
 *
 *   event_date         events.event_date (at its precision: YYYY · YYYY-MM · YYYY-MM-DD)
 *   guest_estimate     events.estimated_pax — the host's own figure
 *   guest_count_final  events.final_pax — the finalized count (NULL = reopened)
 *   schedule_time      event_schedule_blocks.start_at of a block TAGGED to a
 *                      booking — one row per tagged shop; subject_id = block_id;
 *                      NULL value = the time was TBA
 *   meeting_time       event_appointments.scheduled_at; subject_id = appointment_id
 *
 * Quotes, amendments and payments already keep every version in their own
 * tables; they are deliberately not repeated here.
 *
 * Values are TEXT exactly as the trigger wrote them: dates `YYYY[-MM[-DD]]`,
 * counts as digits, times ISO-8601 UTC (`2026-12-12T06:00:00Z`).
 */

export const BOOKING_CHANGE_FIELDS = [
  'event_date',
  'guest_estimate',
  'guest_count_final',
  'schedule_time',
  'meeting_time',
] as const;

export type BookingChangeField = (typeof BOOKING_CHANGE_FIELDS)[number];

export type BookingChange = {
  changeId: number;
  eventId: string;
  /** NULL = event-wide (the date, the guest count). */
  vendorProfileId: string | null;
  field: BookingChangeField;
  /** The block / appointment the change is about; NULL for event-wide fields. */
  subjectId: string | null;
  fromValue: string | null;
  toValue: string | null;
  /** The signed-in person who made it; NULL for a server/system write. */
  changedBy: string | null;
  changedAt: string;
};

export function isBookingChangeField(value: unknown): value is BookingChangeField {
  return typeof value === 'string' && (BOOKING_CHANGE_FIELDS as readonly string[]).includes(value);
}

/**
 * The changes to ONE field (and, for a block or a meeting, one subject),
 * newest first — the list behind "Changed N×". Rows are not mutated; the
 * input order does not matter.
 */
export function changesFor(
  rows: readonly BookingChange[],
  field: BookingChangeField,
  subjectId?: string | null,
): BookingChange[] {
  return rows
    .filter((r) => r.field === field && (subjectId === undefined || r.subjectId === subjectId))
    .sort((a, b) => {
      const t = Date.parse(b.changedAt) - Date.parse(a.changedAt);
      return t !== 0 ? t : b.changeId - a.changeId;
    });
}

/** Map one database row to a BookingChange; null when the row is not one. */
export function toBookingChange(row: Record<string, unknown>): BookingChange | null {
  if (!isBookingChangeField(row.field)) return null;
  const id = typeof row.change_id === 'string' ? Number(row.change_id) : row.change_id;
  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (typeof row.event_id !== 'string' || typeof row.changed_at !== 'string') return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    changeId: id,
    eventId: row.event_id,
    vendorProfileId: str(row.vendor_profile_id),
    field: row.field,
    subjectId: str(row.subject_id),
    fromValue: str(row.from_value),
    toValue: str(row.to_value),
    changedBy: str(row.changed_by),
    changedAt: row.changed_at,
  };
}
