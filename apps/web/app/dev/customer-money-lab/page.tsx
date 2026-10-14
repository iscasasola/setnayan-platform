/**
 * /dev/customer-money-lab — the SUPPLIER'S half of the money loop (Suppliers
 * Pair 3, map P3) on fixture data, with no sign-in and no database. DEV-ONLY:
 * production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * The couple's half is `/dev/suppliers-lab?mode=booked&money=…` (press Bituin
 * Catering's Pay); this lab draws what Bituin's customer card shows for the
 * SAME booking at the SAME stage, with the real fold
 * (`clients/[eventId]/_components/customer-money-fold.tsx`) over the shared
 * fixture (`../suppliers-lab/money-pair.ts`):
 *
 *   ?s=due        nothing recorded yet
 *   ?s=waiting    the couple recorded the reservation — Confirm received ·
 *                 Not received, in place
 *   ?s=received   …confirmed: Received ✓ (their sheet says Paid ✓)
 *   ?s=refused    …said it never arrived: back to Due, nothing waiting on you
 *   ?s=noplan     a booking with no plan: the logged ledger instead
 *   ?s=unread     no plan and the ledger read failed — said, never "nothing"
 *
 * The answer forms post the REAL actions; pressing them here needs a
 * supplier's session (the lab draws, it does not confirm). Names are samples.
 */
import { notFound } from 'next/navigation';
import { CustomerMoneyFold } from '@/app/vendor-dashboard/clients/[eventId]/_components/customer-money-fold';
import { awaitsTheSupplier } from '@/lib/payment-refusal';
import type { BookingMoney } from '@/lib/vendor-cashflow';
import { bituinPending, bituinSteps, moneyStageOf } from '../suppliers-lab/money-pair';

const LAB_EVENT = '00000000-0000-4000-8000-000000000000';

const NO_LEDGER: BookingMoney = { rows: [], receivedPhp: 0, expectedPhp: 0 };
const LEDGER: BookingMoney = {
  rows: [
    {
      event_vendor_id: 'v-bituin',
      event_id: LAB_EVENT,
      event_name: 'Ana & Paolo',
      event_date: '2026-12-12',
      seq: 1,
      label: 'Payment',
      amount_php: 38_000,
      due_date: null,
      confirmed: true,
    },
  ],
  receivedPhp: 38_000,
  expectedPhp: 190_000,
};

export default async function CustomerMoneyLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const raw = typeof sp.s === 'string' ? sp.s : 'waiting';
  const noPlan = raw === 'noplan' || raw === 'unread';
  const stage = moneyStageOf(raw);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-6" data-lab-customer-money={raw}>
      <p className="text-xs uppercase tracking-[0.14em] text-ink/55">Customer</p>
      <h1 className="font-display text-[22px] font-medium leading-tight text-ink">Ana &amp; Paolo</h1>
      <p className="mb-5 mt-0.5 text-sm text-ink/55">Dec 12, 2026 · Quezon City · Catering</p>
      <CustomerMoneyFold
        eventId={LAB_EVENT}
        steps={noPlan ? null : bituinSteps(stage)}
        clearedAt={null}
        // The card's own filter: a payment the supplier refused is Setnayan's now.
        pending={noPlan ? [] : bituinPending(stage).filter(awaitsTheSupplier)}
        ledgerMoney={raw === 'noplan' ? LEDGER : NO_LEDGER}
        ledgerUnreadable={raw === 'unread'}
        threadId="t-bituin"
        unreadableNote={
          <p role="status" className="text-[14px] text-ink/70" data-lab-unreadable="">
            Some payments on this booking couldn’t load.
          </p>
        }
      />
    </main>
  );
}
