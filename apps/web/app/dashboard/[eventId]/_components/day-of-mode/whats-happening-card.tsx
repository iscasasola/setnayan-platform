'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, Clock } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';
import { pickTriggerNowNext, type RunState } from '@/lib/run-of-show';

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
function deriveTriggerState(blocks: Block[], trigger: boolean): State | null {
  if (!trigger) return null;
  const picked = pickTriggerNowNext(blocks);
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

function deriveState(blocks: Block[], now: number): State {
  const sorted = [...blocks].sort(
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

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WhatsHappeningCard({ blocks, runStateTrigger = false }: Props) {
  // tick re-renders every 60s so the countdown stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(
    () =>
      deriveTriggerState(blocks, runStateTrigger) ??
      deriveState(blocks, Date.now()),
    [blocks, runStateTrigger],
  );

  return (
    // The day-of obsidian focal (Glass PR-2, § 1.3): on the event day the
    // DayOfModeGrid's "Happening now" card is the single `.sn-tile-dark` — the
    // "Big Day" focal on the dashboard below steps down to glass so the one-
    // obsidian-per-view rule holds.
    <article className="sn-tile-dark space-y-3">
      <header className="flex items-center justify-between">
        <p className="sn-eye">
          <Activity aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Happening now
        </p>
        <span
          className="sn-live-dot inline-flex h-2 w-2 rounded-full"
          style={{ background: 'var(--sn-gold-300)' }}
        />
      </header>

      {state.kind === 'active' ? (
        <>
          <h3
            className="text-xl font-extrabold tracking-tight"
            style={{ color: '#F3ECDF' }}
          >
            {state.block.label}
          </h3>
          <div className="space-y-1 text-sm" style={{ color: 'rgba(243,236,223,.7)' }}>
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
              <p
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--sn-gold-300)' }}
              >
                Live · set by your hosts
              </p>
            ) : null}
            {state.block.location ? (
              <p className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {state.block.location}
              </p>
            ) : null}
            {state.nextBlockStart !== null ? (
              <p className="pt-1 text-xs" style={{ color: 'var(--sn-gold-300)' }}>
                Next block {formatRelativeMs(state.nextBlockStart - Date.now())}
              </p>
            ) : null}
          </div>
        </>
      ) : state.kind === 'between' ? (
        <>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'rgba(243,236,223,.55)' }}
          >
            Up next
          </p>
          <h3
            className="text-xl font-extrabold tracking-tight"
            style={{ color: '#F3ECDF' }}
          >
            {state.nextBlock.label}
          </h3>
          <p className="text-sm" style={{ color: 'rgba(243,236,223,.7)' }}>
            Starts{' '}
            <span className="font-medium" style={{ color: '#F3ECDF' }}>
              {/* Host-set "between moments" can run past the planned start —
                  "5 min ago" would read broken, so soften to "any moment". */}
              {state.hostSet &&
              new Date(state.nextBlock.start_at).getTime() - Date.now() <= 0
                ? 'any moment now'
                : formatRelativeMs(
                    new Date(state.nextBlock.start_at).getTime() - Date.now(),
                  )}
            </span>
            {' · '}
            {formatClock(state.nextBlock.start_at)}
          </p>
          {state.nextBlock.location ? (
            <p
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ color: 'rgba(243,236,223,.7)' }}
            >
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {state.nextBlock.location}
            </p>
          ) : null}
        </>
      ) : state.kind === 'wrapped' ? (
        <p className="text-sm" style={{ color: 'rgba(243,236,223,.7)' }}>
          The program has wrapped — thank you for celebrating with us.
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'rgba(243,236,223,.6)' }}>
          No active schedule block. Add one in Schedule to see live updates here.
        </p>
      )}
    </article>
  );
}
