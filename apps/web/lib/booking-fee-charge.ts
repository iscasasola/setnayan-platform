import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isBookingFeeEnforced,
  decideFeeGate,
  BOOKING_FEE_SCHEDULE_VERSION,
  type BookingFeeAttribution,
  type FeeGateResult,
  type OpenChargeResult,
} from '@/lib/booking-fee-gate';

/**
 * The Booking-Fee charge access layer — thin, typed wrappers over the
 * service-role RPCs defined in migration 20270916909942, plus the async send-gate.
 * The fee amount is computed AUTHORITATIVELY in SQL (public.booking_fee_centavos,
 * the mirror of lib/booking-fee.ts); these wrappers never pass a fee amount, only
 * identifiers. The pure gate RULES (attribution, two-key enforcement, the send
 * decision) live in lib/booking-fee-gate.ts and are re-exported here so existing
 * importers of '@/lib/booking-fee-charge' keep working.
 *
 * INERT until enforced. Nothing here runs on the live send path while
 * isBookingFeeEnforced() is false.
 */
export * from '@/lib/booking-fee-gate';

/**
 * Open (or reuse) the single live charge for a proposal. Call with the
 * SERVICE-ROLE admin client — the RPC is service_role-only, so the fee amount is
 * never client-influenced. `attribution` is resolved server-side by the send
 * action (sourced when a marketplace-sourced thread predates the send, else
 * import → free). Returns null on any error (fail-closed at the RPC boundary; the
 * gate decision then fail-OPENs on null so a transient error never traps a send).
 */
export async function openBookingFeeCharge(
  admin: SupabaseClient,
  proposalId: string,
  attribution: BookingFeeAttribution,
  threadId: string | null,
): Promise<OpenChargeResult | null> {
  const { data, error } = await admin.rpc('booking_fee_open_charge', {
    p_proposal_id: proposalId,
    p_attribution: attribution,
    p_thread_id: threadId,
    p_schedule_version: BOOKING_FEE_SCHEDULE_VERSION,
  });
  // ⚠ null stays the contract (decideFeeGate fail-OPENs on it), but the REASON
  // is recorded now (S34 · 2026-09-18). Before, an RPC error and an empty reply
  // both returned a bare null — a send that went through un-charged left no
  // trace of why.
  if (error) {
    console.error('[booking-fee] booking_fee_open_charge failed; send gate fails open', {
      proposalId,
      attribution,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) {
    console.error('[booking-fee] booking_fee_open_charge returned no charge; send gate fails open', {
      proposalId,
      attribution,
    });
    return null;
  }
  return data as OpenChargeResult;
}

/** What settling did. `error` is set ONLY when the RPC failed. */
export type SettleChargeResult = { settled: boolean; error: string | null };

/**
 * Mark a pending charge paid + roll it into the ledger (from the gateway/admin
 * confirmation path — the same shape as the retired token wallet's
 * approve_vendor_token_purchase). Idempotent: a non-pending charge is a
 * no-op. Service-role only.
 *
 * 🔑 `settled: false` MEANS TWO DIFFERENT THINGS, so the reason travels with it
 * (S34 · 2026-09-18). A no-op on an already-settled charge is correct; an RPC
 * error means the supplier's fee is still open on our books. Both used to come
 * back as a bare `false`, and the approval ledger recorded `settled: false` for
 * each — indistinguishable. `error` is now written into that ledger row.
 */
export async function settleBookingFeeCharge(
  admin: SupabaseClient,
  chargeId: string,
  gateway: string | null,
  paymentRef: string | null,
): Promise<SettleChargeResult> {
  const { data, error } = await admin.rpc('booking_fee_settle_charge', {
    p_charge_id: chargeId,
    p_gateway: gateway,
    p_payment_ref: paymentRef,
  });
  if (error) {
    console.error('[booking-fee] booking_fee_settle_charge failed; the charge stays open', {
      chargeId,
      paymentRef,
      code: error.code,
      message: error.message,
    });
    return { settled: false, error: error.message || error.code || 'unknown error' };
  }
  return { settled: Boolean((data as { settled?: boolean } | null)?.settled), error: null };
}

/**
 * The send-gate predicate: is a paid/waived_import charge on record for this
 * proposal? Read-only, safe on any client. Fail-closed → false on error.
 */
export async function isProposalFeeCleared(
  client: SupabaseClient,
  proposalId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('booking_fee_proposal_cleared', {
    p_proposal_id: proposalId,
  });
  if (error) {
    // Fail-closed stays the contract; the reason is recorded (S34).
    console.error('[booking-fee] booking_fee_proposal_cleared failed; treating as NOT cleared', {
      proposalId,
      code: error.code,
      message: error.message,
    });
    return false;
  }
  return Boolean(data);
}

/**
 * The proposal send-gate. Returns whether the draft→sent flip may proceed.
 * Composes the two-key enforcement check with the charge open + the pure decision
 * (see lib/booking-fee-gate.ts for the full fail-safe contract). Call with the
 * SERVICE-ROLE admin client.
 */
export async function bookingFeeSendGate(
  admin: SupabaseClient,
  args: {
    proposalId: string;
    attribution: BookingFeeAttribution;
    threadId: string | null;
  },
): Promise<FeeGateResult> {
  if (!isBookingFeeEnforced()) return { cleared: true };
  const charge = await openBookingFeeCharge(
    admin,
    args.proposalId,
    args.attribution,
    args.threadId,
  );
  return decideFeeGate(charge);
}
