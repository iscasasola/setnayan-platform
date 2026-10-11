/**
 * "ON THE DAY", FOR AN EVENT THAT HAS NO DAY YET.
 *
 * A guest's walk, 2026-10-11, on an event with no date: the Event Hub's line
 * read *"We'd love to celebrate with you on . You're joining us as Guest"* —
 * a sentence with a hole in it — and three seat pages said their table "shows
 * on the day" for an event whose day nobody had been told.
 *
 * The rule, for every guest-facing sentence that names the day:
 *   · a sentence that PRINTS the date drops the date's words when there is
 *     none (the greeting, the plus-one's door) — never a preposition left
 *     standing in front of nothing;
 *   · a sentence that POINTS at the day ("…shows here on the day") keeps its
 *     words and is followed by one plain sentence saying the date is not set.
 *
 * The words are the repo's own for the dateless case — "Date to be confirmed"
 * (`lib/clusters.ts`, and the note on `formatEventDateWithPrecision`).
 *
 * 🛡 lib/a-dateless-event-prints-no-hole.test.ts
 */
import { formatEventDate, formatEventDateWithPrecision } from '@/lib/events';

export const DATE_STILL_TO_BE_CONFIRMED = 'The date is still to be confirmed.';

/**
 * A sentence that points at "the day", completed for an event with no date.
 * With a date it is returned exactly as given.
 */
export function withDayNote(sentence: string, eventDate: string | null | undefined): string {
  return (eventDate ?? '').trim() ? sentence : `${sentence} ${DATE_STILL_TO_BE_CONFIRMED}`;
}

/**
 * WHEN, AS THE HUB'S GREETING MAY SAY IT — only as much as the hosts decided.
 *
 * `events.event_date` is a real day only when `event_date_precision` says
 * `'day'`. For `'month'` and `'year'` the column holds a PLACEHOLDER day, and
 * the greeting printed it in full: "We'd love to celebrate with you on March 9,
 * 2027" for an event whose hosts had chosen only a year (found 2026-10-11 while
 * fixing N06; `lib/join-door-meta.ts` has the full account, and this asks the
 * same formatter it does — `formatEventDateWithPrecision` — never a second rule).
 *
 *   'day'    → { day: 'December 12, 2026' }   — "…with you on December 12, 2026"
 *   'month'  → { loosely: 'in August 2027' }  — "…with you in August 2027"
 *   'year'   → { loosely: 'sometime in 2027' }
 *   no date, or a precision this does not know → null — the sentence without a when.
 *
 * `precision` NOT GIVEN AT ALL (`undefined`: a caller that never read the
 * column) keeps the day, which is what every such caller printed before.
 */
export type GreetingWhen = { day: string; loosely?: undefined } | { loosely: string; day?: undefined } | null;

export function greetingWhen(eventDate: string | null | undefined, precision?: string | null): GreetingWhen {
  if (!(eventDate ?? '').trim()) return null;
  if (precision === undefined || precision === 'day') {
    const day = formatEventDate(eventDate ?? null) || null;
    return day ? { day } : null;
  }
  if (precision === 'month') {
    const month = formatEventDateWithPrecision(eventDate ?? null, 'month') || null;
    return month ? { loosely: `in ${month}` } : null;
  }
  if (precision === 'year') {
    const year = formatEventDateWithPrecision(eventDate ?? null, 'year') || null;
    return year ? { loosely: year.charAt(0).toLowerCase() + year.slice(1) } : null;
  }
  return null;
}
