import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isUuid } from '@/lib/is-uuid';
import { FORMAL_NAME_FIELDS } from '@/lib/formal-name';
import { seatNameOffer, type SeatNameOffer } from '@/lib/seat-name-offer';

/**
 * seat-name-offer.server.ts — READ ONLY. Is there a fuller name on THIS seat
 * for THIS account's own profile? (B9, lib/seat-name-offer.ts has the rule.)
 *
 * 🔗 ONLY A SEAT SAVED ON PURPOSE (DECISION_LOG 2026-09-30 "A SEAT BECOMES AN
 * ACCOUNT'S ONLY ON PURPOSE"): the seat must be the one this account holds as
 * its guest membership (`event_members.guest_id`), written only by "Save to my
 * account". A guest pass on the device, a name match or a host's typing never
 * qualifies — so a host can never put a name on somebody else's profile.
 *
 * 🔒 Admin reads, every one scoped to the CALLER's `userId` (the page and the
 * action pass the signed-in user, never an id from the request). Nothing here
 * writes; the Me tab calls it on every open, and opening writes nothing.
 */
export async function seatNameOfferFor(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  eventId: string,
  guestId: string,
): Promise<SeatNameOffer | null> {
  if (!userId || !isUuid(eventId) || !isUuid(guestId)) return null;
  const parts = FORMAL_NAME_FIELDS.join(', ');
  const [seatHeld, profile, seat] = await Promise.all([
    admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('guest_id', guestId)
      .limit(1)
      .maybeSingle(),
    admin.from('users').select(parts).eq('user_id', userId).maybeSingle(),
    admin
      .from('guests')
      .select(parts)
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);
  if (seatHeld.error) logQueryError('seatNameOfferFor.member', seatHeld.error, {}, 'graceful_degrade');
  if (profile.error) logQueryError('seatNameOfferFor.profile', profile.error, {}, 'graceful_degrade');
  if (seat.error) logQueryError('seatNameOfferFor.seat', seat.error, {}, 'graceful_degrade');
  // Any doubt — a failed read, a seat not saved to this account — offers nothing.
  if (seatHeld.error || profile.error || seat.error || !seatHeld.data || !profile.data) return null;
  return seatNameOffer(
    profile.data as unknown as Record<string, string | null>,
    seat.data as unknown as Record<string, string | null> | null,
  );
}
