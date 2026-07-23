import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The vendor-facing Booking-Fee checkout: the pure inclusive-price split (the
 * owner's gateway-cost rule) + a read helper for the pending charge on a proposal.
 * The server ACTION lives in the co-located actions module so this stays importable
 * from server components for the read/price without pulling in redirect().
 */

/**
 * The fixed card processing fee Setnayan passes to the vendor (₱15, owner
 * 2026-07-23). GCash + other percentage-only e-wallets have no fixed fee, so
 * nothing is added there. Setnayan always absorbs the percentage.
 */
export const BOOKING_FEE_CARD_FIXED_CENTAVOS = 1500;

export type BookingFeeMethod = 'gcash' | 'card';

/**
 * The INCLUSIVE amount the vendor pays for a fee, by method — a single price, NOT
 * a "fee + processing" surcharge line (Visa/MC + BSP disallow card surcharges;
 * quoted inclusive instead). GCash → the fee itself; card → fee + the fixed ₱15.
 */
export function bookingFeeInclusiveCentavos(
  feeCentavos: number,
  method: BookingFeeMethod,
): number {
  const base = Number.isFinite(feeCentavos) && feeCentavos > 0 ? Math.round(feeCentavos) : 0;
  if (base <= 0) return 0; // no fee → nothing to pay (no phantom card fixed fee)
  return method === 'card' ? base + BOOKING_FEE_CARD_FIXED_CENTAVOS : base;
}

export type PendingFeeCharge = {
  chargeId: string;
  publicId: string;
  amountChargedCentavos: number;
};

/**
 * The single live PENDING booking-fee charge for a proposal, if any — read under
 * the caller's RLS (the vendor reads only their own charges, PR-3 policy). Returns
 * null when there's none (the common case: fee not enforced, or nothing owed).
 * Drives whether the draft view shows the pay-prompt instead of plain "Send".
 */
export async function fetchPendingFeeCharge(
  client: SupabaseClient,
  proposalId: string,
): Promise<PendingFeeCharge | null> {
  try {
    const { data, error } = await client
      .from('booking_fee_charges')
      .select('charge_id, public_id, amount_charged_centavos')
      .eq('proposal_id', proposalId)
      .eq('status', 'pending')
      .maybeSingle();
    if (error || !data) return null;
    return {
      chargeId: data.charge_id as string,
      publicId: data.public_id as string,
      amountChargedCentavos: Number(data.amount_charged_centavos) || 0,
    };
  } catch {
    return null;
  }
}
