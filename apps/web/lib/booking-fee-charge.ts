import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isBookingFeeEnabled,
  isBookingFeeRailLive,
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
  if (!(await isBookingFeeEnforcedServer(admin))) return { cleared: true };
  const charge = await openBookingFeeCharge(
    admin,
    args.proposalId,
    args.attribution,
    args.threadId,
  );
  return decideFeeGate(charge);
}

/** Admin DB toggle: platform_settings.booking_fee_collection_enabled. */
async function dbBookingFeeToggle(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await admin
      .from('platform_settings')
      .select('booking_fee_collection_enabled')
      .eq('id', 1)
      .maybeSingle();
    return Boolean(
      (data as { booking_fee_collection_enabled?: boolean } | null)
        ?.booking_fee_collection_enabled,
    );
  } catch {
    return false;
  }
}

/** Are PayMongo credentials present in the DB (both secrets non-null)? */
async function dbPaymongoCredsPresent(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await admin
      .from('platform_integration_secrets')
      .select('paymongo_secret_key_enc, paymongo_webhook_secret_enc')
      .eq('id', 1)
      .maybeSingle();
    const r = data as {
      paymongo_secret_key_enc?: string | null;
      paymongo_webhook_secret_enc?: string | null;
    } | null;
    return Boolean(r?.paymongo_secret_key_enc && r?.paymongo_webhook_secret_enc);
  } catch {
    return false;
  }
}

/**
 * The authoritative, DB-aware enforcement check (supersedes the pure env-only
 * isBookingFeeEnforced for the live gate). Enforces when BOTH:
 *   • ENABLED — env NEXT_PUBLIC_BOOKING_FEE_ENABLED, OR the admin DB toggle
 *     (platform_settings.booking_fee_collection_enabled), AND
 *   • RAIL LIVE — env NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE, OR PayMongo credentials
 *     present in the DB.
 * So an owner activates entirely from /admin/integrations (paste keys + flip the
 * toggle), no redeploy. FAIL-SAFE: any read error → not enforced → the send
 * proceeds (a DB hiccup must never trap a live proposal). Short-circuits on the
 * enabled check so the common (off) case is a single cheap read.
 */
export async function isBookingFeeEnforcedServer(
  admin: SupabaseClient,
): Promise<boolean> {
  const enabled = isBookingFeeEnabled() || (await dbBookingFeeToggle(admin));
  if (!enabled) return false;
  return isBookingFeeRailLive() || (await dbPaymongoCredsPresent(admin));
}
