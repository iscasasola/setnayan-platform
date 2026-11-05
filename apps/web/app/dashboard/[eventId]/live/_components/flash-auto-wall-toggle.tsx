'use client';

import { useTransition } from 'react';
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

  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <span className="text-sm text-ink/75">
        <span className="font-medium text-ink">Flash to Memory lane</span>
        <span className="ml-1.5 text-ink/50">
          {enabled ? '— Flash stories post automatically after 5 s' : '— off, Flash goes to review queue'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        // The wrapping <label> names native form controls, not a <button>, so
        // the switch needs its own accessible name.
        aria-label="Flash to Memory lane"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await toggleFlashAutoWall(eventId, !enabled);
          })
        }
        className={SWITCH_BUTTON}
      >
        <SwitchTrack on={enabled} />
      </button>
    </label>
  );
}
