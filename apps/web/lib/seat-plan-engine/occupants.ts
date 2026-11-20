/**
 * lib/seat-plan-engine/occupants.ts — 👥 WHO FILLS A SEAT. THE ONLY THING THAT DIFFERS BETWEEN THE TWO SIDES.
 *
 * Owner, verbatim (DECISION_LOG 2026-11-20): *"The Seats on the Event will be assigned from the guests / The seat from
 * the Suppliers will be assigned when someone is booked."*
 *
 *   EVENT    (the couple's Seat plan) — a seat is filled FROM THE GUEST LIST: the couple, the auto-draft, drag a face.
 *   SUPPLIER (a shop's Spaces)        — a seat, a table or a room is filled WHEN SOMEONE IS BOOKED, through a booking,
 *                                       never by a hand-typed name.
 *
 * Everything else — the room, the tables, the chairs, Line up, the checks — is the same engine. A supplier plan never
 * takes a guest, and an event plan never takes a booking: `canFill` is the one gate, and both sides call it.
 *
 * 🔒 Couples see "available", never which one (owner 18 Nov, the Step 5 rule): `coupleSeesOfBookings` gives a couple
 * the count of what is free and nothing that names a table or room.
 *
 * Seat numbers are the couple's own convention: 0-based chair index into `planTableGeometry(t).seats`, the same as
 * `seat_assignments.seat_number`. Deleted chairs (`removedSeats`) are never free. Pure.
 * 🔒 lib/seat-plan-engine/engine.test.ts
 */
import { removedSeatSet } from './geometry';
import { planSeatCount, planTableGeometry, type PlanTable } from './plan';

export type PlanSide = 'event' | 'supplier';

export type SeatOccupant =
  /** From the event's guest list (`guests.guest_id`). */
  | { kind: 'guest'; id: string; name: string }
  /** From a booking (the supplier side, Step 5). `party` = how many it seats; a whole-table or room booking fills all. */
  | { kind: 'booking'; id: string; name: string; party: number };

/** One filled seat. `seat` null = the whole table or room is held (a booking may take a whole table). */
export type SeatFill = { tableId: string; seat: number | null; occupant: SeatOccupant };

/** Which occupant each side takes. */
export const OCCUPANT_OF_SIDE: Record<PlanSide, SeatOccupant['kind']> = { event: 'guest', supplier: 'booking' };

/** The one gate: an event seat takes a guest; a supplier seat takes a booking. Nothing else fills a seat. */
export function canFill(side: PlanSide, occupant: Pick<SeatOccupant, 'kind'>): boolean {
  return OCCUPANT_OF_SIDE[side] === occupant.kind;
}

/** Chairs of a table that cannot take anyone: deleted, or already filled (a whole-table fill takes them all). */
export function takenSeats(t: PlanTable, fills: readonly SeatFill[]): Set<number> {
  const chairs = planTableGeometry(t).seats.length;
  const taken = removedSeatSet(t.removedSeats, chairs);
  for (const f of fills) {
    if (f.tableId !== t.id) continue;
    if (f.seat === null) for (let i = 0; i < chairs; i++) taken.add(i);
    else if (f.seat >= 0 && f.seat < chairs) taken.add(f.seat);
  }
  return taken;
}

/** The next free chair, lowest first — round two, pick 5: "They take the next free seat. The list stays open." */
export function nextFreeSeat(t: PlanTable, fills: readonly SeatFill[]): number | null {
  const chairs = planTableGeometry(t).seats.length;
  const taken = takenSeats(t, fills);
  for (let i = 0; i < chairs; i++) if (!taken.has(i)) return i;
  return null;
}

/** Seat one occupant at a table's next free chair — refused (null) when the side does not take them or the table is full. */
export function fillNextSeat(side: PlanSide, t: PlanTable, fills: readonly SeatFill[], occupant: SeatOccupant): SeatFill | null {
  if (!canFill(side, occupant)) return null;
  const seat = nextFreeSeat(t, fills);
  return seat === null ? null : { tableId: t.id, seat, occupant };
}

/** How many of the table's real seats are filled. */
export function filledCount(t: PlanTable, fills: readonly SeatFill[]): number {
  const usable = planSeatCount(t);
  const removed = removedSeatSet(t.removedSeats, planTableGeometry(t).seats.length).size;
  return Math.min(usable, takenSeats(t, fills).size - removed);
}

/** "1 of 10 seated" (event) · "6 of 10 booked" (supplier). */
export function fillWords(side: PlanSide, t: PlanTable, fills: readonly SeatFill[]): string {
  return `${filledCount(t, fills)} of ${planSeatCount(t)} ${side === 'event' ? 'seated' : 'booked'}`;
}

/** The fill legend the floor colours by: Full · Has room · Empty. */
export function fillState(t: PlanTable, fills: readonly SeatFill[]): 'full' | 'has_room' | 'empty' {
  const n = filledCount(t, fills);
  if (n === 0) return 'empty';
  return n >= planSeatCount(t) ? 'full' : 'has_room';
}

/** 🔒 A couple's view of a supplier's bookings: how many seats are free — never which table or room. */
export function coupleSeesOfBookings(tables: readonly PlanTable[], fills: readonly SeatFill[]): { available: number } {
  const available = tables.reduce((s, t) => s + (planSeatCount(t) - filledCount(t, fills)), 0);
  return { available: Math.max(0, available) };
}
