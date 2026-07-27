'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import { advanceScheduleBlock } from '@/app/_actions/run-of-show';

/**
 * The advance control — the coordinator's one write on the live floor console.
 *
 * WHY IT EXISTS HERE AND NOT ON THE HEADER. `RunOfShowHeader` already carries
 * an advance control, but it is gated behind a `canAdvance` prop that defaults
 * to `false`, and the live console mounts the header WITHOUT it. So on the
 * fullscreen, wake-locked screen a coordinator actually holds while running the
 * night, there is no way to move the show along at all. This is that control —
 * not a second copy of one, the only one on this page.
 *
 * IT SAYS WHAT IT DOES. Advancing writes `run_state`, and `run_state` is what
 * every other screen follows: the guest "what's happening now" card, the
 * realtime header, and the host/MC cue card, which reads "You're on: <block>"
 * from this pointer alone. A coordinator tapping this is cueing the emcee, so
 * the button says so. A control with an invisible blast radius is one people
 * are afraid to press.
 *
 * AUTHORISATION IS THE RPC'S, NOT THIS COMPONENT'S. `advance_schedule_block`
 * self-gates (host / coordinator / booked vendor / admin) and is single-winner
 * and idempotent, so a double tap or a race with the couple's own screen is a
 * benign no-op. Rendering this button is not permission to advance — hiding it
 * would not be a boundary either (2026-07-26 security review).
 */
export function AdvanceControl({
  eventId,
  blockId,
  currentLabel,
  nextLabel,
}: {
  eventId: string;
  blockId: string;
  currentLabel: string | null;
  nextLabel: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go() {
    setError(null);
    start(async () => {
      const res = await advanceScheduleBlock(eventId, blockId);
      if (res.status === 'error') {
        setError('Could not advance. Try again — nothing was changed.');
        return;
      }
      if (res.status === 'not_signed_in') {
        setError('Your session expired. Sign in again to advance.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="flex w-full items-center justify-between gap-3 border border-gild/45 bg-gild/10 px-4 py-3 text-left transition-colors hover:bg-gild/20 disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block font-pahina text-lg font-light leading-snug tracking-tight text-ink">
            {nextLabel ? `Move on to ${nextLabel}` : 'End the current block'}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink/65">
            {currentLabel ? `Ends “${currentLabel}”. ` : ''}
            Everyone&rsquo;s screen follows — including your emcee&rsquo;s cue card.
          </span>
        </span>
        {pending ? (
          <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin text-ink/60" strokeWidth={1.75} />
        ) : (
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-gild" strokeWidth={1.75} />
        )}
      </button>
      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
