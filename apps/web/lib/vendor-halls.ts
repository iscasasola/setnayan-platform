/**
 * vendor-halls.ts — A VENUE'S HALLS ON THE DAY (owner 2026-10-14 🏛 "Approve all"; prototype section 9 moments
 * "the day per hall" · "Joined halls" · "Add from outside · which halls").
 *
 * A hall is a schedule (`vendor_schedule_pools.is_hall`) with its own guests; a card USES one or more halls
 * (`vendor_service_halls`). Booking a joined hall takes a seat on each hall (`acquire_schedule_pools`), so:
 *   a hall is TAKEN on a day when its seats are used (Setnayan + outside) or an all-day closure covers it;
 *   a joined card is NOT AVAILABLE when any of its halls is taken — and says which;
 *   uninvolved halls stay free.
 * Pure — the page reads, this decides the words. The database answers the same question for the supplier's yes
 * (`vendor_card_halls_on`) and for the booking path; this is how the screen says it.
 */
import { blockClosesDay, type DayPart, type RepeatRule } from './not-available';

export type Hall = { poolId: string; name: string; capacity: number; seated: number | null; standing: number | null };
export type HallBooking = { poolId: string; eventId: string; title: string; time?: string | null; outside?: boolean };
export type HallBlock = {
  poolId: string | null;
  source: 'manual' | 'setnayan_booking' | 'synced_calendar' | 'external_client';
  startDate: string;
  endDate: string;
  label?: string | null;
  clientName?: string | null;
  clientTime?: string | null;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  dayPart?: DayPart | null;
};
export type HallCard = { serviceId: string; name: string; poolIds: string[] };

/** "150 seated · 250 standing" · "150 seated" · '' — a hall's guests in words. */
export function hallGuests(h: Pick<Hall, 'seated' | 'standing'>): string {
  return [h.seated ? `${h.seated} seated` : '', h.standing ? `${h.standing} standing` : ''].filter(Boolean).join(' · ');
}

/** What each hall holds on the day — its bookings (Setnayan + outside) and whether it is taken. */
export function hallsOnDay(
  day: string,
  halls: readonly Hall[],
  bookings: readonly HallBooking[],
  blocks: readonly HallBlock[],
): { hall: Hall; used: HallBooking[]; closedBy: string | null; taken: boolean }[] {
  return halls.map((hall) => {
    const used: HallBooking[] = bookings.filter((b) => b.poolId === hall.poolId);
    for (const b of blocks) {
      if (b.source === 'external_client' && b.poolId === hall.poolId && blockClosesDay(b, day)) {
        used.push({ poolId: hall.poolId, eventId: `out:${b.clientName ?? ''}:${b.clientTime ?? ''}`, title: b.clientName?.trim() || 'Booking from outside', time: b.clientTime ?? null, outside: true });
      }
    }
    const closure = blocks.find(
      (b) => (b.source === 'manual' || b.source === 'synced_calendar') && (b.poolId === null || b.poolId === hall.poolId) && blockClosesDay(b, day),
    );
    const closedBy = closure ? (closure.label?.trim() && closure.label.trim() !== 'Unavailable' ? closure.label.trim() : 'Not available') : null;
    return { hall, used, closedBy, taken: closedBy !== null || used.length >= Math.max(1, hall.capacity) };
  });
}

const andList = (a: string[]) => (a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/** The day's answer for a venue: "All halls free" · "Hall B · Hall C free · Hall A booked" · "All halls taken". */
export function hallsAnswer(state: ReturnType<typeof hallsOnDay>): { tone: 'ok' | 'bad'; word: string; line: string } | null {
  if (state.length === 0) return null;
  const free = state.filter((s) => !s.taken).map((s) => s.hall.name);
  const taken = state.filter((s) => s.taken).map((s) => s.hall.name);
  if (taken.length === 0) return { tone: 'ok', word: 'All halls free', line: 'nothing on this day' };
  if (free.length === 0) return { tone: 'bad', word: 'All halls taken', line: `${andList(taken)} booked` };
  return { tone: 'ok', word: `${free.join(' · ')} free`, line: `${taken.join(' · ')} booked` };
}

/** A joined card on the day: free, or which of its halls is taken ("Hall A is booked that day"). */
export function joinedCardOnDay(card: HallCard, state: ReturnType<typeof hallsOnDay>, halls: readonly Hall[]): { free: boolean; line: string } {
  const mine = state.filter((s) => card.poolIds.includes(s.hall.poolId));
  const taken = mine.filter((s) => s.taken).map((s) => s.hall.name);
  if (taken.length > 0) return { free: false, line: `${andList(taken)} ${taken.length === 1 ? 'is' : 'are'} booked that day` };
  const names = halls.filter((h) => card.poolIds.includes(h.poolId)).map((h) => h.name);
  const seated = halls.filter((h) => card.poolIds.includes(h.poolId)).reduce((n, h) => n + (h.seated ?? 0), 0);
  return { free: true, line: [seated > 0 ? `${seated} seated` : '', names.join(' + ')].filter(Boolean).join(' · ') };
}

/** For the add sheet: of the halls picked, which are taken on the date — "Hall A is booked that day" / "A + B free that day". */
export function hallsPickLine(picked: readonly string[], state: ReturnType<typeof hallsOnDay>): { tone: 'ok' | 'bad'; text: string } | null {
  if (picked.length === 0) return null;
  const mine = state.filter((s) => picked.includes(s.hall.poolId));
  const taken = mine.filter((s) => s.taken).map((s) => s.hall.name);
  if (taken.length > 0) return { tone: 'bad', text: `${andList(taken)} ${taken.length === 1 ? 'is' : 'are'} booked that day` };
  return { tone: 'ok', text: `${mine.map((s) => s.hall.name).join(' + ')} free that day` };
}
