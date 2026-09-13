'use client';

/**
 * remove-guest-confirm.tsx — the quick view's Remove, behind one deliberate
 * second tap.
 *
 * WHY THIS EXISTS. The quick view (the below-xl sheet and the desktop inspector
 * column) gained a Remove on 2026-09-06. It shipped as a single unguarded tap on
 * a full-width danger button sitting DIRECTLY BENEATH the full-width "Open full
 * details" button — two stacked full-width targets, the lower one destructive,
 * on a panel a host opens casually while scanning a roster. Every other delete
 * path in this feature has a guard and that one had none:
 *
 *   · mobile swipe-to-delete — the swipe IS the confirmation (iOS-style)
 *   · desktop bulk delete    — optimistic remove + a 6s undo snackbar
 *   · quick view             — nothing
 *
 * AND IT IS NOT FULLY UNDOABLE, which is what makes the missing guard matter.
 * `softDeleteGuest` soft-deletes the guest (`deleted_at`, recoverable) but HARD
 * deletes their `event_seat_assignments` row first. The desktop bulk path
 * captures the released seats so its undo can put them back; this single-guest
 * path does not. So a mis-tap costs the seat placement permanently even if the
 * guest themself is restored. A confirm is cheaper than the undo machinery and
 * closes the actual hole.
 *
 * WHY TWO TAPS RATHER THAN A DIALOG. The panel is already an overlay; stacking a
 * modal on an overlay is where focus management goes wrong, and the sheet's own
 * `useModalA11y` would be fighting a second trap. One button that changes its
 * own label is the smallest thing that makes the second tap deliberate. It
 * disarms itself after ARM_MS so a forgotten armed button cannot lie in wait.
 */

import { useEffect, useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { softDeleteGuest } from '../[guestId]/actions';

/** How long the armed state survives without a second tap. */
const ARM_MS = 4000;

export function RemoveGuestConfirm({
  eventId,
  guestId,
  guestName,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
}) {
  const [armed, setArmed] = useState(false);

  // Disarm on a timer. Without this, arming and then scrolling away leaves a
  // one-tap delete sitting on screen — the exact hazard this file removes.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <form
      action={softDeleteGuest.bind(null, eventId, guestId)}
      className="mt-4 border-t border-ink/10 pt-3"
    >
      {armed ? (
        <>
          <SubmitButton
            overlay={false}
            pendingLabel="Removing…"
            aria-label={`Confirm removing ${guestName}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-danger-600 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-danger-700"
          >
            Tap again to remove
          </SubmitButton>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="mt-1.5 inline-flex w-full items-center justify-center rounded-lg px-4 py-1.5 text-xs font-medium text-ink/60 hover:text-ink"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          aria-label={`Remove ${guestName}`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-danger-300/70 px-4 py-2.5 text-sm font-medium text-danger-700 hover:border-danger-400 hover:bg-danger-100"
        >
          Remove guest
        </button>
      )}
      {/* Announce the arm, so the change is not visual-only. */}
      <p aria-live="polite" className="sr-only">
        {armed ? `Removing ${guestName} needs one more tap.` : ''}
      </p>
    </form>
  );
}
