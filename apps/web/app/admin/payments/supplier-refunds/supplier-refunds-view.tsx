import Link from 'next/link';
import { ArrowLeft, Undo2 } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { formatPhp } from '@/lib/orders';
import { refundDayWords, refundedTotalPhp } from '@/lib/client-refunds';

/** One number, read by the query AND disclosed by the table. */
export const SUPPLIER_REFUNDS_ROW_LIMIT = 200;

export type SupplierRefundRow = {
  refund_id: string;
  event_id: string | null;
  vendor_profile_id: string;
  amount_php: number | string;
  refunded_on: string;
  reason: string;
  proof_r2_key: string | null;
  created_at: string;
  removed_at: string | null;
};

/**
 * 💸 Admin › Payments › Supplier refunds — the render (read only). `rows: null` = the read was refused: the table says
 * "Couldn't read", the totals an em-dash, never "No supplier refunds yet". The page does the reads (`page.tsx`); the
 * dev lab draws this same component on sample rows.
 */
export function SupplierRefundsView({
  rows,
  readError,
  shopName,
  eventName,
  namesUnread = false,
}: {
  rows: SupplierRefundRow[] | null;
  readError: { message?: string } | null;
  shopName: ReadonlyMap<string, string | null>;
  eventName: ReadonlyMap<string, string | null>;
  /** The supplier or event names could not be read — each row then says so, never a made-up name. */
  namesUnread?: boolean;
}) {
  const ROW_LIMIT = SUPPLIER_REFUNDS_ROW_LIMIT;
  const standing = rows ? rows.filter((r) => !r.removed_at) : null;
  const total = standing ? refundedTotalPhp(standing.map((r) => ({ amountPhp: Number(r.amount_php) }))) : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8" data-admin-supplier-refunds="">
      <Link href="/admin/payments" className="mb-3 inline-flex items-center gap-1 text-sm text-link hover:underline">
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Payments
      </Link>
      <PageMasthead title="Supplier refunds" />
      <p className="mb-6 max-w-prose text-sm text-ink/70">
        Money a supplier says they gave back to a client, as they recorded it on that client&rsquo;s Payment page. A record
        only &mdash; nothing moved through Setnayan, and nothing here can be changed. Setnayan&rsquo;s own refunds of
        orders are on Payments.
      </p>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard label="Refunds standing" value={standing ? standing.length : null} />
        <KpiStatCard label="Given back" value={total === null ? null : formatPhp(total)} />
      </section>

      <ConsoleTable
        rows={rows}
        readPermitted
        readError={error}
        reads="supplier refunds"
        cap={ROW_LIMIT}
        label="Supplier refunds"
        minWidth="40rem"
        rowKey={(r) => r.refund_id}
        empty={{
          Icon: Undo2,
          title: 'No supplier refunds yet',
          blurb: 'A refund lands here when a supplier records one on a client’s Payment page (Clients › event › Payment › Record a refund).',
        }}
        columns={[
          {
            header: 'Given back',
            mono: true,
            cell: (r) => (
              <span className={r.removed_at ? 'text-ink/60 line-through' : 'font-semibold'}>{formatPhp(Number(r.amount_php))}</span>
            ),
          },
          { header: 'On', mono: true, cell: (r) => refundDayWords(r.refunded_on) },
          {
            header: 'Supplier · event',
            cell: (r) => (
              <>
                <p className="text-sm text-ink">{shopName.get(r.vendor_profile_id) ?? (namesUnread ? 'Couldn’t load the supplier' : 'A supplier')}</p>
                <p className="text-xs text-ink/70">{(r.event_id && eventName.get(r.event_id)) || (namesUnread ? 'Couldn’t load the event' : 'Their client’s event')}</p>
              </>
            ),
          },
          { header: 'Why', cell: (r) => <span className="text-sm text-ink">{r.reason}</span> },
          {
            header: 'Proof',
            hideBelow: 'md',
            cell: (r) => <span className="text-xs text-ink/70">{r.proof_r2_key ? 'Photo attached' : 'None attached'}</span>,
          },
          {
            header: 'Status',
            hideBelow: 'md',
            cell: (r) => (
              <span className="text-xs text-ink/70">
                {r.removed_at ? `Removed by the supplier · ${r.removed_at.slice(0, 10)}` : `Recorded ${r.created_at.slice(0, 10)}`}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
