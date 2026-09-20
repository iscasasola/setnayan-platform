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
  FEE_ORDERS_UNREADABLE,
} from '@/lib/vendor-booking-fees.server';
import {
  feeOrderTotalPhp,
  sumFeeOrderTotalsPhp,
  vendorBookingFeePayPath,
} from '@/lib/vendor-booking-fees';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchWaivedFeeCharges,
  FEE_BILLS_UNREADABLE,
} from '@/lib/booking-fee-disclosure.server';
import type { WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { WaivedFeeRows } from '@/app/_components/booking-fee-notice';

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

  const read = await fetchVendorFeeOrders(supabase, user.id);
  const unreadable = read === FEE_ORDERS_UNREADABLE;
  const orders = unreadable ? [] : read;
  const { due, settled, closed } = bucketFeeOrders(orders);

  // THE FREE BOOKINGS BELONG ON THE FEE LIST TOO (owner 2026-09-20). A waived
  // charge mints no `orders` row, so until now this page — the one place a
  // supplier goes to read their fees — showed nothing at all for the first five
  // and then a bill for the sixth. Unreadable renders nothing, never an implied
  // "you have had no free bookings".
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  const waivedRead = await fetchWaivedFeeCharges(
    createAdminClient(),
    profile?.vendor_profile_id,
  ).catch(() => FEE_BILLS_UNREADABLE);
  const waived: WaivedFeeCharge[] = waivedRead === FEE_BILLS_UNREADABLE ? [] : waivedRead;

  // `null` when ANY due order's total could not be read — the banner then names
  // the count and says the amount is unreadable, instead of printing a sum that
  // silently counted the unreadable one as ₱0.
  const totalDue = sumFeeOrderTotalsPhp(due);

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
          </span>
          {totalDue === null ? (
            <>
              {' '}
              — we couldn&rsquo;t load the total. Open each one below for the exact
              amount.
            </>
          ) : (
            <>
              {' '}
              totalling{' '}
              <span className="font-mono font-semibold">{formatPhp(totalDue)}</span>.
            </>
          )}
        </div>
      ) : null}

      {unreadable ? (
        <div className="sn-tile mt-6 p-8 text-center sm:mt-8">
          <ReceiptText
            className="mx-auto h-8 w-8 text-ink/30"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium text-ink">
            We couldn&rsquo;t load your booking fees right now.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
            This is on our side, not a sign you owe nothing. Refresh in a moment.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="sn-tile mt-6 p-8 text-center sm:mt-8">
          <ReceiptText
            className="mx-auto h-8 w-8 text-ink/30"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium text-ink">Nothing to pay yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
            Your first 5 booked customers are free — each one still shows the fee
            it would have carried, so the 6th is no surprise.
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

      {/* THE FREE FIVE, PRICED. Outside the orders branch on purpose: a shop
          with no bill at all still has free bookings worth naming, and the
          "Nothing to pay yet" empty state above is about ORDERS, not about
          whether any fee has ever been computed for this shop. */}
      {waived.length > 0 ? (
        <section className="mt-8">
          <h2 className="sn-eye">Waived — your first 5</h2>
          <WaivedFeeRows charges={waived} />
        </section>
      ) : null}
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
          // `null` → `formatPhp` prints `—`. A fee whose amount we could not
          // read must never read ₱0 on the row a supplier taps to pay it.
          const amount = feeOrderTotalPhp(o);
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
