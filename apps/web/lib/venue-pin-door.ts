/**
 * venue-pin-door.ts — WHO MAY SET A VENUE'S PIN, AND WHERE IT IS KEPT.
 *
 * Owner, 2026-10-22 (DECISION_LOG "A MANUAL VENUE TAKES THE COUPLE'S PIN; A SHOP'S VENUE TAKES THE SHOP'S"), on
 * Studio › Info › Venues: *"can we place the setting the pin here also? · manual entry venues can set pin. · venues
 * from actual suppliers cannot customize pin, only follows what the suppliers pinned."* · *"manual is the manual
 * added suppliers."*
 *
 * ONE VALUE, TWO DOORS. A pin has exactly one home, and every editor that shows it (Studio › Info, the Suppliers
 * place sheet, Details › Venues) writes THAT home — never a copy:
 *
 *   · `shop`   — the venue is a Setnayan shop (`pinFrom: 'shop'`). Its pin is the shop's own `hq_*`. NOBODY on the
 *                couple's side edits it, in any mode — not even "Enter your own" (which still types the name and the
 *                address). Unpinned → the editors say {@link shopUnpinnedLine}; the guest map says "not on the map".
 *   · `own`    — no venue is booked, or the card is on the couple's own details ("Enter your own") over a booking
 *                that is NOT a shop: the event's own columns (`ceremony_venue_*` / `venue_*`), through the Event Hub
 *                draft — guests see it at Apply.
 *   · `manual` — the venue is a supplier the couple added by hand, shown on its own details: the pin on that
 *                supplier's contact card (`event_manual_vendors.address_*`), through the card's own writer
 *                (`saveSelfAddedServiceCard`, via `saveManualVenuePin`) — the same row the Suppliers card edits, and
 *                live at once, as it always was there. When that supplier CLAIMS its shop the booking becomes `shop`
 *                and the shop's pin takes over (`lib/event-venues.ts`).
 *   · `record` — a pick from the venue list (`directory`), on its details: the list's record, read-only here
 *                ("Enter your own" is still offered where the editor offers it).
 *
 * PURE and client-safe — the editors and the guard (`a-shop-venue-follows-the-shops-pin.test.ts`) ask THIS.
 */
import type { VenuePinSource } from '@/lib/event-venues';

export type VenuePinDoor = 'shop' | 'own' | 'manual' | 'record';

/** The booked venue as an editor holds it (`VenueSlot.booked` / `PlaceSlot.booked`). */
export type BookedForPin = { pinFrom?: VenuePinSource | null; vendorId?: string | null } | null;

/** Where this card's pin is set — see the docblock. `own` = the card is on the couple's own details. */
export function venuePinDoor(booked: BookedForPin, own: boolean): VenuePinDoor {
  if (booked?.pinFrom === 'shop') return 'shop';
  if (!booked || own) return 'own';
  if (booked.pinFrom === 'directory') return 'record';
  return booked.vendorId ? 'manual' : 'record';
}

/** The note under a shop's venue that has not pinned itself yet — said, never left out (owner 2026-10-22). */
export function shopUnpinnedLine(shop: string): string {
  return `${shop.trim() || 'This supplier'} hasn’t pinned their place yet`;
}

/** The line under a shop's venue that has — whose pin the guests' map uses. */
export function shopPinnedLine(shop: string): string {
  return `Pinned by ${shop.trim() || 'the supplier'}`;
}

/** The line a shop's pin says, pinned or not. */
export function shopPinLine(shop: string, pinned: boolean): string {
  return pinned ? shopPinnedLine(shop) : shopUnpinnedLine(shop);
}
