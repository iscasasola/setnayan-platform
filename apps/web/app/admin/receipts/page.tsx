import Link from 'next/link';
import { ExternalLink, Receipt as ReceiptIcon } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatOrNumber, formatPhpFromString } from '@/lib/receipts';

export const metadata = { title: 'Receipts · Admin' };

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
  const search = await searchParams;
  const filterMonth = search.month ?? null;

  const admin = createAdminClient();
  let query = admin
    .from('receipts')
    .select(
      'receipt_id,or_serial,order_id,user_id,issued_to_email,issued_to_name,pre_vat_php,vat_rate_pct,vat_amount_php,gross_total_php,issued_at',
    )
    .order('issued_at', { ascending: false })
    .limit(200);
  if (filterMonth) {
    const [year, month] = filterMonth.split('-');
    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1).toISOString();
      const end = new Date(Number(year), Number(month), 1).toISOString();
      query = query.gte('issued_at', start).lt('issued_at', end);
    }
  }
  const { data } = await query;
  const receipts = (data ?? []) as ReceiptListRow[];

  // Build a list of available months for the filter dropdown.
  const allMonths = new Set<string>();
  for (const r of receipts) {
    allMonths.add(monthBucket(r.issued_at));
  }
  const monthOptions = Array.from(allMonths).sort().reverse();

  // Totals across the visible filter.
  const totals = receipts.reduce(
    (acc, r) => {
      acc.preVat += Number(r.pre_vat_php);
      acc.vat += Number(r.vat_amount_php);
      acc.gross += Number(r.gross_total_php);
      return acc;
    },
    { preVat: 0, vat: 0, gross: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-sm text-ink/60">
          Every Official Receipt issued when a payment was approved with &ldquo;Also mark
          order as paid&rdquo;. Filter by month for BIR filing.
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

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Receipts" value={String(receipts.length)} />
        <Stat label="Pre-VAT sales" value={formatPhpFromString(totals.preVat)} />
        <Stat label="VAT collected" value={formatPhpFromString(totals.vat)} />
        <Stat label="Gross" value={formatPhpFromString(totals.gross)} />
      </section>

      {receipts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          <ReceiptIcon
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          No receipts in this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th className="px-3 py-3 font-medium">OR number</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Issued</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Pre-VAT</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">VAT</th>
                <th className="px-3 py-3 font-medium">Gross</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr
                  key={r.receipt_id}
                  className="border-t border-ink/5 hover:bg-terracotta/[0.04]"
                >
                  <td className="px-3 py-3 font-mono text-xs text-ink">
                    {formatOrNumber(r.or_serial, r.issued_at)}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-xs text-ink/65 md:table-cell">
                    {r.issued_at.slice(0, 10)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm text-ink">
                      {r.issued_to_name ?? r.issued_to_email}
                    </p>
                    {r.issued_to_name ? (
                      <p className="text-xs text-ink/55">{r.issued_to_email}</p>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-sm lg:table-cell">
                    {formatPhpFromString(r.pre_vat_php)}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-sm text-ink/65 lg:table-cell">
                    {formatPhpFromString(r.vat_amount_php)}
                  </td>
                  <td className="px-3 py-3 font-mono text-sm font-semibold">
                    {formatPhpFromString(r.gross_total_php)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/receipts/${r.receipt_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                    >
                      View
                      <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
