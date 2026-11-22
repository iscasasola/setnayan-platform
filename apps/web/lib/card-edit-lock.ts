/**
 * lib/card-edit-lock.ts — the PURE half of the open-bookings rule: the words and shapes the Card Maker (a client
 * component) draws. No I/O and no server import, so the maker's bundle never pulls the database read
 * (`lib/service-open-bookings.ts`, which re-exports all of this and holds the reads and the server gate).
 */

export type OpenBooking = { eventName: string; eventDate: string | null };

/** What the shop's cards carry: how many couples ever picked it (the delete-or-hide question) and which are open. */
export type CardBookings = { picked: number; open: OpenBooking[] };

/**
 * "14 Dec 2026" — the calendar day as stored (a DATE column), never shifted by the reader's timezone. Exported for the
 * Share picker's event rows (`lib/service-share-targets.server.ts`), which name the same events the same way.
 */
export function dayMonthYear(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * 🔒 A CARD A BOOKED CLIENT IS USING CANNOT BE EDITED (owner 19 Nov 2026, DECISION_LOG "SERVICE CARD EDIT LOCK +
 * SUPPLIER CLAIM JOURNEY", verbatim: *"Also add the rule that you can only edit a service card, if there are no booked
 * client that you are working with."*).
 *
 * NOT A NEW IDEA OF "BOOKED": the SAME open set the delete and turn-off locks read (`OPEN_BOOKING_STATUSES` —
 * contracted · deposit_paid · delivered, on a live event), through the SAME read (`readCardBookings`). A card is
 * unlocked the moment every booking on it is `complete`, cancelled (out of the booked set) or its event was deleted.
 *
 * The lock's Problem and Solution are drawn by the shared lock part (`LockExplainer`, app/_components/lock) — the
 * card's 🔒 row in the maker. The Solution names only doors that exist: finishing the booking, and the maker's own
 * "Start another from this" (a NEW card; a booking never moves between cards — `deleteWarningLines`).
 *
 * 🔒 app/vendor-dashboard/services/a-booked-card-cannot-be-edited.test.ts
 */
export const CARD_IN_USE_LOCK = {
  key: 'cardInUse',
  name: 'Can’t edit while booked',
  problem: 'A booked client is using this card.',
  solution:
    'You can edit it again once every booking on it is finished. To change it now, start a new card from this one — the booked client keeps this card as it is.',
} as const;

/** Said — by the save AND on the card — when the bookings could not be read: the card is never edited on no evidence. */
export const CARD_EDIT_UNREAD =
  'We couldn’t check whether a booked client is using this card, so nothing was saved. Try again in a moment.';

/** What the maker draws: free to edit · locked by these open bookings · could not be checked (locked, and said). */
export type CardEditLock = { state: 'free' } | { state: 'locked'; open: OpenBooking[] } | { state: 'unread' };

/** The card's edit lock from its bookings read — `null` (refused read) is `unread`, never `free`. */
export function cardEditLockOf(bookings: CardBookings | null): CardEditLock {
  if (!bookings) return { state: 'unread' };
  return bookings.open.length > 0 ? { state: 'locked', open: bookings.open } : { state: 'free' };
}

/** Each open booking on its own line — "Ana & Ben · 14 Dec 2026" (the delete refusal's own lines). */
export function openBookingLines(open: readonly OpenBooking[]): string[] {
  return open.map((b) => {
    const date = dayMonthYear(b.eventDate);
    return date ? `${b.eventName} · ${date}` : b.eventName;
  });
}

