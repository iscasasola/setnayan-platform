'use client';

import { useState } from 'react';
import { Explain } from '@/app/_components/explain';
import { actionButtonClass } from '@/components/action-button';
import { CardSubmit } from './guest-card-rows';

/**
 * 🔁 THE SEAT'S TWO DOORS, ONE LINE (owner 2026-11-02: *"simplify access just like the rest of the guest card"*):
 * [Give this spot…] and [Take this seat back] side by side, what each does behind the line's ⓘ. Give opens its name
 * field and its Give only on a tap, and only while the guest has not replied (`canGive`). Both post the card's ONE
 * release door (`releaseGuestClaim` — `swap_name` gives the spot, none takes the seat back), unchanged.
 * Held by `the-access-row-is-three-lines.test.ts`.
 */
export function GuestSeatDoors({
  name,
  canGive,
  releaseAction,
}: {
  name: string;
  /** Only while they have not replied — a guest who answered cannot be swapped. */
  canGive: boolean;
  releaseAction: (formData: FormData) => void | Promise<void>;
}) {
  const [giving, setGiving] = useState(false);
  return (
    <div className="space-y-2 py-2" data-seat-doors="">
      <div className="flex items-center gap-2">
        {canGive ? (
          <button
            type="button"
            className={actionButtonClass('neutral', { extra: 'min-h-11 flex-1' })}
            aria-expanded={giving}
            onClick={() => setGiving((g) => !g)}
            data-give-spot-open=""
          >
            Give this spot…
          </button>
        ) : null}
        <form action={releaseAction} className="flex-1">
          <CardSubmit ariaLabel={`Take back ${name}'s seat — new QR and unlink their account`} pendingLabel="Taking back…">
            Take this seat back
          </CardSubmit>
        </form>
        <Explain title="This seat">
          {canGive ? (
            <>
              Give this spot: the new person takes {name}&rsquo;s table, seats and place in the count. {name}&rsquo;s link
              and QR stop working; they are not notified. Only while they have not replied.{' '}
            </>
          ) : null}
          Take this seat back: a new QR, and their account is unlinked.
        </Explain>
      </div>
      {canGive && giving ? (
        <form action={releaseAction} className="flex items-end gap-2" data-give-spot="">
          <label className="block min-w-0 flex-1">
            <span className="text-xs font-medium text-ink/60">Who takes it?</span>
            <input
              // field-ok: the card's one native box, moved here unchanged — its `required` is what stops an empty swap falling through to Take back (the-templated-card-holds-no-hand-made-control.test.ts)
              name="swap_name"
              required
              autoComplete="off"
              autoFocus
              placeholder="First and last name"
              className="input-field mt-1 w-full"
            />
          </label>
          <div className="shrink-0">
            <CardSubmit main pendingLabel="Giving…">
              Give
            </CardSubmit>
          </div>
        </form>
      ) : null}
    </div>
  );
}
