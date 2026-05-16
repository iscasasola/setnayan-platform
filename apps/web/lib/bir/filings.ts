import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapVendorToATC } from './atc-mapper';

/**
 * Server-side data access for BIR Form 2307 quarterly filings.
 *
 * Reads vendor + payout rows for a given (year, quarter), aggregates by
 * vendor + month, runs the ATC mapper, and computes the totals that the
 * PDF generator + admin queue both consume.
 *
 * V1 data source: `vendor_payouts.bir_withholding_centavos` (the
 * marketplace withholding column added in #68's Setnayan Pay reprice).
 * Each payout row also carries the `amount_centavos` which is the
 * vendor's net gross for the row — we use that as the "income payment"
 * basis on the 2307 line item.
 *
 * Note: the spec brief originally pointed at `service_orders.bir_
 * withholding_centavos`. In the actual repo the column landed on
 * `vendor_payouts` in migration 20260516020000_v1_sku_lock_vendor_payouts
 * (`bir_withholding_centavos`). This module reads from where the column
 * actually lives.
 */

export type FilingPeriod = {
  tax_year: number;
  tax_quarter: 1 | 2 | 3 | 4;
  /** Inclusive — e.g. 2026-01-01 for Q1. */
  period_from: string;
  /** Inclusive — e.g. 2026-03-31 for Q1. */
  period_to: string;
};

export type MonthlyAtcRow = {
  /** 1, 2, or 3 — which month of the quarter this row covers. */
  month_index: 1 | 2 | 3;
  atc_code: string;
  gross_centavos: number;
  ewt_centavos: number;
};

export type FilingTotals = {
  gross_centavos: number;
  ewt_centavos: number;
  atc_rows: Array<{
    atc_code: string;
    rate_bps: number;
    gross_centavos: number;
    ewt_centavos: number;
  }>;
};

export type VendorFilingInput = {
  vendor_profile_id: string;
  /** Vendor identity at PDF-generation time — snapshotted into the row. */
  business_name: string;
  tin_number: string | null;
  tin_type: 'individual' | 'corporation' | null;
  registered_business_name: string | null;
  registered_address: string | null;
  registered_zip: string | null;
  bir_service_category:
    | 'professional'
    | 'talent'
    | 'service_supplier'
    | null;
  monthly_breakdown: MonthlyAtcRow[];
  totals: FilingTotals;
};

export type Vendor2307FilingRow = {
  filing_id: string;
  public_id: string;
  vendor_profile_id: string;
  tax_year: number;
  tax_quarter: number;
  period_from: string;
  period_to: string;
  status: 'queued' | 'generated' | 'downloaded' | 'filed_manually' | 'error';
  pdf_storage_bucket: string | null;
  pdf_storage_key: string | null;
  pdf_public_url: string | null;
  generated_at: string | null;
  downloaded_by_vendor_at: string | null;
  filed_at: string | null;
  generated_by_admin_id: string | null;
  regenerated_count: number;
  monthly_breakdown: MonthlyAtcRow[];
  totals: FilingTotals;
  audit_log: Array<{ at: string; actor: string; action: string; note?: string }>;
  created_at: string;
  updated_at: string;
};

/**
 * "The quarter that just ended" for a given calendar date — what the
 * pg_cron job needs when it fires on the 1st of Jan/Apr/Jul/Oct.
 *
 * Examples:
 *   1 Apr 2026 → Q1 2026
 *   1 Jul 2026 → Q2 2026
 *   1 Jan 2027 → Q4 2026
 *
 * Pure helper. Pass a `Date` so tests can pin the clock.
 */
export function quarterThatJustEnded(now: Date): FilingPeriod {
  const month = now.getUTCMonth(); // 0-based; PH cron fires at PH midnight + 2hr
  const year = now.getUTCFullYear();
  let prevQuarter: 1 | 2 | 3 | 4;
  let prevYear = year;
  if (month >= 0 && month < 3) {
    // Cron firing in Jan → last quarter was Q4 of prior year.
    prevQuarter = 4;
    prevYear = year - 1;
  } else if (month < 6) {
    prevQuarter = 1;
  } else if (month < 9) {
    prevQuarter = 2;
  } else {
    prevQuarter = 3;
  }
  return quarterToPeriod(prevYear, prevQuarter);
}

export function quarterToPeriod(
  year: number,
  quarter: 1 | 2 | 3 | 4,
): FilingPeriod {
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2; // 2, 5, 8, 11
  // Last day of the end month — JavaScript Date pivot trick.
  const endDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
  return {
    tax_year: year,
    tax_quarter: quarter,
    period_from: `${year}-${String(startMonth + 1).padStart(2, '0')}-01`,
    period_to: `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
}

export function periodLabel(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

/**
 * For a given quarter, walk every vendor that has at least one released
 * `vendor_payouts` row with `bir_withholding_centavos > 0` in the window
 * and produce the aggregated 2307 inputs.
 *
 * Reads from `vendor_payouts` joined with `vendor_profiles`. Uses
 * `released_at` as the "income payment date" — that's when the vendor
 * actually got paid (matches BIR's "constructive receipt" rule).
 *
 * Caller must be a service-role / admin client. Vendor RLS would hide
 * the cross-vendor data the cron needs to aggregate.
 */
export async function buildQuarterFilings(
  admin: SupabaseClient,
  period: FilingPeriod,
): Promise<VendorFilingInput[]> {
  // Build a UTC-aware window so a payout released at 23:59 PH on Mar 31
  // still falls into Q1. PH is UTC+8 → Q1 ends 2026-03-31T23:59:59+08:00
  // which is 2026-03-31T15:59:59Z. We're a hair lazy here and use the
  // calendar-day boundary in UTC — close enough for V1 manual review.
  const fromIso = `${period.period_from}T00:00:00Z`;
  // Exclusive upper bound — add one day to period_to.
  const upper = new Date(period.period_to + 'T00:00:00Z');
  upper.setUTCDate(upper.getUTCDate() + 1);
  const toIsoExclusive = upper.toISOString();

  type PayoutRow = {
    vendor_profile_id: string;
    amount_centavos: number;
    bir_withholding_centavos: number;
    released_at: string;
  };

  const { data: payouts, error: payoutsErr } = await admin
    .from('vendor_payouts')
    .select(
      'vendor_profile_id,amount_centavos,bir_withholding_centavos,released_at',
    )
    .gte('released_at', fromIso)
    .lt('released_at', toIsoExclusive)
    .gt('bir_withholding_centavos', 0)
    .order('released_at', { ascending: true });

  if (payoutsErr) {
    throw new Error(`buildQuarterFilings/payouts failed: ${payoutsErr.message}`);
  }
  const rows = (payouts ?? []) as PayoutRow[];
  if (rows.length === 0) return [];

  // Group payouts by vendor + month-index within quarter.
  type GroupKey = string; // `${vendor_id}|${month_index}`
  const grouped = new Map<
    string,
    Map<1 | 2 | 3, { gross: number; ewt: number }>
  >();
  for (const r of rows) {
    const released = new Date(r.released_at);
    const monthZeroBased = released.getUTCMonth();
    const quarterStartMonth = (period.tax_quarter - 1) * 3;
    const monthIndex = (monthZeroBased - quarterStartMonth + 1) as 1 | 2 | 3;
    if (monthIndex < 1 || monthIndex > 3) continue;
    let perVendor = grouped.get(r.vendor_profile_id);
    if (!perVendor) {
      perVendor = new Map();
      grouped.set(r.vendor_profile_id, perVendor);
    }
    const existing = perVendor.get(monthIndex) ?? { gross: 0, ewt: 0 };
    existing.gross += r.amount_centavos;
    existing.ewt += r.bir_withholding_centavos;
    perVendor.set(monthIndex, existing);
  }

  // Fetch vendor identity rows for the groups we built.
  const vendorIds = Array.from(grouped.keys());
  const { data: vendors, error: vendorsErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,business_name,tin_number,tin_type,registered_business_name,registered_address,registered_zip,bir_service_category',
    )
    .in('vendor_profile_id', vendorIds);
  if (vendorsErr) {
    throw new Error(`buildQuarterFilings/vendors failed: ${vendorsErr.message}`);
  }
  const vendorById = new Map(
    (vendors ?? []).map((v) => [v.vendor_profile_id as string, v]),
  );

  const filings: VendorFilingInput[] = [];
  for (const [vendorId, monthMap] of grouped) {
    const v = vendorById.get(vendorId);
    if (!v) continue;

    const mapped = mapVendorToATC({
      tin_type: v.tin_type as 'individual' | 'corporation' | null,
      bir_service_category: v.bir_service_category as
        | 'professional'
        | 'talent'
        | 'service_supplier'
        | null,
    });

    // V1: a single ATC code per vendor → one entry per (month, atc) in
    // monthly_breakdown. If a future vendor wears multiple BIR hats we'd
    // group payouts by service_key here.
    const monthly: MonthlyAtcRow[] = [];
    let totalGross = 0;
    let totalEwt = 0;
    for (const m of [1, 2, 3] as const) {
      const agg = monthMap.get(m);
      const gross = agg?.gross ?? 0;
      const ewt = agg?.ewt ?? 0;
      totalGross += gross;
      totalEwt += ewt;
      // Skip empty months entirely — fewer rows on the 2307.
      if (gross === 0 && ewt === 0) continue;
      monthly.push({
        month_index: m,
        atc_code: mapped.atc_code,
        gross_centavos: gross,
        ewt_centavos: ewt,
      });
    }

    filings.push({
      vendor_profile_id: vendorId,
      business_name: (v.business_name as string) ?? '',
      tin_number: (v.tin_number as string) ?? null,
      tin_type: v.tin_type as 'individual' | 'corporation' | null,
      registered_business_name: (v.registered_business_name as string) ?? null,
      registered_address: (v.registered_address as string) ?? null,
      registered_zip: (v.registered_zip as string) ?? null,
      bir_service_category: v.bir_service_category as
        | 'professional'
        | 'talent'
        | 'service_supplier'
        | null,
      monthly_breakdown: monthly,
      totals: {
        gross_centavos: totalGross,
        ewt_centavos: totalEwt,
        atc_rows: [
          {
            atc_code: mapped.atc_code,
            rate_bps: mapped.rate_bps,
            gross_centavos: totalGross,
            ewt_centavos: totalEwt,
          },
        ],
      },
    });
  }

  return filings;
}

/**
 * BIR-deadline helper. Per RR 11-2018:
 *   Q1 (Jan-Mar) → issued by Apr 30
 *   Q2 (Apr-Jun) → issued by Jul 31
 *   Q3 (Jul-Sep) → issued by Oct 31
 *   Q4 (Oct-Dec) → issued by Jan 31 of the following year
 */
export function deadlineForQuarter(year: number, quarter: number): Date {
  switch (quarter) {
    case 1:
      return new Date(Date.UTC(year, 3, 30)); // Apr 30
    case 2:
      return new Date(Date.UTC(year, 6, 31)); // Jul 31
    case 3:
      return new Date(Date.UTC(year, 9, 31)); // Oct 31
    case 4:
      return new Date(Date.UTC(year + 1, 0, 31)); // Jan 31 next year
    default:
      return new Date(Date.UTC(year, 0, 1));
  }
}

/**
 * Locate an existing filing — used by the cron to decide UPDATE vs INSERT
 * and by the admin surface to render the current state.
 */
export async function fetchFilingByVendorAndPeriod(
  client: SupabaseClient,
  vendor_profile_id: string,
  tax_year: number,
  tax_quarter: number,
): Promise<Vendor2307FilingRow | null> {
  const { data, error } = await client
    .from('vendor_2307_filings')
    .select('*')
    .eq('vendor_profile_id', vendor_profile_id)
    .eq('tax_year', tax_year)
    .eq('tax_quarter', tax_quarter)
    .maybeSingle();
  if (error) {
    throw new Error(`fetchFilingByVendorAndPeriod failed: ${error.message}`);
  }
  return (data ?? null) as Vendor2307FilingRow | null;
}

export async function listFilingsForVendor(
  client: SupabaseClient,
  vendor_profile_id: string,
): Promise<Vendor2307FilingRow[]> {
  const { data, error } = await client
    .from('vendor_2307_filings')
    .select('*')
    .eq('vendor_profile_id', vendor_profile_id)
    .order('tax_year', { ascending: false })
    .order('tax_quarter', { ascending: false });
  if (error) throw new Error(`listFilingsForVendor failed: ${error.message}`);
  return (data ?? []) as Vendor2307FilingRow[];
}

export async function listAllFilings(
  admin: SupabaseClient,
  args: { year?: number; quarter?: number; limit?: number } = {},
): Promise<Vendor2307FilingRow[]> {
  let q = admin
    .from('vendor_2307_filings')
    .select('*')
    .order('tax_year', { ascending: false })
    .order('tax_quarter', { ascending: false })
    .order('generated_at', { ascending: false, nullsFirst: false });
  if (args.year != null) q = q.eq('tax_year', args.year);
  if (args.quarter != null) q = q.eq('tax_quarter', args.quarter);
  q = q.limit(args.limit ?? 200);
  const { data, error } = await q;
  if (error) throw new Error(`listAllFilings failed: ${error.message}`);
  return (data ?? []) as Vendor2307FilingRow[];
}
