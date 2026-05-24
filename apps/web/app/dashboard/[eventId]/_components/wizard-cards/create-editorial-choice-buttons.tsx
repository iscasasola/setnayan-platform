'use client';

/**
 * Two-button choice surface for Card 38 Create Editorial. Each button
 * calls the generic markTaskDone server action with a per-card meta_
 * field that the editorial-broadcast pipeline (iteration 0046) reads to
 * flip the Phase 4 public/private state.
 */

import { useState, useTransition } from 'react';
import { Globe, Lock } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = { eventId: string };

export function CreateEditorialChoiceButtons({ eventId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [pendingChoice, setPendingChoice] = useState<'public' | 'private' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleChoice(choice: 'public' | 'private') {
    setErrorMessage(null);
    setPendingChoice(choice);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'create_editorial');
    formData.set('meta_opt_in', choice);
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your choice. Try again.";
        setErrorMessage(message);
        setPendingChoice(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => handleChoice('public')}
          disabled={isPending}
          className="inline-flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Globe aria-hidden className="h-4 w-4" strokeWidth={2} />
          {pendingChoice === 'public' ? 'Saving…' : 'Publish my editorial'}
        </button>
        <button
          type="button"
          onClick={() => handleChoice('private')}
          disabled={isPending}
          className="inline-flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
          {pendingChoice === 'private' ? 'Saving…' : 'Keep it private'}
        </button>
      </div>
    </div>
  );
}
