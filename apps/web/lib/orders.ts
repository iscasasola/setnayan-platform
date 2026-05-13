import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_VAT_RATE_PCT, computeVatFromBase } from '@/lib/receipts';

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_payment'
  | 'paid'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'matched' | 'rejected';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  draft: 'bg-ink/5 text-ink/70',
  submitted: 'bg-sky-100 text-sky-800',
  awaiting_payment: 'bg-amber-100 text-amber-900',
  paid: 'bg-emerald-100 text-emerald-800',
  fulfilled: 'bg-emerald-200 text-emerald-900',
  cancelled: 'bg-ink/10 text-ink/55',
  refunded: 'bg-violet-100 text-violet-800',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending review',
  matched: 'Matched',
  rejected: 'Rejected',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  matched: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
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
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const ORDER_SELECT =
  'order_id,public_id,event_id,user_id,service_key,description,requested_total_php,confirmed_total_php,status,reference_code,admin_notes,created_at,updated_at';

const PAYMENT_SELECT =
  'payment_id,order_id,user_id,amount_php,channel,reference_number,screenshot_url,paid_at,status,admin_notes,reviewed_by_user_id,reviewed_at,created_at';

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
export function computeOrderTotals(order: OrderRow, payments: PaymentRow[]) {
  const matched = payments
    .filter((p) => p.status === 'matched')
    .reduce((acc, p) => acc + Number(p.amount_php), 0);
  const pending = payments
    .filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + Number(p.amount_php), 0);
  const base = Number(order.confirmed_total_php ?? order.requested_total_php);
  const { preVat, vat, gross, rate } = computeVatFromBase(base, DEFAULT_VAT_RATE_PCT);
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
