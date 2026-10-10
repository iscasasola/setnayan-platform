import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * seatClaimedCoupleAsCustomer — THE COUPLE WHO ADDED A SUPPLIER IS THAT
 * SUPPLIER'S CUSTOMER, NOT A NEW INQUIRY.
 *
 * Owner, 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`): the claimed
 * couple lands on the supplier's side as a CUSTOMER. What shipped did the
 * opposite: `applyClaimAutoLink` opens the one chat thread for (event, shop) and
 * leaves `inquiry_status` at its database default, `pending` — so the supplier
 * who had just joined THROUGH THE COUPLE'S OWN LINK was greeted by "Reply to a
 * new inquiry" and an Accept / Decline about the people who invited them.
 *
 * ── THE SAME TWO WRITES `acceptInquiry` MAKES, AND NOTHING ELSE ────────────
 * Joining through the couple's link IS the supplier's yes to talking to them, so
 * this performs exactly what pressing Accept performs (`lib/chat-actions.ts`):
 *   1. `unlock_vendor_event_free` — the free, idempotent per-(shop, event)
 *      unlock; it ownership-checks the caller, which is why this runs on the
 *      SUPPLIER'S OWN SESSION and not the admin client;
 *   2. `chat_threads.inquiry_status = 'accepted'` (+ `accepted_at`), only where
 *      it is still `pending`, so every trigger an Accept fires still fires and a
 *      thread the couple already set aside is left alone.
 * It does NOT send `inquiry_accepted`: nobody asked a question, and the couple
 * is told the supplier joined by the notice the claim already sends.
 *
 * ⚠ NOT A BOOKING, NOT A HOLD. Nothing here touches `event_vendors`, the lock
 * handshake, the calendar or the booking fee. The date still holds nothing on
 * the supplier's calendar (it reads "asking" — `lib/vendor-inquiry-dates.ts`).
 * 🔌 `chat_threads.inquiry_source` is left exactly as the claim leaves it (NULL):
 * `invite_claim` is not a value the column's CHECK admits today, and how a
 * claimed booking is attributed is the fee step's decision, not this one's.
 *
 * FAIL-SOFT, AND SAID: a refusal leaves the thread `pending` — the supplier
 * then sees an inquiry they can accept by hand, which is what shipped before —
 * and the reason is returned and logged rather than swallowed.
 */
export async function seatClaimedCoupleAsCustomer(
  supplierSession: SupabaseClient,
  args: { vendorProfileId: string; eventId: string },
): Promise<{ seated: boolean; reason?: string }> {
  if (!args.vendorProfileId || !args.eventId) return { seated: false, reason: 'missing ids' };

  const { error: unlockErr } = await supplierSession.rpc('unlock_vendor_event_free', {
    p_vendor_profile_id: args.vendorProfileId,
    p_event_id: args.eventId,
  });
  if (unlockErr) {
    console.error('[claim] could not open the claimed couple as a customer (unlock):', unlockErr.message);
    return { seated: false, reason: unlockErr.message };
  }

  const { data, error } = await supplierSession
    .from('chat_threads')
    .update({ inquiry_status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('inquiry_status', 'pending')
    .select('thread_id');
  if (error) {
    console.error('[claim] could not open the claimed couple as a customer (thread):', error.message);
    return { seated: false, reason: error.message };
  }
  // Zero rows is not a failure: the thread was already accepted (a retry, or a
  // shop that had been talking to this couple before it used their link).
  return { seated: true, ...(data && data.length === 0 ? { reason: 'already open' } : {}) };
}
