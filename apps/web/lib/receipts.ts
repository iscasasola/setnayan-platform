import type { SupabaseClient } from '@supabase/supabase-js';

export type ReceiptRow = {
  receipt_id: string;
  or_serial: number;
  order_id: string;
  user_id: string;
  issued_to_email: string;
  issued_to_name: string | null;
  issued_to_tin: string | null;
  pre_vat_php: number;
  vat_rate_pct: number;
  vat_amount_php: number;
  gross_total_php: number;
  issued_at: string;
  created_at: string;
};

const SELECT =
  'receipt_id,or_serial,order_id,user_id,issued_to_email,issued_to_name,issued_to_tin,pre_vat_php,vat_rate_pct,vat_amount_php,gross_total_php,issued_at,created_at';

export const DEFAULT_VAT_RATE_PCT = 12;

/**
 * VAT is **added on top** of the quoted value (PH B2B convention).
 * Given the pre-VAT base (the value Setnayan quotes), compute the VAT
 * amount and the gross the customer actually pays.
 *
 * Math: vat = base * rate / 100; gross = base + vat.
 *
 * Returns numbers rounded to 2 decimal places. The CHECK constraint in the
 * receipts table tolerates ±0.01 rounding noise.
 */
export function computeVatFromBase(
  basePhp: number,
  vatRatePct: number = DEFAULT_VAT_RATE_PCT,
): { preVat: number; vat: number; gross: number; rate: number } {
  const preVat = Math.round(basePhp * 100) / 100;
  const rate = vatRatePct;
  const vat = Math.round(((preVat * rate) / 100) * 100) / 100;
  const gross = Math.round((preVat + vat) * 100) / 100;
  return { preVat, vat, gross, rate };
}

export function formatOrNumber(serial: number, issuedAtIso?: string): string {
  const year = issuedAtIso
    ? new Date(issuedAtIso).getFullYear()
    : new Date().getFullYear();
  return `SR-${year}-${String(serial).padStart(6, '0')}`;
}

export async function fetchReceiptById(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<ReceiptRow | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select(SELECT)
    .eq('receipt_id', receiptId)
    .maybeSingle();
  if (error) throw new Error(`fetchReceiptById failed: ${error.message}`);
  return (data ?? null) as ReceiptRow | null;
}

export async function fetchReceiptByOrderId(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ReceiptRow | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select(SELECT)
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new Error(`fetchReceiptByOrderId failed: ${error.message}`);
  return (data ?? null) as ReceiptRow | null;
}

export function formatPhpFromString(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
