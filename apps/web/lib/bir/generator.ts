import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildQuarterFilings,
  fetchFilingByVendorAndPeriod,
  quarterToPeriod,
  type FilingPeriod,
  type VendorFilingInput,
  type Vendor2307FilingRow,
} from './filings';
import { generate2307PDF, type GeneratorPayorInfo } from './2307-pdf';
import { upload2307Pdf } from './storage';

/**
 * High-level orchestration for the BIR Form 2307 quarterly auto-fill.
 *
 *   1. Pull payor (Setnayan) info from platform_settings.
 *   2. Aggregate vendor payouts into VendorFilingInput rows.
 *   3. For each vendor:
 *        a. Render the PDF
 *        b. Upload to R2 / Supabase Storage fallback
 *        c. Upsert vendor_2307_filings row
 *      Failures on individual vendors are recorded as status='error' on
 *      that row but don't abort the whole batch.
 *   4. Return a summary the API endpoint can JSONify.
 *
 * Callers (cron + admin manual trigger) MUST pass an admin client —
 * the aggregator reads cross-vendor payout data that vendor RLS would
 * otherwise hide.
 */

export type GenerateQuarterArgs = {
  admin: SupabaseClient;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  /** When the trigger came from a human admin — gets recorded in audit_log. */
  triggered_by_admin_id?: string | null;
};

export type GenerateQuarterResult = {
  period: FilingPeriod;
  vendor_count: number;
  generated: number;
  skipped_no_ewt: number;
  errors: Array<{ vendor_profile_id: string; message: string }>;
  filings: Array<{
    filing_id: string;
    vendor_profile_id: string;
    status: string;
    pdf_public_url: string | null;
  }>;
};

export async function generateQuarter(
  args: GenerateQuarterArgs,
): Promise<GenerateQuarterResult> {
  const period = quarterToPeriod(args.year, args.quarter);
  const payor = await fetchPayorInfo(args.admin);
  const filings = await buildQuarterFilings(args.admin, period);

  const result: GenerateQuarterResult = {
    period,
    vendor_count: filings.length,
    generated: 0,
    skipped_no_ewt: 0,
    errors: [],
    filings: [],
  };

  for (const filing of filings) {
    if (filing.totals.ewt_centavos === 0) {
      result.skipped_no_ewt++;
      continue;
    }
    try {
      const row = await generateOne(args.admin, {
        period,
        payor,
        filing,
        triggered_by_admin_id: args.triggered_by_admin_id ?? null,
      });
      result.generated++;
      result.filings.push({
        filing_id: row.filing_id,
        vendor_profile_id: row.vendor_profile_id,
        status: row.status,
        pdf_public_url: row.pdf_public_url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({
        vendor_profile_id: filing.vendor_profile_id,
        message,
      });
      console.error(
        `[bir/generator] vendor ${filing.vendor_profile_id} failed:`,
        message,
      );
      // Best-effort: write an 'error' status row so the admin queue
      // surfaces the failure rather than silently swallowing it.
      try {
        await upsertErrorRow(args.admin, {
          vendor_profile_id: filing.vendor_profile_id,
          period,
          message,
        });
      } catch {
        // We've already lost — log only.
      }
    }
  }

  return result;
}

/**
 * Generate / regenerate a single vendor's 2307 for a specific quarter.
 * Used by the cron loop and by the admin "Regenerate" button.
 */
export async function regenerateVendor(
  admin: SupabaseClient,
  vendor_profile_id: string,
  year: number,
  quarter: 1 | 2 | 3 | 4,
  triggered_by_admin_id: string | null,
): Promise<Vendor2307FilingRow> {
  const period = quarterToPeriod(year, quarter);
  const payor = await fetchPayorInfo(admin);
  const all = await buildQuarterFilings(admin, period);
  const match = all.find((f) => f.vendor_profile_id === vendor_profile_id);
  if (!match) {
    throw new Error(
      `No EWT-bearing payouts found for vendor ${vendor_profile_id} in ${year} Q${quarter}.`,
    );
  }
  return generateOne(admin, {
    period,
    payor,
    filing: match,
    triggered_by_admin_id,
  });
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

async function generateOne(
  admin: SupabaseClient,
  args: {
    period: FilingPeriod;
    payor: GeneratorPayorInfo;
    filing: VendorFilingInput;
    triggered_by_admin_id: string | null;
  },
): Promise<Vendor2307FilingRow> {
  const pdfBytes = await generate2307PDF({
    filing: args.filing,
    period: args.period,
    payor: args.payor,
  });
  const upload = await upload2307Pdf({
    pdfBytes,
    vendor_profile_id: args.filing.vendor_profile_id,
    tax_year: args.period.tax_year,
    tax_quarter: args.period.tax_quarter,
  });

  const existing = await fetchFilingByVendorAndPeriod(
    admin,
    args.filing.vendor_profile_id,
    args.period.tax_year,
    args.period.tax_quarter,
  );

  const auditEntry = {
    at: new Date().toISOString(),
    actor: args.triggered_by_admin_id ?? 'cron',
    action: existing ? 'regenerated' : 'generated',
    note: `storage=${upload.storage} bucket=${upload.bucket}`,
  };

  const newAuditLog = [
    ...(existing?.audit_log ?? []),
    auditEntry,
  ];

  const payload = {
    vendor_profile_id: args.filing.vendor_profile_id,
    tax_year: args.period.tax_year,
    tax_quarter: args.period.tax_quarter,
    period_from: args.period.period_from,
    period_to: args.period.period_to,
    status: 'generated' as const,
    pdf_storage_bucket: upload.bucket,
    pdf_storage_key: upload.key,
    pdf_public_url: upload.publicUrl,
    generated_at: new Date().toISOString(),
    generated_by_admin_id: args.triggered_by_admin_id,
    regenerated_count: (existing?.regenerated_count ?? 0) + (existing ? 1 : 0),
    monthly_breakdown: args.filing.monthly_breakdown,
    totals: args.filing.totals,
    audit_log: newAuditLog,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('vendor_2307_filings')
    .upsert(payload, {
      onConflict: 'vendor_profile_id,tax_year,tax_quarter',
    })
    .select('*')
    .single();
  if (error) {
    throw new Error(`vendor_2307_filings upsert failed: ${error.message}`);
  }
  return data as Vendor2307FilingRow;
}

async function upsertErrorRow(
  admin: SupabaseClient,
  args: {
    vendor_profile_id: string;
    period: FilingPeriod;
    message: string;
  },
): Promise<void> {
  const existing = await fetchFilingByVendorAndPeriod(
    admin,
    args.vendor_profile_id,
    args.period.tax_year,
    args.period.tax_quarter,
  );
  const auditEntry = {
    at: new Date().toISOString(),
    actor: 'cron',
    action: 'error',
    note: args.message.slice(0, 500),
  };
  await admin.from('vendor_2307_filings').upsert(
    {
      vendor_profile_id: args.vendor_profile_id,
      tax_year: args.period.tax_year,
      tax_quarter: args.period.tax_quarter,
      period_from: args.period.period_from,
      period_to: args.period.period_to,
      status: 'error',
      audit_log: [...(existing?.audit_log ?? []), auditEntry],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id,tax_year,tax_quarter' },
  );
}

async function fetchPayorInfo(
  admin: SupabaseClient,
): Promise<GeneratorPayorInfo> {
  const { data, error } = await admin
    .from('platform_settings')
    .select(
      'business_tin,bir_payor_name,bir_payor_address,bir_payor_zip,bir_authorized_rep_name,bir_authorized_rep_tin,bir_authorized_rep_title,business_name,business_address',
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    throw new Error(`platform_settings read failed: ${error.message}`);
  }
  const row = data ?? {};
  return {
    tin: (row as Record<string, unknown>).business_tin as string | null,
    // Fall back to business_name / business_address when the BIR-
    // specific column hasn't been filled in yet.
    name:
      ((row as Record<string, unknown>).bir_payor_name as string | null) ??
      ((row as Record<string, unknown>).business_name as string | null) ??
      null,
    address:
      ((row as Record<string, unknown>).bir_payor_address as string | null) ??
      ((row as Record<string, unknown>).business_address as string | null) ??
      null,
    zip: ((row as Record<string, unknown>).bir_payor_zip as string | null) ?? null,
    authorized_rep_name:
      ((row as Record<string, unknown>).bir_authorized_rep_name as string | null) ?? null,
    authorized_rep_tin:
      ((row as Record<string, unknown>).bir_authorized_rep_tin as string | null) ?? null,
    authorized_rep_title:
      ((row as Record<string, unknown>).bir_authorized_rep_title as string | null) ?? null,
  };
}
