import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEPOSIT_DISPUTE_COLUMNS,
  LEDGER_DISPUTE_COLUMNS,
  readPaymentDispute,
  type DepositDisputeRow,
  type LedgerDisputeRow,
} from '@/lib/payment-refusal';

/**
 * Default Setnayan Pay convenience-fee percentage. Disclosed transparently
 * on each row so the vendor sees how the gross-to-net math works out.
 *
 * All rails are now a flat 5.0% (locked 2026-05-16 row 16 — supersedes the
 * morning's 5.5%/6.5% dual rate). Per-method rates still live in
 * `setnayan_pay_methods`; wiring `convenienceFeePhp` to read per-method
 * from the table is a follow-up (see migration 20260518000000).
 */
export const SETNAYAN_PAY_FEE_PCT = 5.0;

/**
 * Resolve the effective Setnayan Pay convenience-fee percentage, reading the
 * admin-set `platform_settings.setnayan_pay_fee_pct` (the /admin/pricing
 * "Platform fee" editor) and falling back to `SETNAYAN_PAY_FEE_PCT` (5.0%) when
 * the column is unset, the row is missing, or the read fails. Behavior is
 * byte-identical to the constant whenever the column is NULL.
 *
 * Takes the admin client from the caller so this module stays client-agnostic.
 */
export async function getSetnayanFeePct(
  adminClient: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await adminClient
      .from('platform_settings')
      .select('setnayan_pay_fee_pct')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[supabase-error] lib/vendor-earnings.ts · from:platform_settings.select', error);
      return SETNAYAN_PAY_FEE_PCT;
    }
    const pct = (data as { setnayan_pay_fee_pct?: number | null })
      .setnayan_pay_fee_pct;
    if (pct == null || !Number.isFinite(Number(pct))) {
      return SETNAYAN_PAY_FEE_PCT;
    }
    return Number(pct);
  } catch {
    return SETNAYAN_PAY_FEE_PCT;
  }
}

/**
 * Minimum Setnayan Pay convenience-fee floor — ₱50 (locked CLAUDE.md
 * decision-log 2026-05-17 ninth row). Crossover at ₱1,000 gross
 * (5.0% × ₱1,000 = ₱50). Below ₱1,000 the floor wins; at or above, the
 * percentage wins. Per-rail values live in
 * `setnayan_pay_methods.min_fee_centavos` (migration 20260608000000); this
 * constant is the fallback for display surfaces that don't carry a
 * payment-method context.
 */
export const SETNAYAN_PAY_MIN_FEE_PHP = 50;

export type VendorEarningRow = {
  order_id: string;
  public_id: string;
  reference_code: string;
  description: string;
  service_key: string | null;
  confirmed_total_php: number | null;
  requested_total_php: number;
  event_display_name: string | null;
  paid_at: string;
  payment_amount_php: number;
};

export type MonthlySubtotal = {
  /** Zero-padded YYYY-MM key for ordering / display. */
  ym: string;
  /** Human-readable label like "May 2026". */
  label: string;
  /** Sum of payment_amount_php in this month, in pesos (whole). */
  total_php: number;
  /** Number of paid orders in this month. */
  order_count: number;
};

/**
 * 🔴 WHAT THIS REPLACED (AREA-VENDOR, 2026-09-19). The earnings reader used to
 * be `fetchVendorEarnings(admin, categories)`: it read SETNAYAN'S OWN platform
 * `payments`/`orders` with the admin client and kept any row whose
 * `orders.service_key` equalled one of the supplier's categories. Two faults,
 * one line:
 *   • it could never find a supplier's money — `service_key` holds Setnayan
 *     SKUs (`ONBOARDING_SERVICES`, `SETNAYAN_AI`, measured in prod), never a
 *     supplier category — so "Earned · this year" and the Earnings ledger read
 *     ₱0 / "No bookings logged yet" for the supplier Saysay, who had confirmed
 *     a ₱2,000 deposit;
 *   • a category is not an owner. Had a key ever matched, every supplier in
 *     that category would have been shown the same orders.
 *
 * ✅ The supplier's money is the booking ledger: `event_vendor_payments` on
 * the `event_vendors` rows whose `marketplace_vendor_id` is THIS shop — the
 * same ownership join `vendor_payday_installments()` and
 * `confirm_vendor_payment` use. Only money the supplier confirmed (or a
 * dispute ruled stands) counts as earned; a logged-but-unconfirmed payment is
 * not yet theirs to count.
 */

/** One ledger payment, as read — with the canonical dispute columns. */
export type LedgerPayment = LedgerDisputeRow & {
  payment_id: string;
  vendor_id: string;
  event_id: string;
  amount_php: number | string;
  paid_at: string | null;
  method: string | null;
  vendor_confirmed_at: string | null;
};

/**
 * One of this shop's booking rows, as read. Carries the DEPOSIT's dispute
 * columns: a deposit's refusal lives on `event_vendors`, not on its ledger row
 * (see `lib/payment-refusal.ts`), so a reader that looked only at the ledger
 * row would count a declined deposit as money received.
 */
export type LedgerBooking = DepositDisputeRow & {
  vendor_id: string;
  event_id: string;
  category: string | null;
};

/**
 * Is this ledger payment money the supplier has received?
 *
 * The dispute is read ONE way — `readPaymentDispute` (lib/payment-refusal.ts),
 * the same module every ledger surface and /admin/disputes use — and the rule
 * matches `vendor_payday_installments()` arm 2 (migration 20271233896417):
 *   • Setnayan ruled it stands (a SETTLED `payment_stands`) → earned;
 *   • the supplier refused it and nobody has ruled (an OPEN dispute, the
 *     `isOpenDispute` definition), or Setnayan ruled `not_received` → NOT earned;
 *   • otherwise it is earned only once the supplier confirmed it.
 * An installment's refusal is on its own row; the deposit's is on the booking.
 */
export function isEarnedPayment(p: LedgerPayment, booking?: DepositDisputeRow | null): boolean {
  const dispute = readPaymentDispute(p, booking);
  if (dispute?.settlement?.outcome === 'payment_stands') return true;
  if (dispute != null) return false;
  return p.vendor_confirmed_at != null;
}

/**
 * Pure: shop bookings + their ledger payments → earning rows, newest first.
 * A payment on a booking that is not in `bookings` is dropped — the scope is
 * the shop's own rows, never whatever the payments query returned.
 */
export function ledgerEarningRows(
  bookings: LedgerBooking[],
  payments: LedgerPayment[],
  eventNames: Map<string, string | null>,
): VendorEarningRow[] {
  const byVendorId = new Map(bookings.map((b) => [b.vendor_id, b]));
  const rows: VendorEarningRow[] = [];
  for (const p of payments) {
    const booking = byVendorId.get(p.vendor_id);
    if (!booking || !isEarnedPayment(p, booking)) continue;
    const amount = Number(p.amount_php);
    if (!Number.isFinite(amount)) continue;
    const kind = p.is_deposit_record ? 'Deposit' : 'Payment';
    rows.push({
      order_id: p.payment_id,
      public_id: p.payment_id,
      reference_code: '',
      description: p.method ? `${kind} · ${p.method}` : kind,
      service_key: booking.category,
      confirmed_total_php: amount,
      requested_total_php: amount,
      event_display_name: eventNames.get(p.event_id) ?? null,
      paid_at: p.paid_at ?? p.vendor_confirmed_at ?? '',
      payment_amount_php: amount,
    });
  }
  rows.sort((a, b) => (a.paid_at < b.paid_at ? 1 : a.paid_at > b.paid_at ? -1 : 0));
  return rows;
}

/**
 * The money couples have paid THIS shop and the shop has confirmed, newest
 * first. Admin client (a supplier holds no RLS on the couple's ledger or on
 * `events`), so the scope is the `marketplace_vendor_id` filter — the caller
 * passes the vendor_profile_id it resolved from the signed-in user. Throws on a
 * refused read: an unread ledger must never be shown as ₱0.
 */
export async function fetchVendorLedgerEarnings(
  adminClient: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorEarningRow[]> {
  const { data: bookingRows, error: bookingError } = await adminClient
    .from('event_vendors')
    .select(`vendor_id, event_id, category, ${DEPOSIT_DISPUTE_COLUMNS}`)
    .eq('marketplace_vendor_id', vendorProfileId)
    .eq('voided_by_fraud', false);
  if (bookingError) {
    throw new Error(`fetchVendorLedgerEarnings bookings: ${bookingError.message}`);
  }
  const bookings = (bookingRows ?? []) as LedgerBooking[];
  if (bookings.length === 0) return [];

  const { data: paymentRows, error: paymentError } = await adminClient
    .from('event_vendor_payments')
    .select(
      `payment_id, vendor_id, event_id, amount_php, paid_at, method, vendor_confirmed_at, ${LEDGER_DISPUTE_COLUMNS}`,
    )
    .in(
      'vendor_id',
      bookings.map((b) => b.vendor_id),
    )
    .limit(1000);
  if (paymentError) {
    throw new Error(`fetchVendorLedgerEarnings payments: ${paymentError.message}`);
  }
  const payments = (paymentRows ?? []) as LedgerPayment[];

  const eventIds = Array.from(new Set(payments.map((p) => p.event_id)));
  const eventNames = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data: events, error: eventsError } = await adminClient
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    // A missing NAME is cosmetic ("Event"); the money above is already read.
    if (!eventsError) {
      for (const e of (events ?? []) as Array<{ event_id: string; display_name: string | null }>) {
        eventNames.set(e.event_id, e.display_name);
      }
    }
  }
  return ledgerEarningRows(bookings, payments, eventNames);
}

/**
 * Compute the last 12 months of subtotals ending in the current month,
 * even if a month has zero earnings (so the chart-like table has a
 * stable shape).
 */
export function computeMonthlySubtotals(
  rows: VendorEarningRow[],
  now: Date = new Date(),
): { ytdTotal: number; months: MonthlySubtotal[] } {
  const months: MonthlySubtotal[] = [];
  const thisYear = now.getFullYear();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    months.push({
      ym,
      label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      total_php: 0,
      order_count: 0,
    });
  }
  const byYm = new Map(months.map((m) => [m.ym, m]));

  let ytdTotal = 0;
  for (const row of rows) {
    const d = new Date(row.paid_at);
    if (Number.isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const slot = byYm.get(ym);
    if (slot) {
      slot.total_php += row.payment_amount_php;
      slot.order_count += 1;
    }
    if (d.getFullYear() === thisYear) {
      ytdTotal += row.payment_amount_php;
    }
  }
  return { ytdTotal, months };
}

/**
 * Setnayan Pay convenience-fee line, computed at the default rail rate
 * (`SETNAYAN_PAY_FEE_PCT`) with the ₱50 minimum floor applied (per CLAUDE.md
 * decision-log 2026-05-17 ninth row).
 *
 * Formula: fee = MAX(gross × 5.0%, ₱50). Crossover at ₱1,000 gross. A
 * zero-gross row (no earnings yet) returns 0 — the floor doesn't fire on
 * empty rows. Returned as a positive number; the caller chooses how to
 * surface it (vendor sees it as the platform's slice of the gross).
 *
 * For a specific payment method, callers should look up the rate + floor
 * in `setnayan_pay_methods`. The canonical centavos-typed compute lives in
 * `apps/web/lib/payouts.ts::computePayoutBreakdown`.
 */
export function convenienceFeePhp(
  grossPhp: number,
  feePct: number = SETNAYAN_PAY_FEE_PCT,
): number {
  if (grossPhp <= 0) return 0;
  const percentFee = Math.round((grossPhp * feePct) / 100);
  return Math.max(percentFee, SETNAYAN_PAY_MIN_FEE_PHP);
}
