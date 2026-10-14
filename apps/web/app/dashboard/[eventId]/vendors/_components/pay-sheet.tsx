'use client';

/**
 * THE PAY SHEET (owner 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md`
 * § PR4 "Pay sheet"; the prototype's `SHEETS.pay`, acceptance picture
 * `09-pay-sheet-one-channel-dark.jpg`).
 *
 * "Pay" and "Payments" on a booked supplier open this over the page — a sheet
 * from the bottom on a phone, a panel on the right from 1024 px (the shipped
 * `Sheet`) — instead of leaving for the supplier's workspace.
 *
 *   Payments · Seda Vertis North
 *   PAYMENT PLAN     the supplier's own plan, each instalment's state
 *                    (`PaymentPlanStepper`), or the accepted quote's schedule
 *   the payment card `DepositReservation` — the ONE card the workspace's
 *                    Payments tab and the chat already mount: where to pay
 *                    them (`VendorDirectPay`), then record it
 *                    (`recordDeposit` / `logScheduledPayment`), then what has
 *                    been paid (`PaymentHistoryList`)
 *
 * ── NOTHING ABOUT PAYING IS RE-IMPLEMENTED HERE ────────────────────────────
 * This file loads and places. The minimum on a first payment, the proof
 * upload, the "date held · awaiting confirmation" chip, a supplier's refusal,
 * the next instalment — all of it is the shipped card's, unchanged.
 *
 * ── ONE REQUEST, WHEN IT OPENS (the minimum-request rules, 2026-10-08) ─────
 * `loadPaySheet` runs once per open, says so while it is out, and says so with
 * "Try again" when it fails — a sheet that could not load never draws an empty
 * plan or "no payments". When the page's own figures for this supplier change
 * (a payment was just recorded) it asks again.
 */
import { useCallback, useContext, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { PriceSummary } from '@/app/_components/price-summary';
import { priceSummaryOf, priceToday } from '@/lib/price-summary';
import { moneyStepLine, pesoFromCentavos } from '@/lib/accepted-quote-terms';
import { DepositReservation } from '../[vendorId]/workspace/_components/deposit-reservation';
import { planNote, type LoadPaySheetResult, type PaySheetData } from '@/lib/pay-sheet';
import { loadPaySheet } from '../_actions/pay-sheet';
import { BookedStandInCtx } from './booked-stand-ins';

const K2 = 'text-[11px] uppercase tracking-[0.14em] text-ink/55';
const MUTE = 'text-[13px] leading-snug text-ink/60';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'not_booked' } | { kind: 'ok'; data: PaySheetData };

export function PaySheet({
  eventId,
  vendorId,
  vendorName,
  version,
  onClose,
}: {
  eventId: string;
  /** `event_vendors.vendor_id`. */
  vendorId: string;
  vendorName: string;
  /** The row's own money, as words — when it changes, the sheet asks again. */
  version: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const standIn = useContext(BookedStandInCtx);
  const [state, setState] = useState<Load>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    let res: LoadPaySheetResult;
    try {
      res = standIn.loadPay
        ? await standIn.loadPay(vendorId)
        : await loadPaySheet({ eventId, vendorId, vendorName });
    } catch {
      res = { status: 'error' };
    }
    if (res.status === 'ok') setState({ kind: 'ok', data: res.data });
    else if (res.status === 'not_booked') setState({ kind: 'not_booked' });
    else setState({ kind: 'failed' });
  }, [eventId, vendorId, vendorName, standIn]);

  useEffect(() => {
    void load();
  }, [load, version]);

  // Drawn into <body>: inside the dashboard a transformed ancestor captures
  // `position: fixed`, and the app's top bar then sat over the sheet's title on
  // a computer (seen in the 2026-10-13 walk at 1280). The house fix —
  // `book-this-build.tsx` portals its Sheet the same way.
  return createPortal(
    <Sheet open onClose={onClose} labelledById={titleId} rise>
      <div className="space-y-4 px-5 pb-6 pt-5" data-pay-sheet={vendorId} data-pay-state={state.kind}>
        <h2 id={titleId} className="pr-10 font-display text-[22px] leading-tight text-ink">
          Payments · {vendorName}
        </h2>

        {state.kind === 'loading' ? (
          <p className={MUTE} role="status" data-pay-loading="">
            Loading their payments…
          </p>
        ) : null}

        {state.kind === 'failed' ? (
          <div className="flex flex-wrap items-center gap-3" role="status" data-pay-failed="">
            <p className="text-[14px] text-ink/75">We couldn’t load their payments. Nothing was changed.</p>
            <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={() => void load()} />
          </div>
        ) : null}

        {state.kind === 'not_booked' ? (
          <p className="text-[14px] text-ink/75" role="status" data-pay-not-booked="">
            Nothing can be paid or recorded until {vendorName} says yes.
          </p>
        ) : null}

        {state.kind === 'ok' ? (
          <>
            <section className="space-y-1.5" data-pay-section="plan" data-pay-plan={state.data.scheduleSource}>
              <p className={K2}>
                Payment plan
                {state.data.scheduleSource === 'plan' && state.data.plan !== 'unreadable' && state.data.plan.isDefaultSeeded
                  ? ' (estimated)'
                  : ''}
              </p>
              <p className={MUTE}>{planNote(state.data, vendorName)}</p>
              {state.data.scheduleSource === 'plan' && state.data.plan !== 'unreadable' && state.data.plan.steps ? (
                // Kind 26 — the SAME rows the supplier's customer card draws for
                // this booking (`priceSummaryOf`), in the couple's words.
                <PriceSummary
                  idPrefix={`pay-${vendorId}`}
                  summary={priceSummaryOf(state.data.plan.steps, 'couple', {
                    clearedAt: state.data.plan.clearedAt,
                    today: standIn.today ?? priceToday(),
                  })}
                />
              ) : null}
              {state.data.quoteSchedule ? (
                <ol>
                  {state.data.quoteSchedule.map((row, i) => (
                    <li
                      key={`${i}-${row.label}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-ink/10 py-3 text-[14px] first:border-t-0"
                    >
                      <span className="min-w-0">
                        <b className="block font-semibold text-ink">{row.label}</b>
                        <span className="block text-ink/55">Due {row.dueText}</span>
                      </span>
                      <b className="shrink-0 font-semibold tabular-nums text-ink">{pesoFromCentavos(row.amountCentavos)}</b>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            <section className="space-y-2" data-pay-section="pay">
              {/* The step's one sentence — the helper the workspace and the chat
                  read. Left out for a first payment with no amount on record:
                  the helper then has no figure to say, and the card below
                  already names the step ("Amount to pay"). */}
              {state.data.step.kind === 'first_payment_due' &&
              state.data.step.amountCentavos === null &&
              !state.data.step.resend ? null : (
                <p className="text-[14px] font-medium leading-snug text-ink" data-pay-step={state.data.step.kind}>
                  {moneyStepLine(state.data.step, 'couple', vendorName)}
                </p>
              )}
              <DepositReservation
                eventId={eventId}
                vendorId={vendorId}
                vendorName={vendorName}
                depositRecordedAt={state.data.depositRecordedAt}
                depositAcknowledgedAt={state.data.depositAcknowledgedAt}
                depositProofUrl={state.data.depositProofUrl}
                depositDeclinedAt={state.data.depositDeclinedAt}
                depositDeclineReason={state.data.depositDeclineReason}
                depositDisputeNote={null}
                payMethods={state.data.payMethods}
                payMethodsState={state.data.payMethodsState}
                requestedFirstPaymentCentavos={state.data.requestedFirstPaymentCentavos}
                requestedFirstPaymentSentence={state.data.requestedFirstPaymentSentence}
                requestedTermsUnreadable={state.data.requestedTermsUnreadable}
                step={state.data.step}
                history={state.data.history}
                compact
              />
            </section>
          </>
        ) : null}
      </div>
    </Sheet>,
    document.body,
  );
}
