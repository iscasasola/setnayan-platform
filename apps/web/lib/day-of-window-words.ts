/**
 * When day-of mode switches on and off, in plain words — for copy that must not
 * say "T-1h" (2026-10-21 sweep: /features said "from T-1h on the day itself",
 * jargon AND two windows out of date). Day-of mode is `LIVE_WINDOW_START_MS`
 * (12h) before midnight on the event day until `LIVE_WINDOW_END_MS` (36h) after
 * it — see lib/day-of-mode.ts, which re-exports these. Kept apart from that file
 * so a copy module importing the words does not ship the window maths to the
 * browser. `the-app-says-event-in-plain-words.test.ts` checks both sentences
 * against `getDayOfPhase`, so they cannot drift from the window again.
 */
export const DAY_OF_STARTS_PLAIN = 'noon the day before';
export const DAY_OF_ENDS_PLAIN = 'noon the day after';
