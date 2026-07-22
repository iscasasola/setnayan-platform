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
 */

const IDLE: PhotoChallengeActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

export function PhotoChallengeBuy({
  eventId,
  pricePhp,
}: {
  eventId: string;
  pricePhp: number;
}) {
  const [state, formAction] = useActionState(sponsorPhotoChallenge, IDLE);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />

      <fieldset>
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
        pendingLabel="Starting…"
        className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
      >
        {`Sponsor a Photo Challenge — ${peso(pricePhp)}`}
      </SubmitButton>

      {state.status === 'error' ? (
        <p className="rounded-lg border border-terracotta/25 bg-terracotta/[0.06] px-3 py-2 text-xs text-terracotta">
          {state.message}
        </p>
      ) : null}

      {state.status === 'ordered' ? (
        <div className="rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/75">
          <p className="font-mono text-sm font-bold text-ink">{peso(state.amountPhp)}</p>
          <p className="mt-1">
            Pay to our BDO or GCash account and put{' '}
            <span className="font-mono font-semibold">{state.referenceCode}</span> in the
            transfer note. Photo Challenge unlocks for this event once our team confirms
            your payment (within 24 hours).
          </p>
        </div>
      ) : null}
    </form>
  );
}
