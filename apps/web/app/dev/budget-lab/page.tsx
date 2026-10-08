/**
 * /dev/budget-lab — the Budget page's own components on the approved
 * prototype's figures (`prototypes/budget_page_2026-10-08_fable.html`): no
 * sign-in, no database, nothing written. DEV-ONLY: production builds 404 this
 * route, the same kill-switch as `/dev/home-lab` and `/dev/guests-lab`.
 *
 * It draws the REAL `BudgetSummary` over a ledger computed by the REAL
 * `computeEventMoney` (`fixture.ts`), so what it shows is what the page shows.
 *
 *   ?state=summary   the summary rows (default)
 *   ?state=failed    "Bought on Setnayan" could not be read — the figures are unknown, never ₱0
 *   ?state=view      a delegate who may read but not set the target
 *   ?state=over      agreed runs past the target (the meter's red tail)
 *   ?state=empty     a new event: no target, nothing agreed
 */
import { notFound } from 'next/navigation';
import { BudgetSummary } from '@/app/dashboard/[eventId]/budget/_components/budget-summary';
import { knownMoneyTotals, unreadEventMoney, computeEventMoney } from '@/lib/budget-truth';
import { pickNextPayment } from '@/lib/budget-page-view';
import { labMoney, LAB_NOW } from './fixture';

export const dynamic = 'force-dynamic';

const E = '00000000-0000-4000-8000-000000000000';

export default async function BudgetLabPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const state = (await searchParams).state ?? 'summary';

  const money =
    state === 'failed'
      ? labMoney({ suppliers: 'ok', orders: 'failed', costs: 'ok' })
      : state === 'empty'
        ? computeEventMoney({
            targetCentavos: null,
            vendors: [],
            lineItems: [],
            payments: [],
            orders: [],
            costs: [],
            pricing: new Map(),
            packageLockedCentavos: new Map(),
            benchmarks: [],
            now: LAB_NOW,
          })
        : state === 'unread'
          ? unreadEventMoney()
          : labMoney();
  const known = knownMoneyTotals(money);
  // `?state=over` lowers the target under what is agreed; nothing else changes.
  const targetPhp = state === 'over' ? 1_000_000 : money.targetPhp;

  return (
    <main className="sn-col" style={{ maxWidth: 720, margin: '0 auto', padding: '8px 16px 96px' }} data-budget-lab={state}>
      <BudgetSummary
        eventId={E}
        canEdit={state !== 'view'}
        targetPhp={targetPhp}
        agreedPhp={known.agreedPhp}
        paidPhp={known.paidPhp}
        owedPhp={known.partial ? null : known.owedAtLeastPhp}
        next={known.partial ? null : pickNextPayment(money.lines)}
        payHref="#budget-payments"
      />
    </main>
  );
}
