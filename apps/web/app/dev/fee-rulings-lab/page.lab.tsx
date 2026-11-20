/**
 * /dev/fee-rulings-lab — the 20 Nov booking-fee rulings on two screens that had no lab, on fixture data, with no
 * sign-in and no database. DEV-ONLY: production builds never compile `page.lab.tsx`, and app/dev/layout.lab.tsx
 * 404s it as a second lock.
 *
 *   ?screen=fees            /vendor-dashboard/booking-fees, nothing due — the empty state with the live fee line
 *   ?screen=fees&waived=1   …plus "Waived — nothing owed": Setnayan's every-Nth fee, a ticket, a place frozen free
 *   ?screen=fees&months=unread  …the new-client window's length could not be read: no window line, no months named
 *   ?screen=admin           Admin › Pricing › Supplier booking fee — the form with the lock and the every-Nth count
 *
 * The Plan row and the fee notice before Agree live in their own labs: /dev/supplier-plan-lab?s=plan (&unverified=1,
 * &ticket=1) and /dev/booking-ask-lab (&fee=unverified|ticket|platform|import).
 *
 * The markup around each shipped component is copied from its page so the picture is the page's; the components are
 * the shipped ones. Every number comes from `BOOKING_FEE` (the ruled schedule) — none is typed here. Names are samples.
 */
import { notFound } from 'next/navigation';
import { ReceiptText } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { WaivedFeeRows } from '@/app/_components/booking-fee-notice';
import { BookingFeeLine } from '@/app/_components/booking-fee-line';
import { InfoTip } from '@/app/_components/info-tip';
import { FEE_NEW_CLIENT_DETAIL, feeFreeRuleInApp, feeNewClientLine } from '@/lib/booking-fee-who-words';
import { BookingFeeForm } from '@/app/admin/pricing/_components/booking-fee-form';
import { saveBookingFeeSchedule } from '@/app/admin/pricing/price-control-actions';
import { BOOKING_FEE, bookingFeePhp } from '@/lib/booking-fee';
import type { WaivedFeeCharge } from '@/lib/booking-fee-disclosure';

/**
 * The live schedule as the settings read hands it over, with the new-client window's length. 12 is a SAMPLE of
 * `platform_settings.booking_fee_new_client_free_months` (its migration default) — dev lab only. `&months=unread`
 * draws the page when that read failed: no line, and the ⓘ falls back to the public words.
 */
const LAB_NEW_CLIENT_FREE_MONTHS = 12;

const WAIVED: WaivedFeeCharge[] = [
  {
    chargeId: 'lab-platform',
    reason: 'platform',
    eventId: null,
    coupleName: 'Rosa & Ben',
    computedPhp: bookingFeePhp(100_000, BOOKING_FEE),
    ordinal: 12,
    waivedOn: '2026-11-21',
    platformNumber: 100_000,
  },
  {
    chargeId: 'lab-frozen',
    reason: 'free5',
    eventId: null,
    coupleName: 'Ana & Paolo',
    computedPhp: bookingFeePhp(250_000, BOOKING_FEE),
    ordinal: 1,
    waivedOn: '2026-11-02',
  },
];

export default async function FeeRulingsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const screen = sp.screen === 'admin' ? 'admin' : 'fees';

  if (screen === 'admin') {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6" data-lab-fee-rulings="admin">
        <section>
          <h2 className="mb-1 text-base font-semibold tracking-tight">Supplier booking fee</h2>
          <p className="mb-3 max-w-prose text-sm text-ink/60">
            What a supplier pays Setnayan for an introduction that turns into a booking. Owner-set: the rate below the
            threshold, the threshold itself, and the rate above it. The minimum is fixed; the lock, the every-Nth free
            booking fee and the new-client free window are shown under the form.
          </p>
          <BookingFeeForm
            action={saveBookingFeeSchedule}
            ratePct={BOOKING_FEE.rate * 100}
            tailRatePct={BOOKING_FEE.tailRate * 100}
            tier1LimitPhp={BOOKING_FEE.tier1LimitPhp}
            capPhp={BOOKING_FEE.capPhp ?? null}
            freeEveryNth={100_000}
            newClientFreeMonths={LAB_NEW_CLIENT_FREE_MONTHS}
            minPhp={BOOKING_FEE.minPhp}
            isFromDb
            enabled
          />
        </section>
      </main>
    );
  }

  const waived = sp.waived === '1' ? WAIVED : [];
  const fee = sp.months === 'unread' ? BOOKING_FEE : { ...BOOKING_FEE, newClientFreeMonths: LAB_NEW_CLIENT_FREE_MONTHS };
  const newClientLine = feeNewClientLine(fee.newClientFreeMonths);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6" data-lab-fee-rulings="fees">
      <PageMasthead title="Booking fees" />
      {newClientLine ? (
        <p className="mt-3 text-sm text-ink/70" data-fees-new-client-window="">
          <InfoTip label={newClientLine} ariaLabel="About free bookings for new clients">
            {FEE_NEW_CLIENT_DETAIL}
          </InfoTip>
        </p>
      ) : null}
      <div className="sn-tile mt-6 p-8 text-center sm:mt-8">
        <ReceiptText className="mx-auto h-8 w-8 text-ink/30" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-sm font-medium text-ink">Nothing to pay yet.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
          <BookingFeeLine
            fee={fee}
            leadStyle={{ color: 'var(--sn-ink-700)' }}
            freeRule={feeFreeRuleInApp(fee.newClientFreeMonths)}
          />{' '}
          A free booking fee ticket pays your next fee by itself.
        </p>
      </div>
      {waived.length > 0 ? (
        <section className="mt-8">
          <h2 className="sn-eye">Waived — nothing owed</h2>
          <WaivedFeeRows charges={waived} />
        </section>
      ) : null}
    </div>
  );
}
