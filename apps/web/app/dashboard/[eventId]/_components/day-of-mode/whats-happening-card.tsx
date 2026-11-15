'use client';
import { ScheduleUnread } from './schedule-unread';

import { formatWallClock } from '@/lib/schedule-datetime-local';

import { useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, Clock } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';
import { pickTriggerNowNext, type RunState } from '@/lib/run-of-show';
import { venueNowMs } from '@/lib/schedule';
import { isTimeTba } from '@/lib/schedule-chapters';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  /** Day-of run-of-show pointer (migration 20270321980372). Optional — the
   *  couple-dashboard grid doesn't pass it and keeps pure wall-clock math. */
  run_state?: RunState | null;
  actual_start_at?: string | null;
  /** ⏰ A Time-TBA chapter (migration 20271300482585) — never "now", never "next": its 00:00 is only its day. */
  time_tba?: boolean | null;
};

type Props = {
  blocks: Block[];
  /**
   * NEXT_PUBLIC_GUEST_NOW_TRIGGER (resolved server-side): when true AND the
   * host/coordinator has started the run of show, "happening now" follows the
   * run_state pointer instead of the wall clock (owner directive 2026-07-23).
   * The wall clock stays the fallback while every block is still 'upcoming'.
   */
  runStateTrigger?: boolean;
  /** 🛑 The schedule read was refused (Home's day-of grid) — said, never "wrapped" or "empty". */
  failed?: boolean;
};

type State =
  | { kind: 'active'; block: Block; nextBlockStart: number | null; hostSet?: boolean }
  | { kind: 'between'; nextBlock: Block; hostSet?: boolean }
  | { kind: 'wrapped' }
  | { kind: 'empty' };

/**
 * Run-state-driven derivation. Returns null when the trigger is off or the
 * show hasn't started (all blocks 'upcoming' / no run_state selected) — the
 * caller falls back to deriveState's wall-clock inference. A live block the
 * viewer can't see (is_public=false → not in `blocks`) degrades to 'between'
 * with the next visible upcoming block, or 'wrapped' — never a crash or a
 * teaser of the hidden label.
 */
export function deriveTriggerState(blocks: Block[], trigger: boolean): State | null {
  if (!trigger) return null;
  const picked = pickTriggerNowNext(blocks.filter((b) => !isTimeTba(b)));
  if (!picked) return null;
  const { current, next } = picked;
  if (current) {
    return {
      kind: 'active',
      block: current,
      nextBlockStart: next ? new Date(next.start_at).getTime() : null,
      hostSet: true,
    };
  }
  if (next) return { kind: 'between', nextBlock: next, hostSet: true };
  return { kind: 'wrapped' };
}

export function deriveState(blocks: Block[], now: number): State {
  // ⏰ A Time-TBA chapter is never ranked by time, so never "now" and never "next" (its 00:00 is a placeholder day).
  const sorted = blocks.filter((b) => !isTimeTba(b)).sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!b) continue;
    const start = new Date(b.start_at).getTime();
    const end = b.end_at
      ? new Date(b.end_at).getTime()
      : start + 30 * 60_000;
    if (start <= now && now < end) {
      const next = sorted[i + 1] ?? null;
      return {
        kind: 'active',
        block: b,
        nextBlockStart: next ? new Date(next.start_at).getTime() : null,
      };
    }
  }
  const next = sorted.find((b) => new Date(b.start_at).getTime() > now);
  if (next) return { kind: 'between', nextBlock: next };
  return { kind: 'empty' };
}

// A stored block time is the VENUE'S WALL CLOCK, not an instant. This card is
// a client component, so `toLocaleTimeString` rendered it in the guest's own
// timezone — eight hours late in Manila — while the Schedule page one tap away
// rendered the same value correctly on the server. See lib/schedule-datetime-local.ts.
const formatClock = (iso: string): string => formatWallClock(iso);

export function WhatsHappeningCard({ blocks, runStateTrigger = false, failed = false }: Props) {
  // tick re-renders every 60s so the countdown stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(
    () =>
      deriveTriggerState(blocks, runStateTrigger) ??
      deriveState(blocks, venueNowMs()),
    [blocks, runStateTrigger],
  );

  return (
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 13 · 14 · 2): the day's ONE thing that matters now — the top of the page on
    // the warm surface (`--m-paper-2`, which flips in dark), its name big in full ink; no dark tile with typed colour
    // codes, no 10 px typewriter captions. The live dot stays the house gold (an edge/icon, never words).
    <article className="space-y-2 rounded-card bg-[var(--m-paper-2)] p-4">
      <header className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          <Activity aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          Happening now
        </h2>
        <span aria-hidden className="sn-live-dot inline-flex h-2 w-2 rounded-full bg-terracotta" />
      </header>

      {failed ? (
        <ScheduleUnread />
      ) : state.kind === 'active' ? (
        <>
          <h3 className="text-2xl font-extrabold tracking-tight text-ink">{state.block.label}</h3>
          <div className="space-y-1 text-sm text-ink/75">
            <p className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Started at{' '}
              {formatClock(
                (state.hostSet ? state.block.actual_start_at : null) ??
                  state.block.start_at,
              )}
              {state.block.end_at ? ` · ends ${formatClock(state.block.end_at)}` : null}
            </p>
            {state.hostSet ? (
              <p className="text-[13px] font-semibold text-ink">Live · set by your hosts</p>
            ) : null}
            {state.block.location ? (
              <p className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {state.block.location}
              </p>
            ) : null}
            {state.nextBlockStart !== null ? (
              <p className="pt-1 text-[13px] font-semibold text-ink">
                Next block {formatRelativeMs(state.nextBlockStart - venueNowMs())}
              </p>
            ) : null}
          </div>
        </>
      ) : state.kind === 'between' ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Up next</p>
          <h3 className="text-2xl font-extrabold tracking-tight text-ink">{state.nextBlock.label}</h3>
          <p className="text-sm text-ink/75">
            Starts{' '}
            <span className="font-semibold text-ink">
              {/* Host-set "between moments" can run past the planned start —
                  "5 min ago" would read broken, so soften to "any moment". */}
              {state.hostSet &&
              new Date(state.nextBlock.start_at).getTime() - venueNowMs() <= 0
                ? 'any moment now'
                : formatRelativeMs(
                    new Date(state.nextBlock.start_at).getTime() - venueNowMs(),
                  )}
            </span>
            {' · '}
            {formatClock(state.nextBlock.start_at)}
          </p>
          {state.nextBlock.location ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-ink/75">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {state.nextBlock.location}
            </p>
          ) : null}
        </>
      ) : state.kind === 'wrapped' ? (
        <p className="text-sm text-ink/75">
          The program has wrapped — thank you for celebrating with us.
        </p>
      ) : (
        <p className="text-sm text-ink/75">
          No active schedule block. Add one in Schedule to see live updates here.
        </p>
      )}
    </article>
  );
}
