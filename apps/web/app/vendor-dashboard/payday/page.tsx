import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, Info, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { formatPhp } from '@/lib/vendors';
import {
  buildPaydayTimeline,
  manilaTodayIso,
  type PaydayInstallmentRow,
} from '@/lib/vendor-cashflow';
import { PaydaySummary } from './_components/payday-summary';
import { PaydayInstallmentRow as PaydayRow } from './_components/payday-installment-row';

export const metadata = { title: 'Payday · Vendor' };

/**
 * Payday Calendar & Cash-Flow View (Wave 4 vendor "Soon" benefit).
 *
 * A READ-ONLY, vendor-scoped timeline of every upcoming installment due-date
 * across ALL the vendor's booked events — assembled from the SECURITY DEFINER
 * `vendor_payday_installments()` RPC (which is itself ownership-gated:
 * vendor_profiles.user_id = auth.uid() → event_vendors.marketplace_vendor_id,
 * mirroring confirm_vendor_payment). Off-platform money: this visualizes the
 * installment plan the couple already locked in — it moves no money, charges
 * nothing, and never touches the couple's host-only payment-plan RLS.
 */
export default async function VendorPaydayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Ownership-gated read fn (auth.uid()-scoped internally). No args — the fn
  // resolves the caller's owned vendor + only their bookings' installments.
  const { data, error } = await supabase.rpc('vendor_payday_installments');
  const rows = (error ? [] : ((data ?? []) as unknown as PaydayInstallmentRow[]));

  const today = manilaTodayIso();
  const timeline = buildPaydayTimeline(rows, today);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <CalendarClock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Vendor dashboard · Payday calendar
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Payday</h1>
        <p className="max-w-prose text-base text-ink/65">
          Every installment your booked couples agreed to pay you, laid out by
          due date across all your events. It&rsquo;s a forward view of your
          cash flow — Setnayan never holds your money, so these are the dates to
          plan around, not a balance we owe you.
        </p>
      </header>

      <article className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 text-sm text-ink/75">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium text-ink">How Payday works</p>
          <p className="text-sm text-ink/70">
            When a couple locks you in, the payment plan they picked is frozen
            into installments. This page gathers those due-dates across all your
            bookings. An installment shows{' '}
            <span className="font-medium text-emerald-700">Received</span> once
            you&rsquo;ve confirmed the payment on the couple&rsquo;s workspace.
            Couples pay you directly, off-platform.
          </p>
        </div>
      </article>

      {error ? (
        <p className="rounded-2xl border border-ink/10 bg-white p-6 text-sm text-ink/65">
          We couldn&rsquo;t load your Payday timeline right now. Please try again
          shortly.
        </p>
      ) : timeline.totals.installmentCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
          <CalendarClock
            aria-hidden
            className="mx-auto h-8 w-8 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm font-medium text-ink">No installments yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
            Once a couple books you on a service with a payment schedule, their
            installment due-dates will appear here. See your{' '}
            <Link href="/vendor-dashboard/bookings" className="underline hover:text-ink">
              bookings
            </Link>{' '}
            to track confirmed events.
          </p>
        </div>
      ) : (
        <>
          <PaydaySummary totals={timeline.totals} />

          {timeline.totals.unresolvedCount > 0 ? (
            <p className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs text-ink/55">
              {timeline.totals.unresolvedCount} installment
              {timeline.totals.unresolvedCount === 1 ? '' : 's'} couldn&rsquo;t
              show an amount — these are percentage-based installments on a
              booking whose total wasn&rsquo;t set when it locked. They&rsquo;re
              listed below with a dash.
            </p>
          ) : null}

          {timeline.overdue.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/[0.03]">
              <header className="flex items-center justify-between gap-2 border-b border-rose-500/15 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Overdue · {timeline.overdue.length}
                </span>
                <span className="text-sm font-semibold tabular-nums text-rose-700">
                  {formatPhp(timeline.totals.overduePhp)}
                </span>
              </header>
              <ul className="divide-y divide-rose-500/10">
                {timeline.overdue.map((inst) => (
                  <PaydayRow key={inst.key} inst={inst} />
                ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-5">
            {timeline.months.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-ink/10 bg-white"
              >
                <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
                  <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
                  <span className="text-xs text-ink/55">
                    <span className="font-semibold text-ink/75 tabular-nums">
                      {formatPhp(group.expectedPhp)}
                    </span>{' '}
                    expected · {formatPhp(group.confirmedPhp)} received
                  </span>
                </header>
                <ul className="divide-y divide-ink/[0.06]">
                  {group.installments.map((inst) => (
                    <PaydayRow key={inst.key} inst={inst} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
