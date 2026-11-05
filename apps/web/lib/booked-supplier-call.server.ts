/**
 * 📞 THE READ BEHIND THE CHAT HEAD'S Call · Video call — booked first, phone second.
 *
 * The rule is in `lib/booked-supplier-call.ts`: a couple may call a supplier OUT of the app only once that supplier is
 * BOOKED on this event (owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS", item 2). This file is where "booked" is
 * decided and where the phone is fetched, in that order:
 *
 *   1. THE BOOKING — `event_vendors` for (event, this shop), at-or-past `contracted` (`CONFIRMED_VENDOR_STATUSES`, the
 *      one meaning of "booked" — the Suppliers › Booked list, the date clash, the money step) and not archived.
 *      None → `not_booked`, and the phone is NEVER READ: a value that is never fetched cannot reach a page by any route.
 *   2. THE PHONE — `vendor_profiles.contact_phone`, the shop's business phone (the one its Details page edits). Neither
 *      `anon` nor `authenticated` may SELECT it (migration 20271221366210), so it is read on the service role, here,
 *      and only after step 1 found a booking.
 *
 * 🔒 WHO MAY ASK. The caller has already read the thread under the VIEWER's session (RLS) and checked it belongs to
 * this event — the couple's thread page does exactly that (`fetchThreadById` + `thread.event_id === eventId`) before
 * it calls this. So whoever reaches this read is somebody the database already lets see this conversation: the couple,
 * or a coordinator on the event. Reading the booking on the service role (not the viewer's) keeps a coordinator whose
 * session cannot list `event_vendors` from being told "not booked" about a booked shop.
 *
 * A refused read is `unknown` — never `not_booked` (that would print "Calls open once you've booked" over a booking),
 * and never a button.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { supplierCallLinks, type BookedSupplierCall } from '@/lib/booked-supplier-call';

/**
 * The service-role client — the caller passes `createAdminClient()` itself, so
 * `lib/security/shop-contact-is-not-session-readable.test.ts` can prove every call site hands in the service role
 * (and the test can hand in a fake and count what was read).
 */
type Db = SupabaseClient;

export async function readBookedSupplierCall(
  db: Db,
  args: { eventId: string; vendorProfileId: string | null | undefined },
): Promise<BookedSupplierCall> {
  if (!args.vendorProfileId) return { kind: 'not_booked' };

  const { data: bookings, error: bookingErr } = await db
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', args.eventId)
    .eq('marketplace_vendor_id', args.vendorProfileId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
    .is('archived_at', null)
    .limit(1);
  if (bookingErr) {
    console.error('[readBookedSupplierCall] booking read refused', bookingErr.message, { event_id: args.eventId });
    return { kind: 'unknown' };
  }
  if (!bookings || bookings.length === 0) return { kind: 'not_booked' };

  const { data: shop, error: shopErr } = await db
    .from('vendor_profiles')
    .select('contact_phone')
    .eq('vendor_profile_id', args.vendorProfileId)
    .maybeSingle();
  if (shopErr) {
    console.error('[readBookedSupplierCall] shop phone read refused', shopErr.message, { event_id: args.eventId });
    return { kind: 'unknown' };
  }
  const links = supplierCallLinks((shop as { contact_phone?: string | null } | null)?.contact_phone ?? null);
  return links ? { kind: 'booked', links } : { kind: 'booked_no_phone' };
}
