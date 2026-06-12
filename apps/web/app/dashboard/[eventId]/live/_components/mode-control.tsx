'use client';

/**
 * Wall lifecycle override — the day-of "force it" control (P3). Auto derives
 * the mode from the event date server-side; an override always wins
 * (resolveWallMode). The two real day-of moments: open the wall EARLY
 * (Live before the auto window) and freeze it to the Recap collage when the
 * program ends. Teaser covers the rehearsal-dinner "it's coming" screen.
 */

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { WallMode } from '@/lib/live-wall-logic';
import { setWallMode } from '../actions';

const CHOICES: Array<{ value: WallMode | null; label: string; hint: string }> = [
  { value: null, label: 'Auto', hint: 'follows your wedding date' },
  { value: 'pre_event', label: 'Teaser', hint: 'join QR + countdown' },
  { value: 'live', label: 'Live', hint: 'photos as they happen' },
  { value: 'recap', label: 'Recap', hint: 'frozen highlight collage' },
];

export function WallModeControl({
  eventId,
  override,
  resolved,
}: {
  eventId: string;
  /** The stored override (null = Auto). */
  override: WallMode | null;
  /** What the wall is actually showing right now (override or derived). */
  resolved: WallMode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (value: WallMode | null) => {
    if (pending || value === override) return;
    setError(null);
    startTransition(async () => {
      const result = await setWallMode(eventId, value);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Wall mode">
        {CHOICES.map((choice) => {
          const active = choice.value === override;
          return (
            <button
              key={choice.label}
              type="button"
              disabled={pending}
              onClick={() => pick(choice.value)}
              title={choice.hint}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active
                  ? 'bg-mulberry text-cream'
                  : 'border border-ink/15 bg-surface text-ink/70 hover:border-ink/35 hover:text-ink'
              }`}
            >
              {choice.label}
            </button>
          );
        })}
        {pending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin text-ink/40" strokeWidth={2} />
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-ink/55">
        Showing now: <span className="font-medium text-ink/80">{resolved.replace('_', '-')}</span>
        {override === null ? ' (auto)' : ' (manual override)'}
      </p>
      {error ? <p className="mt-1 text-xs text-terracotta">{error}</p> : null}
    </div>
  );
}
