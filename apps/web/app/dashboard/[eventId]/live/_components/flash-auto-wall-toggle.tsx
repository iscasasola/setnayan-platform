'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toggleFlashAutoWall } from '../actions';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

export function FlashAutoWallToggle({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  /* 📍 Shown at once, saved behind it; a refusal is said here and the switch goes back (owner 2026-10-26). */
  const [shown, setShown] = useOptimistic(enabled);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <span className="text-sm text-ink/75">
        <span className="font-medium text-ink">Flash to Memory lane</span>
        <span className="ml-1.5 text-ink/50">
          {shown ? '— Flash stories post automatically after 5 s' : '— off, Flash goes to review queue'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        // The wrapping <label> names native form controls, not a <button>, so
        // the switch needs its own accessible name.
        aria-label="Flash to Memory lane"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setShown(!shown);
            const r = await toggleFlashAutoWall(eventId, !shown);
            if (!r.ok) setError(r.error);
          })
        }
        className={SWITCH_BUTTON}
      >
        <SwitchTrack on={shown} />
      </button>
    </label>
    {error ? <p role="alert" className="mt-1 text-xs text-terracotta">{error}</p> : null}
    </>
  );
}
