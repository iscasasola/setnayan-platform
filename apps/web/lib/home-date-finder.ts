/**
 * 📅 THE COUNTDOWN OPENS THE DATE FINDER (owner 2026-10-30, verbatim, asked "open the Date row, or jump straight to the
 * Date Finder?": *"date finder. because we want them to find the date for their event"* — the 2026-10-26 "FINAL
 * STRUCTURE" (3) ruling, *"Countdown will jump to Date Finder since this will control the Date of the event"*).
 *
 * The address is Home with `?date=find`: on Home the Countdown's tap is caught and the SAME date sheet Suppliers' date
 * chip opens ("Your date" · I have a date | Help me choose — `vendors/_components/fact-sheets.tsx` `FactSheet`) opens IN
 * PLACE on Help me choose, no navigation; from anywhere else the link lands on Home with it open. A pure module so the
 * Home widgets (server) and the opener (client) share one string.
 */
export const DATE_FINDER_PARAM = 'date';
export const DATE_FINDER_VALUE = 'find';

export function dateFinderHref(eventId: string): string {
  return `/dashboard/${eventId}?${DATE_FINDER_PARAM}=${DATE_FINDER_VALUE}`;
}
