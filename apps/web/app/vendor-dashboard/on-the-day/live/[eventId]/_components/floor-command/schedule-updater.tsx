'use client';

/**
 * The live schedule updater — the coordinator's two floor actions on the
 * run-of-show: call the next block, and push everything back when the room
 * runs late.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * Not a timeline. `RunOfShowHeader` (now/next + drift, live over Realtime) and
 * `FloorClock` (countdown) already render ABOVE this on the same page, and
 * both stay. This adds only the ACT — `page.tsx` mounts RunOfShowHeader without
 * `canAdvance`, so until now the coordinator could watch the schedule and not
 * touch it. Rendering a third view of the same blocks here would be a
 * duplicate that can disagree with the two above it.
 *
 * The button's label comes from `nextAdvanceAction`, which mirrors what
 * `advance_schedule_block` will really do — so the button never promises a
 * step the database will refuse.
 */

import { useState, useTransition } from 'react';
import { Clock, Loader2, PlayCircle, SkipForward } from 'lucide-react';

import { RETIME_PRESETS, type AdvanceAction } from '@/lib/floor-command';
import { driftLabel } from '@/lib/run-of-show';
import { floorAdvanceBlock, floorRetimeFrom } from './actions';

type Props = {
  eventId: string;
  action: AdvanceAction;
  remaining: number;
  driftMinutes: number | null;
};

export function ScheduleUpdater({ eventId, action, remaining, driftMinutes }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const drift = driftLabel(driftMinutes);
  const actionable = action.kind === 'start' || action.kind === 'finish';

  function advance() {
    if (!actionable) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await floorAdvanceBlock(eventId, action.blockId);
      if (!res.ok) setError(res.error ?? 'Could not advance.');
      else if (res.message) setNote(res.message);
    });
  }

  function retime(minutes: number) {
    if (!actionable) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await floorRetimeFrom(eventId, action.blockId, minutes);
      if (!res.ok) setError(res.error ?? 'Could not move the schedule.');
      else setNote(res.message ?? 'Schedule moved.');
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Clock aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
          The running order
        </h4>
        <span className="text-xs text-ink/55">
          {remaining} {remaining === 1 ? 'block' : 'blocks'} left
          {drift ? ` · ${drift}` : ''}
        </span>
      </div>

      {action.kind === 'empty' ? (
        <p className="text-sm text-ink/55">
          The couple hasn’t built a run-of-show yet, so there’s nothing to call.
        </p>
      ) : action.kind === 'all_done' ? (
        <p className="text-sm text-ink/55">Every block has run. Nothing left to call.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={advance}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : action.kind === 'start' ? (
              <PlayCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <SkipForward aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            )}
            {action.kind === 'start'
              ? `Start ${action.label}`
              : action.nextLabel
                ? `Finish ${action.label} → ${action.nextLabel}`
                : `Finish ${action.label}`}
          </button>

          <div className="space-y-1.5">
            <p className="text-xs text-ink/55">
              Running late? Push {action.kind === 'start' ? action.label : action.label} and
              everything after it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RETIME_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => retime(m)}
                  disabled={pending}
                  className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink/80 transition hover:border-terracotta hover:text-ink disabled:opacity-40"
                >
                  +{m}m
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {error}
        </p>
      ) : null}
      {note ? <p className="text-sm text-success-700">{note}</p> : null}
    </section>
  );
}
