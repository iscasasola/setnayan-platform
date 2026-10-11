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
export const DATE_STILL_TO_BE_CONFIRMED = 'The date is still to be confirmed.';

/**
 * A sentence that points at "the day", completed for an event with no date.
 * With a date it is returned exactly as given.
 */
export function withDayNote(sentence: string, eventDate: string | null | undefined): string {
  return (eventDate ?? '').trim() ? sentence : `${sentence} ${DATE_STILL_TO_BE_CONFIRMED}`;
}
