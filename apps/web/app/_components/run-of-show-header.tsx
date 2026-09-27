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
import { useSaveLoader } from '@/components/sd-loader';
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
 * `canAdvance` gates the "Start next" / "End & advance" control.
 *
 * ⚠ IT IS NOT AN AUTHORIZATION BOUNDARY, AND IT IS WIDER THAN THE SERVER.
 * The vendor client workspace passes it as a bare literal, so every booked
 * supplier sees the control; the server action then narrows to host/couple ∪
 * schedule-delegate ∪ the BOOKED COORDINATOR ∪ admin. The DATABASE rpc is wider
 * still (it admits any booked vendor) — so "allowed by the RPC" says nothing
 * about whether a press will work. `lib/run-of-show-advance.ts` is the narrowing
 * that decides, and this header now SHOWS what it decided. See `onAdvance`.
 *
 * The RPC is single-winner + idempotent, so a stray click from a second device
 * is a benign no-op.
 *
 * `initial` is computed in the server render so the header shows correct state
 * on first paint before the channel connects.
 */
export function RunOfShowHeader({
  eventId,
  initial,
  canAdvance = false,
  compact = false,
  variant = 'card',
}: {
  eventId: string;
  initial: RunOfShowBlock[];
  canAdvance?: boolean;
  compact?: boolean;
  /**
   * `strip` — the Schedule rebuild's ONE live strip (2026-09-27, prototype
   * `schedule_redesign_2026-09-25.html` § "the live strip"): Now and Up next
   * merged into one row, with a single "Done — start …" press. Same run-state,
   * same realtime channel, same advance action and refusal notice — only the
   * drawing differs. Every other caller keeps the card, byte-identically.
   */
  variant?: 'card' | 'strip';
}) {
  const [blocks, setBlocks] = useState<RunOfShowBlock[]>(initial);
  const [live, setLive] = useState(false);
  /** What the last press was told. Null while nothing has been refused. */
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();
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

  // 🔑 THE RESULT IS THE POINT — DO NOT DISCARD IT AGAIN.
  //
  // `advanceScheduleBlock` narrows to host/couple ∪ schedule-delegate ∪ the
  // BOOKED COORDINATOR ∪ admin (lib/run-of-show-advance.ts), and it returns a
  // refusal rather than throwing. `canAdvance` used to be passed as a LITERAL on
  // the vendor client workspace, so EVERY booked supplier — photographer,
  // caterer, florist — saw this button, and the returned status was awaited and
  // thrown away: a supplier pressed "Start next", watched the saving loader run,
  // and the timeline simply did not move. No error, no explanation, nothing to
  // distinguish a refusal from a failed network.
  //
  // That literal is gone (the workspace now computes the coordinator tile) and
  // the database refuses the rest outright (migration 20271227867922). Neither
  // retires this branch. `canAdvance` is a PREDICTION made on the server at
  // render time and this is a live day-of surface: a booking can end, a grant
  // can be withdrawn, and a tab can be open for hours. A refusal must stay
  // visible — a guard that refuses without saying so is indistinguishable from
  // one that passed, which is how this survived review in the first place:
  // every pass was made as the coordinator, for whom the button works.
  const onAdvance = (blockId: string) => {
    setNotice(null);
    startTransition(async () => {
      const result = await save.run(() => advanceScheduleBlock(eventId, blockId), {
        steps: ['Advancing the timeline'],
        hint: 'Saving',
      });
      // `ok` is the only status that moved the timeline. Anything else has to
      // say something — and a refusal carries its own sentence, so prefer it
      // over a generic one.
      if (result && result.status !== 'ok') {
        setNotice(result.message ?? 'That didn’t go through. Please try again.');
      }
      await refetch();
    });
  };

  // advance_schedule_block handles both START (target upcoming + nothing live →
  // light it) and ADVANCE (target live → done + next live), so the control calls
  // the same action on whichever block is actionable: the current live block to
  // advance, or the next upcoming block to start the show.
  const drift = driftLabel(driftMinutes);

  if (variant === 'strip') {
    const doneCount = blocks.filter((b) => b.run_state === 'done').length;
    const progress = blocks.length > 0 ? Math.round((doneCount / blocks.length) * 100) : 0;
    const target = current ?? next;
    const pressLabel = current
      ? next
        ? `Done — start ${trim(next.label)}`
        : `Finish ${trim(current.label)}`
      : next
        ? `Start ${trim(next.label)}`
        : null;
    return (
      <section
        aria-label="Run of show"
        className="relative flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-white/70 px-4 pb-3.5 pt-3 shadow-[0_1px_2px_rgba(40,34,24,0.05),0_18px_40px_-26px_rgba(30,26,18,0.4)] sm:px-6"
      >
        {allDone ? (
          <p className="flex items-center gap-2 text-sm text-ink/70">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" />
            Every moment is done.
          </p>
        ) : (
          <>
            <div className="flex min-w-0 flex-[1_1_100%] items-center gap-3 sm:flex-initial">
              <span
                aria-hidden
                className={`h-2 w-2 flex-none rounded-full ${current ? 'animate-pulse bg-mulberry' : 'bg-ink/25'}`}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mulberry">Now</p>
                <p className="truncate font-display text-xl leading-tight text-ink sm:text-2xl">
                  {current ? current.label : notStarted ? 'Not started yet' : 'Between moments'}
                </p>
                {current ? (
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink/55">
                    <span className="font-mono">{fmtTime(current.start_at)}</span>
                    {current.actual_start_at ? (
                      <span>started {fmtInstant(current.actual_start_at)}</span>
                    ) : null}
                    {drift ? (
                      <span
                        className={`font-semibold ${driftMinutes && driftMinutes > 0 ? 'text-danger-700' : 'text-success-700'}`}
                      >
                        {drift}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            <span aria-hidden className="hidden h-9 w-px bg-ink/10 sm:block" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">Up next</p>
              <p className="truncate text-sm font-semibold text-ink/80 sm:text-base">
                {next ? next.label : 'Nothing after this'}
              </p>
              {next ? (
                <p className="hidden text-xs text-ink/55 sm:block">
                  <span className="font-mono">{fmtTime(next.start_at)}</span>
                  {next.location ? ` · ${next.location}` : ''}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {canAdvance && target && pressLabel ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onAdvance(target.block_id)}
                  className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-50"
                >
                  {pressLabel}
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </button>
              ) : (
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45"
                  title={live ? 'Updating in real time' : 'Reconnecting…'}
                >
                  {live ? 'Live · watching' : 'Syncing'}
                </span>
              )}
            </div>
          </>
        )}
        {notice ? (
          <p role="status" className="w-full text-xs font-medium text-mulberry-600">
            {notice}
          </p>
        ) : null}
        <div aria-hidden className="absolute inset-x-4 bottom-0 h-0.5 bg-ink/[0.06] sm:inset-x-6">
          <i className="absolute inset-y-0 left-0 bg-mulberry" style={{ width: `${progress}%` }} />
        </div>
      </section>
    );
  }

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

      {/* Advance control. Shown wider than it is permitted (see the docblock),
          so a refusal must be visible — never a loader that finishes and a
          timeline that did not move. */}
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
          {notice ? (
            <p
              role="status"
              className="w-full text-xs font-medium text-mulberry-600"
            >
              {notice}
            </p>
          ) : null}
        </div>
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

/**
 * When a moment ACTUALLY started. Unlike `start_at`, `actual_start_at` is a
 * real instant (the database's `now()` at the press), so it is read in the
 * venue's zone — the one clock everybody in the room shares.
 */
function fmtInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-PH', {
    timeZone: DEFAULT_EVENT_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function trim(label: string): string {
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
}
