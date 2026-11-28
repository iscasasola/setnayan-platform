import Link from 'next/link';
import { ExternalLink, Receipt as ReceiptIcon } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatReceiptNumber, formatPhpFromString } from '@/lib/receipts';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { TemplateNums, TemplateSection } from '@/app/_components/template-rows';
import { InsightsParamPick } from '@/app/admin/app-performance/_components/insights-param-pick';

import { requireAdmin } from '@/lib/admin/require-admin';
import { formatCount } from '@/lib/format-number';
import { manilaMonthLabel, manilaMonthRange, manilaMonthsSince } from '@/lib/receipt-months';
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
  // A8·A-7: the MANILA month (BIR reconciliation runs on it), never the
  // server clock's UTC month.
  const range = filterMonth ? manilaMonthRange(filterMonth) : null;
  if (range) query = query.gte('issued_at', range.start).lt('issued_at', range.end);
  // A8·A-22: the picker is built from the OLDEST receipt, not the rows on
  // screen (those are month-filtered and capped), so one pick never hides the
  // other months. Same batch as the list.
  const oldestQuery = admin.from('receipts').select('issued_at').order('issued_at', { ascending: true }).limit(1);
  // This read had NO error branch at all. Supabase resolves with `{ error }`, so
  // a rejected query arrived as `data: null`, became `[]`, and the page said
  // "No receipts in this view." — on the surface an accountant reconciles BIR
  // filings against. `null` now travels to the render as NOT MEASURED.
  const [{ data, error }, oldestRes] = await Promise.all([query, oldestQuery]);
  if (oldestRes.error) logQueryError('AdminReceiptsPage.oldest', oldestRes.error, {}, 'graceful_degrade');
  if (error) {
    logQueryError('AdminReceiptsPage', error, { filterMonth }, 'graceful_degrade');
  }
  const receipts = data as ReceiptListRow[] | null;

  const oldest = (oldestRes.data?.[0] as { issued_at?: string } | undefined)?.issued_at ?? null;
  const monthOptions = oldest ? manilaMonthsSince(oldest) : [];
  // The picked month stays offered even when the oldest-receipt read failed.
  if (filterMonth && manilaMonthRange(filterMonth) && !monthOptions.includes(filterMonth)) monthOptions.unshift(filterMonth);

  // A8·A-8: the list is capped at ROW_LIMIT, so when it is full the tiles sum
  // the newest ROW_LIMIT only and say so — never a partial sum read as whole.
  const capped = receipts !== null && receipts.length >= ROW_LIMIT;
  const scope = capped ? ` · newest ${formatCount(ROW_LIMIT)}` : '';

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
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* The page starts at its content. ⚖ The sentence survives for the same
          reason it does on Platform settings: these are NOT BIR Official
          Receipts, and somebody reconciling a month's takings has to know that
          before they file anything — so it sits behind the ⓘ on the section's
          own label (admin clean port 19 Nov 2026: words unchanged, moved). */}
      <PageMasthead title="Receipts" />

      <TemplateSection
        label="Transaction receipts"
        first
        data="receipts"
        tip={
          <>
            App-issued transaction receipts (one per paid order). These are{' '}
            <strong>not</strong> BIR Official Receipts &mdash; cross-reference with your
            BIR-side OR records before filing. Filter by month for reconciliation.
          </>
        }
      >
        {/* 🗓 The month is ONE dropdown (the one-selector rule): a pick moves `?month=` and keeps `?view=receipts`,
            exactly as the old GET form + Apply did — the same read, re-run on the server. */}
        <InsightsParamPick
          name="Month"
          param="month"
          value={filterMonth ?? ''}
          options={[
            { key: '', label: 'All months' },
            ...monthOptions.map((m) => ({ key: m, label: manilaMonthLabel(m) })),
          ]}
        />

        {/* `null` when the read was refused: an em-dash, never a misleading ₱0
            total. A zero here would read as "no money came in". */}
        <TemplateNums
          items={[
            { label: `Receipts${scope}`, value: receipts ? formatCount(receipts.length) : '—', tone: receipts ? undefined : 'warn' },
            { label: `Pre-VAT sales${scope}`, value: totals ? formatPhpFromString(totals.preVat) : '—', tone: totals ? undefined : 'warn' },
            { label: `VAT collected${scope}`, value: totals ? formatPhpFromString(totals.vat) : '—', tone: totals ? undefined : 'warn' },
            { label: `Gross${scope}`, value: totals ? formatPhpFromString(totals.gross) : '—', tone: totals ? undefined : 'warn' },
          ]}
        />
      </TemplateSection>

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
                className="sn-hit inline-flex items-center gap-1 text-xs text-link hover:underline"
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
