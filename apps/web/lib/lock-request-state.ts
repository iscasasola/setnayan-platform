/**
 * THE ONE PLACE THE LOCK-REQUEST STATE IS DERIVED.
 *
 * Four couple surfaces and two vendor surfaces answer "where is this booking?".
 * They must not each work it out, or they drift — the reason the coverage strip
 * and the bench once disagreed about the same category.
 *
 * 🔑 DERIVED FROM `(status, lock_request_state)`, NEVER FROM THE TIMESTAMPS.
 * `lock_agreed_at` survives its own round: after a decline-then-re-ask the row
 * carries a stale agreed-at while the state says 'declined'. Anything keyed on
 * the timestamp reads that row as agreed forever. The state column is the
 * machine; the timestamps are its receipts.
 *
 * 🔑 A CONFIRMED ROW WITH NO MARKERS IS `locked`, NOT `none`. Legacy bookings,
 * the printed Locked-QR path (which promotes to `deposit_paid` without touching
 * a single `lock_*` column — owner-exempt, 2026-08-04 §6.4) and every booking
 * made while the flag was off all look like that. Derive, never backfill.
 *
 * PURE CORE: takes the flag as a PARAMETER and must never call
 * `isLockHandshakeEnabled()` itself — `flag-chokepoint-scan.test.ts` property 3
 * fails this file the moment it does.
 */

/** The statuses that mean "this is a real booking". Mirrors lib/events.ts. */
const CONFIRMED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

export type LockRequestState =
  /** No request, and not booked. */
  | 'none'
  /** Asked; the supplier has not answered. */
  | 'requested'
  /** The supplier said no. */
  | 'declined'
  /** The couple withdrew — or a rival was confirmed in the same category. */
  | 'cancelled'
  /** Nobody answered inside the window. */
  | 'expired'
  /** A real booking. */
  | 'locked';

export type LockRequestRow = {
  status: string | null;
  lock_request_state: string | null;
};

/**
 * @param enabled the handshake flag, passed in by an already-gated caller.
 *   With `false` this returns exactly what the pre-PR-H world returned:
 *   `locked` for a confirmed status, `none` for anything else.
 */
export function lockRequestStateOf(row: LockRequestRow, enabled: boolean): LockRequestState {
  const confirmed = !!row.status && CONFIRMED.has(row.status);

  // FLAG OFF — byte-identical to "is it in CONFIRMED_VENDOR_STATUSES?".
  if (!enabled) return confirmed ? 'locked' : 'none';

  // A real booking outranks any marker it happens to carry. This is what stops
  // a legacy / Locked-QR row rendering a phantom "waiting", and it is also why
  // the sweeps carry a status floor: such a row can hold a stale 'pending'.
  if (confirmed) return 'locked';

  switch (row.lock_request_state) {
    case 'pending':
      return 'requested';
    case 'declined':
      return 'declined';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    case 'agreed':
      // AGREED BUT NOT CONFIRMED — reachable, and it must not fall through to
      // 'none'. The couple's "Change pick" reverts status to 'considering'; its
      // flag arm now also writes 'cancelled' (slice B — until then this sentence
      // described a write that did not exist), but a row reverted before that
      // shipped, or moved by an admin, can still sit here. Reporting 'none'
      // would offer Lock again on a booking the supplier believes they hold.
      return 'cancelled';
    default:
      return 'none';
  }
}

/** Whether the couple is still waiting on an answer. */
export function isAwaitingVendor(row: LockRequestRow, enabled: boolean): boolean {
  return lockRequestStateOf(row, enabled) === 'requested';
}

/**
 * HOW LONG A SUPPLIER HAS TO ANSWER A BOOKING ASK — owner ruling 2026-08-28,
 * asked and answered in one word: **48 hours**.
 *
 * 🔑 THIS IS A MIRROR, NOT THE RULE. The window is DECIDED in one place, the
 * database: `guard_event_vendor_lock_handshake` stamps
 * `lock_requested_at + INTERVAL '48 hours'` onto `lock_request_expires_at` the
 * moment a row becomes pending. This constant exists only so the SENTENCES a
 * person reads ("you have 48 hours to agree or decline") come from the same
 * number as the deadline that is enforced. `the-answer-window-is-48-hours.db.test.ts`
 * fails if the two ever disagree — a rule the database keeps and a sentence the
 * product prints are two copies of one number, and two copies drift.
 *
 * ⚠ IT MUST NOT BE USED TO COMPUTE A DEADLINE. Every countdown reads the
 * MATERIALIZED `lock_request_expires_at`, so the number shown is the number
 * enforced — and so a row stamped under the old seven-day rule keeps the window
 * it was actually given rather than being shortened retroactively by a constant.
 */
export const LOCK_ANSWER_WINDOW_HOURS = 48;

/**
 * Whole HOURS left before the request lapses, floored at 0.
 *
 * 🔴 IT USED TO BE DAYS, AND DAYS STOPPED BEING TRUE AT 48 HOURS. On a
 * seven-day fuse "2 days left" was a fair summary. On a two-day fuse the
 * day-granular version spends HALF the whole window saying "Last day to
 * answer" — the same words at 23 hours and at 3 minutes — which is the shape of
 * a countdown that reads as urgent exactly when it is not and stops meaning
 * anything exactly when it should.
 *
 * Reads the MATERIALIZED deadline so the number shown is the number enforced —
 * the trigger stamps it on every transition into pending, and a re-ask gets a
 * fresh one rather than inheriting the dead deadline of the round before.
 */
export function lockRequestHoursLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 3_600_000));
}

/**
 * The fuse as a person reads it — ONE phrasing, so the Answers Desk, the
 * customer card and the Customers roster cannot word the same deadline three
 * ways. Null when there is no readable deadline: a row still renders, without a
 * countdown, rather than claiming a number nobody measured.
 */
export function lockRequestFuseLabel(
  expiresAt: string | null,
  now: Date = new Date(),
): string | null {
  const hours = lockRequestHoursLeft(expiresAt, now);
  if (hours === null) return null;
  if (hours === 0) return 'closing now';
  if (hours === 1) return '1 hour left to answer';
  if (hours < 24) return `${hours} hours left to answer`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} left to answer`;
}
