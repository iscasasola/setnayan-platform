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
import { Coins, ReceiptText } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import {
  ORDER_STATUS_LABEL,
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
import { LEDGER_REFERENCE_COLUMN } from './ledger-reference-column';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import {
  TEMPLATE_MONEY,
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateNums,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { LedgerPhoneRow } from './ledger-phone-row';
import { formatCount } from '@/lib/format-number';

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

/**
 * Where an order stands, as the template's soft chip (rule 5): green done · amber waiting · grey nothing to do. The
 * WORD still comes from the shared `ORDER_STATUS_LABEL`; only the colour family is chosen here.
 */
const STATUS_BADGE: Readonly<Record<OrderStatus, BadgeTone>> = {
  draft: 'quiet',
  submitted: 'wait',
  awaiting_payment: 'wait',
  paid: 'ok',
  fulfilled: 'ok',
  lapsed: 'quiet',
  cancelled: 'quiet',
  refunded: 'quiet',
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
  // ── EACH SIDE READ KEEPS ITS OWN ERROR (row 16) ───────────────────────────
  // `?? []` turned a refused read into an empty one: a refused `users` read
  // made every buyer "Unknown" and silently dropped the "ours" badge — our own
  // test purchases then read as real revenue — and a refused `payments` read
  // made the Received total fall back to the CHARGED amount. Each now says it
  // could not read, in the column it feeds.
  let buyersFailed = false;
  let paidFailed = false;
  let receiptsFailed = false;
  if (orders) {
    const orderIds = orders.map((o) => o.order_id);
    const userIds = Array.from(new Set(orders.map((o) => o.user_id)));

    const [
      { data: buyers, error: buyersError },
      { data: paid, error: paidError },
      { data: receipts, error: receiptsError },
    ] = await Promise.all([
      admin.from('users').select('user_id,display_name,email,is_internal').in('user_id', userIds),
      admin.from('payments').select('order_id,amount_php,status').in('order_id', orderIds),
      admin.from('receipts').select('receipt_id,order_id').in('order_id', orderIds),
    ]);

    if (buyersError) logQueryError('AdminTransactionsLedger.buyers', buyersError, {}, 'graceful_degrade');
    if (paidError) logQueryError('AdminTransactionsLedger.payments', paidError, {}, 'graceful_degrade');
    if (receiptsError) logQueryError('AdminTransactionsLedger.receipts', receiptsError, {}, 'graceful_degrade');
    buyersFailed = Boolean(buyersError) || buyers == null;
    paidFailed = Boolean(paidError) || paid == null;
    receiptsFailed = Boolean(receiptsError) || receipts == null;

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

  // A refused payments read is NOT "received = what was charged".
  const received = rows && !paidFailed
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

  const buyerWords = (r: Row): string =>
    r.buyerName ?? r.buyerEmail ?? (buyersFailed ? 'Couldn’t read buyer' : 'Unknown buyer');
  const buyerChip = (r: Row) =>
    buyersFailed ? (
      // Unread is not "not ours": without the buyer we cannot tell a test purchase from real revenue, so say that.
      <Badge tone="wait">ours? unknown</Badge>
    ) : r.buyerInternal ? (
      // 🪤 Our own test purchases look exactly like real revenue in a total. Say so on the row rather than
      // filtering them out, so the ledger stays complete and still honest.
      <Badge tone="quiet">ours</Badge>
    ) : null;
  const statusChip = (r: Row) => (
    // The English word, from the shared map — never the stored value.
    <Badge tone={STATUS_BADGE[r.status] ?? 'quiet'}>{ORDER_STATUS_LABEL[r.status] ?? r.status}</Badge>
  );

  // 📐 THE DESIGN TEMPLATE (owner-approved 2026-11-14, "Admin · Money, everything"). The page is named in the
  // layout's pinned row ("Money · Everything ▾"); the paragraph and the card of queue chips go — each queue is
  // already a ▾ view with its count. The three numbers sit between hairlines, not in cards. On a phone each
  // purchase is ONE row (who · what · when · amount + chip) and a tap opens the rest; on a computer the table
  // stays a table, inside the one 760 column.
  return (
    <section className="mx-auto w-full max-w-[760px] px-4 pt-2 sm:px-6">
      {/* One honest line in place of the queue card: what needs you, or that it could not be checked. */}
      <p className={`py-1 ${TEMPLATE_SUBLINE}`} data-money-waiting="">
        {anyUnmeasured
          ? 'Some money queues couldn’t be checked just now — not the same as none'
          : waitingTotal === 0
            ? 'Nothing is waiting for you'
            : `${formatCount(waitingTotal)} ${waitingTotal === 1 ? 'thing needs' : 'things need'} you`}
      </p>

      <TemplateNums
        items={[
          { label: 'Received', value: (received == null ? null : formatPhp(received)) ?? '—' },
          { label: 'Waiting', value: (outstanding == null ? null : formatPhp(outstanding)) ?? '—' },
          { label: 'Purchases', value: rows ? formatCount(rows.length) : '—' },
        ]}
      />
      {paidFailed ? (
        <TemplateFail retryHref="/admin/money" data="payments">
          Couldn&rsquo;t read payments just now &mdash; Received is not shown rather than guessed.
        </TemplateFail>
      ) : null}

      <TemplateSection label="Every purchase · newest first" data="ledger">
        {/* PHONE — one row per purchase; the tap sheet holds reference, email and receipt. */}
        <div className="sm:hidden">
          {orderError || !rows ? (
            <TemplateFail retryHref="/admin/money" data="ledger">
              Couldn&rsquo;t read the transaction ledger &mdash; not the same as no purchases.
            </TemplateFail>
          ) : rows.length === 0 ? (
            <TemplateEmpty data="ledger">Nobody has bought anything yet.</TemplateEmpty>
          ) : (
            <ul aria-label="Every transaction" className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
              {rows.map((r) => (
                <LedgerPhoneRow
                  key={r.order_id}
                  title={
                    <>
                      {buyerWords(r)} {buyerChip(r)}
                    </>
                  }
                  line={`${r.description} · ${manilaDay(r.created_at)}`}
                  amount={formatPhp(r.chargedPhp)}
                  chip={statusChip(r)}
                  receiptHref={r.receiptId ? `/receipts/${r.receiptId}` : null}
                  facts={[
                    { label: 'What they bought', value: r.description },
                    { label: 'When', value: manilaDay(r.created_at) },
                    { label: 'Reference', value: LEDGER_REFERENCE_COLUMN.cell(r) },
                    { label: 'Email', value: r.buyerEmail ?? (buyersFailed ? 'Couldn’t read' : '—') },
                    { label: 'Where it stands', value: statusChip(r) },
                    ...(r.receiptId
                      ? []
                      : [{ label: 'Receipt', value: receiptsFailed ? 'Couldn’t read' : 'None yet' }]),
                  ]}
                />
              ))}
            </ul>
          )}
        </div>

        {/* COMPUTER — the table stays a table, never wider than the column. */}
        <div className="hidden sm:block">
          <ConsoleTable
            rows={rows}
            readPermitted
            readError={orderError}
            reads="the transaction ledger"
            cap={ROW_LIMIT}
            label="Every transaction"
            minWidth="44rem"
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
                cell: (r) => <span className="whitespace-nowrap tabular-nums">{manilaDay(r.created_at)}</span>,
              },
              LEDGER_REFERENCE_COLUMN,
              {
                header: 'Who',
                cell: (r) => (
                  <>
                    <span className="flex items-center gap-1.5 text-sm text-ink">
                      {buyerWords(r)}
                      {buyerChip(r)}
                    </span>
                    {r.buyerName && r.buyerEmail ? (
                      <span className={`block ${TEMPLATE_SUBLINE}`}>{r.buyerEmail}</span>
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
                align: 'right',
                cell: (r) => <span className={`whitespace-nowrap ${TEMPLATE_MONEY}`}>{formatPhp(r.chargedPhp)}</span>,
              },
              {
                header: 'Where it stands',
                cell: (r) => statusChip(r),
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
                      className="inline-flex min-h-11 items-center gap-1 text-sm text-link hover:underline"
                    >
                      <ReceiptText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      View
                    </Link>
                  ) : receiptsFailed ? (
                    <span className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
                      Couldn&rsquo;t read
                    </span>
                  ) : (
                    <span className={TEMPLATE_SUBLINE}>—</span>
                  ),
              },
            ]}
          />
        </div>

        <TemplateRows label="More">
          <TemplateRow href="/admin/receipts" title="Receipts for the tax file" data="receipts" />
        </TemplateRows>
      </TemplateSection>
    </section>
  );
}
