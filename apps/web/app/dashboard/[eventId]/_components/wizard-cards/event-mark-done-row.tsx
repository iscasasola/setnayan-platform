'use client';

/**
 * Mark-done CTA for Card 34 Event. Uses the generic markTaskDone server
 * action (PR #472).
 *
 * Pre-event copy: "Looking forward · mark done after the wedding"
 * Post-event copy: "Mark wedding day done · move on to thank-yous"
 */

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  eventHasPassed: boolean;
};

export function EventMarkDoneRow({ eventId, eventHasPassed }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'event');
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark this done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div>
      {errorMessage ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleMarkDone}
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isPending
          ? 'Saving…'
          : eventHasPassed
          ? 'We had our wedding'
          : 'Acknowledge · move forward'}
      </button>
      {!eventHasPassed ? (
        <p className="mt-2 text-xs text-ink/55">
          You can mark this done anytime — Setnayan keeps tracking everything
          you locked, and the post-event cards appear once the wedding has
          happened.
        </p>
      ) : null}
    </div>
  );
}
