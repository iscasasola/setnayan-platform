import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { formatCount } from '@/lib/format-number';

/**
 * 🔒 A CARD WITH AN OPEN BOOKING CANNOT BE DELETED OR TURNED OFF (owner 10 Nov on PR #7464, verbatim: *"You cannot
 * delete a service card until all booked are complete. You cannot turn off a service card until all booked
 * completed."*).
 *
 * WHAT "BOOKED" MEANS HERE — the shipped schema, not a new idea:
 *   · a booking of a card is an `event_vendors` row whose `service_id` is the card (the couple's pick of THIS card);
 *   · "booked" is the named set `public.booked_event_vendor_statuses()` = `BOOKED_EVENT_VENDOR_STATUSES`
 *     (contracted · deposit_paid · delivered · complete) — considering / shortlisted are a save, not a booking;
 *   · "complete" is the enum's `complete`. So an OPEN booking is contracted · deposit_paid · delivered.
 *   · CANCELLED has no label: `vendor_status` has none, and a cancel moves the row OUT of the booked set
 *     (`booking_fee_expires_when_booking_cancelled` reads exactly that). A cancelled booking is therefore not open.
 *   · A booking whose couple DELETED the event survives with `event_id IS NULL` (kept for the shop's record,
 *     `keep_supplier_bookings_on_event_delete`). There is no event left to finish, so it is not open either.
 *
 * Going ONLINE is not governed here — only by the publish gate (`lib/service-publish-gate.ts`).
 *
 * 🔒 app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts
 */
export const OPEN_BOOKING_STATUSES = BOOKED_EVENT_VENDOR_STATUSES.filter((s) => s !== 'complete');

export type OpenBooking = { eventName: string; eventDate: string | null };

/** What the shop's cards carry: how many couples ever picked it (the delete-or-hide question) and which are open. */
export type CardBookings = { picked: number; open: OpenBooking[] };

/** "14 Dec 2026" — the calendar day as stored (a DATE column), never shifted by the reader's timezone. */
function shortDate(iso: string | null): string {
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
 * The line under the row (or in the Card Maker's delete sheet) — the approved prototype's frame E: the count, then
 * every open booking on its own line (event name · date). The same words refuse a delete and a turn-off.
 */
export function openBookingsRefusal(open: readonly OpenBooking[]): string | null {
  if (open.length === 0) return null;
  const head =
    open.length === 1 ? '1 booking still open — finish it first' : `${formatCount(open.length)} bookings still open — finish them first`;
  const lines = open.map((b) => {
    const date = shortDate(b.eventDate);
    return date ? `${b.eventName} · ${date}` : b.eventName;
  });
  return [head, ...lines].join('\n');
}

/** Said when the bookings could not be read — the card is never deleted or turned off on no evidence. */
export const BOOKINGS_UNREAD = 'We could not check this card’s bookings just now, so nothing changed. Try again in a moment.';

/**
 * ONE READ for a set of the shop's OWN cards: every couple's pick of each (`event_vendors.service_id`), and the open
 * bookings named (event name + date). `null` when it could not be read — never "nobody booked" (T29).
 *
 * ⚠ The caller passes the ADMIN client: `event_vendors` admits no shop (a-shop-cannot-read-its-own-booking.test.ts),
 * so the shop's own session would read zero rows and every card would look unbooked. The caller MUST have proved the
 * ids are the shop's own cards before calling.
 */
export async function readCardBookings(
  admin: SupabaseClient,
  serviceIds: readonly string[],
): Promise<Map<string, CardBookings> | null> {
  const out = new Map<string, CardBookings>();
  for (const id of serviceIds) out.set(id, { picked: 0, open: [] });
  if (serviceIds.length === 0) return out;

  const { data: rows, error } = await admin
    .from('event_vendors')
    .select('service_id, status, event_id')
    .in('service_id', serviceIds as string[]);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[supabase-error] card bookings read', error);
    return null;
  }
  const picks = (rows ?? []) as { service_id: string; status: string; event_id: string | null }[];
  const openStatuses = OPEN_BOOKING_STATUSES as readonly string[];
  const openPicks = picks.filter((r) => openStatuses.includes(r.status) && r.event_id !== null);

  const eventIds = [...new Set(openPicks.map((r) => r.event_id as string))];
  const events = new Map<string, { display_name: string | null; event_date: string | null }>();
  if (eventIds.length > 0) {
    const { data: evs, error: evError } = await admin
      .from('events')
      .select('event_id, display_name, event_date')
      .in('event_id', eventIds);
    if (evError) {
      // eslint-disable-next-line no-console
      console.error('[supabase-error] card bookings events read', evError);
      return null;
    }
    for (const e of (evs ?? []) as { event_id: string; display_name: string | null; event_date: string | null }[]) {
      events.set(e.event_id, e);
    }
  }

  for (const r of picks) {
    const card = out.get(r.service_id);
    if (card) card.picked += 1;
  }
  for (const r of openPicks) {
    const card = out.get(r.service_id);
    const ev = events.get(r.event_id as string);
    card?.open.push({ eventName: ev?.display_name?.trim() || 'An event', eventDate: ev?.event_date ?? null });
  }
  for (const card of out.values()) {
    card.open.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  }
  return out;
}

/**
 * ⚠ THE DELETE WARNING (owner 10 Nov on PR #7464, verbatim: *"You must also warn them that all events linked to your
 * service card will be gone and inspirations. All reviews and all stats for that service card will be gone. It will
 * stay at the shop but not at the service card…"*). Shown BEFORE anything is deleted, only on a card with no open
 * booking (an open booking gets `openBookingsRefusal` instead, never this).
 *
 * Checked against what the delete does (`deleteOrRetireOwnService` in services/actions.ts):
 *   · a card NOBODY ever picked is deleted. Its links leave it: inspiration suggestions, library photos, saves,
 *     chat offers, thread interests, packages are SET NULL; a couple's photo shared to it is removed (CASCADE).
 *     Reviews (`vendor_reviews` / `vendor_guest_reviews`) keep `vendor_profile_id` — they stay on the shop.
 *   · a card a couple ever picked is HIDDEN instead (turned off), so their record stays — said in its own words,
 *     because "they leave the card" would be untrue there: nothing is detached, the card is only hidden.
 */
export function deleteWarningLines(picked: number): string[] {
  if (picked > 0) {
    return [
      'Couples booked this card, so it is hidden instead of deleted — their bookings stay on it.',
      'Its reviews and stats stay on your shop.',
      'Those events can’t move to a new card — events sync only to the card that was booked. There is no manual upload.',
    ];
  }
  return [
    'Events linked to this card and its inspirations leave the card.',
    'Its reviews and stats leave the card. They stay on your shop.',
    'Those events can’t move to a new card — events sync only to the card that was booked. There is no manual upload.',
  ];
}
