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
