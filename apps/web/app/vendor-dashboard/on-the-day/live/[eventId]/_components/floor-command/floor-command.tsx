import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { buildFloorCommand } from '@/lib/floor-command';
import type { DayRequestRow } from '@/lib/day-requests';
import { getDayRequestsView } from '../../../../actions';
import { IssuesLog } from '../../../../_components/issues-log';
import { ConsoleRule } from '../../../../_components/pahina-console';
import { AdvanceControl } from './advance-control';
import type { SpecializationSurfaceProps } from '../specialization-registry';

/**
 * RUN THE FLOOR — the day-of specialization for a coordinator.
 *
 * WHAT THIS DESK BUILDS, AND WHAT IT REFUSES TO REBUILD. Almost every tool a
 * coordinator needs already shipped; the audit before this component found
 * only two genuine holes, and this closes exactly those:
 *
 *   ✗ the timeline — `RunOfShowHeader` and `FloorClock` render ABOVE this on
 *     the same page. A third view of the same blocks could disagree with them.
 *   ✗ the inbox's own machinery — `requests-inbox.tsx` is already
 *     coordinator-aware by construction, and `lib/day-requests.ts` already
 *     owns sorting, summarising and the status machine. Both reused whole.
 *   ✗ the local issues log — `IssuesLog` already swaps itself to the shared
 *     inbox when the server says the stream is live, and stays a device-local
 *     log when it is not. That fallback is why it is mounted here rather than
 *     `RequestsInbox` directly: a coordinator on venue wifi keeps a working
 *     log either way.
 *
 *   ✓ HOLE 1 — the inbox was a LINK AWAY. `moduleHref('issues_log')` sends the
 *     coordinator back to `/vendor-dashboard/on-the-day`, i.e. out of the
 *     fullscreen wake-locked console they are standing in, to reach the one
 *     tool they use most. It is now inline.
 *   ✓ HOLE 2 — they could not ADVANCE. `RunOfShowHeader`'s advance control is
 *     gated behind `canAdvance`, which the live page never passes. The person
 *     running the floor could not move the show along from the floor console,
 *     while every other screen — including the host/MC cue card — waits on that
 *     pointer. See `advance-control.tsx`.
 *   ✓ HOLE 3 — nothing crossed "what's open" against "where the show is".
 *     `lib/floor-command.ts` makes that one call: late AND unresolved is the
 *     single state where pushing costs more than it saves.
 *
 * RENDERED INSIDE THE SLOT'S PLATE. `specialization-slot.tsx` already wraps
 * this in a `ConsolePlate` with the set's label, so this starts at content and
 * adds no outer plate or title.
 *
 * ITS OWN DATA BOUNDARY. The frame mounts this only for an entitled, booked,
 * authenticated coordinator — which is not authorisation for these reads.
 * `fetchRunOfShowBlocks` and `getDayRequestsView` both run under the caller's
 * own RLS and are scoped to `eventId`; `getDayRequestsView` additionally
 * fail-closes to an inactive view. No admin client on this path.
 */
export async function FloorCommand({ eventId, coupleName }: SpecializationSurfaceProps) {
  const supabase = await createClient();

  // Independent reads → one batch. The requests view is best-effort by design:
  // it fail-closes to inactive before its migration is pushed, and the desk
  // must still render the run-of-show half in that state.
  const [blocks, view] = await Promise.all([
    fetchRunOfShowBlocks(eventId),
    getDayRequestsView(eventId).catch(() => null),
  ]);

  const rows: readonly DayRequestRow[] =
    view && view.active && Array.isArray(view.rows) ? view.rows : [];

  const model = buildFloorCommand({ rows, blocks: blocks ?? [] });

  return (
    <div className="space-y-4">
      {/* The call: push, or fix first. */}
      <div>
        <p className="font-pahina text-xl font-light leading-snug tracking-tight text-ink">
          {model.headline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {model.drift ? (
            <span
              className={`font-mono text-[0.66rem] uppercase tracking-[0.16em] ${
                model.behind ? 'text-terracotta-700' : 'text-ink/60'
              }`}
            >
              Running {model.drift}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/60">
            {model.openWork > 0 ? (
              <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-terracotta-700" strokeWidth={1.9} />
            ) : (
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.9} />
            )}
            {model.openWork} open
          </span>
          {model.statusUpdates > 0 ? (
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/50">
              {model.statusUpdates} status {model.statusUpdates === 1 ? 'ping' : 'pings'}
            </span>
          ) : null}
        </div>
      </div>

      {/* The one write: move the show along. Only when there is a live block —
          otherwise there is nothing an advance would act on. */}
      {model.canAdvanceNow && model.advanceBlockId ? (
        <AdvanceControl
          eventId={eventId}
          blockId={model.advanceBlockId}
          currentLabel={model.currentLabel}
          nextLabel={model.nextLabel}
        />
      ) : model.advice === 'not_started' ? (
        <p className="text-sm leading-relaxed text-ink/70">
          Nothing has started yet. {coupleName}&rsquo;s first block begins the run —
          start it from the timeline above, and every other screen follows.
        </p>
      ) : null}

      <ConsoleRule />

      {/* The inbox, inline — the whole point of hole 1. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Inbox aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
            Everything coming in
          </span>
        </div>
        <IssuesLog eventId={eventId} />
      </div>
    </div>
  );
}
