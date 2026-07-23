import type { SupabaseClient } from '@supabase/supabase-js';
import { computeVatFromBase } from '@/lib/receipts';

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_payment'
  | 'paid'
  | 'fulfilled'
  | 'lapsed'
  | 'cancelled'
  | 'refunded';

// 'resubmit_requested' added 2026-05-29 Day 3 of the voucher + inline-checkout
// sprint alongside migration 20260529010000_voucher_system_day1.sql (which
// already added the value to public.payment_status enum) — Day 3 wires the
// admin 3-state action (Approve · Reject · Request resubmit) end-to-end.
// Semantically the payment is back in the "needs more proof" state but
// distinct from 'pending' because the admin already reviewed it once and
// left a note for the couple at payments.admin_resubmit_notice.
export type PaymentStatus = 'pending' | 'matched' | 'rejected' | 'resubmit_requested';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  // Subscription expired naturally (term ended, no refund). See
  // apps/web/lib/subscriptions.ts + 20260602000000 migration.
  lapsed: 'Lapsed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  draft: 'bg-ink/5 text-ink/70',
  submitted: 'bg-sky-100 text-sky-800',
  awaiting_payment: 'bg-warn-100 text-warn-900',
  paid: 'bg-success-100 text-success-800',
  fulfilled: 'bg-success-200 text-success-900',
  lapsed: 'bg-ink/15 text-ink/70',
  cancelled: 'bg-ink/10 text-ink/55',
  refunded: 'bg-violet-100 text-violet-800',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending review',
  matched: 'Matched',
  rejected: 'Rejected',
  resubmit_requested: 'Resubmit requested',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  pending: 'bg-warn-100 text-warn-900',
  matched: 'bg-success-100 text-success-800',
  rejected: 'bg-danger-100 text-danger-800',
  // Amber matches the "pending review" register since the payment is back
  // in the queue waiting for the couple's next upload — operationally
  // adjacent to 'pending', visually distinct only via the label text.
  resubmit_requested: 'bg-warn-100 text-warn-900',
};

export type OrderRow = {
  order_id: string;
  public_id: string;
  event_id: string | null;
  user_id: string;
  service_key: string | null;
  description: string;
  requested_total_php: number;
  confirmed_total_php: number | null;
  status: OrderStatus;
  reference_code: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  payment_id: string;
  order_id: string;
  user_id: string;
  amount_php: number;
  channel: string;
  reference_number: string | null;
  screenshot_url: string | null;
  paid_at: string;
  status: PaymentStatus;
  admin_notes: string | null;
  // The free-text notice the admin leaves when picking "Request resubmit"
  // (3-state action, Day 3 of the voucher + inline-checkout sprint). The
  // couple sees this verbatim on the order detail page banner so they know
  // what to fix on their next upload. Column added by migration
  // 20260529010000_voucher_system_day1.sql.
  admin_resubmit_notice: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const ORDER_SELECT =
  'order_id,public_id,event_id,user_id,service_key,description,requested_total_php,confirmed_total_php,status,reference_code,admin_notes,created_at,updated_at';

const PAYMENT_SELECT =
  'payment_id,order_id,user_id,amount_php,channel,reference_number,screenshot_url,paid_at,status,admin_notes,admin_resubmit_notice,reviewed_by_user_id,reviewed_at,created_at';

export async function fetchOrdersForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchOrdersForEvent failed: ${error.message}`);
  return (data ?? []) as OrderRow[];
}

export async function fetchOrderById(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new Error(`fetchOrderById failed: ${error.message}`);
  return (data ?? null) as OrderRow | null;
}

export async function fetchPaymentsForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchPaymentsForOrder failed: ${error.message}`);
  return (data ?? []) as PaymentRow[];
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Compute the running totals for an order. The order's *_total_php columns
 * store the **pre-VAT base** (the value Setnayan quotes). The couple pays
 * the **gross** = base + VAT, so headlineTotal/remaining/matched all run on
 * the gross figure. Receipts later record pre-VAT, VAT, and gross.
 */
export function computeOrderTotals(
  order: OrderRow,
  payments: PaymentRow[],
  /** Effective rate from platform_settings (getEffectiveVatRatePct). 0 ⇒ no VAT line. */
  vatRatePct = 0,
) {
  const matched = payments
    .filter((p) => p.status === 'matched')
    .reduce((acc, p) => acc + Number(p.amount_php), 0);
  const pending = payments
    .filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + Number(p.amount_php), 0);
  const base = Number(order.confirmed_total_php ?? order.requested_total_php);
  const { preVat, vat, gross, rate } = computeVatFromBase(base, vatRatePct);
  return {
    matched,
    pending,
    base: preVat,
    vat,
    vatRatePct: rate,
    gross,
    headlineTotal: gross,
    remaining: Math.max(0, gross - matched),
  };
}

/**
 * Vendor-billing SKUs (branch add-ons, tiers, tokens) are quoted as **all-in
 * "charm" prices** — the ₱999 / ₱2,499 / … a vendor sees IS the gross they pay,
 * with 12% VAT already baked in (owner-locked 2026-07-05). Customer SKUs, by
 * contrast, store a pre-VAT base and add 12% at pay time (see the customer
 * checkout's "incl. 12% VAT" line). So an order's stored `*_total_php` means
 * "gross" for vendor keys and "pre-VAT base" for everyone else.
 *
 * Detected by the `vendor_` service-key prefix — every vendor-billing order
 * (e.g. `vendor_additional_branch__{id}`) uses it, and no customer SKU does
 * (those are UPPER_SNAKE like `SETNAYAN_AI`). WHY this matters: without it, the
 * shortfall guard treated ₱999 as a base, demanded ₱999×1.12=₱1,118.88, and
 * stranded every vendor order in "matched but never promoted" limbo.
 */
export function isVatInclusiveServiceKey(serviceKey: string | null | undefined): boolean {
  return typeof serviceKey === 'string' && serviceKey.startsWith('vendor_');
}

/**
 * The GROSS amount owed on an order, net of any applied voucher. Base =
 * `confirmed_total_php` once an admin has confirmed it; otherwise the requested
 * quote minus the voucher discount (`requested_total_php` stores the PRE-voucher
 * base; the voucher reconciles into `confirmed_total_php` on approval).
 *
 * For customer SKUs the stored total is a pre-VAT base, so gross = base + 12%.
 * For `vatInclusive` orders (vendor charm prices) the stored total ALREADY is
 * the gross, so it's returned as-is (no VAT built on top) — see
 * {@link isVatInclusiveServiceKey}. Used by the payment-approval shortfall guard
 * so a short/partial transfer can't silently promote an order to 'paid'.
 * Pure + unit-testable.
 */
export function orderGrossOwed(opts: {
  requestedTotalPhp: number;
  confirmedTotalPhp: number | null;
  voucherDiscountPhp?: number;
  vatInclusive?: boolean;
  /** Effective rate from platform_settings. Omitted ⇒ 0 — never a hardcoded 12. */
  vatRatePct?: number;
}): number {
  const base =
    opts.confirmedTotalPhp != null
      ? opts.confirmedTotalPhp
      : Math.max(0, opts.requestedTotalPhp - (opts.voucherDiscountPhp ?? 0));
  if (opts.vatInclusive) return Math.round(base * 100) / 100;
  return computeVatFromBase(base, opts.vatRatePct ?? 0).gross;
}

/**
 * Tolerance (in PHP) absorbed when comparing the matched-payment total against
 * the gross owed — covers centavo rounding accumulated across multiple partial
 * payments. Was an inline `const SHORTFALL_TOLERANCE_PHP = 1` inside
 * approvePayment; hoisted so the reconciliation predicate + its tests share
 * one source of truth.
 */
export const ORDER_SHORTFALL_TOLERANCE_PHP = 1;

/**
 * True iff the matched-payment total covers the gross owed (within the centavo
 * tolerance) — i.e. the order is FULLY reconciled and may legitimately reach
 * status='paid'. A short/partial transfer returns false. Pure + unit-testable.
 */
export function orderReconciledToPaid(args: {
  matchedTotalPhp: number;
  owedPhp: number;
  tolerancePhp?: number;
}): boolean {
  const tol = args.tolerancePhp ?? ORDER_SHORTFALL_TOLERANCE_PHP;
  return args.matchedTotalPhp >= args.owedPhp - tol;
}

/**
 * The provisioning gate for admin payment approval.
 *
 * SKU activation (flip events.setnayan_ai_active, materialise Papic seats, run
 * the concierge state machine, …) must fire ONLY when the order actually
 * reaches status='paid' — that means the admin ticked "Also mark order as
 * paid" (promoteOrder) AND the matched payments fully reconcile the amount
 * owed (reconciledToPaid). Approving a ₱1 payment on a ₱X order, or approving
 * with promote unchecked, must NOT provision the full SKU.
 *
 * Pure boolean of the two decisions so a mutation to either the AND or the
 * underlying comparison is caught by tests.
 */
export function shouldProvisionOnApproval(args: {
  promoteOrder: boolean;
  reconciledToPaid: boolean;
}): boolean {
  return args.promoteOrder && args.reconciledToPaid;
}
