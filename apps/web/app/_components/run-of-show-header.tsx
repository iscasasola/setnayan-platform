'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Radio, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  advanceRefusalMessage,
  deriveRunOfShow,
  driftLabel,
  type RunOfShowBlock,
} from '@/lib/run-of-show';
import { advanceScheduleBlock, fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { useLoader } from '@/components/sd-loader';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';

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
 * `canAdvance` decides whether the "Start next" / "End & advance" control is
 * DRAWN. It is a screen convenience, never the permission: `advanceScheduleBlock`
 * re-checks the caller server-side against `lib/run-of-show-gate.ts` and every
 * caller passes `canAdvance` from that same shared gate. The RPC is
 * single-winner + idempotent, so a stray click from a second device is a benign
 * no-op — and a refusal is RENDERED (see `refusal` below), never swallowed.
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
  // The sentence a refused advance leaves on screen. Before this existed the
  // action's refusal was thrown away and the veil finished with "Saved" — a
  // guest, or a supplier the gate had just turned down, watched a success tick
  // land while the programme had not moved an inch.
  const [refusal, setRefusal] = useState<string | null>(null);
  // ⚠ NOT `useSaveLoader`: its `showDone` is decided BEFORE the work runs, and
  // whether this deserves a success beat is decided by the RESULT. Driving the
  // overlay directly keeps that decision where the answer is.
  const { show, complete, hide } = useLoader();
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

  const { current, next, driftMinutes, allDone, notStarted } = deriveRunOfShow(
    blocks,
    undefined,
    DEFAULT_EVENT_TZ,
  );

  // Nothing to show if the couple hasn't built a timeline.
  if (blocks.length === 0) return null;

  const onAdvance = (blockId: string) => {
    setRefusal(null);
    startTransition(async () => {
      show({ steps: ['Advancing the timeline'], hint: 'Saving' });
      let notice: string | null;
      try {
        notice = advanceRefusalMessage(await advanceScheduleBlock(eventId, blockId));
      } catch {
        notice = 'Could not reach the timeline. Check your signal and try again.';
      }
      if (notice) {
        // A REFUSAL GETS NO SUCCESS BEAT. `hide()` is `showDone: false` —
        // dismiss the veil without the "Saved ✓" it would otherwise draw.
        hide();
        setRefusal(notice);
        return;
      }
      complete();
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

      {/* WHERE A REFUSAL IS SEEN. Rendered outside the `canAdvance` branch on
          purpose: if the control is ever shown to someone the action turns
          down, the sentence must still have somewhere to land. */}
      {refusal ? (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2 text-xs text-ink/75"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" />
          <span>{refusal}</span>
        </p>
      ) : null}
    </section>
  );
}

/**
 * The moment's time, as the couple wrote it.
 *
 * `timeZone: 'UTC'` is deliberate: `start_at` holds the venue's WALL CLOCK, so
 * these digits ARE the answer and UTC is what returns them unchanged. Without
 * it this rendered in the READER's zone — so on the same screen, this panel
 * said 10:00 PM while the programme list directly beneath it (which converts
 * properly and labels itself "your time") said 2:00 PM for the identical
 * moment. Two clocks disagreeing by eight hours, one above the other.
 */
function fmtTime(iso: string | null): string {
  if (!iso) return 'Time TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time TBD';
  return d.toLocaleTimeString('en-PH', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function trim(label: string): string {
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
}
