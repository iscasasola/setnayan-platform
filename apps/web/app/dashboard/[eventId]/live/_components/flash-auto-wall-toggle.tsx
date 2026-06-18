'use client';

import { useTransition } from 'react';
import { toggleFlashAutoWall } from '../actions';

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
        <span className="font-medium text-ink">Flash auto-wall</span>
        <span className="ml-1.5 text-ink/50">
          {enabled ? '— Flash stories post automatically after 5 s' : '— off, Flash goes to review queue'}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await toggleFlashAutoWall(eventId, !enabled);
          })
        }
        className={[
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2',
          enabled ? 'bg-terracotta' : 'bg-ink/20',
          pending ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  );
}
