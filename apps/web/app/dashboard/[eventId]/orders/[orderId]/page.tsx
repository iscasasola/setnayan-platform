import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, Trash2, Send } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
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
  formatReceiptNumber,
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

  // Pre-resolve screenshot display URLs for every payment row. Legacy http(s)
  // values pass through; r2:// refs get a 24h presigned GET. We do this on
  // the server so the existing "Screenshot" link below the payment row works
  // for both old and new uploads without exposing R2 internals to the client.
  const paymentScreenshotMap: Record<string, string> = {};
  await Promise.all(
    payments.map(async (p) => {
      if (!p.screenshot_url) return;
      const url = await displayUrlForStoredAsset(p.screenshot_url);
      if (url) paymentScreenshotMap[p.payment_id] = url;
    }),
  );

  const flash =
    search.created === '1'
      ? 'Order created. Pay the amount below and log the payment so we can match it.'
      : search.paid_logged === '1'
        ? 'Payment logged. The Setnayan team will reconcile within one business day.'
        : null;

  // Day 3 of the voucher + inline-checkout sprint (CLAUDE.md 2026-05-29 Day 3
  // row · sprint brief at VOUCHER_SPRINT_BRIEF.md): when the Setnayan team
  // picks "Request resubmit" instead of Approve/Reject, the most recent
  // payment lands at status='resubmit_requested' + carries admin_resubmit_notice.
  // We surface that notice in an amber banner at the top of the page so the
  // couple sees it the moment they open the order, then re-open the upload
  // form below (which is already gated by `canLogPayment` and stays open
  // because the order status doesn't change · only the payment status does).
  //
  // Payments are ordered DESC by created_at in fetchPaymentsForOrder (see
  // lib/orders.ts:124) so payments[0] is the most recent. We only surface
  // the banner if that most-recent payment is the one waiting for a fix.
  const latestPayment = payments[0] ?? null;
  const resubmitRequested =
    latestPayment?.status === 'resubmit_requested'
      ? {
          notice: latestPayment.admin_resubmit_notice ?? null,
          reviewedAt: latestPayment.reviewed_at ?? null,
        }
      : null;

  const canCancel = order.status === 'submitted' || order.status === 'awaiting_payment';
  // canLogPayment already returns true for status='submitted' so the upload
  // form stays open when admin requests a resubmit (order status doesn't
  // change — only the payment row's status does). This is the "re-open the
  // upload form" requirement in the Day 3 brief: no new logic needed because
  // the existing gate already covers the case.
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
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
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

      {/*
        Resubmit banner (Day 3 voucher sprint, 2026-05-29). Surfaces verbatim
        the admin's note about what needs fixing on the next upload — wrong
        amount, blurry screenshot, missing reference code, etc. The upload
        form below stays open automatically because the order's status
        doesn't change when admin picks "Request resubmit" — only the
        payment row's status flips. Brand-voice copy per
        feedback_setnayan_no_dev_text_post_launch: warm, actionable, no
        engineering jargon.
      */}
      {resubmitRequested ? (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-warn-300/60 bg-warn-50 p-5 text-warn-900"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-warn-900/70">
            Please upload your payment again
          </p>
          <p className="text-sm">
            We reviewed your earlier upload and need a fresh one before we can match the payment.
            Here&rsquo;s what the Setnayan team flagged:
          </p>
          {resubmitRequested.notice ? (
            <p className="whitespace-pre-wrap rounded-md bg-white/70 p-3 text-sm text-warn-900">
              {resubmitRequested.notice}
            </p>
          ) : null}
          <p className="text-xs text-warn-900/85">
            Use the &ldquo;Log a payment&rdquo; form below to send a corrected screenshot or
            reference number &mdash; you don&rsquo;t need to create a new order.
          </p>
          {resubmitRequested.reviewedAt ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-warn-900/60">
              Requested {resubmitRequested.reviewedAt.slice(0, 10)}
            </p>
          ) : null}
        </div>
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
          <Stat label="Pre-VAT base" value={formatPhp(totals.base)} />
          <Stat
            label={`+ VAT (${totals.vatRatePct}%)`}
            value={formatPhp(totals.vat)}
            tone="muted"
          />
          <Stat label="Total to pay" value={formatPhp(totals.gross)} tone="good" />
          <Stat
            label="Remaining"
            value={formatPhp(totals.remaining)}
            tone={totals.remaining > 0 ? 'warn' : 'good'}
          />
        </dl>
        <p className="text-xs text-ink/55">
          {order.confirmed_total_php != null ? 'Confirmed' : 'Requested'} base ={' '}
          <span className="font-mono">{formatPhp(totals.base)}</span>. PH VAT (
          {totals.vatRatePct}%) is added on top &mdash; what you actually pay is{' '}
          <span className="font-mono font-semibold">{formatPhp(totals.gross)}</span>.
          {totals.matched > 0
            ? ` So far we've matched ${formatPhp(totals.matched)} of that.`
            : ''}
        </p>

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
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-danger-700 disabled:opacity-60"
              pendingLabel="Cancelling…"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cancel order
            </SubmitButton>
          </form>
        ) : null}
      </header>

      {receipt ? (
        <section className="space-y-2 rounded-2xl border border-success-300/60 bg-success-50/60 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success-900">
            Transaction receipt issued
          </p>
          <p className="text-base font-semibold text-success-900">
            {formatReceiptNumber(receipt.or_serial, receipt.issued_at)}
          </p>
          <p className="text-sm text-success-900/85">
            App-issued transaction receipt &mdash; generated when payment was matched.
            Not a BIR Official Receipt; the BIR OR (where applicable) is issued by
            Setnayan separately. Open the transaction receipt below to print or save
            as PDF for your records.
          </p>
          <Link
            href={`/receipts/${receipt.receipt_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-success-700 px-4 py-2 text-sm font-medium text-cream hover:bg-success-800"
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
              : ' (details emailed once your order is confirmed).'}{' '}
            <CopyButton value={String(totals.headlineTotal)} label="Copy amount" />
          </li>
          <li>
            Include the reference code{' '}
            <span className="font-mono text-terracotta-700">{order.reference_code}</span> in
            the transfer notes so we can match your payment automatically.{' '}
            <CopyButton value={order.reference_code} label="Copy code" />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-sm text-ink">
                      {settings.bdo_account_number}
                    </p>
                    <CopyButton value={settings.bdo_account_number} label="Copy" />
                  </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-sm text-ink">
                      {settings.gcash_number}
                    </p>
                    <CopyButton value={settings.gcash_number} label="Copy" />
                  </div>
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
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="order_id" value={orderId} />
            {/* Task 8 pilot hardening (2026-06-01): per-render idempotency
                key. If the customer double-clicks Submit or retries after a
                503, both submits ship the same UUID and the partial unique
                index on payments(order_id, client_idempotency_key) makes
                the second insert a no-op. */}
            <input
              type="hidden"
              name="client_idempotency_key"
              value={crypto.randomUUID()}
            />
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
            <div className="sm:col-span-2">
              <FileUpload
                bucket="media"
                pathPrefix={`payments/${orderId}`}
                name="screenshot_ref"
                label="Screenshot"
                help="Optional. PNG / JPEG / WebP / HEIC up to 5 MB. The Setnayan team uses this to match your payment."
                maxSizeMB={5}
                acceptedTypes={[
                  'image/png',
                  'image/jpeg',
                  'image/webp',
                  'image/gif',
                  'image/heic',
                  'image/heif',
                ]}
                variant="wide"
              />
            </div>
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
                  {p.screenshot_url && paymentScreenshotMap[p.payment_id] ? (
                    <a
                      href={paymentScreenshotMap[p.payment_id]}
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
              ? 'text-success-700'
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
