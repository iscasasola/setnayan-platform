import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, Trash2, Send } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  computeOrderTotals,
  fetchOrderById,
  fetchPaymentsForOrder,
  formatPhp,
} from '@/lib/orders';
import {
  fetchReceiptByOrderId,
  formatOrNumber,
} from '@/lib/receipts';
import {
  fetchPlatformSettings,
  hasMerchantPaymentInfo,
} from '@/lib/platform-settings';
import { cancelOrder, logPayment } from '../actions';

export const metadata = { title: 'Order detail' };

type Props = {
  params: Promise<{ eventId: string; orderId: string }>;
  searchParams: Promise<{
    created?: string;
    paid_logged?: string;
    error?: string;
  }>;
};

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { eventId, orderId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const order = await fetchOrderById(supabase, orderId);
  if (!order || order.event_id !== eventId) notFound();
  const [payments, receipt, settings] = await Promise.all([
    fetchPaymentsForOrder(supabase, orderId),
    fetchReceiptByOrderId(supabase, orderId),
    fetchPlatformSettings(supabase),
  ]);
  const totals = computeOrderTotals(order, payments);

  const flash =
    search.created === '1'
      ? 'Order created. Pay the amount below and log the payment so we can match it.'
      : search.paid_logged === '1'
        ? 'Payment logged. The Setnayan team will reconcile within one business day.'
        : null;

  const canCancel = order.status === 'submitted' || order.status === 'awaiting_payment';
  const canLogPayment =
    order.status === 'awaiting_payment' || order.status === 'submitted' || order.status === 'paid';

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/orders`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to orders
      </Link>

      {flash ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flash}
        </p>
      ) : null}
      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}

      <header className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Order {order.public_id}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Reference{' '}
              <span className="font-mono text-terracotta-700">{order.reference_code}</span>
            </h1>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              ORDER_STATUS_TONE[order.status]
            }`}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-ink/75">{order.description}</p>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Requested" value={formatPhp(order.requested_total_php)} />
          <Stat
            label="Confirmed"
            value={order.confirmed_total_php != null ? formatPhp(order.confirmed_total_php) : '—'}
            tone={order.confirmed_total_php != null ? 'good' : 'muted'}
          />
          <Stat label="Matched" value={formatPhp(totals.matched)} tone="good" />
          <Stat
            label="Remaining"
            value={formatPhp(totals.remaining)}
            tone={totals.remaining > 0 ? 'warn' : 'good'}
          />
        </dl>

        {order.admin_notes ? (
          <p className="rounded-md bg-ink/[0.04] p-3 text-sm text-ink/75">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Note from Setnayan
            </span>
            <br />
            {order.admin_notes}
          </p>
        ) : null}

        {canCancel ? (
          <form action={cancelOrder}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="order_id" value={orderId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cancel order
            </button>
          </form>
        ) : null}
      </header>

      {receipt ? (
        <section className="space-y-2 rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-900">
            Official Receipt issued
          </p>
          <p className="text-base font-semibold text-emerald-900">
            {formatOrNumber(receipt.or_serial, receipt.issued_at)}
          </p>
          <p className="text-sm text-emerald-900/85">
            BIR-compliant OR generated when payment was matched. Open the receipt to
            print or save as PDF.
          </p>
          <Link
            href={`/receipts/${receipt.receipt_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-cream hover:bg-emerald-800"
          >
            <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Open receipt
          </Link>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Payment instructions
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/75">
          <li>
            Send <span className="font-mono">{formatPhp(totals.headlineTotal)}</span> via BDO
            or GCash to the merchant account
            {hasMerchantPaymentInfo(settings)
              ? ' below.'
              : ' (details emailed once your order is confirmed).'}
          </li>
          <li>
            Include the reference code{' '}
            <span className="font-mono text-terracotta-700">{order.reference_code}</span> in
            the transfer notes so we can match your payment automatically.
          </li>
          <li>Take a screenshot of the receipt and log it below.</li>
        </ul>

        {hasMerchantPaymentInfo(settings) ? (
          <div className="grid gap-3 border-t border-ink/10 pt-3 sm:grid-cols-2">
            {settings.bdo_account_number || settings.bdo_qr_url ? (
              <div className="space-y-2 rounded-md bg-ink/[0.03] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                  BDO bank transfer
                </p>
                {settings.bdo_account_name ? (
                  <p className="text-sm font-medium text-ink">
                    {settings.bdo_account_name}
                  </p>
                ) : null}
                {settings.bdo_account_number ? (
                  <p className="break-all font-mono text-sm text-ink">
                    {settings.bdo_account_number}
                  </p>
                ) : null}
                {settings.bdo_qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.bdo_qr_url}
                    alt="BDO merchant QR"
                    className="mt-2 h-40 w-40 rounded-md border border-ink/10 bg-cream object-contain"
                  />
                ) : null}
              </div>
            ) : null}

            {settings.gcash_number || settings.gcash_qr_url ? (
              <div className="space-y-2 rounded-md bg-ink/[0.03] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                  GCash
                </p>
                {settings.gcash_account_name ? (
                  <p className="text-sm font-medium text-ink">
                    {settings.gcash_account_name}
                  </p>
                ) : null}
                {settings.gcash_number ? (
                  <p className="break-all font-mono text-sm text-ink">
                    {settings.gcash_number}
                  </p>
                ) : null}
                {settings.gcash_qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.gcash_qr_url}
                    alt="GCash QR"
                    className="mt-2 h-40 w-40 rounded-md border border-ink/10 bg-cream object-contain"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {canLogPayment ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Log a payment
          </h2>
          <form
            action={logPayment}
            encType="multipart/form-data"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="order_id" value={orderId} />
            <label className="space-y-1">
              <span className="block text-xs font-medium text-ink">Amount (PHP)</span>
              <input
                name="amount_php"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="0"
                className="input-field"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-ink">Channel</span>
              <input
                name="channel"
                required
                placeholder="BDO, GCash, Cash, etc."
                className="input-field"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-ink">Reference number</span>
              <input
                name="reference_number"
                placeholder="From the bank confirmation"
                className="input-field"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-ink">Paid on</span>
              <input
                name="paid_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="input-field"
              />
            </label>
            <label className="sm:col-span-2 space-y-1">
              <span className="block text-xs font-medium text-ink">Screenshot</span>
              <input
                name="screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
                className="block w-full cursor-pointer rounded-md border border-ink/15 bg-cream p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-terracotta/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-terracotta-700 hover:file:bg-terracotta/15"
              />
              <span className="block text-xs text-ink/55">
                Optional. PNG / JPEG / HEIC up to 6 MB. The Setnayan team
                uses this to match your payment.
              </span>
            </label>
            <div className="sm:col-span-2">
              <SubmitButton
                className="button-primary inline-flex items-center gap-2"
                pendingLabel="Logging…"
              >
                <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Log payment
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Payment log
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 bg-cream p-4 text-center text-xs text-ink/55">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.payment_id}
                className="flex flex-col gap-1 rounded-md bg-ink/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-mono font-semibold">{formatPhp(p.amount_php)}</span>
                    <span className="ml-2 text-ink/65">
                      · {p.channel}
                      {p.reference_number ? ` · ref ${p.reference_number}` : ''}
                    </span>
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Paid {p.paid_at}
                    {p.reviewed_at ? ` · reviewed ${p.reviewed_at.slice(0, 10)}` : ''}
                  </p>
                  {p.admin_notes ? (
                    <p className="text-xs text-ink/65">{p.admin_notes}</p>
                  ) : null}
                  {p.screenshot_url ? (
                    <a
                      href={p.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                    >
                      Screenshot
                      <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    </a>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    PAYMENT_STATUS_TONE[p.status]
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'good' | 'muted';
}) {
  return (
    <div className="rounded-md bg-ink/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm font-semibold ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-emerald-700'
              : tone === 'muted'
                ? 'text-ink/55'
                : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
