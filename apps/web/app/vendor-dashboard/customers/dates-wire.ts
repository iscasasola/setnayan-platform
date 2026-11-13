import type { CalendarBlockEntry, PoolBookingEntry } from '@/lib/vendor-schedule';
import type { DatesBlock, DatesBooking } from '@/lib/vendor-dates';

/**
 * 📅 WHAT THE MONTH SENDS TO THE BROWSER — one trim for every calendar that draws the shop's month (Clients › Dates and
 * the picked client's Schedule, v113 `calC`; one part, not a second calendar). Only what the month and a day's rows
 * read crosses the wire: a block's contact and note never do, an outside booking's id never does.
 */
export function datesBookingsForWire(
  bookings: PoolBookingEntry[],
  /** 🗓 The booked day's hours and the shop's own arrive · done (`readBookedDayHours`); absent = the plain row. */
  hours?: ReadonlyMap<string, { hours: string | null; mine: string | null; unread?: true }>,
): DatesBooking[] {
  return bookings.map((b) => {
    const h = hours?.get(b.poolBookingId);
    return { poolId: b.poolId, bookedDate: b.bookedDate, eventName: b.eventName, ...(h ? { hours: h.hours, mine: h.mine, ...(h.unread ? { hoursUnread: true } : {}) } : {}) };
  });
}

export function datesBlocksForWire(blocks: CalendarBlockEntry[]): DatesBlock[] {
  return blocks.map((k) => ({
    // A closure's id (the day switch reopens a one-day closure by it); an outside booking's never crosses.
    blockId: k.source === 'manual' ? k.blockId : undefined,
    poolId: k.poolId,
    source: k.source,
    startDate: k.startDate,
    endDate: k.endDate,
    label: k.source === 'external_client' ? null : k.label,
    clientName: k.source === 'external_client' ? k.clientName : null,
    clientTime: k.source === 'external_client' ? k.clientTime : null,
    repeat: k.repeat,
    repeatUntil: k.repeatUntil,
    dayPart: k.dayPart,
  }));
}
