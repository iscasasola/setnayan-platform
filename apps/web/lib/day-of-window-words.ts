/**
 * When The Day switches on and off, in plain words — for copy that must not say
 * "T-1h". The Day opens at `THE_DAY_OPENS_DEFAULT_MIN` (06:00) on the event day
 * and closes at `THE_DAY_CLOSES_DEFAULT_MIN` (06:00) the morning after the last
 * day, both by default and both in the venue's clock (owner ruling, 10 Nov 2026)
 * — see lib/day-of-mode.ts, which re-exports these. Kept apart from that file so
 * a copy module importing the words does not ship the window maths to the
 * browser. `the-app-says-event-in-plain-words.test.ts` checks both sentences
 * against `getDayOfPhase`, so they cannot drift from the window again.
 */
export const DAY_OF_STARTS_PLAIN = '6am on the day';
export const DAY_OF_ENDS_PLAIN = '6am the morning after';
