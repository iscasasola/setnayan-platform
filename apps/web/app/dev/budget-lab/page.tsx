/**
 * /dev/budget-lab — the Budget page's own components on the approved
 * prototype's figures (`prototypes/budget_page_2026-10-08_fable.html`): no
 * sign-in, no database, nothing written. DEV-ONLY: production builds 404 this
 * route, the same kill-switch as `/dev/home-lab` and `/dev/guests-lab`.
 *
 * It draws the REAL `BudgetScreen` over a ledger computed by the REAL
 * `computeEventMoney` (`fixture.ts`) and listed by the REAL `buildBudgetList`,
 * so what it shows is what the page shows. The sheets open by tapping, exactly
 * as on the page; their writes go to server actions that refuse without a
 * session, so nothing can be saved from here.
 *
 *   ?state=summary   the whole screen (default)
 *   ?state=failed    "Bought on Setnayan" could not be read — unknown, never ₱0 or empty
 *   ?state=unread    nothing could be read at all (also what the kill-switch draws)
 *   ?state=view      a delegate who may read but not write: no Target field, no verbs
 *   ?state=over      agreed runs past the target (the meter's red tail)
 *   ?state=empty     a new event: no target, nothing agreed, nothing added
 *   ?state=setnayan  the first supplier is ON Setnayan: Chat opens their thread,
 *                    Record a payment goes to Amount to pay
 *   ?state=traditions a Muslim + Chinese event: the Target's ⓘ carries both notes
 */
import { LabShell } from '@/app/dev/_components/lab-shell';
import { notFound } from 'next/navigation';
import { BudgetScreen, type SupplierExtras } from '@/app/dashboard/[eventId]/budget/_components/budget-screen';
import { knownMoneyTotals, unreadEventMoney, computeEventMoney } from '@/lib/budget-truth';
import { buildBudgetList, pickNextPayment } from '@/lib/budget-page-view';
import { bookedBudgetBlock } from '@/lib/booked-budget';
import { costCategoryOptions } from '@/lib/event-costs';
import { depositStepHref } from '@/lib/deposit-pay-step';
import { TraditionNotes } from '@/app/dashboard/[eventId]/budget/_components/tradition-notes';
import { labMoney, LAB_NOW, LAB_PAYMENTS } from './fixture';
import { LabPageSpotlight } from '@/app/dev/_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { HOST_PAGE_TOURS } from '@/lib/host-page-tours';

export const dynamic = 'force-dynamic';

const E = '00000000-0000-4000-8000-000000000000';

export default async function BudgetLabPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; shell?: string; spot?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const state = q.state ?? 'summary';

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
  const list = buildBudgetList(money);
  // `?state=over` lowers the target under what is agreed; nothing else changes.
  const targetPhp = state === 'over' ? 1_000_000 : money.targetPhp;
  // A refused source: Owed is the floor the page prints ("₱994,400+"), by the page's own rule.
  const owedFloor = known.partial ? bookedBudgetBlock(money, targetPhp).owed : null;

  const supplierExtras: Record<string, SupplierExtras> = {};
  for (const [i, row] of (list.suppliers ?? []).entries()) {
    const onSetnayan = state === 'setnayan' && i === 0;
    supplierExtras[row.vendorId] = {
      payments: LAB_PAYMENTS[row.vendorId] ?? [],
      door: onSetnayan ? 'amount_to_pay' : 'log',
      amountToPayHref: depositStepHref(E, row.vendorId),
      chat: onSetnayan ? { kind: 'thread' } : { kind: 'link', href: `/dashboard/${E}/messages` },
    };
  }

  const body = (
    /* With `&shell=1` the column is the real page's (`budget/page.tsx`: `sn-col max-w-3xl` = the 48-rem reading column,
       inside the layout's gutter that LabShell draws) — the old 720-px lab cap made the desktop walk measure a column
       the real page does not have. Without the shell it stays the phone stand-in it always was. */
    <main
      className={q.shell === '1' ? 'sn-col max-w-3xl' : 'sn-col'}
      style={q.shell === '1' ? undefined : { maxWidth: 720, margin: '0 auto', padding: '8px 16px 96px' }}
      data-budget-lab={state}
    >
      <BudgetScreen
        eventId={E}
        canEdit={state !== 'view'}
        summary={{
          targetPhp,
          agreedPhp: known.agreedPhp,
          paidPhp: known.paidPhp,
          owedPhp: known.partial ? (owedFloor?.php ?? null) : known.owedAtLeastPhp,
          owedAtLeast: owedFloor !== null,
          partial: known.partial,
          next: known.partial ? null : pickNextPayment(money.lines),
        }}
        list={list}
        supplierExtras={supplierExtras}
        categories={costCategoryOptions('wedding')}
        targetNote={
          state === 'traditions' ? (
            <TraditionNotes muslim mahrDescription="Gold and a Qur'an" chinese pax={180} />
          ) : undefined
        }
      />
      {/* 🔦 `&spot=1` — the Budget's first-visit spotlight (owner 2026-10-22), first run. */}
      {q.spot === '1' && TOURS[HOST_PAGE_TOURS.budget].spotlight ? (
        <LabPageSpotlight tourKey={HOST_PAGE_TOURS.budget} script={TOURS[HOST_PAGE_TOURS.budget].spotlight!} />
      ) : null}
    </main>
  );
  /* `&shell=1` — the REAL One Shell (rail + bar, `boundary="tab"`) around the ledger. */
  return q.shell === '1' ? <LabShell eventId={E}>{body}</LabShell> : body;
}
