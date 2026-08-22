import Link from 'next/link';
import { payPath } from '@/lib/pay-path';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
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
  fetchPlatformSettings,
  hasMerchantPaymentInfo,
} from '@/lib/platform-settings';
import { bookingFeeErrorCopy,
  isVendorBookingFeeServiceKey,
  isFeeOrderPayable,
  VENDOR_BOOKING_FEES_PATH,
} from '@/lib/vendor-booking-fees';

export const metadata = { title: 'Booking fee · Vendor' };

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ logged?: string; error?: string }>;
};

/**
 * /vendor-dashboard/booking-fees/[orderId] — the vendor pay page for one
 * booking-fee order. Same manual GCash/BDO QR flow couples use (reference +
 * amount + merchant QR + 24-hr verification), rebuilt on the vendor doorway so
 * it's reachable without couple-dashboard access. READ-ONLY on the fee; the only
 * write is logging a payment (proof), which the DB write-guard pins to
 * status='pending' — the vendor can never self-approve.
 */
export default async function VendorBookingFeeDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/vendor-dashboard/booking-fees/${orderId}`));
  const supabase = await createClient();

  // RLS scopes this to the caller's own orders; we additionally require it to be
  // (a) owned by this user and (b) a booking-fee order, so this page can only
  // ever render one of the VENDOR's OWN fee orders — never another vendor's,
  // never a non-fee order.
  const order = await fetchOrderById(supabase, orderId);
  if (
    !order ||
    order.user_id !== user.id ||
    !isVendorBookingFeeServiceKey(order.service_key)
  ) {
    notFound();
  }

  const [payments, settings] = await Promise.all([
    fetchPaymentsForOrder(supabase, orderId),
    fetchPlatformSettings(supabase),
  ]);
  // Fee orders are `vendor_`-prefixed → VAT-INCLUSIVE: the stored total IS the
  // gross the vendor pays. Pass vatRatePct=0 so no VAT line is added on top.
  const totals = computeOrderTotals(order, payments, 0);
  const payable = isFeeOrderPayable(order.status);

  const paymentScreenshotMap: Record<string, string> = {};
  await Promise.all(
    payments.map(async (p) => {
      if (!p.screenshot_url) return;
      const url = await displayUrlForStoredAsset(p.screenshot_url);
      if (url) paymentScreenshotMap[p.payment_id] = url;
    }),
  );

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={VENDOR_BOOKING_FEES_PATH}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to booking fees
      </Link>

      {search.logged === '1' ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Payment logged. Our team reconciles within 24 hours and your fee moves
          to paid — no action needed on your end.
        </p>
      ) : null}
      {/* 🚨 WAS `decodeURIComponent(search.error)` RENDERED DIRECTLY. Harmless
          only because nothing ever wrote the parameter — a dead reader. Now that
          it HAS a writer, a fixed code lookup is the difference between showing
          our own sentence and showing whatever a stranger put in a link, inside
          our red warning styling, on the screen where a vendor sends us money.
          An unknown code renders nothing at all. */}
      {bookingFeeErrorCopy(search.error) ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {bookingFeeErrorCopy(search.error)}
        </p>
      ) : null}

      <PageMasthead
        titleNode={
          <>
            Reference{' '}
            <span className="font-mono text-terracotta-700">{order.reference_code}</span>
          </>
        }
        actions={
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              ORDER_STATUS_TONE[order.status]
            }`}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        }
      />

      <section className="sn-tile space-y-3 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
          Order <span className="normal-case">{order.public_id}</span>
        </p>
        <p className="whitespace-pre-wrap text-sm text-ink/75">{order.description}</p>
        <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            Amount to send
          </p>
          <p className="font-mono text-2xl font-semibold text-ink">
            {formatPhp(totals.headlineTotal)}
          </p>
        </div>
        {payable ? (
          <p className="text-xs text-ink/55">
            Up for verification — once you pay and we confirm it (within 24 hours),
            this fee moves to paid automatically.
          </p>
        ) : null}
        {order.admin_notes ? (
          <p className="rounded-md bg-ink/[0.04] p-3 text-sm text-ink/75">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Note from Setnayan
            </span>
            <br />
            {order.admin_notes}
          </p>
        ) : null}
      </section>

      {payable ? (
        <section className="sn-tile space-y-4 p-5">
          <h2 className="sn-eye">Payment instructions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
                  Amount to send
                </p>
                <p className="font-mono text-lg font-semibold text-ink">
                  {formatPhp(totals.headlineTotal)}
                </p>
              </div>
              <CopyButton value={String(totals.headlineTotal)} label="Copy" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-700">
                  Reference code
                </p>
                <p className="truncate font-mono text-lg font-semibold text-ink">
                  {order.reference_code}
                </p>
              </div>
              <CopyButton value={order.reference_code} label="Copy" />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-ink/60">
            Send the amount via BDO or GCash
            {hasMerchantPaymentInfo(settings)
              ? ' to the account below'
              : ' (details emailed with your reference)'}
            , include the{' '}
            <span className="font-semibold text-ink">reference code</span> in the
            transfer note so we can match it, then log it below.
          </p>

          {hasMerchantPaymentInfo(settings) ? (
            <div className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
              {settings.bdo_account_number || settings.bdo_qr_url ? (
                <div className="sn-row space-y-2 p-4">
                  <p className="sn-eye">BDO bank transfer</p>
                  {settings.bdo_account_name ? (
                    <p className="text-sm font-medium text-ink">{settings.bdo_account_name}</p>
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
                    <div className="mt-1 w-fit rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.bdo_qr_url}
                        alt="BDO merchant QR"
                        className="h-40 w-40 rounded-lg object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {settings.gcash_number || settings.gcash_qr_url ? (
                <div className="sn-row space-y-2 p-4">
                  <p className="sn-eye">GCash</p>
                  {settings.gcash_account_name ? (
                    <p className="text-sm font-medium text-ink">{settings.gcash_account_name}</p>
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
                    <div className="mt-1 w-fit rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.gcash_qr_url}
                        alt="GCash QR"
                        className="h-40 w-40 rounded-lg object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── SENDING THE MONEY LIVES ON THE ONE PAYMENT PAGE (owner 2026-08-21) ──
          What sat here asked the shop to type the amount and pick a rail with
          no code to scan. /pay puts the exact figure inside the QR.
          ⚖ The owner's 2026-08-06 rule — a reference is REQUIRED on this lane,
          because an admin reconciles this against a bank message rather than
          guessing — travels with it: `requiresReference` makes the field
          mandatory there and nowhere else. */}
      {payable ? (
        <section className="sn-tile space-y-3 p-5">
          <h2 className="sn-eye">Paying this fee</h2>
          <p className="text-sm text-ink/70">
            The code on the payment page already has the amount in it. Have your GCash or BDO
            confirmation to hand — we need its reference number to match your payment.
          </p>
          <Link
            href={payPath(order.reference_code)}
            className="button-primary inline-flex items-center gap-2"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Send your payment
          </Link>
        </section>
      ) : null}

      <section className="sn-tile space-y-3 p-5">
        <h2 className="sn-eye">Payment log</h2>
        {payments.length === 0 ? (
          <p className="sn-row border-dashed p-4 text-center text-xs text-ink/55">
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
                  {p.screenshot_url && paymentScreenshotMap[p.payment_id] ? (
                    <a
                      href={paymentScreenshotMap[p.payment_id]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                    >
                      Screenshot
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
