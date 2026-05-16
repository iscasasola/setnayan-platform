import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Default Setnayan Pay convenience-fee percentage. Disclosed transparently
 * on each row so the vendor sees how the gross-to-net math works out.
 *
 * Per-method rates live in `setnayan_pay_methods` (cheap rails 5.5% / premium
 * 6.5%); this constant matches the cheapest default rail (Maya QR Ph / Bank
 * Transfer / GCash Direct) so previews don't over-estimate. Wiring
 * `convenienceFeePhp` to read per-method from the table is a follow-up
 * (see migration 20260516030000_v1_sku_lock_setnayan_pay_methods.sql).
 *
 * Repriced 3 → 5.5 on 2026-05-16 (spec corpus commit a0fa3c7).
 */
export const SETNAYAN_PAY_FEE_PCT = 5.5;

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
 * Pull paid orders whose service_key matches one of the vendor's categories.
 * V1 simplification: we match by string equality — `orders.service_key`
 * is free-form, and the couple-side orders form prefilled it from the
 * service-key catalog. Once the schema links event_vendors -> vendor_profiles
 * we can refine this; the column shape stays the same.
 *
 * Returns rows sorted by paid_at desc.
 */
export async function fetchVendorEarnings(
  adminClient: SupabaseClient,
  vendorCategories: string[],
): Promise<VendorEarningRow[]> {
  if (vendorCategories.length === 0) return [];

  // Pull the matched payments + their order + the order's event in one round
  // trip. RLS is bypassed by the admin client; the vendor-profile scope is
  // enforced by the `vendorCategories` filter the page constructed from the
  // vendor's own vendor_services rows.
  const { data, error } = await adminClient
    .from('payments')
    .select(
      `payment_id,
       amount_php,
       paid_at,
       status,
       order:orders!payments_order_id_fkey(
         order_id,
         public_id,
         reference_code,
         description,
         service_key,
         confirmed_total_php,
         requested_total_php,
         status,
         event:events!orders_event_id_fkey(display_name)
       )`,
    )
    .eq('status', 'matched')
    .order('paid_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`fetchVendorEarnings failed: ${error.message}`);

  type Joined = {
    payment_id: string;
    amount_php: number;
    paid_at: string;
    status: string;
    order: {
      order_id: string;
      public_id: string;
      reference_code: string;
      description: string;
      service_key: string | null;
      confirmed_total_php: number | null;
      requested_total_php: number;
      status: string;
      event: { display_name: string | null } | null;
    } | null;
  };

  const catSet = new Set(vendorCategories);
  const rows: VendorEarningRow[] = [];
  for (const r of (data ?? []) as unknown as Joined[]) {
    if (!r.order) continue;
    if (!r.order.service_key) continue;
    if (!catSet.has(r.order.service_key)) continue;
    if (r.order.status !== 'paid' && r.order.status !== 'fulfilled') continue;
    rows.push({
      order_id: r.order.order_id,
      public_id: r.order.public_id,
      reference_code: r.order.reference_code,
      description: r.order.description,
      service_key: r.order.service_key,
      confirmed_total_php: r.order.confirmed_total_php,
      requested_total_php: r.order.requested_total_php,
      event_display_name: r.order.event?.display_name ?? null,
      paid_at: r.paid_at,
      payment_amount_php: Number(r.amount_php),
    });
  }
  return rows;
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
 * (`SETNAYAN_PAY_FEE_PCT`). For a specific payment method, callers should
 * look up the rate in `setnayan_pay_methods`. Returned as a positive number;
 * the caller chooses how to surface it (vendor sees it as the platform's
 * slice of the gross).
 */
export function convenienceFeePhp(grossPhp: number): number {
  return Math.round((grossPhp * SETNAYAN_PAY_FEE_PCT) / 100);
}
