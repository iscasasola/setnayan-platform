'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { setPoolGalleryOpen } from './pool-gallery-actions';

/**
 * The Shared Pool Gallery open/close switch — client half of PoolGalleryCard.
 * Calls the COUPLE-ONLY server action; a coordinator (or any non-couple
 * member) gets 'forbidden' and the switch snaps back with the error shown.
 */
export function PoolGalleryToggle({
  eventId,
  initialOpen,
}: {
  eventId: string;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flip() {
    const next = !open;
    setError(null);
    startTransition(async () => {
      const res = await setPoolGalleryOpen(eventId, next);
      if (res.ok) {
        setOpen(res.open);
      } else {
        setError(
          res.error === 'forbidden'
            ? 'Only the couple can open or close the shared gallery.'
            : 'That didn’t save — try again.',
        );
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={open}
        onClick={flip}
        disabled={isPending}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
          open
            ? 'bg-mulberry text-cream hover:bg-mulberry-600'
            : 'bg-ink/5 text-ink/80 hover:bg-ink/10'
        }`}
      >
        {isPending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : null}
        {open ? 'Open to guests — tap to close' : 'Closed — tap to open to guests'}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-terracotta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
