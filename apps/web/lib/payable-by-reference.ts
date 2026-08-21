import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { purchaseIdFromVendorSubscriptionServiceKey } from './vendor-subscription-service-key';

/**
 * lib/payable-by-reference.ts — resolve ONE reference code into the thing the
 * payer is about to pay for.
 *
 * # Why this exists
 *
 * Owner, 2026-08-21: *"we want a payment page that applies to all, with the
 * custom QR designated to the amount they want to pay."* Every purchase in the
 * product already mints an `orders` row carrying a reference code, an amount
 * and a description — so the shared page needs exactly one lookup, and every
 * buy button becomes a redirect to /pay/<reference>.
 *
 * # The read is SESSION-SCOPED on purpose
 *
 * A reference code is short, it is printed in emails, and it is the only thing
 * standing between a stranger and "who bought what, for how much". This runs on
 * the caller's own client so `orders_owner_read` decides: your own orders, and
 * orders on events you belong to. A reference that is not yours reads as
 * NOT FOUND — the same answer as a reference that does not exist, so the page
 * can never be used to test whether a code is real.
 */

export type PayableStatus = 'awaiting_payment' | 'settled' | 'closed';

export type Payable = {
  orderId: string;
  reference: string;
  /** What they are buying, in the buyer's own words. */
  title: string;
  /** Who/what it is for — the shop, or the celebration. Null when neither. */
  who: string | null;
  amountPhp: number;
  /** Small facts under the amount. Never money the payer has to add up. */
  rows: ReadonlyArray<{ label: string; value: string }>;
  status: PayableStatus;
  /** True when this order is a shop's plan, which changes the "next" line. */
  isVendorPlan: boolean;
};

type OrderRow = {
  order_id: string;
  reference_code: string;
  description: string | null;
  service_key: string | null;
  requested_total_php: number | string | null;
  confirmed_total_php: number | string | null;
  status: string;
  event_id: string | null;
  vendor_profile_id: string | null;
};

const SELECT =
  'order_id,reference_code,description,service_key,requested_total_php,confirmed_total_php,status,event_id,vendor_profile_id';

/**
 * Which order states still want money. Anything settled or dead renders the
 * page in its closed state rather than showing a QR for money already sent —
 * paying twice is a real harm, and "the page still had a code on it" is how it
 * happens.
 */
function statusOf(raw: string): PayableStatus {
  if (raw === 'paid' || raw === 'refunded') return 'settled';
  if (raw === 'cancelled' || raw === 'expired' || raw === 'failed') return 'closed';
  return 'awaiting_payment';
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function fetchPayableByReference(
  supabase: SupabaseClient,
  reference: string,
): Promise<Payable | null> {
  const ref = reference.trim().toUpperCase();
  if (ref.length === 0 || ref.length > 64) return null;

  const { data, error } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('reference_code', ref)
    .maybeSingle();
  // An RLS refusal and a genuine miss are the SAME value here (null), and both
  // must read as "not found" — see the header. An `error` is also not a reason
  // to guess: never invent a payable.
  if (error || !data) return null;

  const order = data as OrderRow;
  const isVendorPlan =
    purchaseIdFromVendorSubscriptionServiceKey(order.service_key) !== null;

  const rows: Array<{ label: string; value: string }> = [];
  const amount = num(order.confirmed_total_php) || num(order.requested_total_php);

  return {
    orderId: order.order_id,
    reference: order.reference_code,
    title: order.description?.trim() || 'Your Setnayan order',
    who: null,
    amountPhp: amount,
    rows,
    status: statusOf(order.status),
    isVendorPlan,
  };
}
