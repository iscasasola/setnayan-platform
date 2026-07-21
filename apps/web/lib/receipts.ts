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

/**
 * The PH STATUTORY VAT rate — a fact about the tax code, NOT a statement about what Setnayan
 * charges. Kept for receipt labelling and for the day the ₱3M threshold forces registration.
 *
 * ⚠️ Do NOT use this as the rate to charge. Setnayan is currently **non-VAT registered** (sole
 * prop under ICASA ENTERPRISE, 8% flat; VAT only at the ₱3M combined-gross tripwire), and the
 * effective rate lives in `platform_settings.default_vat_rate_pct` — which the owner has set to
 * 0. Use `getEffectiveVatRatePct()` on the server, or a rate passed down from it on the client.
 *
 * This constant used to be the default parameter of `computeVatFromBase`, which meant every
 * customer SKU was silently grossed by 12% while the configured rate said 0 — a 12% overcharge
 * on every purchase, labelled as a tax Setnayan is not registered to collect.
 */
export const PH_STATUTORY_VAT_RATE_PCT = 12;

/**
 * @deprecated Reads as "our rate" but is the statutory one. Kept as an alias so no call site
 * silently changes meaning; new code must take the rate from settings.
 */
export const DEFAULT_VAT_RATE_PCT = PH_STATUTORY_VAT_RATE_PCT;

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
  // REQUIRED on purpose. A defaulted rate is how a hardcoded 12% outlived a configured 0%.
  vatRatePct: number,
): { preVat: number; vat: number; gross: number; rate: number } {
  const preVat = Math.round(basePhp * 100) / 100;
  const rate = vatRatePct;
  const vat = Math.round(((preVat * rate) / 100) * 100) / 100;
  const gross = Math.round((preVat + vat) * 100) / 100;
  return { preVat, vat, gross, rate };
}

/**
 * VAT-INCLUSIVE decomposition — the mirror of {@link computeVatFromBase}.
 * For a price quoted **all-in** (the gross the buyer pays already INCLUDES VAT
 * — e.g. vendor-billing "charm" fees like ₱999, owner-locked 2026-07-05), back
 * the VAT out of the gross rather than building it up from a base.
 *
 * Math: vat = gross * rate / (100 + rate); preVat = gross − vat.
 * So preVat + vat === gross exactly (to 2dp), and the buyer is never charged
 * more than the quoted all-in price. Returns 2dp-rounded numbers.
 */
export function computeVatFromGross(
  grossPhp: number,
  vatRatePct: number = DEFAULT_VAT_RATE_PCT,
): { preVat: number; vat: number; gross: number; rate: number } {
  const gross = Math.round(grossPhp * 100) / 100;
  const rate = vatRatePct;
  const vat = Math.round(((gross * rate) / (100 + rate)) * 100) / 100;
  const preVat = Math.round((gross - vat) * 100) / 100;
  return { preVat, vat, gross, rate };
}

// Setnayan transaction receipts (not BIR Official Receipts). The actual
// BIR OR for a paid order is issued by Setnayan separately, offline. The
// `or_serial` DB column name is legacy and kept as-is; we just label it
// "Transaction No." everywhere it's shown.
export function formatReceiptNumber(serial: number, issuedAtIso?: string): string {
  const year = issuedAtIso
    ? new Date(issuedAtIso).getFullYear()
    : new Date().getFullYear();
  return `TXN-${year}-${String(serial).padStart(6, '0')}`;
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
