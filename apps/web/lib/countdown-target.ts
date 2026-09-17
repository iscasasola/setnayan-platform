import { DEFAULT_EVENT_TZ, wallClockToInstant } from './schedule';

/**
 * countdown-target.ts — WHEN the guest countdown reaches zero.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * `events.event_date` is a `DATE` column, so it reaches the page as
 * `"2027-02-14"` — a DATE-ONLY string. The widget then did `new Date(targetIso)`,
 * and ECMAScript parses a date-only string as **UTC**. On a Manila wedding that
 * puts the target at 08:00 local, not midnight:
 *
 *     a guest at Manila midnight on the 13th was shown   1d 8h
 *     the truthful local remaining was                    1d 0h
 *
 * so the clock over-counted by eight hours and then hung on into the morning of
 * the wedding instead of retiring at the start of the day.
 *
 * 🔑 THE SIGN MATTERS AND THE ROW THAT REPORTED IT HAD IT BACKWARDS. It was
 * filed as "the countdown ends 8 hours EARLY". It ends eight hours **LATE**, and
 * the two have opposite fixes — anchor the date to the venue, never shift it.
 *
 * 🔑 THE WIDGET WAS NEVER WRONG. `target - Date.now()` is instant arithmetic and
 * is correct. The whole defect is in the value handed to it, which is why anyone
 * opening `countdown.tsx` to find the bug finds clean code and concludes the row
 * is false. Measure where a value ENTERS, not where it is used.
 *
 * ⚠ THE MATH IS NOT REIMPLEMENTED HERE. `wallClockToInstant` already does it and
 * its own docblock records this exact eight-hour Manila failure on the day-of
 * surfaces — the same bug, one surface over. A second copy is how two files start
 * disagreeing about when a wedding begins.
 */

/** `YYYY-MM-DD` and nothing else — the shape a `DATE` column arrives as. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The instant a countdown to `eventDate` should reach zero.
 *
 * · A DATE-ONLY value means a DAY, and a day starts at midnight **where the
 *   wedding is** — so it is anchored in `tz`, never in UTC and never in whatever
 *   zone the reader's laptop happens to be set to.
 * · A value that already carries a time is already an instant; it is left alone.
 * · Anything unparseable returns null, so a caller renders NO countdown rather
 *   than a confident wrong one. A missing clock is a gap; a wrong clock is a lie.
 */
export function countdownTargetMs(
  eventDate: string | null | undefined,
  tz: string = DEFAULT_EVENT_TZ,
): number | null {
  const raw = (eventDate ?? '').trim();
  if (!raw) return null;

  const m = DATE_ONLY.exec(raw);
  if (m) {
    const at = wallClockToInstant(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, tz);
    // `wallClockToInstant` returns null when Intl cannot read the zone. Falling
    // back to `new Date(raw)` there would silently restore the UTC parse this
    // module exists to remove, so an unreadable zone yields no countdown at all.
    return at;
  }

  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}
