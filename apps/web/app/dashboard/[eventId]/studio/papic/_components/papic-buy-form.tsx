'use client';

import { CreditStepper } from './credit-stepper';
import { SubmitButton } from '@/app/_components/submit-button';
import { purchasePapicPoolTopUp } from '../actions';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * THE ONE CREDIT FORM — the shipped stepper and its "Continue to payment",
 * shared by the Papic page's `PapicPoolCard` and Home's in-place "Buy more"
 * (owner 2026-10-13 📍: Buy more opens the existing stepper in place → /pay,
 * no new checkout). One form, so the two can never sell one ladder two ways.
 *
 * The rungs arrive already read and sorted (`loadPoolRungs`). The form posts
 * the SERVICE CODE only; `purchasePapicPoolTopUp` re-reads the price itself.
 */
export function PapicBuyForm({ eventId, rungs }: { eventId: string; rungs: readonly PoolRung[] }) {
  if (rungs.length === 0) return null;
  return (
    <form action={purchasePapicPoolTopUp} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      {/* ⚠ A DROPDOWN MADE THE PERSON READ SIXTEEN SENTENCES TO FIND ONE
          NUMBER. Owner 2026-08-28: *"we want a +- value and they will see how
          much will be added."* The stepper walks the SAME rungs — a different
          control over the identical ladder, never a second price list. */}
      <CreditStepper rungs={rungs} />

      {/* ONE PRESS, ONE BILL (2026-10-13). It locks the moment it is pressed
          and says the one step that is happening until the payment page
          opens. The server half (a repeat press lands on the same bill) is in
          lib/one-press-one-order.ts. */}
      <SubmitButton
        overlay={false}
        pendingLabel="Opening payment…"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800 disabled:opacity-80"
      >
        Continue to payment
      </SubmitButton>
    </form>
  );
}
