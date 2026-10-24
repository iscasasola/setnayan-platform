'use client';

import { useCallback, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CreditStepper, type StepperRung } from './credit-stepper';
import { SubmitButton } from '@/app/_components/submit-button';
import { purchasePapicPoolTopUp } from '../actions';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * THE ONE CREDIT FORM — the shipped − / + stepper, "New total: N credits", and ONE
 * button that names the result, "Add N credits · ₱X" (owner "approve all", 2026-10-14,
 * prototype `renderBuySheet`; owner 2026-10-24: *"it should just ask how much they
 * want to add more and purchase … New total: and purchase button"* — no "How many do
 * I need?", no range line, no "Not now"). It lives in the Buy more sheet on Home AND on the
 * Papic page: one form, so the two can never sell one ladder two ways.
 *
 * The rungs arrive already read and sorted (`loadPoolRungs`). The form posts
 * the SERVICE CODE only; `purchasePapicPoolTopUp` re-reads the price itself.
 */
export function PapicBuyForm({
  eventId,
  rungs,
  left,
}: {
  eventId: string;
  rungs: readonly PoolRung[];
  /** Credits left now — null when not measured (then "New total" is not said). */
  left: number | null;
}) {
  const [adds, setAdds] = useState<number | null>(rungs[0]?.points ?? null);
  const [shown, setShown] = useState<StepperRung | null>(rungs[0] ?? null);
  const onRung = useCallback((r: StepperRung) => {
    setAdds(r.points);
    setShown(r);
  }, []);
  if (rungs.length === 0) return null;
  return (
    <form action={purchasePapicPoolTopUp}>
      <input type="hidden" name="event_id" value={eventId} />

      {/* ⚠ A DROPDOWN MADE THE PERSON READ SIXTEEN SENTENCES TO FIND ONE
          NUMBER. Owner 2026-08-28: *"we want a +- value and they will see how
          much will be added."* The stepper walks the SAME rungs. */}
      <CreditStepper rungs={rungs} onRungChange={onRung} />

      {left !== null && adds !== null ? (
        <div className="sg-after" data-papic-after="">
          <span>New total</span>
          <b>{(left + adds).toLocaleString('en-PH')} credits</b>
        </div>
      ) : null}

      {/* ONE PRESS, ONE BILL (2026-10-13 · #6527). It locks the moment it is
          pressed and says the one step that is happening until the payment page
          opens. The server half (a repeat press lands on the same bill) is in
          lib/one-press-one-order.ts. */}
      <div className="mt-3.5">
        <SubmitButton
          overlay={false}
          pendingLabel="Opening payment…"
          className="ab ab-brand ab-main sg-pay inline-flex min-h-11 w-full items-center justify-center"
        >
          {/* ONE Buy button that names the result (owner 2026-10-23). */}
          {shown ? `Add ${shown.points.toLocaleString('en-PH')} credits · ${shown.priceLabel ?? `₱${shown.pricePhp.toLocaleString('en-PH')}`}` : 'Continue to payment'}
        </SubmitButton>
        <PayStep />
      </div>
    </form>
  );
}

/** The one line that names the step while the payment page opens. */
function PayStep() {
  const { pending } = useFormStatus();
  return (
    <p className="sg-step" aria-live="polite">
      {pending ? 'Taking you to GCash, card or bank — one order, never two.' : ''}
    </p>
  );
}
