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

/** One day, in milliseconds. */
const DAY_MS = 86_400_000;

/** What the countdown reads at one instant. */
export type CountdownReading = { days: number; hours: number; minutes: number; seconds: number; isPast: boolean };

/**
 * 🔢 THE COUNTDOWN IS NEVER FALSE (controller, 2026-10-05, after the walk on
 * maria-and-jose found Details reading 67 days and Home "68 days to go"). Its
 * four tiles are the real time left to the start of the day in the event's zone
 * (`countdownTargetMs`, Manila fallback): whole days, then hours, minutes and
 * seconds — 67 d 12 h 42 m on 5 Oct at 11:18 for a 12 Dec wedding, which is
 * exactly what is left. Home says the same number (`daysToGo` below).
 *
 * Pure (both instants passed in) so a test can walk every hour of a day.
 */
export function countdownReading(targetMs: number, nowMs: number): CountdownReading {
  const ms = targetMs - nowMs;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  return {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    isPast: false,
  };
}

/** Days to go, in words a person says — the ONE rule Home and the countdown share. */
export type DaysToGo =
  | { kind: 'days'; days: number }
  | { kind: 'tomorrow' }
  | { kind: 'today' }
  | { kind: 'past'; daysAgo: number };

/** `YYYY-MM-DD` of an instant, in `tz`. */
function dayIn(tz: string, ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * 🔢 ONE RULE FOR "DAYS TO GO" — whole days of REAL time left to the start of
 * the event's day, in its zone (Manila when it has none): the same number as
 * the countdown's Days tile (`countdownReading`), so the two never disagree and
 * neither is ever more than the time that is actually left. At the end it says
 * what a person says — "Tomorrow" on the day before (the calendar day after
 * today is the event's), "Today" on the day itself — rather than "0 days".
 *
 * Null when the date cannot be anchored (no countdown beats a wrong one).
 */
export function daysToGo(
  eventDate: string | null | undefined,
  tz: string | null | undefined,
  nowMs: number,
): DaysToGo | null {
  const zone = tz || DEFAULT_EVENT_TZ;
  const target = countdownTargetMs(eventDate, zone);
  if (target === null) return null;
  const eventDay = dayIn(zone, target);
  const today = dayIn(zone, nowMs);
  const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const calendar = Math.round((utc(eventDay) - utc(today)) / DAY_MS);
  if (calendar < 0) return { kind: 'past', daysAgo: -calendar };
  if (calendar === 0) return { kind: 'today' };
  if (calendar === 1) return { kind: 'tomorrow' };
  return { kind: 'days', days: countdownReading(target, nowMs).days };
}
