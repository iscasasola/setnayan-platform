import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ReceiptText, ArrowLeft } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  formatPhp,
  type OrderRow,
} from '@/lib/orders';
import {
  fetchVendorFeeOrders,
  bucketFeeOrders,
} from '@/lib/vendor-booking-fees.server';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

export const metadata = { title: 'Booking fees · Vendor' };

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * /vendor-dashboard/booking-fees — the vendor-facing list of their Setnayan
 * booking-fee orders (5% of a booked total, then 1% beyond ₱100,000, minimum ₱50,
 * past their free-5 — owner-ruled 2026-07-27; NOT a flat rate). Each row links to
 * the same manual-QR pay flow couples use, reachable from the Plan hub
 * doorway. READ-ONLY surfacing: this never mints or mutates a fee — it lists the
 * orders the fee-charge path already created (RLS scopes to the caller's own).
 *
 * Not flag-gated at the page level: a vendor with an outstanding fee must always
 * be able to reach + pay it (deep-link durability). The DOORWAY that advertises
 * this page + the notification sweep ARE flag-gated, so nothing new is surfaced
 * while the fee system is dark.
 */
export default async function VendorBookingFeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard/booking-fees'));
  const supabase = await createClient();

  const orders = await fetchVendorFeeOrders(supabase, user.id);
  const { due, settled, closed } = bucketFeeOrders(orders);

  const totalDue = due.reduce(
    (acc, o) => acc + Number(o.confirmed_total_php ?? o.requested_total_php ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/vendor-dashboard/subscription"
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Plan
      </Link>

      <PageMasthead
        title="Booking fees"
      />

      {due.length > 0 ? (
        <div className="mt-4 rounded-lg border border-warn-300/60 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          You have{' '}
          <span className="font-semibold">
            {due.length} unpaid {due.length === 1 ? 'fee' : 'fees'}
          </span>{' '}
          totalling <span className="font-mono font-semibold">{formatPhp(totalDue)}</span>.
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="sn-tile mt-6 p-8 text-center sm:mt-8">
          <ReceiptText
            className="mx-auto h-8 w-8 text-ink/30"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium text-ink">No booking fees yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
            Your first 5 booked customers are free. When a 6th booking locks in,
            its fee will show up here to pay.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8 sm:mt-8">
          {due.length > 0 ? (
            <FeeGroup title="Due" tone="warn" orders={due} />
          ) : null}
          {settled.length > 0 ? (
            <FeeGroup title="Paid" tone="good" orders={settled} />
          ) : null}
          {closed.length > 0 ? (
            <FeeGroup title="Closed" tone="muted" orders={closed} />
          ) : null}
        </div>
      )}
    </main>
  );
}

function FeeGroup({
  title,
  tone,
  orders,
}: {
  title: string;
  tone: 'warn' | 'good' | 'muted';
  orders: OrderRow[];
}) {
  return (
    <section className="space-y-3">
      <p
        className={
          'sn-eye ' +
          (tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-success-700'
              : 'text-ink/50')
        }
      >
        {title}
      </p>
      <ul className="space-y-2">
        {orders.map((o) => {
          const amount = Number(o.confirmed_total_php ?? o.requested_total_php ?? 0);
          return (
            <li key={o.order_id}>
              <Link
                href={vendorBookingFeePayPath(o.order_id)}
                className="sn-card sn-press flex items-center gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {formatPhp(amount)}
                    <span className="ml-2 font-mono text-[11px] font-normal text-terracotta-700">
                      {o.reference_code}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink/55">
                    {o.description || 'Setnayan booking fee'} · {fmtDate(o.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    ORDER_STATUS_TONE[o.status]
                  }`}
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-ink/40"
                  strokeWidth={2}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
