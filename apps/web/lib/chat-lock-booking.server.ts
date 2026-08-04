import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMarketplaceVendorBookable } from '@/lib/vendor-verification';
import { collectBookingFeeAtLock } from '@/lib/booking-fee-lock.server';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { planChatLockBooking } from '@/lib/chat-lock-booking';

/**
 * `bookVendorAtChatLock` — the SHARED lock primitive behind the couple's chat
 * "🔒 Lock this deal" (Option A, owner 2026-07-24). It advances an EXISTING
 * `event_vendors` row into 'contracted' at the couple-negotiated total and
 * collects the Booking Fee, reusing the EXACT same two pieces the vendor-page
 * `finalizeVendor` uses — `isMarketplaceVendorBookable` (verified-gate) and
 * `collectBookingFeeAtLock` (the 5% / free-5 / idempotent QR-order path). Because
 * both entry points converge on the one `event_vendors.total_cost_php` and the
 * one `booking_fee_open_lock_charge` RPC, the chat price and the charged base are
 * identical by construction, and a second lock (either entry point) is a no-op.
 *
 * NOT a second booking path: the write here is the SAME status→'contracted' flip
 * finalizeVendor's generic write performs (same money-status precondition, same
 * selection_match_rank / linked_vendor_profile_id stamps), guarded by the SAME
 * `event_vendors_require_verified_before_lock` DB trigger and the SAME hard-single
 * partial-unique index.
 *
 * `authed` MUST be the caller's OWN (couple) session client — RLS + the DB trigger
 * are the write boundary. `admin` is the service-role client for the verified read
 * (public RLS on vendor_profiles is verified-only) and the fee's money writes.
 */
export type ChatLockBookingOutcome =
  // Off-platform / no marketplace `event_vendors` link → caller records the
  // agreed price on the thread only; NO fee, NO crash.
  | { status: 'no_marketplace_link' }
  // Marketplace vendor is not verified → the lock is refused (friendly message).
  | { status: 'not_verified' }
  // First lock committed at the negotiated total; fee attempted (`feeCharged` =
  // a 6th+ paid order was minted, vs free-5 / flag-off / off-platform).
  | { status: 'booked'; feeCharged: boolean }
  // Already booked (re-lock / the other entry point won): no rewrite; the fee was
  // (idempotently) re-checked.
  | { status: 'already_booked'; feeCharged: boolean }
  // Another vendor already holds the single hard-single slot in this category —
  // surfaced friendly (the couple switches from the vendor page).
  | { status: 'hard_single_blocked' }
  | { status: 'error'; message: string };

export async function bookVendorAtChatLock(
  authed: SupabaseClient,
  admin: SupabaseClient,
  args: {
    eventId: string;
    eventVendorId: string;
    /** The vendor_profiles id the thread + the resolved event_vendors row share. */
    marketplaceVendorId: string | null;
    /** The couple-negotiated total in PESOS (the thread's frozen agreed price). */
    agreedTotalPhp: number;
  },
): Promise<ChatLockBookingOutcome> {
  const { eventId, eventVendorId, marketplaceVendorId, agreedTotalPhp } = args;

  // Off-platform / no marketplace link → nothing to verify or charge.
  if (!marketplaceVendorId) return { status: 'no_marketplace_link' };

  // Friendly verified pre-check (the DB trigger is the hard backstop below).
  const verified = await isMarketplaceVendorBookable(admin, marketplaceVendorId);

  // Read the current status (RLS-scoped) to tell a FIRST lock from a re-lock, so
  // we never overwrite the frozen price on an already-booked row.
  const { data: cur } = await authed
    .from('event_vendors')
    .select('status')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const currentStatus = (cur as { status?: string | null } | null)?.status ?? null;

  const action = planChatLockBooking({ marketplaceVendorId, verified, currentStatus });

  if (action === 'skip_no_link') return { status: 'no_marketplace_link' };
  if (action === 'blocked_not_verified') return { status: 'not_verified' };

  if (action === 'book') {
    // Write the NEGOTIATED total + flip to 'contracted' in one update. The
    // money-status precondition mirrors finalizeVendor's generic lock write: a
    // concurrent finalize that already advanced this row past 'contracted'
    // (deposit_paid/delivered/complete) matches 0 rows here → we fall through to
    // the idempotent fee below (no downgrade, no double charge).
    const { error } = await authed
      .from('event_vendors')
      .update({
        status: 'contracted',
        total_cost_php: agreedTotalPhp,
        selection_match_rank: 1,
        linked_vendor_profile_id: marketplaceVendorId,
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', eventVendorId)
      .eq('event_id', eventId)
      .not('status', 'in', '("deposit_paid","delivered","complete")');
    if (error) {
      // The verified DB trigger raises check_violation (23514) when a demotion
      // races our pre-check — map to the friendly not_verified outcome.
      if (error.code === '23514' && /vendor_not_verified/.test(error.message ?? '')) {
        return { status: 'not_verified' };
      }
      // Hard-single partial-unique index (23505): another vendor already holds
      // the one slot in this category. Chat has no Switch modal → surface
      // friendly and let the couple switch from the vendor page.
      if (error.code === '23505' && /hard_single/.test(`${error.message ?? ''} ${(error as { details?: string }).details ?? ''}`)) {
        return { status: 'hard_single_blocked' };
      }
      return { status: 'error', message: error.message };
    }
  }

  // Collect (or reuse) the Booking Fee — reads the just-written total_cost_php,
  // idempotent per (vendor, event). A pure no-op unless NEXT_PUBLIC_BOOKING_FEE_
  // ENABLED is on; free for the vendor's first 5 booked customers; 6th+ mints a
  // 5% vendor-payer order. Fail-soft: the lock committed — a fee hiccup here must
  // never roll it back.
  //
  // ⚠ TRIGGER MOVED — see the note in `dashboard/[eventId]/vendors/actions.ts`.
  // 3 of 3 call sites. This is the one most easily missed: it bills from a CHAT
  // message, not from a lock screen, so a sweep that greps the vendors surface
  // alone walks straight past it and the couple gets billed twice by taking a
  // different route to the same booking.
  let feeCharged = false;
  if (!isLockHandshakeEnabled()) {
    try {
      const res = await collectBookingFeeAtLock(admin, { eventVendorId });
      feeCharged = res.status === 'ordered';
    } catch {
      // swallow — the lock stands; the next lock/re-lock re-attempts the fee.
    }
  }

  return action === 'refresh_fee_only'
    ? { status: 'already_booked', feeCharged }
    : { status: 'booked', feeCharged };
}
