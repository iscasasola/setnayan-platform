import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Booking-Fee charge access layer — thin, typed wrappers over the
 * service-role RPCs defined in migration 20270916909942. The fee amount is
 * computed AUTHORITATIVELY in SQL (public.booking_fee_centavos, the mirror of
 * lib/booking-fee.ts); these wrappers never pass a fee amount, only identifiers.
 *
 * INERT until the flag is flipped. Nothing here runs on the live send path while
 * isBookingFeeEnabled() is false, so the whole system ships dark.
 */

/**
 * The fee is off until this flag is set (default off — same value client +
 * server, mirroring isPaymentGatedLockEnabled). While off, no fee is computed,
 * charged, or gated: the proposal send behaves exactly as it does today.
 */
export function isBookingFeeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/**
 * The fee schedule in force. Stamped on every charge so a future reprice cannot
 * silently rewrite history. MUST match the SQL default in the ledger migration.
 */
export const BOOKING_FEE_SCHEDULE_VERSION = '2026-07-23-flat2';

export type BookingFeeAttribution = 'sourced' | 'import';

export type BookingFeeChargeStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'waived_import';

export type OpenChargeResult = {
  charge_id: string;
  status: BookingFeeChargeStatus;
  amount_charged_centavos: number;
  computed_fee_centavos: number;
  attribution: BookingFeeAttribution;
  reused: boolean;
};

/**
 * Open (or reuse) the single live charge for a proposal. Call with the
 * SERVICE-ROLE admin client — the RPC is service_role-only, so the fee amount is
 * never client-influenced. `attribution` is resolved server-side by the send
 * action (sourced when a marketplace-sourced thread predates the send, else
 * import → free). Returns null on any error (fail-closed: the caller must treat a
 * null as "not cleared" and refuse to send).
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
  if (error || !data) return null;
  return data as OpenChargeResult;
}

/**
 * Mark a pending charge paid + roll it into the ledger (from the gateway/admin
 * confirmation path — the twin of approve_vendor_token_purchase). Idempotent:
 * a non-pending charge is a no-op. Service-role only.
 */
export async function settleBookingFeeCharge(
  admin: SupabaseClient,
  chargeId: string,
  gateway: string | null,
  paymentRef: string | null,
): Promise<boolean> {
  const { data, error } = await admin.rpc('booking_fee_settle_charge', {
    p_charge_id: chargeId,
    p_gateway: gateway,
    p_payment_ref: paymentRef,
  });
  if (error) return false;
  return Boolean((data as { settled?: boolean } | null)?.settled);
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
  if (error) return false;
  return Boolean(data);
}
