/**
 * 🗂 PAYMENT — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). Shown only for a BOOKED client.
 *
 * OWNER OF THIS FILE: **C1** (B2 §2.3). Top to bottom, as v113 draws it:
 *
 *   Agreed · Paid · To collect · the meter · "₱X left to collect" · Next "₱ · label · date" Check › / Ask ›
 *     — the couple's budget figures (`BudgetFigures`, split out of `BudgetSummary`; owner v77 "like the budget
 *       planner"), decided by `clientPaymentView` over the SAME fold the rows below read;
 *   PAYMENT PLAN · FROZEN ON BOOKING — the shipped kind-26 rows (`PriceSummary` over `priceSummaryOf`);
 *   PAYMENTS THE COUPLE LOGGED — each answered here with the shipped `PendingPaymentAnswer`
 *     (**Confirm received** · **Not received** → `confirmVendorPayment` / `refuseVendorPayment`);
 *   REFUNDS YOU GAVE — B2-E: each refund the shop recorded for this client (tap opens · swipe left removes + Undo) and
 *     **Record a refund** (`ClientRefunds` → `recordClientRefund`, confirmed before it writes). Paid drops by them;
 *   ASKS — the shipped `PaymentAsksPanel` (amount · note · by date · asked day · Take it back), handed in by the page;
 *   the reservation-policy line (moved here from the client page, spec §9 #2) and one footer line.
 *
 * Moved, never redrawn: every part is a shipped component; nothing here writes. One read: none of its own — the client
 * page hands in what it already read (`money`). Until L2's switch hands `money` in, the page draws the shipped money
 * node (`shipped`) exactly as before, so nothing is lost in between.
 *
 * 🔒 app/vendor-dashboard/clients/[eventId]/_pages/the-payment-page-reads-like-the-budget.test.ts
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { PriceSummary } from '@/app/_components/price-summary';
import { formatPhp } from '@/lib/php';
import { clientPaymentView } from '@/lib/client-payment-view';
import type { StepperInstallment } from '@/lib/vendor-service-payment-schedules';
import type { PendingVendorPayment } from '@/lib/vendor-service-payment-schedules.server';
import type { BookingMoney } from '@/lib/vendor-cashflow';
import {
  BudgetFigures,
  BudgetLegendRight,
  BudgetNextLink,
  Peso,
} from '@/app/dashboard/[eventId]/budget/_components/budget-figures';
import { PendingPaymentAnswer } from '../../../messages/[threadId]/_components/vendor-payment-live';
import { SupplierThumbRow } from '../../../_components/supplier-thumb-row';
import { BookingMoneySummary } from '../_components/booking-money-summary';
import { customerLandingHref } from '../../../customers/anchors';
import { ClientRefunds, type ClientRefundView } from '../_components/client-refunds';
import { refundedTotalPhp } from '@/lib/client-refunds';
import type { PickedPageProps } from './context';

function fmtShortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Oct 3" — the Manila day the couple logged it (the money fold's own words). */
function loggedDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** The shipped line, word for word — one definition, mounted wherever the money is drawn. */
export function ReservationLine({ acknowledgedAt }: { acknowledgedAt: string | null }) {
  if (!acknowledgedAt) return null;
  return (
    <p className="mt-2 text-xs text-ink/45">
      Protected by your reservation policy · acknowledged {fmtShortDate(acknowledgedAt)}.
    </p>
  );
}

/** What the client page already read for this booking's money — the money fold's own inputs. */
export type PaymentMoney = {
  steps: StepperInstallment[] | null;
  clearedAt: string | null;
  /** Couple-logged payments that still wait on THIS supplier (`awaitsTheSupplier`). */
  pending: PendingVendorPayment[];
  ledgerMoney: BookingMoney;
  ledgerUnreadable: boolean;
  /** The card's own "couldn't load" note, drawn ONE way. */
  unreadableNote?: ReactNode;
};

export type PaymentPageProps = PickedPageProps & {
  /** `fetchPlanProgressForVendor(...).reservationAcknowledgedAt` for this booking, already read by the page. */
  reservationAcknowledgedAt: string | null;
  /** ⏳ Handed in by L2's switch (NEEDS in C1's notes). Absent → the shipped money node is drawn, unchanged. */
  money?: PaymentMoney;
  /** The shipped `PaymentAsksPanel`, drawn by the page (it posts the shipped `vendorAskForPayment`). */
  asks?: ReactNode;
  /** 💸 B2-E: the refunds this shop recorded for this booking (one read by the page). Absent → no refunds section. */
  refunds?: { eventVendorId: string; clientName: string; measured: boolean; rows: ClientRefundView[] };
};

const H = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55';

export function PaymentPage({ ctx, shipped, reservationAcknowledgedAt, money, asks, refunds }: PaymentPageProps) {
  if (!money) {
    return (
      <>
        {shipped ?? null}
        <ReservationLine acknowledgedAt={reservationAcknowledgedAt} />
      </>
    );
  }
  const view = clientPaymentView({
    ...money,
    // Paid is what they paid LESS what the shop gave back; a refused refunds read is "part of this couldn't load".
    refundedPhp: refunds ? (refunds.measured ? refundedTotalPhp(refunds.rows) : null) : 0,
  });
  const cardPath = `/vendor-dashboard/clients/${ctx.eventId}?tab=payments`;
  const nothing = view.plan === null && !view.partial && money.ledgerMoney.rows.length === 0;
  return (
    <div className="space-y-5 pb-24" data-client-payment={ctx.eventId}>
      {nothing ? (
        // Booked, no plan and nothing logged: nothing to add up — said, never "₱0 · all paid" (spec §4, test pinned).
        <p className="text-[14px] text-ink/60" data-client-payment-empty="">
          No payment plan on this booking yet. Ask for a payment below, or add the plan to your quote.
        </p>
      ) : (
        <BudgetFigures
          label="Payment summary"
          columns={3}
          tour="client-payment-figures"
          marks={{ 'data-client-payment-figures': '' }}
          cells={[
            { key: 'agreed', label: 'Agreed', value: view.agreedPhp, id: `cp-agreed-${ctx.eventId}` },
            { key: 'paid', label: 'Paid', value: view.paidPhp, id: `cp-paid-${ctx.eventId}`, tone: 'ok' },
            { key: 'collect', label: 'To collect', value: view.collectPhp, id: `cp-collect-${ctx.eventId}`, tone: 'wine', atLeast: view.collectAtLeast },
          ]}
          meter={{ ...view.meter, ids: { agreed: `cp-m-agreed-${ctx.eventId}`, paid: `cp-m-paid-${ctx.eventId}`, over: `cp-m-over-${ctx.eventId}` } }}
          swatches={['paid', 'agreed']}
          right={
            view.partial ? (
              <BudgetLegendRight wine partial>
                part of this couldn&rsquo;t load
              </BudgetLegendRight>
            ) : view.collectPhp === null ? null : (
              <BudgetLegendRight>
                <Peso value={view.collectPhp} id={`cp-left-${ctx.eventId}`} />
                {view.collectAtLeast ? '+' : ''} left to collect
              </BudgetLegendRight>
            )
          }
          next={
            view.partial
              ? 'unread'
              : view.next
                ? {
                    amountPhp: view.next.amountPhp,
                    name: view.next.name,
                    dueDate: view.next.dueDate,
                    action: view.next.check ? (
                      <BudgetNextLink href="#payment-logged" mark="check">
                        Check ›
                      </BudgetNextLink>
                    ) : (
                      <BudgetNextLink href="#payment-asks" mark="ask">
                        Ask ›
                      </BudgetNextLink>
                    ),
                  }
                : null
          }
        />
      )}

      {view.plan ? (
        <section aria-label="Payment plan" data-client-payment-plan="">
          <p className={H}>Payment plan · frozen on booking · {view.plan.rows.length}</p>
          <PriceSummary summary={view.plan} idPrefix={`cp-${ctx.eventId}`} className="mt-1" />
        </section>
      ) : view.partial ? (
        money.unreadableNote ?? null
      ) : money.ledgerMoney.rows.length > 0 ? (
        <BookingMoneySummary money={money.ledgerMoney} />
      ) : null}

      {money.pending.length > 0 ? (
        <section id="payment-logged" aria-label="Payments the couple logged" data-client-payment-logged={money.pending.length}>
          <p className={H}>Payments the couple logged</p>
          <ul role="list">
            {money.pending.map((p) => (
              <li key={p.paymentId} className="border-t border-ink/10 py-3 first:border-t-0" data-client-payment-pending={p.paymentId}>
                <p className="text-[14px] text-ink">
                  <b className="font-semibold tabular-nums">{formatPhp(p.amountPhp)}</b>
                  {p.installmentLabel ? ` · ${p.installmentLabel}` : p.isDepositRecord ? ' · first payment' : ''}
                  <span className="text-ink/55"> · logged {loggedDay(p.paidAt)}</span>
                </p>
                {p.method || p.reference ? (
                  <p className="text-[12.5px] text-ink/55">{[p.method, p.reference].filter(Boolean).join(' · ')}</p>
                ) : null}
                {p.proofUrl ? (
                  <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-sn-accent underline-offset-2 hover:underline">
                    Their receipt
                  </a>
                ) : null}
                <PendingPaymentAnswer payment={p} threadId={ctx.threadId ?? ''} returnTo={cardPath} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {refunds ? (
        <ClientRefunds
          eventId={ctx.eventId}
          eventVendorId={refunds.eventVendorId}
          clientName={refunds.clientName}
          refunds={refunds.rows}
          measured={refunds.measured}
        />
      ) : null}

      {asks ? (
        <section id="payment-asks" aria-label="Asks" data-client-payment-asks="">
          <p className={H}>Asks</p>
          {asks}
        </section>
      ) : null}

      <div>
        <ReservationLine acknowledgedAt={reservationAcknowledgedAt} />
        <p className="mt-2 text-xs text-ink/55" data-client-payment-footer="">
          Their budget shows only your lines. What you confirm here is what they see as paid.
        </p>
        {/* 💸 THE MONEY LEDGER HAS A DOOR FROM HERE (Build 2 parity, 8 Nov: it was reachable by URL only). The same door
            Today's Money stat opens (`customerLandingHref('payday')`), so the two can never point at different ledgers. */}
        <Link
          href={customerLandingHref('payday')}
          className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent underline-offset-2 hover:underline"
          data-client-payment-ledger=""
        >
          Every client&rsquo;s payments ›
        </Link>
      </div>

      {/* 👍 The thumb: "Ask for payment" — the shipped ask form, right under the payments it is about. */}
      <SupplierThumbRow
        name="client-payment"
        label="Payment tools"
        row={<ThumbRow name="client-payment" action={{ icon: <Wallet aria-hidden="true" strokeWidth={1.9} />, label: 'Ask for payment', href: '#payment-asks' }} />}
      />
    </div>
  );
}
