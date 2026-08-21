/**
 * WHEN AN ANSWER WAS RECORDED — rendered in the event's own clock, always.
 *
 * `guests.rsvp_responded_at` is a true INSTANT (`new Date().toISOString()`),
 * unlike `events.event_date`, which is a bare DATE. Both still have to be
 * displayed against a NAMED timezone: the 2026-08-04 sweep found 17 live
 * defects whose single shared cause was a value formatted in whatever clock
 * the machine happened to be running. CI runs in UTC, which is exactly the
 * offset where "an evening in Manila" silently becomes the previous day.
 *
 * ⚠ THE VALUE DOES NOT MEAN "WHEN THEY REPLIED". Three of the four writers are
 * host-side dashboard paths, and in production 28 of 36 guests carry a stamp
 * while only 3 people have ever scanned anything — so nearly every one of those
 * was the host typing it in. The copy this feeds says "recorded", never
 * "replied", because the second sentence would be false for most rows.
 *
 * ⚠ AND AN ABSENT VALUE DOES NOT MEAN "NEVER ANSWERED". The writers CLEAR it to
 * null whenever the answer moves back to pending or maybe. Callers must render
 * nothing at all when this returns null — never "hasn't replied".
 */

/** Asia/Manila is UTC+8 all year (no DST), so a named zone is exact here. */
const EVENT_CLOCK = 'Asia/Manila';

const FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_CLOCK,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * `'2026-12-12T15:04:00.000Z'` → `'12 Dec 2026'` (in the event's clock).
 *
 * Returns null for null, undefined, blank, or anything that does not parse —
 * never the string `'Invalid Date'`, which is what a raw `new Date(x)` renders
 * straight into the page.
 */
export function formatRecordedAt(iso: string | null | undefined): string | null {
  if (!iso || !iso.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return FMT.format(new Date(ms));
}
