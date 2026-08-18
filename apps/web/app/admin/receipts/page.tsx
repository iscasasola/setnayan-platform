import Link from 'next/link';
import { ExternalLink, Receipt as ReceiptIcon } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatReceiptNumber, formatPhpFromString } from '@/lib/receipts';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Receipts · Admin' };

/** One number, read by the query AND disclosed by the table. Never two hand-typed copies. */
const ROW_LIMIT = 200;

type ReceiptListRow = {
  receipt_id: string;
  or_serial: number;
  order_id: string;
  user_id: string;
  issued_to_email: string;
  issued_to_name: string | null;
  pre_vat_php: number;
  vat_rate_pct: number;
  vat_amount_php: number;
  gross_total_php: number;
  issued_at: string;
};

type Props = {
  searchParams: Promise<{ month?: string }>;
};

function monthBucket(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(bucket: string): string {
  const [year, month] = bucket.split('-');
  if (!year || !month) return bucket;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

export default async function AdminReceiptsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filterMonth = search.month ?? null;

  const admin = createAdminClient();
  let query = admin
    .from('receipts')
    .select(
      'receipt_id,or_serial,order_id,user_id,issued_to_email,issued_to_name,pre_vat_php,vat_rate_pct,vat_amount_php,gross_total_php,issued_at',
    )
    .order('issued_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (filterMonth) {
    const [year, month] = filterMonth.split('-');
    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1).toISOString();
      const end = new Date(Number(year), Number(month), 1).toISOString();
      query = query.gte('issued_at', start).lt('issued_at', end);
    }
  }
  // This read had NO error branch at all. Supabase resolves with `{ error }`, so
  // a rejected query arrived as `data: null`, became `[]`, and the page said
  // "No receipts in this view." — on the surface an accountant reconciles BIR
  // filings against. `null` now travels to the render as NOT MEASURED.
  const { data, error } = await query;
  if (error) {
    logQueryError('AdminReceiptsPage', error, { filterMonth }, 'graceful_degrade');
  }
  const receipts = data as ReceiptListRow[] | null;

  // Build a list of available months for the filter dropdown.
  const allMonths = new Set<string>();
  for (const r of receipts ?? []) {
    allMonths.add(monthBucket(r.issued_at));
  }
  const monthOptions = Array.from(allMonths).sort().reverse();

  // Totals across the visible filter — null when nothing was measured, so the
  // tiles show an em-dash rather than a confident ₱0.
  const totals = receipts
    ? receipts.reduce(
        (acc, r) => {
          acc.preVat += Number(r.pre_vat_php);
          acc.vat += Number(r.vat_amount_php);
          acc.gross += Number(r.gross_total_php);
          return acc;
        },
        { preVat: 0, vat: 0, gross: 0 },
      )
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Transaction receipts</h1>
        <p className="text-sm text-ink/60">
          App-issued transaction receipts (one per paid order). These are{' '}
          <strong>not</strong> BIR Official Receipts &mdash; cross-reference with your
          BIR-side OR records before filing. Filter by month for reconciliation.
        </p>
      </header>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Month
          </span>
          <select name="month" defaultValue={filterMonth ?? ''} className="input-field">
            <option value="">All months</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button-secondary">
          Apply
        </button>
      </form>

      {/* `null` when the read was refused: KpiStatCard renders an em-dash, never
          a misleading ₱0 total. A zero here would read as "no money came in". */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard label="Receipts" value={receipts ? receipts.length : null} />
        <KpiStatCard
          label="Pre-VAT sales"
          value={totals ? formatPhpFromString(totals.preVat) : null}
        />
        <KpiStatCard
          label="VAT collected"
          value={totals ? formatPhpFromString(totals.vat) : null}
        />
        <KpiStatCard label="Gross" value={totals ? formatPhpFromString(totals.gross) : null} />
      </section>

      <ConsoleTable
        rows={receipts}
        readPermitted
        readError={error}
        reads="the receipt ledger"
        cap={ROW_LIMIT}
        label="Transaction receipts"
        rowKey={(r) => r.receipt_id}
        empty={{
          Icon: ReceiptIcon,
          title: filterMonth ? 'No receipts that month' : 'No receipts yet',
          blurb:
            'One receipt is issued per paid order. Nothing here means no order has been marked paid for this view — pick a different month, or check the payments queue.',
        }}
        columns={[
          {
            header: 'Transaction No.',
            mono: true,
            cell: (r) => formatReceiptNumber(r.or_serial, r.issued_at),
          },
          {
            header: 'Issued',
            mono: true,
            hideBelow: 'md',
            cell: (r) => r.issued_at.slice(0, 10),
          },
          {
            header: 'Customer',
            cell: (r) => (
              <>
                <p className="text-sm text-ink">{r.issued_to_name ?? r.issued_to_email}</p>
                {r.issued_to_name ? (
                  <p className="text-xs text-ink/70">{r.issued_to_email}</p>
                ) : null}
              </>
            ),
          },
          {
            header: 'Pre-VAT',
            mono: true,
            align: 'right',
            hideBelow: 'lg',
            cell: (r) => formatPhpFromString(r.pre_vat_php),
          },
          {
            header: 'VAT',
            mono: true,
            align: 'right',
            hideBelow: 'lg',
            cell: (r) => (
              <span className="text-ink/70">{formatPhpFromString(r.vat_amount_php)}</span>
            ),
          },
          {
            header: 'Gross',
            mono: true,
            align: 'right',
            cell: (r) => (
              <span className="font-semibold">{formatPhpFromString(r.gross_total_php)}</span>
            ),
          },
          {
            header: 'Receipt',
            align: 'right',
            cell: (r) => (
              <Link
                href={`/receipts/${r.receipt_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-link hover:underline"
              >
                View
                <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
