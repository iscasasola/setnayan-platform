'use client';

/**
 * Accept or Decline ONE proposed change, in place (owner 8 Nov 2026). Accept applies the change in the same
 * transaction that marks it (`answer_event_change_request`); Decline changes nothing. The row stays on screen with its
 * answer — a save never resets the screen — and a refusal is said, never shown as done.
 */
import { useState, useTransition } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { changeRequestAction } from '@/app/_actions/change-request-actions';

export function ChangeDecision({ eventId, changeId }: { eventId: string; changeId: string }) {
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await changeRequestAction(eventId, { op: 'answer', changeId, accept });
      if (!res.ok) setError(res.error ?? 'Could not record that.');
      else setDone(accept ? 'accepted' : 'declined');
    });
  }

  if (done) {
    return (
      <p className="text-sm text-ink/65" data-change-decided={done}>
        {done === 'accepted' ? 'Accepted — the change is in.' : 'Declined — nothing changed.'}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => decide(true)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
      >
        {pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />}
        Accept
      </button>
      <button
        type="button"
        onClick={() => decide(false)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink/70 transition hover:border-warn-600 disabled:opacity-40"
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> Decline
      </button>
      {error ? (
        <p role="alert" className="w-full rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
