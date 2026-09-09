import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMarketplaceVendorBookable } from '@/lib/vendor-verification';
import { planChatLockBooking } from '@/lib/chat-lock-booking';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';

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
  // `priceLanded` — did `total_cost_php` ACTUALLY receive the negotiated total?
  // Every outcome that claims to have recorded a price now says whether the row
  // matched, because the couple is told "price frozen" on the strength of it and
  // the budget reads that column. A write that matched zero rows used to be
  // indistinguishable from one that landed.
  | { status: 'booked'; feeCharged: boolean; priceLanded: boolean }
  // PR-H · the press ASKED. The negotiated total is recorded and the supplier
  // has been asked; nobody is booked. A distinct value, not a flavour of
  // 'booked', so a caller cannot render the booked copy by forgetting a branch.
  | { status: 'requested'; priceLanded: boolean }
  // PR-H · an ask was already outstanding on this row. Nothing written.
  | { status: 'already_requested' }
  // Already booked (re-lock / the other entry point won): no rewrite; the fee was
  // (idempotently) re-checked.
  | { status: 'already_booked'; feeCharged: boolean; priceLanded: boolean }
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
    .select('status, lock_request_state')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const curRow = (cur ?? null) as {
    status?: string | null;
    lock_request_state?: string | null;
  } | null;
  const currentStatus = curRow?.status ?? null;

  const action = planChatLockBooking({
    marketplaceVendorId,
    verified,
    currentStatus,
    handshakeEnabled: isLockHandshakeEnabled(),
    lockRequestState: curRow?.lock_request_state ?? null,
  });

  if (action === 'skip_no_link') return { status: 'no_marketplace_link' };
  if (action === 'blocked_not_verified') return { status: 'not_verified' };
  if (action === 'already_requested') return { status: 'already_requested' };

  // ── PR-H · THE THIRD LOCK PATH, AND THE EASIEST ONE TO WALK PAST ─────────
  // This site bills and books from a CHAT MESSAGE, not a lock screen — the same
  // reason the booking-fee move nearly missed it, recorded in this file's own
  // note below. Slice A converted `finalizeVendor` and left this one flipping
  // straight to 'contracted', so the SAME supplier was "asked" from the vendor
  // page and "booked" from the chat thread, decided purely by which screen the
  // couple happened to be on.
  //
  // The negotiated total is still written — it is the number the couple and the
  // supplier agreed in the thread, and losing it would make them re-agree it —
  // but the status stays 'considering' and the row carries the request. The
  // supplier's yes is what books them, in `vendor_agree_to_lock`.
  //
  // NO `selection_match_rank` / `linked_vendor_profile_id` HERE, for the exact
  // reason `finalizeVendor` withholds them on an ask: they mean "this is our
  // chosen supplier", the public editorial reader keys `isFirstPick` off them
  // with NO status filter, and the only thing that clears them refuses unless
  // the row is already confirmed. On an ask later declined they would be
  // permanent. The agree RPC stamps both.
  if (action === 'request') {
    const { data: askRows, error } = await authed
      .from('event_vendors')
      .update({
        total_cost_php: agreedTotalPhp,
        lock_request_state: 'pending',
        lock_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', eventVendorId)
      .eq('event_id', eventId)
      .not('status', 'in', '("deposit_paid","delivered","complete")')
      // `.select()` so a ZERO-ROW match is visible. The money-status filter above
      // can exclude the row, and PostgREST reports that as success with no error.
      .select('vendor_id');
    if (error) {
      // 23505 here is the one-pending-request index: another ask is already out
      // in this hard-single category. Same couple-facing outcome as losing the
      // confirmed race — they switch from the vendor page, which owns the modal.
      if (error.code === '23505') return { status: 'hard_single_blocked' };
      if (error.code === '23514' && /vendor_not_verified/.test(error.message ?? '')) {
        return { status: 'not_verified' };
      }
      return { status: 'error', message: error.message };
    }
    return { status: 'requested', priceLanded: (askRows ?? []).length > 0 };
  }

  let bookedPriceLanded = false;

  if (action === 'book') {
    // Write the NEGOTIATED total + flip to 'contracted' in one update. The
    // money-status precondition mirrors finalizeVendor's generic lock write: a
    // concurrent finalize that already advanced this row past 'contracted'
    // (deposit_paid/delivered/complete) matches 0 rows here → we fall through to
    // the idempotent fee below (no downgrade, no double charge).
    const { data: bookRows, error } = await authed
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
      .not('status', 'in', '("deposit_paid","delivered","complete")')
      // See the note on the ask above: a zero-row match is not an error.
      .select('vendor_id');
    bookedPriceLanded = (bookRows ?? []).length > 0;
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

  // NO FEE HERE ANY MORE — see the note in
  // `app/dashboard/[eventId]/vendors/actions.ts`. A couple's lock is a REQUEST;
  // the fee is billed when the VENDOR ACCEPTS THE PAYMENT
  // (`vendorAcknowledgeDeposit`), the one and only caller of
  // `collectBookingFeeAtLock`, enforced by
  // `lib/booking-fee-single-trigger.test.ts`.
  //
  // ⚠ THIS SITE IS THE EASY ONE TO MISS: it bills from a CHAT message, not a
  // lock screen, so a sweep of the vendors surface walks straight past it.
  // Leaving it behind would have billed at the lock AND again at acknowledge —
  // the same booking charged twice, depending only on which route the couple
  // happened to take.
  //
  // `feeCharged` stays in the return shape and is now always false from here.
  // That is CORRECT, not a stub: nothing is charged at lock any more.
  //
  // ⚠ THE LINE THAT USED TO FOLLOW THIS ONE IS NOW FALSE, AND IS DELETED RATHER
  // THAN LEFT TO ROT: it said the 'refresh_fee_only' branch "is consequently
  // inert", which was true only while its sole job was re-attempting a fee that
  // no longer fires here. As of 2026-09-09 that branch does the already-booked
  // REPRICE below, so it is the opposite of inert — it is the only path by which
  // a mid-plan deal reaches the couple's budget.
  const feeCharged = false;

  // ── THE ALREADY-BOOKED REPRICE ───────────────────────────────────────────
  // Until 2026-09-09 this branch wrote NOTHING, on the rule directly above: an
  // already-booked row's price is frozen because the fee was charged against it.
  // That rule protects a *generic re-lock* from overwriting an agreed price. It
  // was never meant to cover THIS: the couple and the supplier have just agreed a
  // NEW number in the thread, and a mid-plan change on a booked supplier is the
  // likeliest reason to strike a deal at all.
  //
  // The cost of not writing it was a screen that lied. `lockDeal` still stamped
  // the Deal, still froze `chat_threads.agreed_price_centavos` at the new total,
  // and still told the couple "🔒 Deal locked — price frozen" — while
  // `total_cost_php`, the column `/budget` reads, kept the old figure. Two live
  // numbers, disagreeing, with the reassuring one on screen.
  //
  // PRICE ONLY. No status flip, no `selection_match_rank`, no
  // `linked_vendor_profile_id`, no fee call — this row is already booked and none
  // of those may move. The one column that changes is the one both sides agreed.
  //
  // ⚠ THE FEE BASE MOVES WITH IT, AND THAT IS THE OWNER'S DECISION (2026-09-09),
  // not an oversight. `collectBookingFeeAtLock` reads `total_cost_php` when the
  // VENDOR ACKNOWLEDGES THE PAYMENT, so: before that moment the fee is charged on
  // the renegotiated price (correct — it is what they booked at); after it, the
  // order is already minted and idempotent, so the fee does not move at all.
  if (action === 'refresh_fee_only') {
    const { data: repricedRows, error: repriceErr } = await authed
      .from('event_vendors')
      .update({ total_cost_php: agreedTotalPhp, updated_at: new Date().toISOString() })
      .eq('vendor_id', eventVendorId)
      .eq('event_id', eventId)
      .select('vendor_id');
    if (repriceErr) {
      if (repriceErr.code === '23514' && /vendor_not_verified/.test(repriceErr.message ?? '')) {
        return { status: 'not_verified' };
      }
      return { status: 'error', message: repriceErr.message };
    }
    return {
      status: 'already_booked',
      feeCharged,
      priceLanded: (repricedRows ?? []).length > 0,
    };
  }

  return { status: 'booked', feeCharged, priceLanded: bookedPriceLanded };
}
