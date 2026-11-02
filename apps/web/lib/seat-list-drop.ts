/**
 * seat-list-drop.ts — WHAT A GUEST LET GO ON A SEAT ROW DOES (Seats S1c, owner 2026-11-01, DECISION_LOG "SEATS STAYS ITS
 * OWN DOOR, BUT LOOKS AND WORKS LIKE THE GUESTS LIST" · "ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL FOR EVERY LIST").
 *
 * Seats › List is the Guests list grouped by table: one row per seat. A guest is pressed, held and dragged (the shared
 * edge scroll, `lib/drag-edge-scroll.ts`) — or picked with Swap and a seat tapped (the "tap · move" fallback). Both end
 * here: ONE answer for where they were let go. The seat plan's own shipped moves do the rest (`seatGuestHere`,
 * `tradeSeats`, `unseat`, with the "before a seat changes hands" ask in front), so nothing new writes.
 *
 *   · on an EMPTY seat          → they sit there (`place`);
 *   · on SOMEONE ELSE's seat    → the two trade (`trade`);
 *   · on "To seat"              → their seat goes (`unseat`) — only if they had one;
 *   · on their OWN seat / nowhere → nothing.
 *
 * Pure (no DOM): the drop rows carry their seat as data attributes (`seatDropAttrs`), read back by `readSeatDrop`.
 * 🔒 lib/seats-list-is-the-guests-list.test.ts
 */

export type SeatDropTarget =
  | { kind: 'seat'; tableId: string; seat: number; occupantId: string | null }
  | { kind: 'unseated' };

export type SeatDropPlan =
  | { kind: 'none' }
  | { kind: 'place'; guestId: string; tableId: string; seat: number }
  | { kind: 'trade'; guestId: string; otherId: string; tableId: string; seat: number }
  | { kind: 'unseat'; guestId: string };

/** The guest being moved — and whether they hold a seat now. */
export type SeatDropMover = { id: string; seated: boolean };

export function planSeatDrop(mover: SeatDropMover, target: SeatDropTarget | null): SeatDropPlan {
  if (!target) return { kind: 'none' };
  if (target.kind === 'unseated') return mover.seated ? { kind: 'unseat', guestId: mover.id } : { kind: 'none' };
  if (target.occupantId === mover.id) return { kind: 'none' };
  if (target.occupantId) return { kind: 'trade', guestId: mover.id, otherId: target.occupantId, tableId: target.tableId, seat: target.seat };
  return { kind: 'place', guestId: mover.id, tableId: target.tableId, seat: target.seat };
}

/** The attributes a drop row wears — what `readSeatDrop` reads back. */
export function seatDropAttrs(t: SeatDropTarget): Record<string, string> {
  if (t.kind === 'unseated') return { 'data-seat-drop': 'unseated' };
  return {
    'data-seat-drop': 'seat',
    'data-seat-drop-table': t.tableId,
    'data-seat-drop-seat': String(t.seat),
    ...(t.occupantId ? { 'data-seat-drop-guest': t.occupantId } : {}),
  };
}

/** A drop row's attributes (an element's `dataset`) → where it is; null when it is no drop row. */
export function readSeatDrop(d: { seatDrop?: string; seatDropTable?: string; seatDropSeat?: string; seatDropGuest?: string } | null | undefined): SeatDropTarget | null {
  if (!d?.seatDrop) return null;
  if (d.seatDrop === 'unseated') return { kind: 'unseated' };
  if (d.seatDrop !== 'seat' || !d.seatDropTable) return null;
  const seat = Number(d.seatDropSeat);
  if (!Number.isInteger(seat) || seat < 0) return null;
  return { kind: 'seat', tableId: d.seatDropTable, seat, occupantId: d.seatDropGuest || null };
}

/** "Table 5 · 8 of 10 seats" — the header's count, its words (the Guests list's "· N"). */
export function seatTallyWords(seated: number, capacity: number, fmt: (n: number) => string = String): string {
  return `${fmt(seated)} of ${fmt(capacity)} ${capacity === 1 ? 'seat' : 'seats'}`;
}
