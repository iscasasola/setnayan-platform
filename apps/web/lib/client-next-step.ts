/**
 * ➡ THE "NEXT STEP" ROW ON TOP OF CHAT (owner 18 Nov 2026, DECISION_LOG "THE CLIENT PAGE GOES TO SEVEN TABS — BOTH
 * SIDES": *"Yes, keep it"*; drawing Q37bc7Bf v12 §2 "The flow"). ONE line naming the one thing that needs the supplier;
 * tapping it opens that tab. Pure: it reads only what the client page already read.
 *
 *   · not booked  → "Quote sent · no answer yet"          → Book & Budget (the quote)
 *   · booked      → "₱242,830 due Wed, Dec 9"             → Book & Budget (the payments)
 *   · event week  → "Sat, Dec 12 · crew in 1:00 PM"       → Schedule      (an unpaid due outranks it)
 *   · after it    → "Send the handover"                   → Files
 *
 * 🔑 NEVER A WRONG NEXT STEP: a stage whose data could not be read gives NOTHING (null), not the next stage down. A
 * refused plan read is not "nothing due"; a refused crew read is not "no call time"; a refused handover read is not
 * "nothing sent".
 */
import { formatPhp } from './php';
import { addDays, dayHeading } from './schedule-days';

export type NextStepPage = 'quote' | 'schedule' | 'files';

export type ClientNextStep = {
  line: string;
  page: NextStepPage;
  /** The part of the page it opens at (`id` of an element on it), or null for its top. */
  anchor: string | null;
};

export type NextStepInputs = {
  todayIso: string;
  eventDate: string | null;
  isBooked: boolean;
  /** Not booked: a sent (non-draft) quote exists, and nobody has accepted it or asked to book. null = the read failed. */
  quoteWaiting: boolean | null;
  /** Booked: the next unpaid installment, in pay order — `undefined` when the plan read failed. */
  nextDue: { amountPhp: number; dueDate: string | null } | null | undefined;
  /** This supplier's earliest crew call on the event day ("YYYY-MM-DDTHH:MM…", the venue's wall clock); undefined = unread. */
  crewCallAt: string | null | undefined;
  /** At least one handover was delivered; undefined = unread. */
  handoverSent: boolean | undefined;
};

/** The event week: the six days before the event, and the day itself. */
const EVENT_WEEK_DAYS = 6;

function clockOf(wall: string): string | null {
  const m = /T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return null;
  const h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${ap}`;
}

export function clientNextStep(i: NextStepInputs): ClientNextStep | null {
  const day = i.eventDate && /^\d{4}-\d{2}-\d{2}/.test(i.eventDate) ? i.eventDate.slice(0, 10) : null;
  if (!i.isBooked) {
    if (i.quoteWaiting === true) return { line: 'Quote sent · no answer yet', page: 'quote', anchor: null };
    return null;
  }
  const after = day !== null && i.todayIso > day;
  const eventWeek = day !== null && !after && i.todayIso >= addDays(day, -EVENT_WEEK_DAYS);
  if (after) {
    if (i.handoverSent === false) return { line: 'Send the handover', page: 'files', anchor: null };
    return null;
  }
  // Booked, before or in the event week: an unpaid due outranks everything.
  if (i.nextDue === undefined) return null;
  if (i.nextDue) {
    const when = i.nextDue.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(i.nextDue.dueDate) ? ` due ${dayHeading(i.nextDue.dueDate)}` : ' to collect';
    return { line: `${formatPhp(i.nextDue.amountPhp)}${when}`, page: 'quote', anchor: 'payments' };
  }
  if (eventWeek && day) {
    if (!i.crewCallAt) return null;
    const at = clockOf(i.crewCallAt);
    return at ? { line: `${dayHeading(day)} · crew in ${at}`, page: 'schedule', anchor: null } : null;
  }
  return null;
}

/**
 * What the work column opens on, on a computer, when no `?tab=` names a page (drawing §4): before booking Book &
 * Budget; once booked Details; in the event week Schedule.
 */
export function workColumnDefault(i: { todayIso: string; eventDate: string | null; isBooked: boolean }): 'quote' | 'details' | 'schedule' {
  if (!i.isBooked) return 'quote';
  const day = i.eventDate && /^\d{4}-\d{2}-\d{2}/.test(i.eventDate) ? i.eventDate.slice(0, 10) : null;
  if (day && i.todayIso <= day && i.todayIso >= addDays(day, -EVENT_WEEK_DAYS)) return 'schedule';
  return 'details';
}
