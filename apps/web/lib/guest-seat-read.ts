import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * guest-seat-read.ts — the signed-in account's own seat on one event, AND
 * WHETHER THE READ HAPPENED.
 *
 * The reads themselves are `findGuestSeatForUser`'s (lib/guest-membership-session.ts,
 * whose header explains every gate below). They live here, taking the client as
 * an argument, so the refusal can be tested against a stubbed client — the
 * server-only module cannot be imported by a unit test.
 *
 * 🔑 A REFUSED READ IS NOT "NO SEAT". Supabase RESOLVES with `{ error }`, so a
 * lost grant, a timeout or a phantom column used to come back as `null` — the
 * same value as a person who is not on the list. The event page then told a
 * LISTED guest *"You're not on the guest list for this event yet"* and offered
 * "Ask to join" (or "Join as a guest", which would add them a second time).
 * `measured: false` is the only thing that can tell those two apart, so the page
 * must read it (lib/guests-read-is-honest.test.ts is the pattern).
 *
 * ⚠ `measured: false` never ADMITS anybody: `seat` is null, so every gate that
 * asks "do they hold a seat" still says no. It only stops the page saying a
 * thing about the person it did not measure.
 */

export type GuestMembershipSeat = {
  guestId: string;
  /**
   * The seat's CURRENT token. No caller mints a session today (see
   * lib/guest-membership-session.ts), but it is read rather than dropped: it
   * proves the seat row is live and readable, and a deliberate one-press mint
   * would need the live value.
   */
  qrToken: string;
  /** The event's public address, as the DATABASE returned it. */
  slug: string;
};

export type GuestSeatRead = {
  /** Their seat, or null — null means "none" ONLY when `measured` is true. */
  seat: GuestMembershipSeat | null;
  /** False = a read was refused or failed: nobody knows whether they hold a seat. */
  measured: boolean;
};

const UNMEASURED: GuestSeatRead = { seat: null, measured: false };

/** `admin` MUST be the admin client — see the RLS note on `findGuestSeatForUser`. */
export async function readGuestSeatForUser(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<GuestSeatRead> {
  const { data: membership, error: membershipError } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null)
    .is('hidden_at', null)
    .maybeSingle();
  if (membershipError) {
    console.error('[supabase-error] lib/guest-seat-read.ts · from:event_members.select', membershipError);
    return UNMEASURED;
  }
  if (!membership?.guest_id) return { seat: null, measured: true };

  const { data: seat, error: seatError } = await admin
    .from('guests')
    .select('guest_id, qr_token, events:event_id ( slug )')
    .eq('guest_id', membership.guest_id as string)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (seatError) {
    console.error('[supabase-error] lib/guest-seat-read.ts · from:guests.select', seatError);
    return UNMEASURED;
  }
  // A removed seat (the host's eviction) or a row with no token: measured, and none.
  if (!seat?.qr_token) return { seat: null, measured: true };

  // The slug comes back through the embed so any link built from it is built
  // from what the DATABASE holds, never from caller-supplied text — the
  // open-redirect lesson `app/[slug]/redeem/route.ts` paid for on 2026-08-06.
  const embedded = (seat as { events?: { slug?: string | null } | { slug?: string | null }[] })
    .events;
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  const slug = row?.slug?.trim();
  // The seat row was read, but its event came back without an address: we do not
  // know this seat well enough to admit on it, and we did not measure "not listed".
  if (!slug) return UNMEASURED;

  return {
    seat: {
      guestId: seat.guest_id as string,
      qrToken: seat.qr_token as string,
      slug,
    },
    measured: true,
  };
}
