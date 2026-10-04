/**
 * The two halves of a schedule time's round trip, in ONE module — because when
 * they lived apart they disagreed, and the disagreement silently moved weddings.
 *
 * ── WHAT A STORED SCHEDULE TIME ACTUALLY IS ─────────────────────────────────
 * `event_schedule_blocks.start_at` holds the VENUE'S WALL CLOCK written into a
 * UTC column. A 2 PM ceremony is stored as `14:00Z`. That is not a real instant
 * — read as one it is 10 PM in Manila — and the live data proves the intent:
 * prod holds `Ceremony 14:00+00`, `Hair & make-up 08:00+00`, `Last Song &
 * Send-off 21:45+00`. As wall clocks those are exactly right; as instants they
 * describe a ceremony at 10 PM and a send-off at 5:45 AM.
 *
 * ── THE BUG THIS EXISTS TO KILL ─────────────────────────────────────────────
 * The write side runs on the SERVER, where TZ is UTC: `new Date("2026-12-12T15:30")
 * .toISOString()` → `15:30Z`. The typed wall clock is stored verbatim. Correct.
 *
 * The prefill ran in the BROWSER and used local getters. In Manila (UTC+8) the
 * same `15:30Z` came back as `23:30`. So the couple saw "3:30 PM" on the line
 * and `23:30` in the box — and pressing Save without touching the time WROTE
 * BACK 23:30, moving the ceremony eight hours. Again on the next save. Their
 * guests' invitation page followed it.
 *
 * Nothing failed. Both halves were internally consistent; only together were
 * they wrong. And afterwards no repair is possible — a 10 PM ceremony is odd
 * but not impossible, so a damaged row is indistinguishable from a deliberate
 * one.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Both directions read and write the SAME components: the wall clock, untouched.
 * `toDatetimeLocalValue(fromDatetimeLocalValue(x)) === x` for every x. That
 * round trip is the property the test pins, and it is the only thing standing
 * between a couple and a schedule that walks.
 */

/**
 * `<input type="datetime-local">` value → what we store.
 *
 * The typed wall clock is preserved verbatim: "2026-12-12T15:30" → the ISO
 * string for 15:30 UTC. It is NOT a conversion — there is no timezone maths
 * here on purpose, because the value is not an instant.
 *
 * Returns null for empty or unparseable input, so a blank field clears rather
 * than storing garbage.
 */
export function fromDatetimeLocalValue(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // Built by hand rather than via `new Date(...)` so the result cannot depend on
  // the runtime's timezone. That dependence is what broke this: the server
  // happened to be UTC, the browser was not, and the same helper gave different
  // answers in each.
  return `${y}-${mo}-${d}T${h}:${mi}:00.000Z`;
}

/**
 * What we store → an `<input type="datetime-local">` value.
 *
 * Reads the UTC components, because that is where the wall clock was written.
 * Using local getters here is the original defect; do not "fix" this back.
 */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso.trim());
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/**
 * A stored schedule time → what a person should read on screen: "2:00 PM".
 *
 * ── WHY THIS IS NOT `toLocaleTimeString` ────────────────────────────────────
 * The obvious `new Date(iso).toLocaleTimeString(...)` reads the value as a real
 * instant and renders it in whatever timezone the code happens to be running
 * in. On the SERVER (TZ=UTC) that accidentally prints the wall clock correctly.
 * In a guest's BROWSER in Manila it prints eight hours late.
 *
 * That is why the couple's own home screen showed the ceremony at 10 PM while
 * the Schedule page one tap away showed 2 PM: one renders on the server, the
 * other in the browser, from the same stored value.
 *
 * This reads the components directly, so it gives the SAME answer everywhere —
 * which is the only property that matters for a value that was never an
 * instant in the first place.
 *
 * @param iso   a stored wall-clock-in-UTC value
 * @param opts  `hour12` follows the locale by default; pass false for 24-hour
 */
export function formatWallClock(iso: string | null | undefined, opts?: { hour12?: boolean }): string {
  const v = toDatetimeLocalValue(iso);
  if (!v) return '';
  const hhmm = v.slice(11);
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = mStr ?? '00';
  if (!Number.isFinite(h)) return '';
  if (opts?.hour12 === false) return `${String(h).padStart(2, '0')}:${m}`;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/* ── 📅 A MOVED DATE MOVES THE WHOLE DAY ─────────────────────────────────────
   Owner 2026-10-04 (DECISION_LOG "CHANGING THE EVENT DATE MOVES THE WHOLE
   SCHEDULE"), verbatim: *"Yes if possible"* — every schedule block moves by the
   same number of days as the event's date, each keeping its own time.

   Same rule as the round trip above: the stored value IS the wall clock, so a
   day is moved on the wall clock's own components. Whole days of UTC epoch
   arithmetic do exactly that — UTC has no daylight saving, so 14:00 stays 14:00
   whatever the venue's timezone does that week. Never `setDate()` on a local
   Date: that is the runtime-timezone dependence this module exists to kill. */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/**
 * The ONE day an event stands on — `YYYY-MM-DD` — or null when its date is not
 * one exact day (precision 'month' or 'year', or no date). An unknown precision
 * reads as 'day', the column's own default. Apply's ceremony time and the
 * whole-Schedule move both ask this one rule.
 */
export function exactDayOf(date: unknown, precision: unknown): string | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  if (precision === 'month' || precision === 'year') return null;
  return date.slice(0, 10);
}

/**
 * How many whole days `toDay` is after `fromDay` (both `YYYY-MM-DD`; negative
 * when it is before). 0 when either is not one exact day — no day, no move.
 */
export function wallClockDayShift(fromDay: string | null | undefined, toDay: string | null | undefined): number {
  if (typeof fromDay !== 'string' || typeof toDay !== 'string') return 0;
  const a = DAY_RE.exec(fromDay);
  const b = DAY_RE.exec(toDay);
  if (!a || !b) return 0;
  const days = (Date.UTC(+b[1]!, +b[2]! - 1, +b[3]!) - Date.UTC(+a[1]!, +a[2]! - 1, +a[3]!)) / DAY_MS;
  return Number.isInteger(days) ? days : 0;
}

/**
 * A stored schedule time moved by `days` whole days, its wall clock (hour,
 * minute, second) untouched: `toDatetimeLocalValue(out).slice(11)` equals
 * `toDatetimeLocalValue(iso).slice(11)` for every value. Null stays null; an
 * unreadable value is returned as it was (never replaced by a guess).
 */
export function shiftWallClockDays(iso: string | null | undefined, days: number): string | null {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || !Number.isInteger(days)) return iso;
  return new Date(t + days * DAY_MS).toISOString();
}
