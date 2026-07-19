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

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SubmitButton } from '@/app/_components/submit-button';
import { PaymentPlanStepper } from '@/app/_components/payment-plan-stepper';
import {
  canClearPlan,
  computePlanRollup,
  type PlanProgress,
} from '@/lib/vendor-service-payment-schedules';
import type { PendingVendorPayment } from '@/lib/vendor-service-payment-schedules.server';
import { confirmVendorPayment, clearVendorPaymentPlan, getVendorPaymentState } from '../pay-confirm-actions';

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

export function VendorPaymentLive({
  threadId,
  eventId,
  initialPending,
  initialPlans,
}: {
  threadId: string;
  eventId: string;
  initialPending: PendingVendorPayment[];
  initialPlans: PlanProgressItem[];
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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, eventId, refetch]);

  return (
    <>
      {/* Pending payment confirms — the couple logged an off-platform payment
          (with optional proof). Nothing is "received" until the vendor taps
          Confirm; the DB guard (confirm_vendor_payment) re-checks ownership. */}
      {pending.map((p) => (
        <div
          key={p.paymentId}
          className="rounded-xl border border-success-700/30 bg-success-50/60 p-4"
        >
          <p className="text-sm font-semibold text-ink">
            The couple logged a {peso(p.amountPhp)} payment
          </p>
          <p className="mt-1 text-sm text-ink/70">
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
          <p className="mt-2 text-xs text-ink/55">
            Setnayan never holds this money — confirm only what you actually
            received.
          </p>
          <div className="mt-3">
            <form action={confirmVendorPayment}>
              <input type="hidden" name="payment_id" value={p.paymentId} />
              <input type="hidden" name="thread_id" value={threadId} />
              <SubmitButton
                pendingLabel="Confirming…"
                className="inline-flex h-9 items-center rounded-lg bg-success-700 px-4 text-sm font-medium text-cream hover:bg-success-800"
              >
                Confirm received
              </SubmitButton>
            </form>
          </div>
        </div>
      ))}

      {/* Payment plan progress + clear — one card per booking with a frozen
          plan: a received-of-total roll-up, the installment stepper, and the
          "Mark payment cleared" gate (enabled only when every installment is
          confirmed, or the booking has no schedule). */}
      {plans.map((p) => {
        const cleared = p.clearedAt != null;
        const steps = p.steps ?? [];
        const canClear = canClearPlan(steps);
        const rollup = computePlanRollup(steps);
        return (
          <div
            key={p.eventVendorId}
            className="sn-row p-4"
          >
            <p className="text-sm font-semibold text-ink">
              Payment plan — {p.vendorLabel}
            </p>
            {p.reservationAcknowledgedAt ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta-700">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Protected by your reservation policy — acknowledged{' '}
                {fmtAckDate(p.reservationAcknowledgedAt)}
              </p>
            ) : null}
            {rollup.total > 0 ? (
              <div className="mt-3 space-y-2 rounded-lg border border-ink/10 bg-paper/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-ink/70">
                    <span className="font-semibold text-ink">{peso(rollup.received)}</span>
                    <span className="text-ink/45"> of </span>
                    <span className="font-semibold text-ink">{peso(rollup.total)}</span>
                    <span className="text-ink/45"> received</span>
                  </p>
                  <p className="font-display text-xl text-ink">{rollup.percentReceived}%</p>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
                  role="progressbar"
                  aria-valuenow={rollup.percentReceived}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Percent of plan received"
                >
                  <div
                    className="h-full rounded-full bg-success-600"
                    style={{ width: `${rollup.percentReceived}%` }}
                  />
                </div>
                <p className="text-xs text-ink/55">
                  {cleared ? (
                    'Plan cleared — nothing outstanding.'
                  ) : rollup.pending > 0 ? (
                    <>
                      <span className="font-medium text-warn-700">
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
                    'All installments confirmed.'
                  )}
                </p>
              </div>
            ) : null}
            <div className="mt-3">
              <PaymentPlanStepper steps={steps} clearedAt={p.clearedAt} />
            </div>
            {!cleared ? (
              <>
                <div className="mt-3">
                  <form action={clearVendorPaymentPlan}>
                    <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                    <input type="hidden" name="thread_id" value={threadId} />
                    <SubmitButton
                      pendingLabel="Clearing…"
                      disabled={!canClear}
                      className="inline-flex h-9 items-center rounded-lg bg-success-700 px-4 text-sm font-medium text-cream hover:bg-success-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark payment cleared
                    </SubmitButton>
                  </form>
                </div>
                {!canClear ? (
                  <p className="mt-2 text-xs text-ink/55">
                    Confirm every installment above before you can mark the plan
                    cleared.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink/55">
                    All installments confirmed — mark the plan cleared to let the
                    couple know nothing more is owed.
                  </p>
                )}
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
