/**
 * 📅 The hosts' "The whole day" (Unichat part F) — its shape, and the face of a read that failed outright. The reads are
 * `lib/hosts-whole-day.server.ts`; the screen is `app/_components/chat/whole-day-rise.tsx`.
 */
import { clientAgenda, dayMonthWords, type Agenda } from './client-agenda';
import type { HostAsk } from './schedule-ask';
import type { SupplierDay } from './supplier-schedule';

export type WholeDay = {
  eventId: string;
  /** The shop this chat is with, as the hosts read it ("Lumina Lights & Sound"). */
  shopName: string;
  agenda: Agenda;
  eventDate: string | null;
  eventDayWords: string | null;
  unreadLine: string | null;
  /** Every chapter and moment; `mine` = this shop's. null = the day could not be read. */
  day: SupplierDay | null;
  /** This shop's bookings on the event (`event_vendors.vendor_id`) — who the ask goes to. */
  shopBookingIds: string[];
  /** The hosts' asks of this shop; null = refused (said on the ask form). */
  asks: HostAsk[] | null;
};

/** Words for a list whose reads failed outright: said, never an empty day. */
export const WHOLE_DAY_UNREAD = 'Your schedule with them couldn’t load just now. Reload to try again.';

/** The whole day when its reads threw: the agenda is empty AND says why; the day is `null` ("Couldn't load the day"). */
export function wholeDayUnread(args: { eventId: string; shopName: string; eventDate: string | null; todayIso: string }): WholeDay {
  return {
    eventId: args.eventId,
    shopName: args.shopName,
    agenda: clientAgenda({ todayIso: args.todayIso, eventDate: args.eventDate, days: [], quote: null }),
    eventDate: args.eventDate,
    eventDayWords: dayMonthWords(args.eventDate),
    unreadLine: WHOLE_DAY_UNREAD,
    day: null,
    shopBookingIds: [],
    asks: null,
  };
}
