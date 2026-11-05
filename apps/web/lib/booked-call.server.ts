/**
 * 📞 THE READS BEHIND THE CHAT HEAD'S Call · Video call — booked first, phone second, on both sides.
 *
 * The rule is in `lib/booked-call.ts`: a couple and a supplier may call each other OUT of the app only once that
 * supplier is BOOKED on that event (owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS", item 2; 2026-11-05, "supplier
 * side. only for booked"). This file is where "booked" is decided and where a phone is fetched, in that order:
 *
 *   1. THE BOOKING (`confirmedBooking`, shared) — `event_vendors` for (event, this shop), at-or-past `contracted`
 *      (`CONFIRMED_VENDOR_STATUSES`, the one meaning of "booked" — the Suppliers › Booked list, the date clash, the
 *      money step) and not archived. None → `not_booked`, and NO phone is read: a value that is never fetched cannot
 *      reach a page by any route.
 *   2. THE PHONE —
 *        couple's thread   → the shop's business phone, `vendor_profiles.contact_phone` (the one its Details page edits).
 *                            Neither `anon` nor `authenticated` may SELECT it (migration 20271221366210).
 *        supplier's thread → the phone on the account (`users.phone`) of the person who opened the conversation —
 *                            ONLY when that person HOSTS the event (`userHostsEvent`). A thread can be opened by the
 *                            SUPPLIER (`lib/vendor-invite-actions.ts` seeds one with the claiming supplier as its
 *                            creator), and that must never hand a supplier their own number dressed as the couple's.
 *      Both on the service role, here, and only after step 1 found a booking.
 *
 * 🔒 WHO MAY ASK. Each caller has already proven the viewer may see this thread before it calls in: the couple's page
 * reads the thread under the viewer's session (RLS) and checks it belongs to the event; the supplier's page checks the
 * thread belongs to the supplier's own shop (`thread.vendor_profile_id === profile.vendor_profile_id`). Reading the
 * booking on the service role keeps a coordinator whose session cannot list `event_vendors` (and a supplier, who holds
 * no `event_vendors` RLS) from being told "not booked" about a real booking.
 *
 * A refused read is `unknown` — never `not_booked` (that would print "Calls open once…" over a booking), and never a
 * button.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES, userHostsEvent } from '@/lib/events';
import { phoneCallLinks, type BookedCall } from '@/lib/booked-call';

/**
 * The service-role client — each caller passes `createAdminClient()` itself, so
 * `lib/security/shop-contact-is-not-session-readable.test.ts` can prove every call site hands in the service role
 * (and the test can hand in a fake and count what was read).
 */
type Db = SupabaseClient;

/** Step 1, for both sides: is this shop BOOKED on this event? */
async function confirmedBooking(
  db: Db,
  eventId: string,
  vendorProfileId: string | null | undefined,
): Promise<'booked' | 'not_booked' | 'unknown'> {
  if (!vendorProfileId) return 'not_booked';
  const { data: bookings, error } = await db
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
    .is('archived_at', null)
    .limit(1);
  if (error) {
    console.error('[booked-call] booking read refused', error.message, { event_id: eventId });
    return 'unknown';
  }
  return bookings && bookings.length > 0 ? 'booked' : 'not_booked';
}

/** The COUPLE's thread: the booked shop's business phone. */
export async function readBookedSupplierCall(
  db: Db,
  args: { eventId: string; vendorProfileId: string | null | undefined },
): Promise<BookedCall> {
  const booking = await confirmedBooking(db, args.eventId, args.vendorProfileId);
  if (booking !== 'booked') return { kind: booking };

  const { data: shop, error: shopErr } = await db
    .from('vendor_profiles')
    .select('contact_phone')
    .eq('vendor_profile_id', args.vendorProfileId as string)
    .maybeSingle();
  if (shopErr) {
    console.error('[booked-call] shop phone read refused', shopErr.message, { event_id: args.eventId });
    return { kind: 'unknown' };
  }
  const links = phoneCallLinks((shop as { contact_phone?: string | null } | null)?.contact_phone ?? null);
  return links ? { kind: 'booked', links } : { kind: 'booked_no_phone' };
}

/** The SUPPLIER's thread: the phone of the host who opened the conversation, once the supplier is booked. */
export async function readBookedCoupleCall(
  db: Db,
  args: { eventId: string; vendorProfileId: string | null | undefined; openedByUserId: string | null | undefined },
): Promise<BookedCall> {
  const booking = await confirmedBooking(db, args.eventId, args.vendorProfileId);
  if (booking !== 'booked') return { kind: booking };

  if (!args.openedByUserId) return { kind: 'booked_no_phone' };
  let hosts: boolean;
  try {
    hosts = await userHostsEvent(db, args.openedByUserId, args.eventId);
  } catch (caught) {
    console.error('[booked-call] host check refused', caught instanceof Error ? caught.message : caught, {
      event_id: args.eventId,
    });
    return { kind: 'unknown' };
  }
  // Opened by somebody who does not host the event (a supplier-seeded thread): there is no couple number to give.
  if (!hosts) return { kind: 'booked_no_phone' };

  const { data: person, error: personErr } = await db
    .from('users')
    .select('phone')
    .eq('user_id', args.openedByUserId)
    .maybeSingle();
  if (personErr) {
    console.error('[booked-call] couple phone read refused', personErr.message, { event_id: args.eventId });
    return { kind: 'unknown' };
  }
  const links = phoneCallLinks((person as { phone?: string | null } | null)?.phone ?? null);
  return links ? { kind: 'booked', links } : { kind: 'booked_no_phone' };
}
