/**
 * ⬜ THE CLOSED-DAY DECISION, PURE (owner 2026-11-14, "Grey: no ask, no book"). The I/O half is
 * `lib/closed-day.server.ts`; this is the rule both the couple's ask and the supplier's yes apply to the facts the
 * date sheet reads (`readShopDateFacts`), so a test can hold it without a database.
 *
 *   · the month builder of the public "Check a date" page (`checkDateAnswer`), never a second reading of a calendar;
 *   · `closedOnly` — a FULL day is not closed: it is the waiting list's, and the yes refuses it on capacity;
 *   · only blocks the supplier CHOSE close a day — `manual` and `synced_calendar`. A `setnayan_booking` block marks a
 *     booked date and an `external_client` block a client booked elsewhere: both mean full, not closed;
 *   · a held day (`day_state = 'locked'`) closes it, as on the sheet.
 */
import { checkDateAnswer, type CheckDateInput } from '@/lib/check-a-date';

export const CLOSING_BLOCK_SOURCES: ReadonlySet<string> = new Set(['manual', 'synced_calendar']);

/** The couple's words when their ask names a day the supplier closed — the slot path's own sentence. */
export const CLOSED_DAY_COUPLE_MESSAGE =
  'The supplier has closed this date on their calendar — message them before booking this date.';

export type ClosedDayFacts = Pick<CheckDateInput, 'pools' | 'bookings' | 'blocks' | 'dayStates' | 'services'>;

/** A PH civil day `YYYY-MM-DD`, or null. */
export function civilDay(day: unknown): string | null {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** The month `day` falls in, and its first and last day. */
export function monthOf(day: string): { month: string; from: string; to: string } {
  const month = day.slice(0, 7);
  const [y = 1970, m = 1] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month, from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Is `day` closed by the shop — for this card when one is named, else for the shop as a whole? */
export function isClosedDay(facts: ClosedDayFacts, args: { serviceId: string | null; day: string; today: string }): boolean {
  if (args.day < args.today) return false;
  const answer = checkDateAnswer({
    pools: facts.pools,
    bookings: facts.bookings,
    blocks: facts.blocks.filter((b) => CLOSING_BLOCK_SOURCES.has(b.source)),
    dayStates: facts.dayStates,
    services: facts.services,
    months: [monthOf(args.day).month],
    today: args.today,
    closedOnly: true,
  });
  const forCard = args.serviceId ? answer.perService?.[args.serviceId] : undefined;
  return (forCard ?? answer.notBookable).includes(args.day);
}
