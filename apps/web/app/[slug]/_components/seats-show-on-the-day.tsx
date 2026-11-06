import { withDayNote } from '../_lib/day-words';

/**
 * SEATS SHOW ON THE DAY — the ONE waiting state of the three seat pages.
 *
 * A guest's walk, 2026-10-11 (fault N20): before seats are shown, `/find-seat`,
 * `/seat` and `/find-my-table` each told it differently — three titles ("Your
 * seat shows on the day" · "Seating shows on the day" · "Your table shows on
 * the day") and three different promises under them. Owner the same day: one
 * waiting state, one sentence.
 *
 * The rule under it is unchanged (owner 2026-09-30, "SEATS SHOW ON THE EVENT
 * DAY — THE COUPLE'S SWITCH ONLY OPENS THEM EARLY"): each page still asks
 * `guestsMaySeeSeatsFor` and draws this when the answer is no.
 *
 * THE WORDS. The title is `/find-seat`'s, as shipped. The one sentence is what
 * is true on all three pages — come back on the day, and the table is there —
 * and for an event with no date yet it is followed by "The date is still to be
 * confirmed." (`withDayNote`).
 *
 * No frame: words on the page (a frame only on something a person presses).
 * Each page keeps its own shell and its own way back around this.
 *
 * 🛡 app/[slug]/_components/seats-show-on-the-day.test.ts
 */
export const SEATS_WAITING_TITLE = 'Your seat shows on the day';
const SEATS_WAITING_LINE = 'Come back to this page on the day and you’ll find your table.';

/** The one sentence under the title — with the date note when the event has no date. */
export function seatsWaitingLine(eventDate: string | null | undefined): string {
  return withDayNote(SEATS_WAITING_LINE, eventDate);
}

export function SeatsShowOnTheDay({
  eventDate,
  className = '',
}: {
  eventDate: string | null | undefined;
  /** The page's own spacing around it — never a frame. */
  className?: string;
}) {
  return (
    <div data-seats-waiting="" className={`text-center ${className}`.trim()}>
      <h1 className="font-serif text-[2rem] font-medium leading-[1.12] text-ink">{SEATS_WAITING_TITLE}</h1>
      <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-ink/75">{seatsWaitingLine(eventDate)}</p>
    </div>
  );
}
