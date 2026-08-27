import 'server-only';

import { cache } from 'react';

import { createAdminClient } from '@/lib/supabase/admin';
import { COMMITTED_BOOKING_STATUSES } from '@/lib/vendor-addon-first5-free';
import { vendorBookingIsCommitted } from '@/app/[slug]/_lib/site-identity';

/**
 * "IS THE SIGNED-IN VIEWER A SUPPLIER THIS COUPLE BOOKED ON THIS EVENT?" — the
 * ONE read, and the ONE answer.
 *
 * ── WHY IT MOVED HERE ──────────────────────────────────────────────────────
 * It lived in `app/[slug]/_lib/loaders.ts`, whose own header says its loaders
 * must not be imported from other routes. Three surfaces needed it anyway and
 * two of them held a LAXER rule than the third:
 *
 *   · the private lock screen on `app/[slug]/page.tsx` asked the row's STATUS;
 *   · `resolveVendorCapability` (the supplier doorway, and the "people of this
 *     celebration" test behind a restricted keepsake story) asked only whether
 *     a LINK existed;
 *   · `/{slug}/print` asked only whether a link existed, and fed that straight
 *     into `belongsToThisEvent` — the single boolean that IS the gate on a
 *     story the couple kept to the people of their day.
 *
 * 🔴 A LINK IS NOT A BOOKING. `lib/reusable-bookings.server.ts` mints a linked
 * row at **'shortlisted'** for a reuse offer the couple has still to lock. So
 * on the two lax copies, a supplier the couple was merely *considering* was one
 * of "the people of this celebration": the doorway told them **"You are booked
 * here"** and the print sheet handed them a story restricted to the day's own
 * people. The strict copy, one file away, refused the same person.
 * 🔑 *A rule written three times had two copies laxer — and the lax ones were
 * the ones deciding a disclosure.*
 *
 * ── WHAT IS NOT HERE ───────────────────────────────────────────────────────
 * 🔒 Nothing about the event. This module answers a MEMBERSHIP question and
 * returns an id, a trading name and the status that decided it. The event's
 * own content is read by the surface, under its own rules.
 *
 * WHY THE ADMIN CLIENT. `/{slug}` renders for anonymous visitors with no RLS
 * session, exactly as the host membership probe already does, and
 * `event_vendors` has no vendor-side policy at all — a supplier reading it
 * through their own session gets zero rows, silently, forever. The question is
 * answered HERE, in one query, scoped in SQL to the businesses this proved user
 * owns, and only the ANSWER travels.
 */

/** What the read hands back. `bookingStatus` is what makes it a booking. */
export type SupplierBooking = {
  vendorProfileId: string;
  businessName: string;
  /** `event_vendors.status` of the row that linked them. */
  bookingStatus: string | null;
};

/**
 * The booking read, verbatim from the loader it replaces.
 *
 * TWO JOINS, ONE ANSWER. `event_vendors` is the couple's own list of who they
 * booked; `linked_vendor_profile_id` is set once a real Setnayan vendor claims
 * that row. An unclaimed hand-typed "Tita's Catering" resolves to nobody, which
 * is correct — there is no account to send anywhere.
 *
 * WHICH ROW, WHEN THERE ARE SEVERAL. A couple can book two businesses belonging
 * to the same person (a caterer who is also the florist). It reads every
 * matching row and PREFERS a committed one, so the strongest true claim wins
 * deterministically instead of "whichever Postgres returned first".
 *
 * ⚠ SOFT FAILURE, DELIBERATELY. A failed read returns null — it hides a doorway
 * from one supplier, where a throw would blank the invitation for every guest
 * at the wedding because a vendor table hiccuped. Wrong, but the cheaper wrong.
 *
 * React.cache'd on (eventId, userId) and NOT on a client instance, so sharing
 * the query no longer depends on two callers happening to hold the same admin
 * client. That matters immediately: a `/{slug}/print` request now asks once for
 * its visibility gate and its audience gate, where the old key made those two
 * separate queries. (The event page's own two call sites already shared a
 * client, and still share the read.)
 */
export const loadVendorBooking = cache(
  async (eventId: string, userId: string): Promise<SupplierBooking | null> => {
    const admin = createAdminClient();

    // The businesses this user owns or administers.
    const { data: mine } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .eq('user_id', userId);
    const owned = (mine ?? []) as { vendor_profile_id: string; business_name: string }[];
    if (owned.length === 0) return null;

    // …narrowed to the ones the couple actually listed on this event.
    const { data: booked } = await admin
      .from('event_vendors')
      .select('linked_vendor_profile_id, status')
      .eq('event_id', eventId)
      .in(
        'linked_vendor_profile_id',
        owned.map((v) => v.vendor_profile_id),
      );

    const rows = (booked ?? []) as {
      linked_vendor_profile_id: string | null;
      status: string | null;
    }[];
    const usable = rows.filter(
      (r): r is { linked_vendor_profile_id: string; status: string | null } =>
        typeof r.linked_vendor_profile_id === 'string' && r.linked_vendor_profile_id.length > 0,
    );
    const chosen =
      usable.find((r) =>
        (COMMITTED_BOOKING_STATUSES as readonly string[]).includes(r.status ?? ''),
      ) ?? usable[0];
    if (!chosen) return null;

    const id = chosen.linked_vendor_profile_id;
    const match = owned.find((v) => v.vendor_profile_id === id);
    if (!match) return null;
    return {
      vendorProfileId: match.vendor_profile_id,
      businessName: match.business_name,
      bookingStatus: chosen.status ?? null,
    };
  },
);

/**
 * May this signed-in account read this celebration BECAUSE they are working it?
 *
 * 🔒 A PLAIN BOOLEAN, ON PURPOSE. A refused supplier must get byte-identically
 * what a stranger gets. The moment this returns a reason, the reason travels to
 * a surface, and the surface says something a stranger would never be told —
 * which is how the existence of somebody's private celebration leaks.
 */
export async function viewerIsBookedSupplier(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const booking = await loadVendorBooking(eventId, userId);
  return booking !== null && vendorBookingIsCommitted(booking.bookingStatus);
}
