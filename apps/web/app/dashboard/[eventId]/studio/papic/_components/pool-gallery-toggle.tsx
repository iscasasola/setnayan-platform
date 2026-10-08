'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { setPoolGalleryOpen } from './pool-gallery-actions';
import { SwitchTrack } from '@/app/_components/switch-track';

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
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-ink disabled:opacity-60"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {isPending ? (
            <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2} />
          ) : null}
          {open ? 'Open to guests — tap to close' : 'Closed — tap to open to guests'}
        </span>
        {/* The app's one switch (owner 2026-10-08) — the words stay; the fill that said "on" is the track's now. */}
        <SwitchTrack on={open} />
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-terracotta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
