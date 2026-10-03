/**
 * apps/web/lib/seat-details-carry.ts — kept OUT of the `server-only` binder
 * (lib/link-guest-account.ts) so the carry can be EXECUTED by a test against a
 * fake client: lib/the-reply-comes-with-the-account.test.ts. The caller hands
 * in the admin client; this module holds no credentials of its own.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * THE REST OF THE REPLY COMES WITH THEM (owner 2026-08-21 + 2026-09-30, DECISION_LOG
 * "A FIRST-TIME ACCOUNT MADE FROM AN INVITATION STARTS WITH ITS PROFILE ALREADY
 * FILLED" — prefix · first · middle · last · suffix · photo · MOBILE). The name
 * parts are filled by `fillAccountNameFromSeat`; this carries the MOBILE the guest typed on the reply
 * (`guests.mobile` → `users.phone`), and their meal and dietary notes, so the
 * next invitation offers them back instead of asking again.
 *
 * 🔒 FILLS BLANKS ONLY, ONE UPDATE PER FIELD, each guarded on ITS OWN blank — a
 * single statement would AND the `.is(…, null)` filters, and a profile that
 * already held a meal would silently drop the allergy. A value the person typed
 * on their own profile is never replaced; a second run is a no-op.
 *
 * ⚠ Dietary text is HEALTH DATA (RA 10173) and carries a consent stamp: the
 * person typed it into the reply and then chose to keep it on an account.
 *
 * 🔑 WHY IT LIVES HERE, NOT IN THE COOKIE BINDER. Both on-purpose doors — the
 * same-browser cookie path (`linkGuestSessionToUser`) and the cross-device email
 * path (`connectEventForUser`) — call `fillAccountNameFromSeat`. Until 2026-10-02
 * only the cookie path carried meal and dietary, and NEITHER carried the mobile.
 * Never throws.
 */
export async function carrySeatDetailsToAccount(
  admin: SupabaseClient,
  userId: string,
  guestId: string,
): Promise<void> {
  try {
    const { data: seat } = await admin
      .from('guests')
      .select('mobile, meal_preference, dietary_restrictions')
      .eq('guest_id', guestId)
      .maybeSingle();
    if (!seat) return;
    const mobile = typeof seat.mobile === 'string' ? seat.mobile.trim().slice(0, 32) : '';
    if (mobile) {
      const { error } = await admin.from('users').update({ phone: mobile }).eq('user_id', userId).is('phone', null);
      if (error) console.warn('[link-guest-account] phone fill refused:', error.message);
    }
    if (seat.meal_preference) {
      const { error } = await admin
        .from('users')
        .update({ meal_preference: seat.meal_preference })
        .eq('user_id', userId)
        .is('meal_preference', null);
      if (error) console.warn('[link-guest-account] meal fill refused:', error.message);
    }
    const diet = typeof seat.dietary_restrictions === 'string' ? seat.dietary_restrictions.trim() : '';
    if (diet) {
      const { error } = await admin
        .from('users')
        .update({
          dietary_restrictions: diet.slice(0, 300),
          dietary_restrictions_consent_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .is('dietary_restrictions', null);
      if (error) console.warn('[link-guest-account] dietary fill refused:', error.message);
    }
  } catch {
    // Best-effort by contract — a missing detail must never cost somebody their link.
  }
}
