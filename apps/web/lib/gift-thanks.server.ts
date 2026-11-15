import 'server-only';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * apps/web/lib/gift-thanks.server.ts (server-only)
 *
 * 🎁 MAY THIS READER SEE THE COUPLE'S GIFT THANK-YOU? (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE
 * SCENE PER SCREEN) — SIX CALLS SETTLED" (2): one line for all givers, shown only to the guest who gave.)
 *
 * The SAME check the one writer of a gift record makes (`lib/gift-record.server.ts` `recordGift`, steps 1–2 of its
 * fence): the reader is THIS event's guest by the RSVP's own identity read (`readGuestSessionForEvent` — this
 * browser's invitation for the event, or the signed-in account's own seat at it; no new token, no name taken on
 * trust), the guest row is this event's and not removed — and then that guest has a gift record here that the couple
 * did not remove (`event_gift_records.giver_guest_id`, `removed_at IS NULL`).
 *
 * 🔒 It answers only YES or NO, and a first name to greet them by — never an amount, never what or how much, never
 * anybody else's gift. Every failure is NO (fails closed): an unreadable check hides the thank-you, it never shows it
 * to someone who did not give.
 */
export type OwnGiftThanks = { giver: boolean; firstName: string | null };

const NO: OwnGiftThanks = { giver: false, firstName: null };

export async function readOwnGiftThanks(eventId: string): Promise<OwnGiftThanks> {
  try {
    const session = await readGuestSessionForEvent(eventId);
    if (!session || session.event_id !== eventId || !session.guest_id) return NO;
    const admin = createAdminClient();
    const [guestRes, giftRes] = await Promise.all([
      admin.from('guests').select('first_name, deleted_at').eq('guest_id', session.guest_id).eq('event_id', eventId).maybeSingle(),
      admin
        .from('event_gift_records')
        .select('gift_record_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('giver_guest_id', session.guest_id)
        .is('removed_at', null),
    ]);
    if (guestRes.error || giftRes.error) {
      console.error('[supabase-error] readOwnGiftThanks: a check could not be read', guestRes.error ?? giftRes.error, { eventId });
      return NO;
    }
    const guest = guestRes.data as { first_name: string | null; deleted_at: string | null } | null;
    if (!guest || guest.deleted_at != null) return NO;
    if ((giftRes.count ?? 0) < 1) return NO;
    const first = (guest.first_name ?? '').trim();
    return { giver: true, firstName: first && first !== '+1' ? first : null };
  } catch {
    return NO;
  }
}
