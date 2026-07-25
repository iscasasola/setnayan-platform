/**
 * apps/web/lib/bir-2307.ts
 *
 * Pure helpers for the quarterly BIR Form 2307 (Certificate of Creditable Tax
 * Withheld at Source) generator — the compute half of
 * `POST /api/admin/cron/generate-2307`.
 *
 * PURE + unit-testable. No DB, no I/O, no `server-only` imports.
 *
 * ── What a 2307 filing is ──────────────────────────────────────────────────
 * One row per (vendor_profile_id, tax_year, tax_quarter) in
 * `vendor_2307_filings` (migration 20260516100000). It reports, per month of
 * the quarter, the income payments Setnayan made to that vendor and the tax
 * Setnayan withheld from them.
 *
 * ── Where the numbers come from ────────────────────────────────────────────
 * ONLY from `vendor_payouts` rows that were actually PAID (`paid_at` set)
 * inside the quarter. Nothing is recomputed from order totals — a 2307 is a
 * certificate of what was actually withheld, not a re-derivation of what
 * should have been.
 *
 * ⚠ GOTCHA the allocation below exists for: `lib/payouts.ts`
 * (`dispatchVendorPayouts`) stamps the ORDER-LEVEL `gross_centavos` and
 * `bir_withholding_centavos` onto EVERY stage row of an order. A coming_soon
 * vendor's 20/60/20 release therefore carries the full order withholding
 * three times. Naively summing the column across paid rows would triple-count.
 * `allocateOrderTotals` splits the order-level totals across that order's
 * stages by release weight (integer centavos, last stage absorbs the
 * remainder) so:
 *   • summing every stage of an order == the order's own withholding, exactly;
 *   • a quarter only ever counts the share of the stages actually paid in it.
 *
 * ── Current live reality ───────────────────────────────────────────────────
 * Setnayan takes 0% commission and never sits in the vendor↔couple money path
 * (settlement is off-platform), so there are no qualifying paid payouts today
 * and the honest output is ZERO filings. This module never fabricates rows to
 * fill that silence.
 */

/** Asia/Manila is UTC+8 year-round (no DST) — a fixed offset is exact. */
export const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Matches `vendor_2307_filings.tax_year`'s CHECK (2024..2100). */
export const MIN_TAX_YEAR = 2024;
export const MAX_TAX_YEAR = 2100;

export type TaxQuarter = 1 | 2 | 3 | 4;

export type QuarterRef = {
  tax_year: number;
  tax_quarter: TaxQuarter;
};

export type QuarterWindow = QuarterRef & {
  /** PHT calendar date, inclusive — lands on `vendor_2307_filings.period_from`. */
  period_from: string;
  /** PHT calendar date, inclusive — lands on `vendor_2307_filings.period_to`. */
  period_to: string;
  /** Instant the quarter opens (00:00 PHT of period_from), as UTC ISO. */
  starts_at_utc: string;
  /** Instant the NEXT quarter opens — the exclusive upper bound, as UTC ISO. */
  ends_before_utc: string;
};

/** Civil year/month/day of an instant in Asia/Manila. */
function phtParts(epochMs: number): { year: number; month: number; day: number } {
  const d = new Date(epochMs + PH_UTC_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** Epoch ms of 00:00:00 PHT on the 1st of `month` in `year`. */
function phtMonthStartEpoch(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1) - PH_UTC_OFFSET_MS;
}

function isTaxQuarter(v: unknown): v is TaxQuarter {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/**
 * The quarter that ENDED most recently before `now`, evaluated on the PH
 * calendar.
 *
 * The pg_cron job fires just after each quarter boundary (`0 18 1 1,4,7,10 *`
 * UTC ≈ 02:00 PHT on the 2nd of Jan/Apr/Jul/Oct), so "the quarter that just
 * ended" is the one it means to file.
 *
 * Timezone matters at exactly one place and it is the one that bites: the
 * turn of the year. At 2026-01-01 00:30 PHT the UTC clock still reads
 * 2025-12-31, so a UTC-based `getMonth()` would resolve Q3-2025 instead of the
 * correct Q4-2025. Everything here reads PH civil fields.
 */
export function resolveTargetQuarter(now: Date | number = Date.now()): QuarterRef {
  const epochMs = typeof now === 'number' ? now : now.getTime();
  const { year, month } = phtParts(epochMs);
  const currentQuarter = Math.ceil(month / 3);
  if (currentQuarter === 1) return { tax_year: year - 1, tax_quarter: 4 };
  return { tax_year: year, tax_quarter: (currentQuarter - 1) as TaxQuarter };
}

/** Last PH calendar day of a quarter — fixed, no leap-year sensitivity. */
const QUARTER_END_DAY: Record<TaxQuarter, number> = { 1: 31, 2: 30, 3: 30, 4: 31 };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Calendar + instant bounds of a tax quarter, on the PH calendar. */
export function quarterWindow(ref: QuarterRef): QuarterWindow {
  const q = ref.tax_quarter;
  const firstMonth = (q - 1) * 3 + 1;
  const lastMonth = q * 3;
  const nextYear = q === 4 ? ref.tax_year + 1 : ref.tax_year;
  const nextMonth = q === 4 ? 1 : lastMonth + 1;

  return {
    tax_year: ref.tax_year,
    tax_quarter: q,
    period_from: `${ref.tax_year}-${pad2(firstMonth)}-01`,
    period_to: `${ref.tax_year}-${pad2(lastMonth)}-${QUARTER_END_DAY[q]}`,
    starts_at_utc: new Date(
      phtMonthStartEpoch(ref.tax_year, firstMonth),
    ).toISOString(),
    ends_before_utc: new Date(
      phtMonthStartEpoch(nextYear, nextMonth),
    ).toISOString(),
  };
}

export type QuarterOverrideResult =
  | { ok: true; ref: QuarterRef | null }
  | { ok: false; error: string };

/**
 * Validate an optional `{ tax_year, tax_quarter }` override off the request
 * body. `ref: null` means "no override — use the default target quarter".
 *
 * The pg_cron job posts `{ "triggered_by": "pg_cron" }`, which carries neither
 * key and correctly resolves to `null`. Both keys must be supplied together —
 * a half-override is a caller bug, not something to guess at.
 */
export function parseQuarterOverride(body: unknown): QuarterOverrideResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: true, ref: null };
  }
  const raw = body as Record<string, unknown>;
  const hasYear = raw.tax_year !== undefined && raw.tax_year !== null;
  const hasQuarter = raw.tax_quarter !== undefined && raw.tax_quarter !== null;
  if (!hasYear && !hasQuarter) return { ok: true, ref: null };
  if (hasYear !== hasQuarter) {
    return {
      ok: false,
      error: 'tax_year and tax_quarter must be supplied together.',
    };
  }

  const year = Number(raw.tax_year);
  const quarter = Number(raw.tax_quarter);
  if (!Number.isInteger(year) || year < MIN_TAX_YEAR || year > MAX_TAX_YEAR) {
    return {
      ok: false,
      error: `tax_year must be an integer between ${MIN_TAX_YEAR} and ${MAX_TAX_YEAR}.`,
    };
  }
  if (!Number.isInteger(quarter) || !isTaxQuarter(quarter)) {
    return { ok: false, error: 'tax_quarter must be an integer 1-4.' };
  }
  return { ok: true, ref: { tax_year: year, tax_quarter: quarter } };
}

/**
 * Which month of its quarter an instant falls in (1 | 2 | 3), on the PH
 * calendar. Returns null for an unparseable timestamp.
 */
export function monthIndexInQuarter(timestamp: string | null | undefined): 1 | 2 | 3 | null {
  if (!timestamp) return null;
  const t = Date.parse(String(timestamp));
  if (!Number.isFinite(t)) return null;
  const { month } = phtParts(t);
  return (((month - 1) % 3) + 1) as 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// ATC (Alphanumeric Tax Code) mapping
// ---------------------------------------------------------------------------

/**
 * BIR ATC per `vendor_profiles.bir_service_category` × `tin_type`, using the
 * code pairs named in migration 20260516100000:
 *
 *   professional     → WI151 / WI150   (lawyers · CPAs · engineers · medical)
 *   talent           → WI080 / WI081   (musicians · photographers as talent)
 *   service_supplier → WI158 / WC158   (default — caterers · florists ·
 *                                       coordinators, 2% under a Top
 *                                       Withholding Agent designation)
 *
 * For `service_supplier` the pair is the standard BIR individual (WI) vs
 * corporate (WC) split, so `tin_type` picks it. The `professional` and
 * `talent` pairs are BOTH individual-series codes — they are gross-receipt
 * TIERS, not an individual/corporate split, and the migration does not say
 * which tier applies. Rather than invent a discriminator we take the first
 * code of each pair as the V1 default.
 *
 * TODO(0026-atc): confirm the professional / talent tier thresholds with the
 * tax accountant before any 2307 is actually filed with BIR.
 */
export const DEFAULT_BIR_SERVICE_CATEGORY = 'service_supplier';

export type BirVendorIdentity = {
  bir_service_category?: string | null;
  tin_type?: string | null;
};

export function resolveAtcCode(vendor: BirVendorIdentity | null | undefined): string {
  const category = vendor?.bir_service_category ?? DEFAULT_BIR_SERVICE_CATEGORY;
  const isCorporation = vendor?.tin_type === 'corporation';
  switch (category) {
    case 'professional':
      return 'WI151';
    case 'talent':
      return 'WI080';
    case 'service_supplier':
    default:
      return isCorporation ? 'WC158' : 'WI158';
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** The `vendor_payouts` columns the generator reads. */
export type PayoutRowForFiling = {
  payout_id: string;
  order_id: string | null;
  vendor_profile_id: string;
  /** NULL until the disbursement actually cleared. Only paid rows are filed. */
  paid_at: string | null;
  /** Centavos released at THIS stage — the allocation weight. */
  amount_centavos: number | null;
  vendor_net_centavos: number | null;
  /** ORDER-level gross, repeated on every stage row of the order. */
  gross_centavos: number | null;
  /** ORDER-level withholding, repeated on every stage row of the order. */
  bir_withholding_centavos: number | null;
  scheduled_at: string | null;
};

export type MonthlyBreakdownRow = {
  month_index: 1 | 2 | 3;
  atc_code: string;
  gross_centavos: number;
  ewt_centavos: number;
};

export type AtcTotalsRow = {
  atc_code: string;
  /**
   * EFFECTIVE rate, derived from the aggregated numbers
   * (`ewt × 10000 / gross`) — NOT the ATC's nominal rate.
   *
   * Deliberate: `lib/payouts.ts` withholds `BIR_WITHHOLDING_BPS` = 50 bps
   * (0.5%, the RMC 8-2024 marketplace rate), while WI158/WC158's nominal rate
   * is 200 bps. Printing the nominal rate next to real 0.5% numbers would make
   * the certificate internally inconsistent, so the row reports what was
   * actually withheld.
   */
  rate_bps: number;
  gross_centavos: number;
  ewt_centavos: number;
};

export type VendorFilingAggregate = {
  vendor_profile_id: string;
  atc_code: string;
  monthly_breakdown: MonthlyBreakdownRow[];
  totals: {
    gross_centavos: number;
    ewt_centavos: number;
    atc_rows: AtcTotalsRow[];
  };
  /** Payout rows that fed this filing — provenance for the audit_log entry. */
  payout_ids: string[];
};

function toInt(v: number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Split ONE order's order-level totals across its payout stage rows.
 *
 * `rows` must be every `vendor_payouts` row of a single order (paid or not) —
 * the split is over the whole release schedule so the shares are stable no
 * matter which quarter is being generated.
 *
 * Integer centavos throughout; the last row in deterministic order absorbs the
 * rounding remainder, so the shares always re-sum to the order total exactly.
 * A zero-weight order (every stage 0) puts the whole total on the first row
 * rather than silently dropping it.
 */
export function allocateOrderTotals(
  rows: PayoutRowForFiling[],
): Map<string, { gross_centavos: number; ewt_centavos: number }> {
  const out = new Map<string, { gross_centavos: number; ewt_centavos: number }>();
  if (rows.length === 0) return out;

  // Deterministic order: schedule first, payout_id as the tiebreaker.
  const ordered = [...rows].sort((a, b) => {
    const sa = a.scheduled_at ?? '';
    const sb = b.scheduled_at ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.payout_id < b.payout_id ? -1 : a.payout_id > b.payout_id ? 1 : 0;
  });

  // The order-level columns are identical across the order's stages; max is a
  // defensive read that survives a NULL or a partially-backfilled row.
  const orderGross = Math.max(...ordered.map((r) => toInt(r.gross_centavos)));
  const orderEwt = Math.max(
    ...ordered.map((r) => toInt(r.bir_withholding_centavos)),
  );

  const weights = ordered.map((r) =>
    toInt(r.amount_centavos ?? r.vendor_net_centavos),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (totalWeight === 0) {
    ordered.forEach((r, i) => {
      out.set(r.payout_id, {
        gross_centavos: i === 0 ? orderGross : 0,
        ewt_centavos: i === 0 ? orderEwt : 0,
      });
    });
    return out;
  }

  let grossAssigned = 0;
  let ewtAssigned = 0;
  ordered.forEach((r, i) => {
    const isLast = i === ordered.length - 1;
    const weight = weights[i] ?? 0;
    const gross = isLast
      ? orderGross - grossAssigned
      : Math.floor((orderGross * weight) / totalWeight);
    const ewt = isLast
      ? orderEwt - ewtAssigned
      : Math.floor((orderEwt * weight) / totalWeight);
    grossAssigned += gross;
    ewtAssigned += ewt;
    out.set(r.payout_id, { gross_centavos: gross, ewt_centavos: ewt });
  });

  return out;
}

export type BuildFilingsInput = {
  window: QuarterWindow;
  /**
   * Every `vendor_payouts` row belonging to an order that has at least one
   * stage paid inside the window — NOT just the in-window rows. The extra rows
   * are what make the per-order allocation exact.
   */
  rows: PayoutRowForFiling[];
  /** vendor_profile_id → BIR identity, for the ATC mapping. */
  vendors: Map<string, BirVendorIdentity>;
};

/**
 * Aggregate paid payout rows into one filing per vendor for the quarter.
 *
 * A vendor appears whenever it has ≥1 payout PAID inside the window, even if
 * the withheld total lands at zero — the old 0026 spec § 5.4 groups on
 * completed payouts and says nothing about dropping zero-EWT vendors, and a
 * zero-withholding certificate is a truthful record of a zero-withholding
 * quarter. Vendors with no paid payout at all simply never appear.
 */
export function buildVendorFilings(input: BuildFilingsInput): VendorFilingAggregate[] {
  const startMs = Date.parse(input.window.starts_at_utc);
  const endMs = Date.parse(input.window.ends_before_utc);

  // 1. Group every supplied row by its order so the allocation sees the whole
  //    release schedule. A row without an order_id stands alone.
  const byOrder = new Map<string, PayoutRowForFiling[]>();
  for (const row of input.rows) {
    const key = row.order_id ?? `payout:${row.payout_id}`;
    const bucket = byOrder.get(key);
    if (bucket) bucket.push(row);
    else byOrder.set(key, [row]);
  }

  // 2. Allocate order-level gross + withholding across each order's stages.
  const shares = new Map<string, { gross_centavos: number; ewt_centavos: number }>();
  for (const orderRows of byOrder.values()) {
    for (const [payoutId, share] of allocateOrderTotals(orderRows)) {
      shares.set(payoutId, share);
    }
  }

  // 3. Fold the in-window PAID rows into per-vendor monthly buckets.
  type Accumulator = {
    months: Map<1 | 2 | 3, { gross_centavos: number; ewt_centavos: number }>;
    payout_ids: string[];
  };
  const byVendor = new Map<string, Accumulator>();

  for (const row of input.rows) {
    if (!row.paid_at) continue;
    const paidMs = Date.parse(String(row.paid_at));
    if (!Number.isFinite(paidMs) || paidMs < startMs || paidMs >= endMs) continue;
    const monthIndex = monthIndexInQuarter(row.paid_at);
    if (monthIndex === null) continue;

    const share = shares.get(row.payout_id) ?? {
      gross_centavos: 0,
      ewt_centavos: 0,
    };

    let acc = byVendor.get(row.vendor_profile_id);
    if (!acc) {
      acc = { months: new Map(), payout_ids: [] };
      byVendor.set(row.vendor_profile_id, acc);
    }
    const month = acc.months.get(monthIndex) ?? {
      gross_centavos: 0,
      ewt_centavos: 0,
    };
    month.gross_centavos += share.gross_centavos;
    month.ewt_centavos += share.ewt_centavos;
    acc.months.set(monthIndex, month);
    acc.payout_ids.push(row.payout_id);
  }

  // 4. Shape each vendor's filing payload.
  const filings: VendorFilingAggregate[] = [];
  for (const [vendorProfileId, acc] of byVendor) {
    const atcCode = resolveAtcCode(input.vendors.get(vendorProfileId));
    const monthly: MonthlyBreakdownRow[] = ([1, 2, 3] as const)
      .filter((m) => acc.months.has(m))
      .map((m) => {
        const bucket = acc.months.get(m)!;
        return {
          month_index: m,
          atc_code: atcCode,
          gross_centavos: bucket.gross_centavos,
          ewt_centavos: bucket.ewt_centavos,
        };
      });

    const grossTotal = monthly.reduce((sum, r) => sum + r.gross_centavos, 0);
    const ewtTotal = monthly.reduce((sum, r) => sum + r.ewt_centavos, 0);

    filings.push({
      vendor_profile_id: vendorProfileId,
      atc_code: atcCode,
      monthly_breakdown: monthly,
      totals: {
        gross_centavos: grossTotal,
        ewt_centavos: ewtTotal,
        atc_rows: [
          {
            atc_code: atcCode,
            rate_bps:
              grossTotal > 0 ? Math.round((ewtTotal * 10000) / grossTotal) : 0,
            gross_centavos: grossTotal,
            ewt_centavos: ewtTotal,
          },
        ],
      },
      payout_ids: [...acc.payout_ids].sort(),
    });
  }

  // Stable output order so a re-run is byte-comparable.
  filings.sort((a, b) =>
    a.vendor_profile_id < b.vendor_profile_id
      ? -1
      : a.vendor_profile_id > b.vendor_profile_id
        ? 1
        : 0,
  );
  return filings;
}

/**
 * Serialize with object keys sorted, so two structurally equal values always
 * produce the same string.
 *
 * Plain `JSON.stringify` is NOT enough here: Postgres `jsonb` normalises key
 * order on write (shortest key first, then bytewise), so a value read back from
 * `vendor_2307_filings` is almost never key-for-key identical to the object the
 * generator just built. Comparing raw stringify output would therefore report
 * "changed" on every single re-run and defeat the whole no-op path.
 *
 * Array order is preserved — `monthly_breakdown` is ordered by month and that
 * ordering is meaningful.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Do two generations of the same filing carry the same numbers? Used to keep a
 * re-run of an unchanged quarter from churning `updated_at` /
 * `regenerated_count` / `audit_log` for no reason.
 */
export function filingPayloadEquals(
  a: { monthly_breakdown: unknown; totals: unknown },
  b: { monthly_breakdown: unknown; totals: unknown },
): boolean {
  return (
    canonicalJson(a.monthly_breakdown) === canonicalJson(b.monthly_breakdown) &&
    canonicalJson(a.totals) === canonicalJson(b.totals)
  );
}
