/**
 * IS THIS APPROVAL TEMPORARY, AND HAS ITS DATE PASSED?
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * `lib/data-privacy-controls.ts` is a server module: it reaches for Supabase, so
 * a test cannot import it without a server context and a guard can only ever
 * GREP it. The rule below is the part that can actually be got wrong — three
 * states, a date comparison, and a timezone — so it lives in a pure sibling that
 * `provisional-approval.test.ts` EXECUTES. Nothing here imports anything.
 *
 * ── THE DEFECT IT ENCODES ──────────────────────────────────────────────────
 * Owner, 2026-09-22: the data-privacy controls were approved *temporarily*, to
 * be revisited in January. Until migration 20271238899699 the table had no way
 * to say that — a temporary approval and a permanent one were the same row.
 * 🔑 A provisional decision stored as an unconditional one does not expire. It
 * quietly becomes the permanent answer, and the review date passes with nothing
 * on any screen.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────
 * It does not gate anything. `isDataPrivacyControlActive` reads `status` and
 * only `status`. An overdue review must never switch a live feature off: that
 * would take the site down on a date nobody was watching, which is worse than
 * the drift it is meant to catch. This decides what the BOARD SAYS. The switch
 * stays with the owner.
 */

/** What a control's approval looks like right now. */
export type ApprovalStanding =
  /** Not switched on, so no review is owed either way. */
  | 'inactive'
  /** Active with no review date — a settled, open-ended decision. */
  | 'settled'
  /** Active, temporary, and the date is still ahead. */
  | 'provisional'
  /** Active, temporary, and the date has passed. Nobody looked. */
  | 'overdue';

/**
 * Manila. The whole product runs on `+08:00` (see `PAPIC_TZ_OFFSET`), and a
 * review date is a CALENDAR day the owner named — "January" — not an instant.
 * Comparing a bare `YYYY-MM-DD` against a UTC clock would flip the verdict for
 * the eight hours either side of midnight, which is exactly the kind of
 * one-day-early "overdue" that teaches somebody to ignore the banner.
 */
export const REVIEW_TZ_OFFSET = '+08:00';

/**
 * Today's calendar date in Manila, as `YYYY-MM-DD`.
 *
 * `now` is injectable so the test can stand on a fixed day; production passes
 * nothing. It takes an epoch-millis number rather than a Date to keep this
 * module trivially serialisable and free of Date-mutation surprises.
 */
export function manilaToday(now: number = Date.now()): string {
  // +8h then read the UTC calendar fields: the same trick the rest of the
  // codebase uses, and it needs no Intl table.
  const shifted = new Date(now + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalise whatever the DB hands back for a `date` column to `YYYY-MM-DD`.
 *
 * Supabase returns a bare `YYYY-MM-DD` for `date`, but a full ISO timestamp
 * turns up whenever a column is widened or a row travels through a JSON payload
 * — and `'2027-01-31T00:00:00+00:00' <= '2027-01-31'` is FALSE as a string
 * compare, so an unnormalised timestamp reads as not-yet-due forever.
 */
function asCalendarDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t.length === 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return null;

  // ⚠ SHAPE IS NOT VALIDITY, AND THE TEST CAUGHT THIS. '2027-13-45x' matches the
  // pattern above, and a plain string compare then puts it in the FUTURE — so a
  // nonsense deadline read as "provisional, plenty of time" rather than as the
  // broken row it is. Round-trip through UTC so only a real calendar day
  // survives; month 13 and day 45 both roll over and fail to come back.
  const [, ys, ms, ds] = m as unknown as [string, string, string, string];
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${ys}-${ms}-${ds}`;
}

export type ApprovalInputs = {
  /** The control's `status` column. Only `'active'` can owe a review. */
  status: string | null | undefined;
  /** The `review_by` column. NULL = settled. */
  reviewBy: string | null | undefined;
};

/**
 * The one resolver. Every surface asks this; none re-derives it.
 *
 * ⚠ AN UNPARSEABLE DATE IS `overdue`, NOT `settled`. Garbage in a review column
 * means somebody's deadline is unreadable, and the safe reading of "I cannot
 * tell when this was due" is "go and look", never "nothing is owed". Failing
 * the other way would let one bad row silently leave the board.
 */
export function approvalStanding(
  { status, reviewBy }: ApprovalInputs,
  now: number = Date.now(),
): ApprovalStanding {
  if (status !== 'active') return 'inactive';

  const raw = typeof reviewBy === 'string' ? reviewBy.trim() : reviewBy;
  if (raw === null || raw === undefined || raw === '') return 'settled';

  const due = asCalendarDate(raw);
  if (due === null) return 'overdue';

  // Due ON the day still counts as in-hand — you have until the end of it.
  return manilaToday(now) > due ? 'overdue' : 'provisional';
}

/** True when the board must shout rather than merely mention. */
export function isOverdue(i: ApprovalInputs, now: number = Date.now()): boolean {
  return approvalStanding(i, now) === 'overdue';
}

export type ReviewSummary = {
  provisional: number;
  overdue: number;
  /** The soonest date still ahead, or null when nothing is pending. */
  nextDue: string | null;
};

/**
 * Roll a board's worth of rows into the one line at the top.
 *
 * `nextDue` deliberately ignores overdue rows: once a date has passed it is not
 * "next", it is late, and it is counted in `overdue`. Mixing them would let a
 * single forgotten row keep reporting a reassuring past date as the deadline.
 */
export function summariseReviews(
  rows: readonly ApprovalInputs[],
  now: number = Date.now(),
): ReviewSummary {
  let provisional = 0;
  let overdue = 0;
  let nextDue: string | null = null;

  for (const row of rows) {
    const standing = approvalStanding(row, now);
    if (standing === 'overdue') {
      overdue += 1;
      continue;
    }
    if (standing !== 'provisional') continue;
    provisional += 1;
    const due = asCalendarDate(row.reviewBy);
    if (due && (nextDue === null || due < nextDue)) nextDue = due;
  }

  return { provisional, overdue, nextDue };
}

/**
 * How the board says it, in the owner's own terms. Returns null when there is
 * nothing to say, so a caller renders no banner rather than an empty one.
 */
export function reviewBanner(s: ReviewSummary): string | null {
  if (s.overdue > 0) {
    const n = s.overdue;
    return `${n} temporary approval${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} past ${n === 1 ? 'its' : 'their'} review date. ${n === 1 ? 'It was' : 'They were'} switched on on the understanding ${n === 1 ? 'it' : 'they'} would be looked at again.`;
  }
  if (s.provisional > 0) {
    const n = s.provisional;
    return `${n} approval${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} temporary${s.nextDue ? ` · review by ${s.nextDue}` : ''}.`;
  }
  return null;
}
