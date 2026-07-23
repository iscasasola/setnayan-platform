'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import {
  SCHEDULE_BLOCK_LABEL,
  formatBlockTimeRange,
  formatViewerTimeRange,
  wallClockToInstant,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import { pickTriggerNowNext, type RunOfShowBlock } from '@/lib/run-of-show';
import { ProgressRing } from '@/app/_components/progress-ring';

type Props = {
  blocks: ScheduleBlockRow[];
  /** Event's IANA timezone (from venue coords) — times render in the viewer's
   *  own local time relative to this. */
  eventTz: string;
  /**
   * NEXT_PUBLIC_GUEST_NOW_TRIGGER (resolved server-side, owner directive
   * 2026-07-23): when true AND the host/coordinator has started the run of
   * show, the per-block "Happening now" / "Up next" badges + progress ring
   * follow run_state instead of the wall clock — so they can no longer
   * contradict the RunOfShowHeader rendered directly above them. Wall clock
   * stays the fallback while everything is still 'upcoming'.
   */
  nowTrigger?: boolean;
  /**
   * RSVP-season labeling (same flag, resolved server-side): true during the
   * pre/inactive phases — the schedule is the couple's plan, not a live
   * program, and is labeled "Estimated" per the owner directive.
   */
  estimated?: boolean;
};

/**
 * Public schedule widget on /[slug]. Server passes the full ordered list of
 * public blocks; the client ticks every 30 seconds and labels:
 *   • happening now — current time falls between start_at and end_at (or
 *     start_at and the next block's start)
 *   • up next — first block whose start_at is in the future
 * Everything else is rendered in muted ink.
 */
export function ScheduleWidget({ blocks, eventTz, nowTrigger = false, estimated = false }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Initialize on mount so SSR doesn't mismatch with a stale "now".
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (blocks.length === 0) return null;

  // The stored value is the naive event-local wall-clock; its TRUE instant is
  // that wall-clock interpreted in the event timezone. "Happening now" / "up
  // next" compare real instants to real now (falling back to the raw value if
  // tz math is unavailable).
  const toInstant = (iso: string): number => {
    const d = new Date(iso);
    const inst = wallClockToInstant(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      eventTz,
    );
    return inst ?? d.getTime();
  };

  // Build a virtual end time for each block — explicit end_at when set,
  // otherwise the start_at of the next block (so "happening now" doesn't
  // require couples to fill in end times).
  const ordered = [...blocks].sort((a, b) => toInstant(a.start_at) - toInstant(b.start_at));
  const ends: (number | null)[] = ordered.map((b, i) => {
    if (b.end_at) return toInstant(b.end_at);
    const next = ordered[i + 1];
    return next ? toInstant(next.start_at) : null;
  });

  const nowMs = now?.getTime() ?? 0;
  let currentIndex = -1;
  let upNextIndex = -1;
  // Run-state trigger read (owner directive 2026-07-23): once the host /
  // coordinator has started the show, the pointer wins over the wall clock.
  // pickTriggerNowNext returns null while everything is 'upcoming' (or a
  // private live block hides the pointer AND nothing visible is done) — then
  // the wall-clock inference below runs exactly as before.
  const triggerPick = nowTrigger ? pickTriggerNowNext(ordered) : null;
  if (triggerPick) {
    currentIndex = triggerPick.current
      ? ordered.findIndex((b) => b.block_id === triggerPick.current!.block_id)
      : -1;
    upNextIndex = triggerPick.next
      ? ordered.findIndex((b) => b.block_id === triggerPick.next!.block_id)
      : -1;
  } else if (now) {
    for (let i = 0; i < ordered.length; i++) {
      const block = ordered[i];
      if (!block) continue;
      const start = toInstant(block.start_at);
      const end = ends[i] ?? null;
      if (start <= nowMs && (end === null || nowMs < end)) {
        currentIndex = i;
      } else if (currentIndex === -1 && start > nowMs && upNextIndex === -1) {
        upNextIndex = i;
      }
    }
  }

  // Program progress ("Energy, not skin" density read) — how far through the
  // day's run of show we are, from data already on the page: a block counts as
  // done once its virtual end (explicit or the next block's start) has passed.
  // Only surfaced once the program has actually begun so it's a live pulse, not
  // a pre-event 0%. Palette-driven ring (couple accent), never dashboard wine.
  const completed = triggerPick
    ? ordered.filter((b) => b.run_state === 'done').length
    : now
      ? ordered.reduce((n, _b, i) => {
          const end = ends[i];
          return end !== null && end !== undefined && end <= nowMs ? n + 1 : n;
        }, 0)
      : 0;
  const total = ordered.length;
  const programBegun =
    triggerPick !== null || (now !== null && (currentIndex >= 0 || completed > 0));
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  // Run-of-show header — read-only for guests (no advance control). Driven by
  // the shared run-state on the public blocks; realtime keeps it current as the
  // host advances the day. eventId comes off any block (all share the event).
  const eventId = ordered[0]?.event_id ?? null;
  const runOfShowBlocks: RunOfShowBlock[] = ordered.map((b) => ({
    block_id: b.block_id,
    label: b.label,
    start_at: b.start_at,
    end_at: b.end_at,
    location: b.location,
    run_state: b.run_state,
    actual_start_at: b.actual_start_at,
  }));
  // Only surface the live header once the host has actually started the run of
  // show (some block is live or done) — before that, the static schedule below
  // already says "up next", so a "Not started" header would just be noise.
  const showRunOfShow =
    eventId !== null && runOfShowBlocks.some((b) => b.run_state !== 'upcoming');

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta">
            Day-of schedule
          </p>
          <h2 className="font-serif text-2xl italic leading-tight tracking-tight text-ink">
            The run of show
          </h2>
          {estimated && !triggerPick ? (
            /* RSVP-season honesty (owner directive 2026-07-23): before the
               day, these times are the couple's plan — not a live program.
               Suppressed the moment the host actually starts the run of show
               (early start edge) — a live pointer and an "Estimated" label
               would contradict each other. */
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
              Estimated program · times may shift on the day
            </p>
          ) : null}
        </div>
        {programBegun ? (
          <ProgressRing
            pct={progressPct}
            size={54}
            stroke={5}
            color="rgb(var(--color-terracotta))"
            className="shrink-0"
          >
            <span className="font-serif text-sm leading-none text-ink">
              {completed}
              <span className="text-ink/40">/{total}</span>
            </span>
          </ProgressRing>
        ) : null}
      </div>
      {showRunOfShow && eventId ? (
        <RunOfShowHeader eventId={eventId} initial={runOfShowBlocks} compact />
      ) : null}
      <ol className="space-y-3">
        {ordered.map((b, i) => {
          const isNow = i === currentIndex;
          const isNext = i === upNextIndex;
          return (
            <li
              key={b.block_id}
              className={`relative rounded-xl border p-4 transition-colors ${
                isNow
                  ? 'border-terracotta bg-terracotta/10'
                  : isNext
                    ? 'border-terracotta/30 bg-cream'
                    : 'border-ink/10 bg-cream'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
                    {SCHEDULE_BLOCK_LABEL[b.block_type]}
                  </p>
                  <p className="font-serif text-lg italic leading-snug text-ink">{b.label}</p>
                </div>
                {isNow ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-xs uppercase tracking-[0.15em] text-cream">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cream" />
                    Happening now
                  </span>
                ) : isNext ? (
                  <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.15em] text-terracotta-700">
                    Up next
                  </span>
                ) : null}
              </div>
              <p className="mt-2 inline-flex flex-wrap items-center gap-x-1.5 text-sm text-ink/70">
                <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {(() => {
                  // Viewer-local only after mount (now != null) so SSR (server tz)
                  // and the first client render agree — no hydration flip.
                  const viewer = now ? formatViewerTimeRange(b.start_at, b.end_at, eventTz) : null;
                  return viewer ? (
                    <>
                      {viewer} <span className="text-ink/45">· your time</span>
                    </>
                  ) : (
                    formatBlockTimeRange(b.start_at, b.end_at)
                  );
                })()}
              </p>
              {b.location ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink/65">
                  <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {b.location}
                </p>
              ) : null}
              {b.notes ? (
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-cream/70 p-3 text-xs text-ink/70">
                  {b.notes}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
