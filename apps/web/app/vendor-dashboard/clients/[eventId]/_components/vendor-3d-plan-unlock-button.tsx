'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  unlockVendor3dPlanForCouple,
  type Vendor3dPlanUnlockActionState,
} from '../vendor-3d-plan-unlock-actions';

/**
 * "Unlock the 3D Plan for this couple" — the vendor CTA on a booked event where
 * the vendor holds an ACTIVE 3D Booth add-on. FREE + unlimited (the ₱1,500/28d
 * add-on is the charge). Unlocking marks the event eligible for the couple's
 * DISCOUNTED ₱1,000 SEATING_3D purchase; the couple then buys + publishes on
 * their own. Idempotent — a second unlock returns the same success state.
 */

const IDLE: Vendor3dPlanUnlockActionState = { status: 'idle' };

export function Vendor3dPlanUnlockButton({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState(unlockVendor3dPlanForCouple, IDLE);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      <SubmitButton
        pendingLabel="Unlocking…"
        className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
      >
        Unlock the 3D Plan for this couple
      </SubmitButton>

      {state.status === 'error' ? (
        <p className="rounded-lg border border-terracotta/25 bg-terracotta/[0.06] px-3 py-2 text-xs text-terracotta">
          {state.message}
        </p>
      ) : null}

      {state.status === 'unlocked' ? (
        <p className="rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/75">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
