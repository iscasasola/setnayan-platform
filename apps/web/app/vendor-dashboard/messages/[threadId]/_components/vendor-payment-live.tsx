'use client';

/**
 * Live vendor payment view for a thread. Renders the pending-confirmation cards
 * (couple-logged payments awaiting the vendor's "Confirm received") + the
 * per-booking plan-progress cards (received-of-total roll-up + installment
 * stepper + "Mark payment cleared"), and keeps them current in real time.
 *
 * Subscribes to Supabase Realtime on the event's payments + line-item tables.
 * Delivery is RLS-gated by the vendor-read policies added in
 * 20270315091571_vendor_read_payment_ledger_rls.sql, so a vendor only ever
 * receives changes for their OWN bookings. On any change it refetches the whole
 * state via getVendorPaymentState (ownership-gated server action). The vendor's
 * own confirm/clear actions also revalidate the page, which re-seeds `initial`.
 */

import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ChevronDown, CircleCheck, ShieldCheck, Undo2, Wallet } from 'lucide-react';
import { Explain } from '@/app/_components/explain';
import { PickedNavContext } from '@/app/_components/picked/picked-nav';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { TEMPLATE_MONEY, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { PLAN_FOLD_SEEN_KEY, planFoldLine, planFoldOpensFor } from '@/lib/chat-plan-fold';
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';
import { SubmitButton } from '@/app/_components/submit-button';
import { PaymentPlanStepper } from '@/app/_components/payment-plan-stepper';
import {
  canClearPlan,
  computePlanRollup,
  type PlanProgress,
} from '@/lib/vendor-service-payment-schedules';
import type { PendingVendorPayment } from '@/lib/vendor-service-payment-schedules.server';
import {
  confirmVendorPayment,
  clearVendorPaymentPlan,
  getVendorPaymentState,
  refuseVendorPayment,
} from '../pay-confirm-actions';
import { NotReceivedForm } from '@/app/_components/not-received-form';

type PlanProgressItem = PlanProgress & {
  eventVendorId: string;
  vendorLabel: string;
  // No-Show Downpayment Protection — set when the couple acknowledged this
  // booking's reservation policy at lock.
  reservationAcknowledgedAt?: string | null;
};

function fmtAckDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

const peso = (n: number) => `₱${Math.abs(Math.round(n)).toLocaleString('en-PH')}`;

// "Confirm received" is the card's MAIN button → terracotta (owner 2026-10-12, look call 1 — it was a green fill);
// "Not received" is the grey outline beside it. Both are the template's button piece (`SupplierSubmit` /
// `ActionButton`), 44 px floor.
const FLOOR = '!min-h-11';

/**
 * The supplier's answer to one logged payment — "Confirm received" or "Not
 * received" (H4, owner 2026-09-11: one path for every payment). The second opens
 * the shared `NotReceivedForm`, the same form Decisions opens.
 *
 * Once refused, the card says where it stands instead of asking again: the
 * supplier's own words, then Setnayan's ruling. "Confirm received" stays — the
 * money can turn up late, and confirming lifts the refusal (the database does
 * that, for the deposit and for an installment alike).
 */
export function PendingPaymentAnswer({
  payment,
  threadId,
  returnTo,
}: {
  payment: PendingVendorPayment;
  /** The conversation, when there is one ('' when the card has none). */
  threadId: string;
  /**
   * The customer card answers here too (Suppliers Pair 3, 2026-10-13): its own
   * path, so the answer re-draws THAT page (`payConfirmReturnTo`).
   */
  returnTo?: string;
}) {
  const [notReceivedOpen, setNotReceivedOpen] = useState(false);
  const d = payment.dispute;
  const refused = d?.refusedAtMs != null;
  const hidden = (
    <>
      <input type="hidden" name="payment_id" value={payment.paymentId} />
      <input type="hidden" name="thread_id" value={threadId} />
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
    </>
  );
  return (
    <>
      {refused ? (
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          {d?.settlement?.outcome === 'not_received'
            ? `Setnayan found it didn’t reach you${d.settlement.note ? ` — “${d.settlement.note}”` : ''}.`
            : `You said this never reached you${d?.reason ? ` — “${d.reason}”` : ''}. Setnayan is checking it with both of you.`}
        </p>
      ) : (
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          Setnayan never holds this money — confirm only what you actually
          received.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={confirmVendorPayment}>
          {hidden}
          <SupplierSubmit
            tone="brand"
            main
            icon={<BadgeCheck aria-hidden strokeWidth={1.9} />}
            label={refused ? 'It arrived — confirm received' : 'Confirm received'}
            pendingLabel="Confirming…"
            className={FLOOR}
          />
        </form>
        {refused ? null : (
          <ActionButton
            type="button"
            tone="neutral"
            icon={<Undo2 aria-hidden strokeWidth={1.9} />}
            label="Not received"
            onClick={() => setNotReceivedOpen((v) => !v)}
            aria-expanded={notReceivedOpen}
            className={FLOOR}
          />
        )}
      </div>
      {!refused && notReceivedOpen ? (
        <NotReceivedForm
          action={refuseVendorPayment}
          hidden={hidden}
          fieldClassName="w-full rounded-xl border border-[color:var(--m-line)] px-3 py-2 text-sm text-ink"
          submit={
            <SupplierSubmit
              tone="neutral"
              icon={<Undo2 aria-hidden strokeWidth={1.9} />}
              label="Tell them it hasn’t arrived"
              pendingLabel="Sending…"
              className={`${FLOOR} self-start`}
            />
          }
        />
      ) : null}
    </>
  );
}

export function VendorPaymentLive({
  threadId,
  eventId,
  initialPending,
  initialPlans,
  fold = null,
}: {
  threadId: string;
  eventId: string;
  initialPending: PendingVendorPayment[];
  initialPlans: PlanProgressItem[];
  /**
   * 💳 THE CHAT FOLDS IT (DECISION_LOG 2026-11-16 CHAT-09): one 44 px row — "Plan · ₱0 of ₱8,750 · next ₱1,750 Nov 15"
   * — that opens in place; "Mark payment cleared" one tap deeper, its helper line in an ⓘ, and "Payment ›" to the
   * picked client's Payment page (`paymentHref`, `customerCardHref(…, 'payments')`). Absent (the customer card's
   * Payment tab): the whole card, open, as before.
   */
  fold?: { paymentHref: string } | null;
}) {
  const [pending, setPending] = useState<PendingVendorPayment[]>(initialPending);
  const [plans, setPlans] = useState<PlanProgressItem[]>(initialPlans);

  // Re-seed from the server when the page revalidates (e.g. after the vendor's
  // own confirm/clear), so a server refresh wins over stale client state.
  useEffect(() => {
    setPending(initialPending);
    setPlans(initialPlans);
  }, [initialPending, initialPlans]);

  const refetch = useCallback(async () => {
    const fresh = await getVendorPaymentState(threadId);
    if (fresh) {
      setPending(fresh.pending);
      setPlans(fresh.plans);
    }
  }, [threadId]);

  // Skip a redundant refetch on the first subscribe (`initial` is already
  // fresh); only re-pull on reconnects, which may have missed events.
  const subscribedOnce = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    // 🔌 A console left in a background tab lets the channel go after a while (`pauseWhileHidden`); coming back
    // re-subscribes, and the re-SUBSCRIBED below re-pulls — a payment logged meanwhile is on screen.
    return pauseWhileHidden(() => {
      const channel = supabase
        .channel(`vendor-pay-${threadId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_vendor_payments',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            void refetch();
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_vendor_line_items',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            void refetch();
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (subscribedOnce.current) void refetch();
            subscribedOnce.current = true;
          }
        });
      return () => supabase.removeChannel(channel);
    });
  }, [threadId, eventId, refetch]);

  // 💳 THE FOLD (chat only — CHAT-09): a newly logged payment opens the row ONCE on this device, like the due-now pins;
  // a deep link to `#pending-payments` (the customer card's "Log payment") opens it too.
  const [foldOpen, setFoldOpen] = useState(false);
  const foldId = useId();
  const pendingKey = pending.map((p) => p.paymentId).join('|');
  const folded = fold != null;
  useEffect(() => {
    if (!folded) return;
    const ids = pendingKey ? pendingKey.split('|') : [];
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(PLAN_FOLD_SEEN_KEY(threadId));
    } catch {
      seen = null;
    }
    if (planFoldOpensFor(ids, seen)) setFoldOpen(true);
    try {
      window.localStorage.setItem(PLAN_FOLD_SEEN_KEY(threadId), pendingKey);
    } catch {
      /* private mode — the row simply stays as the person left it */
    }
  }, [folded, threadId, pendingKey]);
  useEffect(() => {
    if (folded && window.location.hash === '#pending-payments') setFoldOpen(true);
  }, [folded]);
  const nav = useContext(PickedNavContext);

  /* Pending payment confirms — the couple logged an off-platform payment
     (with optional proof). Nothing is "received" until the vendor taps
     Confirm; the DB guard (confirm_vendor_payment) re-checks ownership. */
  const pendingCards = pending.map((p) => (
    // The one next step on this screen — the only thing here that may wear a frame (rule 2): the warm surface.
    <div
      key={p.paymentId}
      className="rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-4"
    >
      <p className="text-[15px] font-semibold text-ink">
        The couple logged a <span className={TEMPLATE_MONEY}>{peso(p.amountPhp)}</span> payment
      </p>
      <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>
        {p.installmentLabel ? `For ${p.installmentLabel} · ` : ''}
        Paid {p.paidAt}
        {p.method ? ` · ${p.method}` : ''}
        {p.reference ? ` · ref ${p.reference}` : ''}.
        {p.notes ? ` “${p.notes}”` : ''}
      </p>
      {p.proofUrl ? (
        <p className="mt-1.5 text-sm">
          <a
            href={p.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-mulberry underline hover:text-mulberry-600"
          >
            View attached receipt
          </a>
        </p>
      ) : null}
      <PendingPaymentAnswer payment={p} threadId={threadId} />
    </div>
  ));

  /* Payment plan progress + clear — one per booking with a frozen plan: a
     received-of-total roll-up, the installment stepper, and the "Mark payment
     cleared" gate (enabled only when every installment is confirmed, or the
     booking has no schedule). Each piece is built ONCE; the open card (the
     Payment tab) and the chat's folded row lay the same pieces out. */
  const planViews = plans.map((p) => {
    const cleared = p.clearedAt != null;
    const steps = p.steps ?? [];
    const canClear = canClearPlan(steps);
    const rollup = computePlanRollup(steps);
    const ack = p.reservationAcknowledgedAt ? (
      <p className={`mt-1.5 inline-flex items-center gap-1.5 ${TEMPLATE_SUBLINE}`}>
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Protected by your reservation policy — acknowledged{' '}
        {fmtAckDate(p.reservationAcknowledgedAt)}
      </p>
    ) : null;
    const stepper = <PaymentPlanStepper steps={steps} clearedAt={p.clearedAt} lined={folded} />;
    const clearForm = !cleared ? (
      <form action={clearVendorPaymentPlan}>
        <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
        <input type="hidden" name="thread_id" value={threadId} />
        {fold ? (
          <SubmitButton
            pendingLabel="Clearing…"
            disabled={!canClear}
            className="inline-flex min-h-11 items-center rounded-full bg-success-700 px-4 text-sm font-semibold text-cream hover:bg-success-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark payment cleared
          </SubmitButton>
        ) : (
          // Green confirms money (rule 3) — outlined, the screen's one filled button stays Send / Confirm.
          <SubmitButton
            pendingLabel="Clearing…"
            disabled={!canClear}
            className={actionButtonClass('ok', { extra: FLOOR })}
            aria-label="Mark payment cleared"
            title="Mark payment cleared"
          >
            <CircleCheck aria-hidden strokeWidth={1.9} />
            <span className="lbl">Mark payment cleared</span>
          </SubmitButton>
        )}
      </form>
    ) : null;
    return { p, cleared, steps, canClear, rollup, ack, stepper, clearForm };
  });

  if (fold) {
    if (pending.length === 0 && planViews.length === 0) return null;
    const lead = planViews[0];
    const line = lead
      ? planFoldLine(lead.rollup, lead.cleared, lead.steps.length > 0)
      : `${peso(pending.reduce((sum, p) => sum + p.amountPhp, 0))} to confirm`;
    return (
      <div className="border-b border-ink/10 bg-cream px-3 py-0.5 sm:px-4" data-chat-plan-fold={foldOpen ? 'open' : 'closed'}>
        <button
          type="button"
          aria-expanded={foldOpen}
          aria-controls={foldId}
          onClick={() => setFoldOpen((was) => !was)}
          className="sn-press flex h-11 w-full items-center gap-2 rounded-full border border-ink/12 pl-3.5 pr-3 text-left text-[14px] text-ink/70 hover:bg-ink/[0.04]"
          data-chat-plan-row=""
        >
          <Wallet aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold text-ink">Plan</b> · {line}
          </span>
          <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${foldOpen ? 'rotate-180' : ''}`} strokeWidth={1.9} />
        </button>
        {foldOpen ? (
          <div id={foldId} className="space-y-2 pb-1.5 pt-1" data-chat-plan-open="">
            {pendingCards}
            {planViews.map(({ p, cleared, canClear, ack, stepper, clearForm }) => (
              <div key={p.eventVendorId}>
                {planViews.length > 1 ? <p className="pt-1 text-[13px] font-semibold text-ink">{p.vendorLabel}</p> : null}
                {ack}
                {stepper}
                <div className="flex items-center gap-1 border-t border-ink/10 pt-1.5">
                  {clearForm}
                  {!cleared ? (
                    <Explain title="Mark payment cleared" data="chat-plan-clear">
                      {canClear
                        ? 'All payments confirmed — mark the plan cleared to let the couple know nothing more is owed.'
                        : 'Confirm every payment first.'}
                    </Explain>
                  ) : null}
                  <Link
                    href={fold.paymentHref}
                    onClick={(e) => {
                      // Inside the picked client the Payment page opens in place; full screen, the link goes there.
                      if (nav) {
                        e.preventDefault();
                        nav.select('payments');
                      }
                    }}
                    className="ml-auto inline-flex min-h-11 items-center px-1 text-sm font-semibold text-sn-accent"
                    data-chat-plan-payment=""
                  >
                    Payment ›
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {pendingCards}
      {planViews.map(({ p, cleared, canClear, rollup, ack, stepper, clearForm }) => (
          <div
            key={p.eventVendorId}
            className="border-t border-[color:var(--m-line)] py-3 first:border-t-0"
          >
            <p className="text-[15px] font-semibold text-ink">
              Payment plan — {p.vendorLabel}
            </p>
            {ack}
            {rollup.total > 0 ? (
              <div className="mt-3 space-y-2 border-y border-[color:var(--m-line)] py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-[color:var(--m-slate-2)]">
                    <span className={TEMPLATE_MONEY}>{peso(rollup.received)}</span>
                    <span> of </span>
                    <span className={TEMPLATE_MONEY}>{peso(rollup.total)}</span>
                    <span> received</span>
                  </p>
                  <p className="text-xl font-bold tabular-nums text-ink">{rollup.percentReceived}%</p>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--m-line)]"
                  role="progressbar"
                  aria-valuenow={rollup.percentReceived}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Percent of plan received"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${rollup.percentReceived}%`, background: 'rgb(var(--color-ok))' }}
                  />
                </div>
                <p className={TEMPLATE_SUBLINE}>
                  {cleared ? (
                    'Plan cleared — nothing outstanding.'
                  ) : rollup.pending > 0 ? (
                    <>
                      <span className="font-medium" style={{ color: 'rgb(var(--color-warn))' }}>
                        {peso(rollup.pending)} awaiting your confirmation
                      </span>
                      {rollup.next ? (
                        <>
                          {' · next: '}
                          {rollup.next.label}
                          {rollup.next.dueDate ? ` (due ${rollup.next.dueDate})` : ''}
                        </>
                      ) : null}
                    </>
                  ) : rollup.next ? (
                    <>
                      Next: {rollup.next.label} — {peso(rollup.next.amountPhp)}
                      {rollup.next.dueDate ? ` · due ${rollup.next.dueDate}` : ''}
                    </>
                  ) : (
                    'All payments confirmed.'
                  )}
                </p>
              </div>
            ) : null}
            <div className="mt-3">{stepper}</div>
            {clearForm ? (
              <>
                <div className="mt-3">{clearForm}</div>
                {!canClear ? (
                  <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
                    Confirm every payment above before you can mark the plan
                    cleared.
                  </p>
                ) : (
                  <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
                    All payments confirmed — mark the plan cleared to let the
                    couple know nothing more is owed.
                  </p>
                )}
              </>
            ) : null}
          </div>
      ))}
    </>
  );
}
