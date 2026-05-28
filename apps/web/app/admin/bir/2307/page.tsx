import Link from 'next/link';
import {
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  deadlineForQuarter,
  listAllFilings,
  periodLabel,
  quarterThatJustEnded,
  type Vendor2307FilingRow,
} from '@/lib/bir/filings';
import { centavosToPesoString } from '@/lib/bir/atc-mapper';
import { Manual2307Trigger } from './_components/manual-trigger';
import { RegenerateButton } from './_components/regenerate-button';

export const metadata = { title: 'BIR Form 2307 · Admin' };
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ year?: string; quarter?: string }>;
};

export default async function AdminBir2307Page({ searchParams }: Props) {
  const search = await searchParams;
  const yearFilter = search.year ? Number.parseInt(search.year, 10) : undefined;
  const quarterFilter = search.quarter
    ? Number.parseInt(search.quarter, 10)
    : undefined;

  const admin = createAdminClient();
  const filings = await listAllFilings(admin, {
    year: Number.isFinite(yearFilter) ? yearFilter : undefined,
    quarter: Number.isFinite(quarterFilter) ? quarterFilter : undefined,
    limit: 500,
  });

  // Resolve vendor business names for the table.
  const vendorIds = Array.from(new Set(filings.map((f) => f.vendor_profile_id)));
  const { data: vendorRows } = vendorIds.length
    ? await admin
        .from('vendor_profiles')
        .select('vendor_profile_id,business_name,tin_number')
        .in('vendor_profile_id', vendorIds)
    : { data: [] };
  const vendorById = new Map(
    (vendorRows ?? []).map((v) => [
      v.vendor_profile_id as string,
      v as { vendor_profile_id: string; business_name: string; tin_number: string | null },
    ]),
  );

  // Per-quarter summary stats — sum gross + EWT, count filings.
  const summary = filings.reduce(
    (acc, f) => {
      acc.gross += Number(f.totals?.gross_centavos ?? 0);
      acc.ewt += Number(f.totals?.ewt_centavos ?? 0);
      if (f.status === 'generated') acc.generated++;
      if (f.status === 'downloaded') acc.downloaded++;
      if (f.status === 'filed_manually') acc.filed++;
      if (f.status === 'error') acc.errors++;
      return acc;
    },
    { gross: 0, ewt: 0, generated: 0, downloaded: 0, filed: 0, errors: 0 },
  );

  const recentPeriod = quarterThatJustEnded(new Date());

  // Build a small list of distinct (year, quarter) buckets for the filter
  // dropdown.
  const buckets = new Set<string>();
  for (const f of filings) {
    buckets.add(`${f.tax_year}-${f.tax_quarter}`);
  }
  const bucketOptions = Array.from(buckets).sort().reverse();

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0026 · BIR / Tax compliance
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          BIR Form 2307 · Quarterly auto-fill
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          One row per vendor per quarter. Cron fires automatically on the 1st
          of Jan/Apr/Jul/Oct at 02:00 PHT. Use the manual trigger to backfill,
          and the Regenerate button to refresh a single vendor after fixing
          their TIN / address.
        </p>
      </header>

      <Manual2307Trigger
        defaultYear={recentPeriod.tax_year}
        defaultQuarter={recentPeriod.tax_quarter}
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Filings" value={String(filings.length)} />
        <Stat label="Gross paid" value={`PHP ${centavosToPesoString(summary.gross)}`} />
        <Stat label="EWT" value={`PHP ${centavosToPesoString(summary.ewt)}`} />
        <Stat label="Generated" value={String(summary.generated)} />
        <Stat label="Downloaded" value={String(summary.downloaded)} />
        <Stat
          label="Errors"
          value={String(summary.errors)}
          tone={summary.errors > 0 ? 'warn' : 'normal'}
        />
      </section>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Period
          </span>
          <select
            name="bucket"
            defaultValue={
              yearFilter && quarterFilter
                ? `${yearFilter}-${quarterFilter}`
                : ''
            }
            className="input-field"
            onChange={undefined}
          >
            <option value="">All periods</option>
            {bucketOptions.map((b) => {
              const [y, q] = b.split('-');
              return (
                <option key={b} value={b}>
                  {y} Q{q}
                </option>
              );
            })}
          </select>
        </label>
        <button type="submit" className="button-secondary">
          Apply
        </button>
        {(yearFilter || quarterFilter) && (
          <Link href="/admin/bir/2307" className="text-xs text-terracotta hover:underline">
            Clear filter
          </Link>
        )}
      </form>

      {filings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          No 2307 filings on record yet.{' '}
          {recentPeriod ? (
            <>Trigger one above for {periodLabel(recentPeriod.tax_year, recentPeriod.tax_quarter)}.</>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th className="px-3 py-3 font-medium">Period</th>
                <th className="px-3 py-3 font-medium">Vendor</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">TIN</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">ATC</th>
                <th className="px-3 py-3 font-medium">Gross</th>
                <th className="px-3 py-3 font-medium">EWT</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => {
                const vendor = vendorById.get(f.vendor_profile_id);
                const deadline = deadlineForQuarter(f.tax_year, f.tax_quarter);
                const overdue = f.status !== 'filed_manually' && deadline < new Date();
                return (
                  <tr
                    key={f.filing_id}
                    className="border-t border-ink/5 hover:bg-terracotta/[0.04]"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-ink">
                      {periodLabel(f.tax_year, f.tax_quarter)}
                      {overdue ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-red-700">
                          <AlertTriangle aria-hidden className="h-3 w-3" />
                          past deadline
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-ink">
                        {vendor?.business_name || 'Unknown vendor'}
                      </p>
                      <p className="font-mono text-[11px] text-ink/55">
                        {f.public_id}
                      </p>
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-ink/65 md:table-cell">
                      {vendor?.tin_number ?? '—'}
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-ink/65 md:table-cell">
                      {f.totals?.atc_rows?.[0]?.atc_code ?? '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-sm">
                      PHP {centavosToPesoString(f.totals?.gross_centavos ?? 0)}
                    </td>
                    <td className="px-3 py-3 font-mono text-sm font-semibold">
                      PHP {centavosToPesoString(f.totals?.ewt_centavos ?? 0)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={f.status} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        {f.pdf_public_url ? (
                          <a
                            href={f.pdf_public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                          >
                            View
                            <ExternalLink aria-hidden className="h-3 w-3" />
                          </a>
                        ) : null}
                        <RegenerateButton
                          vendor_profile_id={f.vendor_profile_id}
                          year={f.tax_year}
                          quarter={f.tax_quarter}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'warn';
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === 'warn'
          ? 'border-red-200 bg-red-50'
          : 'border-ink/10 bg-cream'
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold tracking-tight ${
          tone === 'warn' ? 'text-red-900' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Vendor2307FilingRow['status'] }) {
  const map: Record<string, { label: string; tone: string; Icon?: typeof CheckCircle2 }> = {
    queued: {
      label: 'Queued',
      tone: 'bg-ink/10 text-ink/65',
    },
    generated: {
      label: 'Generated',
      tone: 'bg-amber-100 text-amber-900',
    },
    downloaded: {
      label: 'Downloaded',
      tone: 'bg-emerald-100 text-emerald-800',
      Icon: CheckCircle2,
    },
    filed_manually: {
      label: 'Filed',
      tone: 'bg-emerald-100 text-emerald-900',
      Icon: CheckCircle2,
    },
    error: {
      label: 'Error',
      tone: 'bg-red-100 text-red-900',
      Icon: AlertTriangle,
    },
  };
  const m = map[status] ?? map.queued ?? {
    label: status,
    tone: 'bg-ink/10 text-ink/65',
  };
  const Icon = m.Icon ?? RefreshCw;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${m.tone}`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {m.label}
    </span>
  );
}
