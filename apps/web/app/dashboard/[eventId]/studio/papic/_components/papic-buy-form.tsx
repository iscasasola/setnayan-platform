'use client';

import { useCallback, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CreditStepper, type StepperRung } from './credit-stepper';
import { SubmitButton } from '@/app/_components/submit-button';
import { purchasePapicPoolTopUp } from '../actions';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * THE ONE CREDIT FORM — the shipped − / + stepper, the one added line "After
 * this: N credits", and "Continue to payment" (owner "approve all", 2026-10-14,
 * prototype `renderBuySheet`). It lives in the Buy more sheet on Home AND on the
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
  /** Credits left now — null when not measured (then "After this" is not said). */
  left: number | null;
}) {
  const [adds, setAdds] = useState<number | null>(rungs[0]?.points ?? null);
  const onRung = useCallback((r: StepperRung) => setAdds(r.points), []);
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
          <span>After this</span>
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
          Continue to payment
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
