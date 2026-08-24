'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  sponsorPhotoChallenge,
  type PhotoChallengeActionState,
} from '../photo-challenge-actions';

/**
 * "Sponsor a Photo Challenge · ₱400" — the buy surface on a booked vendor's view
 * of a Papic-active event. Apply-then-pay (BDO/GCash) that a Setnayan admin
 * confirms; on approval the vendor may author custom challenges for the event.
 * Owner-locked 2026-07-22: ₱400 / event, Pro/Enterprise + verified + booked +
 * Papic active. No free cycle (per-event, not a subscription).
 *
 * `free` = "free until your 6th booking" is active for this vendor (owner
 * 2026-07-25): no pay channel is collected and the sponsorship activates
 * IMMEDIATELY rather than waiting on an admin confirming a payment.
 */

const IDLE: PhotoChallengeActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export function PhotoChallengeBuy({
  eventId,
  pricePhp,
  free = false,
}: {
  eventId: string;
  pricePhp: number;
  free?: boolean;
}) {
  const [state, formAction] = useActionState(sponsorPhotoChallenge, IDLE);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      {/* A ₱0 grant collects no payment, so it needs no channel. */}
      <fieldset className={free ? 'hidden' : undefined} disabled={free}>
        <legend className="text-xs font-medium text-ink">Pay with</legend>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
            <input type="radio" name="channel" value="bdo" defaultChecked />
            BDO
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
            <input type="radio" name="channel" value="gcash" />
            GCash
          </label>
        </div>
      </fieldset>

      <SubmitButton
        pendingLabel={free ? 'Turning on…' : 'Starting…'}
        className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
      >
        {free
          ? 'Turn on Papic Challenges — free'
          : `Sponsor Papic Challenges — ${peso(pricePhp)}`}
      </SubmitButton>

      {state.status === 'error' ? (
        <p className="rounded-lg border border-terracotta/25 bg-terracotta/[0.06] px-3 py-2 text-xs text-terracotta-700">
          {state.message}
        </p>
      ) : null}

      {state.status === 'activated' ? (
        <p className="rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/75">
          {state.message}
        </p>
      ) : null}

    </form>
  );
}
