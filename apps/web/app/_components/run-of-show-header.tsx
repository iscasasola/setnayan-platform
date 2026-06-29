'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Radio, ChevronRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  deriveRunOfShow,
  driftLabel,
  type RunOfShowBlock,
} from '@/lib/run-of-show';
import { advanceScheduleBlock, fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';

/**
 * Shared "now / next / running ±N min" run-of-show header.
 *
 * Rendered on the couple Schedule page, the vendor client workspace, and the
 * day-of guest card — all three read the SAME run-state on event_schedule_blocks
 * (run_state / actual_start_at, migration 20270321980372). The header keeps
 * itself current in real time by subscribing to Supabase Realtime on
 * event_schedule_blocks (cron-free, modeled on BudgetLiveSummaryCard): any
 * INSERT/UPDATE/DELETE re-pulls the blocks via a server action, so advancing on
 * one device lights up on every open surface within ~500ms.
 *
 * `canAdvance` gates the "Start next" / "End & advance" control to the
 * host/coordinator (and the booked vendor, who is also allowed by the RPC). The
 * RPC is single-winner + idempotent, so a stray click from a second device is a
 * benign no-op.
 *
 * `initial` is computed in the server render so the header shows correct state
 * on first paint before the channel connects.
 */
export function RunOfShowHeader({
  eventId,
  initial,
  canAdvance = false,
  compact = false,
}: {
  eventId: string;
  initial: RunOfShowBlock[];
  canAdvance?: boolean;
  compact?: boolean;
}) {
  const [blocks, setBlocks] = useState<RunOfShowBlock[]>(initial);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();
  // A wall-clock tick (60s) so the drift label re-reads "now" even without a
  // realtime event — purely cosmetic; run-state is the source of truth.
  const [, setTick] = useState(0);

  useEffect(() => {
    setBlocks(initial);
  }, [initial]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refetch = useCallback(async () => {
    const fresh = await fetchRunOfShowBlocks(eventId);
    if (fresh) setBlocks(fresh);
  }, [eventId]);

  const subscribedOnce = useRef(false);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`run-of-show-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_schedule_blocks',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (subscribedOnce.current) void refetch();
          subscribedOnce.current = true;
        } else {
          setLive(false);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, refetch]);

  const { current, next, driftMinutes, allDone, notStarted } = deriveRunOfShow(blocks);

  // Nothing to show if the couple hasn't built a timeline.
  if (blocks.length === 0) return null;

  const onAdvance = (blockId: string) => {
    startTransition(async () => {
      await advanceScheduleBlock(eventId, blockId);
      await refetch();
    });
  };

  // advance_schedule_block handles both START (target upcoming + nothing live →
  // light it) and ADVANCE (target live → done + next live), so the control calls
  // the same action on whichever block is actionable: the current live block to
  // advance, or the next upcoming block to start the show.
  const drift = driftLabel(driftMinutes);

  return (
    <section
      aria-label="Run of show"
      className={`rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] ${
        compact ? 'p-3' : 'p-4 sm:p-5'
      }`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
            Run of show
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45"
          title={live ? 'Updating in real time' : 'Reconnecting…'}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-success-500 animate-pulse' : 'bg-ink/25'}`}
          />
          {live ? 'Live' : 'Syncing'}
        </span>
      </header>

      {allDone ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink/70">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" />
          The day-of timeline has wrapped — every moment is done.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* NOW */}
          <div className="rounded-xl border border-ink/10 bg-white/70 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              Now
            </p>
            {current ? (
              <>
                <p className="mt-1 text-sm font-semibold text-ink">{current.label}</p>
                <p className="text-xs text-ink/55">
                  {fmtTime(current.start_at)}
                  {current.location ? ` · ${current.location}` : ''}
                  {drift ? (
                    <span className={driftMinutes && driftMinutes > 0 ? ' text-terracotta-700' : ' text-success-700'}>
                      {' '}· {drift}
                    </span>
                  ) : null}
                </p>
              </>
            ) : notStarted ? (
              <p className="mt-1 text-sm text-ink/60">Not started yet.</p>
            ) : (
              <p className="mt-1 text-sm text-ink/60">Between moments.</p>
            )}
          </div>

          {/* NEXT */}
          <div className="rounded-xl border border-ink/10 bg-white/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Up next
            </p>
            {next ? (
              <>
                <p className="mt-1 text-sm font-semibold text-ink">{next.label}</p>
                <p className="text-xs text-ink/55">
                  {fmtTime(next.start_at)}
                  {next.location ? ` · ${next.location}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink/60">Nothing scheduled after this.</p>
            )}
          </div>
        </div>
      )}

      {/* Advance control — host/coordinator (and booked vendor). The RPC is
          single-winner + idempotent, so concurrent taps are safe. */}
      {canAdvance && !allDone ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {current ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAdvance(current.block_id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50"
            >
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              {next ? `End "${trim(current.label)}" → start "${trim(next.label)}"` : `Finish "${trim(current.label)}"`}
            </button>
          ) : next ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAdvance(next.block_id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50"
            >
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              Start &ldquo;{trim(next.label)}&rdquo;
            </button>
          ) : null}
          {pending ? <span className="text-xs text-ink/45">Updating…</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return 'Time TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time TBD';
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function trim(label: string): string {
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
}
