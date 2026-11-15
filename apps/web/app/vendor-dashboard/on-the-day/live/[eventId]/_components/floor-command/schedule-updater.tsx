'use client';

/**
 * The live schedule updater — the coordinator's two floor actions on the
 * run-of-show: call the next block, and CHANGE THE SCHEDULE (owner 2026-11-04 —
 * move a part earlier or later with the parts after it, or skip one; it replaced
 * the +5 · +10 · +15 · +30 push row and "Hold 10 min"). The sheet is
 * `ChangeTheSchedule`, the same one a crew Member's phone draws.
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
import { Clock, PlayCircle, SkipForward } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

import type { AdvanceAction } from '@/lib/floor-command';
import type { ChangeablePart, CrewSkipAsk } from '@/lib/change-the-schedule';
import { driftLabel } from '@/lib/run-of-show';
import { floorAdvanceBlock } from './actions';
import { ChangeTheSchedule } from './change-the-schedule';
import { CrewAsks } from './crew-asks';

type Props = {
  eventId: string;
  action: AdvanceAction;
  remaining: number;
  driftMinutes: number | null;
  /** The run of show as the page already read it — the sheet's Part ▾ list. */
  parts: readonly ChangeablePart[];
  /** 🗓 The coordinator's crew's open skip asks — Decline · Approve, one tap each (owner 2026-11-05). */
  crewAsks?: readonly CrewSkipAsk[];
  /**
   * DAY-8 · say whose schedule this is, to somebody it is not.
   *
   * ⚠ DEFAULTS FALSE SO THE COORDINATOR'S SURFACE RENDERS BYTE-IDENTICALLY.
   * Running the programme IS the coordinator's job — they do not need telling
   * that the night belongs to the couple. The host/MC is a different case: the
   * couple lent him one area out of a grid, he can hand it back, and a control
   * that appears with no explanation reads as "this is mine now".
   */
  onLoan?: boolean;
};

export function ScheduleUpdater({
  eventId,
  action,
  remaining,
  driftMinutes,
  parts,
  crewAsks = [],
  onLoan = false,
}: Props) {
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


  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Clock aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
          The running order
        </h4>
        <span className="text-sm tabular-nums text-[color:var(--m-slate-2)]">
          {remaining} {remaining === 1 ? 'block' : 'blocks'} left
          {drift ? ` · ${drift}` : ''}
        </span>
      </div>

      {/* The loan, in one sentence, ABOVE the controls rather than under them —
          it is the frame for everything below it, not a footnote to be found
          after the schedule has already been moved. */}
      {onLoan ? (
        <p className="text-sm leading-snug text-[color:var(--m-slate-2)]">
          The couple&rsquo;s running order, shared with you for tonight. What you move here moves for everyone.
        </p>
      ) : null}

      {action.kind === 'empty' ? (
        <p className="text-sm text-[color:var(--m-slate-2)]">
          The couple hasn’t built a run-of-show yet, so there’s nothing to call.
        </p>
      ) : action.kind === 'all_done' ? (
        <p className="text-sm text-[color:var(--m-slate-2)]">Every block has run. Nothing left to call.</p>
      ) : (
        <>
          <ActionButton
            tone="brand"
            main
            icon={action.kind === 'start' ? PlayCircle : SkipForward}
            label={
              action.kind === 'start'
                ? `Start ${action.label}`
                : action.nextLabel
                  ? `Finish ${action.label} → ${action.nextLabel}`
                  : `Finish ${action.label}`
            }
            onClick={advance}
            waiting={pending}
            className="w-full"
          />

          <ChangeTheSchedule eventId={eventId} parts={parts} className="w-full" />
          <CrewAsks eventId={eventId} asks={crewAsks} />
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
      {note ? <p className="text-sm text-success-700">{note}</p> : null}
    </section>
  );
}
