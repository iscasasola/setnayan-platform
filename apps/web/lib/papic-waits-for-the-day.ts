import { openDateWords } from './event-date-options';

/**
 * 📅 PAPIC WAITS FOR A FIXED DAY — AND SAYS SO TRUTHFULLY (walk 16 Nov 2026, EB-191).
 *
 * Papic's capture window is built from the event's LOCKED day (`resolveStoredWindow` on `event_date`): with only
 * options, nobody knows which day to open the cameras on, so the rule stays. What was false was the line: "Switches
 * on when your date is set" on a wedding whose header reads June 19, 2027 (one picked option, not yet fixed).
 * It now says what is missing — the exact day — and names the day(s) the couple picked, in the date sheet's own
 * words ("Pick the day").
 */
export function papicWaitsForTheDayWords(ev: Record<string, unknown>): string {
  const open = openDateWords({
    mode: ev.date_mode,
    candidates: ev.date_candidates,
    windowStart: ev.date_window_start,
    windowEnd: ev.date_window_end,
    days: ev.event_days,
  });
  return open ? `Switches on when you pick the day · you’re considering ${open}` : 'Switches on when you pick the day';
}
