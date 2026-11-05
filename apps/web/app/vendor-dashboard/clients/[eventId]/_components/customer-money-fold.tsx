/**
 * THE MONEY FOLD OF THE CUSTOMER CARD — the supplier's half of Suppliers Pair 3
 * (map P3, rows 19–24; `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 4 row
 * "Quote & Payments tab" → *"Money ⌄ — Paid · Due · one row per instalment with
 * Received/due pill"*). The couple's half is the Pay sheet on Suppliers › Booked.
 *
 *   Money
 *   PAID ₱31,350              DUE ₱94,050
 *   ▓▓▓▓▓░░░░░░░░░░░░  received of ₱125,400
 *   Downpayment                    ₱31,350   [Received ✓]
 *   Second payment · Nov 12        ₱31,350   [Waiting for you]
 *   Balance                        ₱62,700   [Due Dec 5]
 *   Total                         ₱125,400
 *   WAITING FOR YOU
 *   ₱31,350 · Second payment · logged Oct 3
 *   ( Confirm received )  ( Not received )
 *
 * THE LOOP, BOTH ENDS: the couple records a payment (the Pay sheet's shipped
 * card) → it waits here, answered IN PLACE (`PendingPaymentAnswer`, the thread
 * page's own answer — `confirmVendorPayment` / `refuseVendorPayment`, posting
 * this card as `return_to`) → "Received ✓" here, "Paid ✓" on their Pay sheet,
 * and their row's next step moves on. "Not received" folds the instalment back
 * to Due on both ends (H4) and tells the couple. Nothing about paying is
 * written here: every write is an action that already ships.
 *
 * The instalment rows are kind 26 (`PriceSummary`) over `priceSummaryOf` — the
 * SAME function and the same plan fold (`computeStepper`) the couple's sheet
 * reads, so the two ends cannot list different instalments.
 *
 * A SERVER component; the answer buttons are the one client island.
 *
 * ── A FIGURE NOBODY MEASURED IS NOT ₱0 ─────────────────────────────────────
 * No plan and an unreadable ledger → the card's own "couldn't load" note, never
 * "nothing received". An instalment with no resolved amount keeps the total
 * unstated ("not every amount is set yet") and is left out of Due.
 */
import { Count, Fill } from '@/components/count';
import { formatPhp } from '@/lib/php';
import { PriceSummary } from '@/app/_components/price-summary';
import { priceSummaryOf, priceToday } from '@/lib/price-summary';
import type { StepperInstallment } from '@/lib/vendor-service-payment-schedules';
import type { PendingVendorPayment } from '@/lib/vendor-service-payment-schedules.server';
import type { BookingMoney } from '@/lib/vendor-cashflow';
import { PendingPaymentAnswer } from '../../../messages/[threadId]/_components/vendor-payment-live';
import { BookingMoneySummary } from './booking-money-summary';

const H = 'text-[12px] uppercase tracking-[0.08em] text-ink/55';
const V = 'mt-0.5 text-[22px] font-medium leading-tight tabular-nums';

/** "Oct 3" — the Manila day the couple logged it. */
function loggedDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

function Peso({ value, id }: { value: number; id: string }) {
  return Number.isInteger(value) ? <Count value={value} format="peso" id={id} /> : <span>{formatPhp(value)}</span>;
}

export function CustomerMoneyFold({
  eventId,
  steps,
  clearedAt,
  pending,
  ledgerMoney,
  ledgerUnreadable,
  threadId,
  unreadableNote,
}: {
  eventId: string;
  /** The frozen plan with the couple's payments folded in, or null (no plan). */
  steps: StepperInstallment[] | null;
  clearedAt: string | null;
  /** Couple-logged payments that still wait on THIS supplier (`awaitsTheSupplier`). */
  pending: PendingVendorPayment[];
  /** No-plan booking: the logged payments and the balance. */
  ledgerMoney: BookingMoney;
  ledgerUnreadable: boolean;
  threadId: string | null;
  /** The card's own "couldn't load" note, passed in so it is drawn ONE way. */
  unreadableNote: React.ReactNode;
}) {
  const plan = steps && steps.length > 0 ? priceSummaryOf(steps, 'supplier', { clearedAt, today: priceToday() }) : null;
  // The two figures: from the plan when there is one, else the logged ledger.
  const figures = plan
    ? { paid: plan.paidPhp, due: plan.leftPhp, total: plan.totalPhp }
    : ledgerUnreadable || ledgerMoney.rows.length === 0
      ? null
      : {
          paid: ledgerMoney.receivedPhp,
          due: Math.max(0, Math.round((ledgerMoney.expectedPhp - ledgerMoney.receivedPhp) * 100) / 100),
          total: ledgerMoney.expectedPhp,
        };
  const pct = figures && figures.total && figures.total > 0 ? Math.min(100, (figures.paid / figures.total) * 100) : 0;
  const cardPath = `/vendor-dashboard/clients/${eventId}`;

  return (
    <section data-customer-money="" aria-labelledby="cm-money-h" className="space-y-3">
      <h3 id="cm-money-h" className="font-display text-[19px] font-medium leading-tight text-ink">
        Money
      </h3>

      {figures ? (
        <>
          <div className="grid grid-cols-2 gap-x-5" data-customer-money-figures="">
            <div className="min-w-0">
              <div className={H}>Paid</div>
              <div className={`${V} text-[rgb(var(--color-ok))]`}>
                <Peso value={figures.paid} id={`cm-paid-${eventId}`} />
              </div>
            </div>
            <div className="min-w-0">
              <div className={H}>Due</div>
              <div className={`${V} text-ink`}>
                <Peso value={figures.due} id={`cm-due-${eventId}`} />
              </div>
            </div>
          </div>
          {figures.total ? (
            <>
              {/* Kind 32's meter: received of the total, no frame. */}
              <div className="relative h-1.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
                <Fill value={pct} id={`cm-meter-${eventId}`} className="absolute inset-y-0 left-0 bg-[rgb(var(--color-ok))]" />
              </div>
              <p className="text-[12.5px] text-ink/60">received of {formatPhp(figures.total)}</p>
            </>
          ) : null}
        </>
      ) : null}

      {plan ? (
        <PriceSummary summary={plan} idPrefix={`cm-${eventId}`} />
      ) : ledgerUnreadable ? (
        unreadableNote
      ) : ledgerMoney.rows.length > 0 ? (
        <BookingMoneySummary money={ledgerMoney} />
      ) : (
        <p className="text-[14px] text-ink/60">No payment plan on this booking yet.</p>
      )}

      {pending.length > 0 ? (
        <div data-customer-money-waiting={pending.length}>
          <p className={`${H} mt-2`}>Waiting for you</p>
          <ul role="list">
            {pending.map((p) => (
              <li key={p.paymentId} className="border-t border-ink/10 py-3 first:border-t-0" data-customer-money-pending={p.paymentId}>
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
                <PendingPaymentAnswer payment={p} threadId={threadId ?? ''} returnTo={cardPath} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
