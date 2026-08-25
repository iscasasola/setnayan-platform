/**
 * The transactions ledger — every peso event Setnayan has ever taken, on the
 * page called Money.
 *
 * WHY THIS EXISTS. /admin/money shipped as a grid of links to settings pages,
 * carrying a note that had to apologise for itself: "The act-now money queues —
 * Payments, Payouts and Subscriptions — live in Overview, not here." The page
 * named Money contained no money. Worse, there was NO page anywhere in the
 * console that listed transactions: /admin/payments queries orders with
 * `.eq('status','submitted')` and payments with `status='pending'`, so it shows
 * only what is UNSETTLED. The first real sale — a paid order — was invisible on
 * every money screen the moment it was reconciled. /admin/receipts came closest
 * but lists receipts, which exist only for orders that reached 'paid'; a
 * cancelled or lapsed order appears nowhere at all.
 *
 * 🔑 A QUEUE IS NOT A LEDGER. A queue answers "what needs me now" and empties
 * itself by design. The owner asked how to CHECK AND TRACK transactions —
 * tracking is the half that survives settlement, and it was the half missing.
 * This component is the ledger; the queues keep their pages and are linked from
 * the strip at the top rather than duplicated here.
 *
 * The "needs you now" strip reads the SHARED getAdminQueueDigest() — the same
 * fetch behind the nav badges, the topbar pill and the /admin/work list — so
 * this screen cannot disagree with them about what is outstanding. It is a
 * per-request cache() so mounting it here costs no extra round-trip when the
 * badges have already run.
 *
 * MEASUREMENT RULE, followed throughout: `null` means NOT MEASURED and renders
 * an em-dash. It never renders as ₱0 — on a money screen a confident zero reads
 * as "no money came in", which is a different and much worse claim than "this
 * did not load".
 */

import Link from 'next/link';
import { ArrowRight, Coins, ReceiptText } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  formatPhp,
  isVatInclusiveServiceKey,
  orderGrossOwed,
  type OrderStatus,
} from '@/lib/orders';
import {
  getAdminQueueDigest,
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';

/** One number, read by the query AND disclosed by the table. Never two copies. */
const ROW_LIMIT = 200;

/** A transaction has SETTLED when money changed hands and stayed. */
const RECEIVED_STATUSES: readonly OrderStatus[] = ['paid', 'fulfilled'];
/** Still owed to us — the buyer has asked for something and not yet paid. */
const OUTSTANDING_STATUSES: readonly OrderStatus[] = ['submitted', 'awaiting_payment'];

type LedgerOrder = {
  order_id: string;
  public_id: string;
  user_id: string;
  service_key: string | null;
  description: string;
  requested_total_php: number;
  confirmed_total_php: number | null;
  voucher_discount_centavos: number | null;
  status: OrderStatus;
  reference_code: string;
  created_at: string;
};

type Row = LedgerOrder & {
  buyerName: string | null;
  buyerEmail: string | null;
  buyerInternal: boolean;
  chargedPhp: number;
  receivedPhp: number | null;
  receiptId: string | null;
};

/** Manila-local day, so a sale at 9pm PH does not file itself under tomorrow. */
function manilaDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export async function TransactionsLedger() {
  const admin = createAdminClient();

  // The money-lane queues, straight from the shared digest. Fails soft: a
  // thrown query degrades the strip to "not measured", never to "all clear".
  const digest = await getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest);
  const moneyQueues = BASE_ROWS.filter(
    (r) => ADMIN_QUEUE_META[r.key]?.lane === 'money',
  ).map((r) => ({
    key: r.key,
    label: r.label,
    href: r.href,
    count: digest[r.key]?.count ?? null,
  }));

  const vatRatePct = await getEffectiveVatRatePct(admin);

  const { data: orderData, error: orderError } = await admin
    .from('orders')
    .select(
      'order_id,public_id,user_id,service_key,description,requested_total_php,confirmed_total_php,voucher_discount_centavos,status,reference_code,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  if (orderError) {
    logQueryError('AdminTransactionsLedger.orders', orderError, {}, 'graceful_degrade');
  }
  const orders = orderData as LedgerOrder[] | null;

  // Side reads are per-page, not per-row: three queries total regardless of how
  // many transactions are listed.
  let rows: Row[] | null = null;
  if (orders) {
    const orderIds = orders.map((o) => o.order_id);
    const userIds = Array.from(new Set(orders.map((o) => o.user_id)));

    const [{ data: buyers }, { data: paid }, { data: receipts }] = await Promise.all([
      admin.from('users').select('user_id,display_name,email,is_internal').in('user_id', userIds),
      admin.from('payments').select('order_id,amount_php,status').in('order_id', orderIds),
      admin.from('receipts').select('receipt_id,order_id').in('order_id', orderIds),
    ]);

    const buyerBy = new Map((buyers ?? []).map((u) => [u.user_id as string, u]));
    const receiptBy = new Map(
      (receipts ?? []).map((r) => [r.order_id as string, r.receipt_id as string]),
    );
    // Only MATCHED money counts as received. A pending screenshot is a claim.
    const receivedBy = new Map<string, number>();
    for (const p of paid ?? []) {
      if (p.status !== 'matched') continue;
      const id = p.order_id as string;
      receivedBy.set(id, (receivedBy.get(id) ?? 0) + Number(p.amount_php ?? 0));
    }

    rows = orders.map((o) => {
      const u = buyerBy.get(o.user_id);
      return {
        ...o,
        buyerName: (u?.display_name as string | null) ?? null,
        buyerEmail: (u?.email as string | null) ?? null,
        buyerInternal: Boolean(u?.is_internal),
        // Derived by the SHARED money rule, never re-typed here.
        chargedPhp: orderGrossOwed({
          requestedTotalPhp: Number(o.requested_total_php),
          confirmedTotalPhp:
            o.confirmed_total_php == null ? null : Number(o.confirmed_total_php),
          voucherDiscountPhp: (o.voucher_discount_centavos ?? 0) / 100,
          vatInclusive: isVatInclusiveServiceKey(o.service_key),
          vatRatePct,
        }),
        receivedPhp: receivedBy.get(o.order_id) ?? null,
        receiptId: receiptBy.get(o.order_id) ?? null,
      };
    });
  }

  const received = rows
    ? rows
        .filter((r) => RECEIVED_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + (r.receivedPhp ?? r.chargedPhp), 0)
    : null;
  const outstanding = rows
    ? rows
        .filter((r) => OUTSTANDING_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + r.chargedPhp, 0)
    : null;

  // A queue whose count could not be read is NOT zero — it is unknown, and the
  // strip says so rather than reporting a clear desk.
  const waitingKnown = moneyQueues.filter((q) => q.count != null);
  const waitingTotal = waitingKnown.reduce((sum, q) => sum + (q.count ?? 0), 0);
  const anyUnmeasured = moneyQueues.some((q) => q.count == null);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      <h2 className="text-lg font-semibold text-ink">Money</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        Every transaction Setnayan has taken, newest first — including the ones
        already settled. What still needs you is at the top.
      </p>

      {/* ── What needs you now ─────────────────────────────────────────── */}
      <div className="mt-5 rounded-xl border border-ink/10 bg-paper p-4">
        <p className="text-sm font-medium text-ink">
          {anyUnmeasured
            ? 'Some money queues could not be checked just now'
            : waitingTotal === 0
              ? 'Nothing is waiting for you'
              : `${waitingTotal} ${waitingTotal === 1 ? 'thing needs' : 'things need'} you`}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {moneyQueues.map((q) => (
            <li key={q.key}>
              <Link
                href={q.href}
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1.5 text-xs text-ink hover:border-ink/25"
              >
                <span>{q.label}</span>
                <span
                  className={`font-mono text-[11px] ${
                    q.count == null
                      ? 'text-ink/45'
                      : q.count > 0
                        ? 'font-semibold text-mulberry'
                        : 'text-ink/45'
                  }`}
                >
                  {/* Em-dash = not measured. Never a confident 0. */}
                  {q.count == null ? '—' : q.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiStatCard
          label="Received"
          value={received == null ? null : formatPhp(received)}
          hint="Settled and kept"
        />
        <KpiStatCard
          label="Waiting on payment"
          value={outstanding == null ? null : formatPhp(outstanding)}
          hint="Asked for, not yet paid"
        />
        <KpiStatCard label="Transactions" value={rows ? rows.length : null} />
      </div>

      <div className="mt-5">
        <ConsoleTable
          rows={rows}
          readPermitted
          readError={orderError}
          reads="the transaction ledger"
          cap={ROW_LIMIT}
          label="Every transaction"
          rowKey={(r) => r.order_id}
          empty={{
            Icon: Coins,
            title: 'No transactions yet',
            blurb:
              'Nobody has bought anything. The first purchase will appear here the moment it is placed — before it is paid, not after.',
          }}
          columns={[
            {
              header: 'When',
              mono: true,
              cell: (r) => manilaDay(r.created_at),
            },
            {
              header: 'Reference',
              mono: true,
              hideBelow: 'md',
              cell: (r) => r.reference_code,
            },
            {
              header: 'Who',
              cell: (r) => (
                <>
                  <p className="text-sm text-ink">
                    {r.buyerName ?? r.buyerEmail ?? 'Unknown buyer'}
                    {r.buyerInternal ? (
                      // 🪤 Our own test purchases look exactly like real revenue
                      // in a total. Say so on the row rather than filtering them
                      // out, so the ledger stays complete and still honest.
                      <span className="ml-2 rounded bg-ink/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/70">
                        ours
                      </span>
                    ) : null}
                  </p>
                  {r.buyerName && r.buyerEmail ? (
                    <p className="text-xs text-ink/70">{r.buyerEmail}</p>
                  ) : null}
                </>
              ),
            },
            {
              header: 'What they bought',
              cell: (r) => <span className="text-sm text-ink">{r.description}</span>,
            },
            {
              header: 'Amount',
              mono: true,
              align: 'right',
              cell: (r) => <span className="font-semibold">{formatPhp(r.chargedPhp)}</span>,
            },
            {
              header: 'Where it stands',
              cell: (r) => (
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                    ORDER_STATUS_TONE[r.status] ?? 'bg-ink/10 text-ink/70'
                  }`}
                >
                  {/* The English word, from the shared map — never the stored value. */}
                  {ORDER_STATUS_LABEL[r.status] ?? r.status}
                </span>
              ),
            },
            {
              header: 'Receipt',
              align: 'right',
              cell: (r) =>
                r.receiptId ? (
                  <Link
                    href={`/receipts/${r.receiptId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-link hover:underline"
                  >
                    <ReceiptText aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    View
                  </Link>
                ) : (
                  <span className="text-xs text-ink/45">—</span>
                ),
            },
          ]}
        />
      </div>

      <p className="mt-3 text-sm text-ink/70">
        <Link href="/admin/receipts" className="text-link hover:underline">
          Receipts for the tax file
          <ArrowRight aria-hidden className="ml-1 inline h-3 w-3" strokeWidth={1.75} />
        </Link>
      </p>
    </section>
  );
}
