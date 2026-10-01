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
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

const CHOICES: Array<{ value: WallMode | null; label: string; hint: string }> = [
  { value: null, label: 'Auto', hint: 'follows your event date' },
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
      {/* ONE dropdown (owner rule 2026-09-28: a choice of several is a
          dropdown, never a pill row). Each option carries its hint beside it,
          which the pills could only show on hover. `Auto` is keyed 'auto'
          because a PickMenu key is a string; it maps back to null. */}
      <div className="flex items-center gap-2">
        <PickMenu
          label="Wall mode"
          value={override ?? 'auto'}
          dataAttr="data-wall-mode"
          options={CHOICES.map((choice) => ({
            key: choice.value ?? 'auto',
            label: `${choice.label} — ${choice.hint}`,
          }))}
          buttonText={CHOICES.find((c) => c.value === override)?.label}
          onPick={(key) => pick(key === 'auto' ? null : (key as WallMode))}
          className="border border-ink/15"
        />
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
