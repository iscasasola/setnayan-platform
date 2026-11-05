/**
 * apps/web/lib/sample-event/date.ts
 *
 * 📅 THE SAMPLE'S DAY, DERIVED AT READ TIME (owner GO 2026-11-02; corpus
 * SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md item 1, DECISION_LOG "MARIA AND JOSE").
 *
 * Maria and Jose are ALWAYS in preparation: their wedding is the nearest
 * Saturday on or after (today + 3 months), today read on the venue's clock
 * (Asia/Manila). Nothing in the sample stores a date — every other date (the
 * chapters, the moments, the call times, the reply-by line) is this day plus
 * an offset, so the sample can never drift into "the day" or "after".
 *
 * Pure: no imports, no clock of its own — the caller hands `now`, which is how
 * `sample-content.test.ts` freezes it.
 */

/** The venue's clock. The sample is a Philippine wedding. */
export const SAMPLE_EVENT_TZ = 'Asia/Manila';

/** Manila is UTC+8 all year (no daylight saving) — the calendar day there, as Y/M/D. */
function manilaDay(now: Date): { y: number; m: number; d: number } {
  const t = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

const iso = (t: Date) => t.toISOString().slice(0, 10);

/**
 * The wedding day as `YYYY-MM-DD`: the nearest Saturday on or after today + 3
 * calendar months (a day past the end of the target month clamps to its last
 * day — 30 November + 3 months is 28/29 February, never 2 March).
 */
export function sampleEventDate(now: Date): string {
  const { y, m, d } = manilaDay(now);
  const lastOfTarget = new Date(Date.UTC(y, m + 4, 0)).getUTCDate();
  const target = new Date(Date.UTC(y, m + 3, Math.min(d, lastOfTarget)));
  const toSaturday = (6 - target.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + toSaturday);
  return iso(target);
}

/** Today on the venue's clock, `YYYY-MM-DD` — what "before the day" is measured against. */
export function sampleToday(now: Date): string {
  const { y, m, d } = manilaDay(now);
  return iso(new Date(Date.UTC(y, m, d)));
}

/** A day `offset` days from `day` (`YYYY-MM-DD`). */
export function sampleDayPlus(day: string, offset: number): string {
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + offset);
  return iso(t);
}

/**
 * A wall-clock time on `day`, in the shape the schedule stores it: the venue's
 * own clock PARKED IN UTC (`2027-02-06T15:00:00Z` = 3:00 PM in Manila — see
 * `ScheduleBlockRow.start_at`). `hhmm` is `HH:MM`, 24-hour.
 */
export function sampleWallClock(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00Z`;
}
