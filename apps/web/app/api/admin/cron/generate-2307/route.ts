import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secureCompare } from '@/lib/secure-compare';
import {
  buildVendorFilings,
  filingPayloadEquals,
  parseQuarterOverride,
  quarterWindow,
  resolveTargetQuarter,
  type BirVendorIdentity,
  type PayoutRowForFiling,
  type QuarterRef,
} from '@/lib/bir-2307';

/**
 * Quarterly BIR Form 2307 generator — the endpoint the `quarterly_2307_generation`
 * pg_cron job has been POSTing to since migration 20260516100000.
 *
 * That migration shipped the schema AND the schedule but never the route, so
 * every quarterly firing 404'd. This is the compute + record half; the PDF
 * render is still owed (see TODO(0026-pdf) below), which is exactly why a
 * filing lands at status='queued'.
 *
 * ── Auth ───────────────────────────────────────────────────────────────────
 * `X-Cron-Secret: <CRON_SECRET>` (what the DB job sends — it reads the value
 * from Supabase Vault per migration 20270930270000) OR
 * `Authorization: Bearer <CRON_SECRET>` for a manual curl / Vercel Cron.
 * Timing-safe, and fail-closed when CRON_SECRET is unset. POST only.
 *
 * ── What it does ───────────────────────────────────────────────────────────
 * 1. Resolves the target quarter — by default the quarter that just ended on
 *    the PH calendar, since the job fires right after the boundary. An
 *    explicit `{ tax_year, tax_quarter }` body overrides it (both keys, or
 *    neither).
 * 2. Reads `vendor_payouts` rows PAID inside that quarter, plus the rest of
 *    each touched order's release schedule (needed for the stage allocation —
 *    see lib/bir-2307.ts).
 * 3. UPSERTs one `vendor_2307_filings` row per vendor with a paid payout,
 *    keyed on (vendor_profile_id, tax_year, tax_quarter). Regeneration UPDATEs
 *    in place per the migration's audit-trail contract — never a second row.
 *
 * ── Idempotency ────────────────────────────────────────────────────────────
 * Re-running the same quarter re-derives identical numbers and, when they
 * match what is already stored, writes NOTHING — no bumped `updated_at`, no
 * `regenerated_count`, no extra `audit_log` entry. Only a genuine change to
 * the computed figures updates the row.
 *
 * ── Expected output today ──────────────────────────────────────────────────
 * ZERO filings. Setnayan takes 0% commission and never sits in the
 * vendor↔couple money path (settlement is off-platform), so no payout is ever
 * marked paid and there is nothing to certify. That is the correct answer, not
 * a failure — the route reports the empty result honestly rather than
 * manufacturing rows. See the 2026-06-07 as-built correction on iteration 0026.
 */

// Service-role client + node:crypto in secureCompare — Node runtime required.
export const runtime = 'nodejs';
// Never statically optimise; every invocation needs fresh DB reads.
export const dynamic = 'force-dynamic';

/** Columns the generator reads off vendor_payouts. */
const PAYOUT_COLUMNS =
  'payout_id, order_id, vendor_profile_id, paid_at, amount_centavos, vendor_net_centavos, gross_centavos, bir_withholding_centavos, scheduled_at';

type FilingError = { vendor_profile_id: string; error: string };

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: Request) {
  // ---- Auth: fail closed, timing-safe, either header shape. ----------------
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured.' },
      { status: 503 },
    );
  }
  const authz = request.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = request.headers.get('x-cron-secret') ?? '';
  const authorized =
    (bearer.length > 0 && secureCompare(bearer, expected)) ||
    (headerSecret.length > 0 && secureCompare(headerSecret, expected));
  if (!authorized) return unauthorized();

  // ---- Target quarter ------------------------------------------------------
  // A body is optional: the pg_cron job posts `{ triggered_by: 'pg_cron' }`,
  // a manual curl may post nothing at all. Neither is an error.
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const override = parseQuarterOverride(body);
  if (!override.ok) {
    return NextResponse.json({ ok: false, error: override.error }, { status: 400 });
  }
  const ref: QuarterRef = override.ref ?? resolveTargetQuarter(new Date());
  const quarter = quarterWindow(ref);

  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  // ---- 1. Payouts actually PAID inside the quarter -------------------------
  const { data: paidRows, error: paidErr } = await admin
    .from('vendor_payouts')
    .select(PAYOUT_COLUMNS)
    .not('paid_at', 'is', null)
    .gte('paid_at', quarter.starts_at_utc)
    .lt('paid_at', quarter.ends_before_utc);

  if (paidErr) {
    return NextResponse.json(
      { ok: false, error: `vendor_payouts query failed: ${paidErr.message}` },
      { status: 500 },
    );
  }

  const paid = (paidRows ?? []) as unknown as PayoutRowForFiling[];

  if (paid.length === 0) {
    // The expected steady state today. Nothing to certify, nothing written.
    return NextResponse.json({
      ok: true,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      tax_year: quarter.tax_year,
      tax_quarter: quarter.tax_quarter,
      period_from: quarter.period_from,
      period_to: quarter.period_to,
      payouts_in_quarter: 0,
      vendors_processed: 0,
      filings_inserted: 0,
      filings_updated: 0,
      filings_unchanged: 0,
      filings_upserted: 0,
      total_gross_centavos: 0,
      total_withheld_centavos: 0,
      errors: [],
    });
  }

  // ---- 2. The rest of each touched order's release schedule ----------------
  // The order-level gross + withholding columns are stamped identically on
  // every stage row, so the per-stage share can only be computed with the whole
  // schedule in hand (lib/bir-2307.ts · allocateOrderTotals).
  const orderIds = [
    ...new Set(paid.map((r) => r.order_id).filter((id): id is string => !!id)),
  ];
  let rows: PayoutRowForFiling[] = paid;
  if (orderIds.length > 0) {
    const { data: siblingRows, error: siblingErr } = await admin
      .from('vendor_payouts')
      .select(PAYOUT_COLUMNS)
      .in('order_id', orderIds);
    if (siblingErr) {
      return NextResponse.json(
        {
          ok: false,
          error: `vendor_payouts sibling query failed: ${siblingErr.message}`,
        },
        { status: 500 },
      );
    }
    // Union by payout_id — the sibling read already contains the paid rows.
    const merged = new Map<string, PayoutRowForFiling>();
    for (const r of paid) merged.set(r.payout_id, r);
    for (const r of (siblingRows ?? []) as unknown as PayoutRowForFiling[]) {
      if (!merged.has(r.payout_id)) merged.set(r.payout_id, r);
    }
    rows = [...merged.values()];
  }

  // ---- 3. Vendor BIR identity for the ATC mapping --------------------------
  const vendorIds = [...new Set(paid.map((r) => r.vendor_profile_id))];
  const vendors = new Map<string, BirVendorIdentity>();
  const { data: vendorRows, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, bir_service_category, tin_type')
    .in('vendor_profile_id', vendorIds);
  if (vendorErr) {
    return NextResponse.json(
      { ok: false, error: `vendor_profiles query failed: ${vendorErr.message}` },
      { status: 500 },
    );
  }
  for (const v of vendorRows ?? []) {
    const row = v as {
      vendor_profile_id: string;
      bir_service_category: string | null;
      tin_type: string | null;
    };
    vendors.set(row.vendor_profile_id, {
      bir_service_category: row.bir_service_category,
      tin_type: row.tin_type,
    });
  }

  const filings = buildVendorFilings({ window: quarter, rows, vendors });

  // ---- 4. Existing filings for this quarter (regeneration path) ------------
  const { data: existingRows, error: existingErr } = await admin
    .from('vendor_2307_filings')
    .select(
      'filing_id, vendor_profile_id, monthly_breakdown, totals, audit_log, regenerated_count',
    )
    .eq('tax_year', quarter.tax_year)
    .eq('tax_quarter', quarter.tax_quarter)
    .in('vendor_profile_id', vendorIds);
  if (existingErr) {
    return NextResponse.json(
      { ok: false, error: `vendor_2307_filings query failed: ${existingErr.message}` },
      { status: 500 },
    );
  }
  type ExistingFiling = {
    filing_id: string;
    vendor_profile_id: string;
    monthly_breakdown: unknown;
    totals: unknown;
    audit_log: unknown;
    regenerated_count: number | null;
  };
  const existing = new Map<string, ExistingFiling>();
  for (const r of (existingRows ?? []) as unknown as ExistingFiling[]) {
    existing.set(r.vendor_profile_id, r);
  }

  // ---- 5. Write ------------------------------------------------------------
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: FilingError[] = [];

  for (const filing of filings) {
    const now = new Date().toISOString();
    const prior = existing.get(filing.vendor_profile_id);

    if (prior && filingPayloadEquals(prior, filing)) {
      // Byte-identical regeneration — leave the row completely alone so a
      // re-run is a true no-op.
      unchanged += 1;
      continue;
    }

    const auditEntry = {
      at: now,
      actor: 'cron' as const,
      action: prior ? ('regenerated' as const) : ('generated' as const),
      note:
        `Quarter ${quarter.tax_year}-Q${quarter.tax_quarter} · ` +
        `${filing.payout_ids.length} paid payout row(s) · ` +
        `gross ${filing.totals.gross_centavos}c · ewt ${filing.totals.ewt_centavos}c · ` +
        'PDF pending (status=queued).',
    };

    if (prior) {
      const priorLog = Array.isArray(prior.audit_log) ? prior.audit_log : [];
      const { error: updErr } = await admin
        .from('vendor_2307_filings')
        .update({
          period_from: quarter.period_from,
          period_to: quarter.period_to,
          // Numbers changed → any previously rendered PDF is stale. Reset to
          // 'queued' and clear the PDF pointers so a superseded certificate can
          // never be served. `downloaded_by_vendor_at` / `filed_at` are left
          // intact — those record what the vendor did, which regeneration does
          // not undo.
          status: 'queued',
          pdf_storage_bucket: null,
          pdf_storage_key: null,
          pdf_public_url: null,
          generated_at: null,
          monthly_breakdown: filing.monthly_breakdown,
          totals: filing.totals,
          audit_log: [...priorLog, auditEntry],
          regenerated_count: (prior.regenerated_count ?? 0) + 1,
          updated_at: now,
        })
        .eq('filing_id', prior.filing_id);
      if (updErr) {
        errors.push({
          vendor_profile_id: filing.vendor_profile_id,
          error: updErr.message,
        });
        continue;
      }
      updated += 1;
      continue;
    }

    const { error: insErr } = await admin.from('vendor_2307_filings').insert({
      vendor_profile_id: filing.vendor_profile_id,
      tax_year: quarter.tax_year,
      tax_quarter: quarter.tax_quarter,
      period_from: quarter.period_from,
      period_to: quarter.period_to,
      // TODO(0026-pdf): render the BIR Form 2307 PDF from monthly_breakdown +
      // totals + the vendor's BIR identity (vendor_profiles.tin_number /
      // registered_business_name / registered_address) + Setnayan's payor
      // identity (platform_settings.bir_payor_* / business_tin), upload it to
      // the 'setnayan-bir-2307' bucket, then set pdf_storage_bucket /
      // pdf_storage_key / pdf_public_url / generated_at and flip status to
      // 'generated'. The contributing vendor_payouts rows' form_2307_issued /
      // form_2307_url are flipped in that same step — NOT here, because no
      // certificate has been issued yet. Until then 'queued' is the honest
      // state: the figures are computed and recorded, the document is not.
      status: 'queued',
      monthly_breakdown: filing.monthly_breakdown,
      totals: filing.totals,
      audit_log: [auditEntry],
      // generated_by_admin_id stays NULL — the cron, not an admin, made this.
    });
    if (insErr) {
      errors.push({
        vendor_profile_id: filing.vendor_profile_id,
        error: insErr.message,
      });
      continue;
    }
    inserted += 1;
  }

  const totalGross = filings.reduce((s, f) => s + f.totals.gross_centavos, 0);
  const totalWithheld = filings.reduce((s, f) => s + f.totals.ewt_centavos, 0);

  return NextResponse.json({
    ok: errors.length === 0,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    tax_year: quarter.tax_year,
    tax_quarter: quarter.tax_quarter,
    period_from: quarter.period_from,
    period_to: quarter.period_to,
    payouts_in_quarter: paid.length,
    vendors_processed: filings.length,
    filings_inserted: inserted,
    filings_updated: updated,
    filings_unchanged: unchanged,
    filings_upserted: inserted + updated,
    total_gross_centavos: totalGross,
    total_withheld_centavos: totalWithheld,
    errors,
  });
}

// Reject GET so an accidental browser visit never writes filing rows.
export function GET() {
  return NextResponse.json(
    { ok: false, error: 'POST only.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
