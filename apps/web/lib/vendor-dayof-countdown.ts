/**
 * Vendor "On the Day" launcher — the honest day-of clock.
 *
 * Council ruling (verdict 2026-07-16): a vendor booking stores a DATE only — no
 * per-vendor service start/end hours exist. So the launched console's clock must
 * NEVER fabricate a vendor "hours remaining" countdown. Two honest sources, in
 * priority:
 *
 *   1. The couple's run-of-show (event_schedule_blocks). When present, we count
 *      down to the next upcoming block's start, and show hours left in the whole
 *      program (last block end/start − now). Labelled as the COUPLE'S program,
 *      never as the vendor's service window.
 *   2. No run-of-show → the T-band. The console is live T-1h → T+8h on the event
 *      day; we show elapsed time since the day's T-0 (midnight PH is not it — we
 *      anchor to the first plausible start, see below) as "event day · started
 *      N ago", degrading honestly rather than inventing an end.
 *
 * Pure module (no I/O, no wall-clock capture at import) so it unit-tests cleanly;
 * callers pass `now`.
 */

import { deriveRunOfShow, type RunOfShowBlock } from '@/lib/run-of-show';

export type DayOfClock =
  | {
      mode: 'program';
      /** Minutes until the next upcoming block starts (null if none upcoming). */
      minutesToNext: number | null;
      /** Label of the next block, if any. */
      nextLabel: string | null;
      /** Hours left in the couple's whole program (to the last block's end/start). */
      hoursLeftInProgram: number | null;
      /** True once every block is done. */
      allDone: boolean;
    }
  | {
      mode: 'tband';
      /** Minutes elapsed since the program's implied start (T-band anchor). */
      minutesElapsed: number;
    };

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Derive the launched-console clock from the couple's schedule blocks.
 *
 * When there are blocks: mode='program' — minutes to the next upcoming block +
 * hours remaining in the program (max end_at, else max start_at, minus now).
 * When there are none: mode='tband' — minutes since the earliest sensible
 * anchor. We anchor the T-band to (now − 1h) as a floor so a freshly-opened
 * console reads a small positive elapsed rather than a whole day; callers that
 * know the true booked window can override the anchor.
 */
export function deriveDayOfClock(
  blocks: ReadonlyArray<RunOfShowBlock>,
  now: Date = new Date(),
  tbandAnchor?: Date,
): DayOfClock {
  const nowMs = now.getTime();

  if (blocks.length > 0) {
    const ros = deriveRunOfShow(blocks, now);
    let minutesToNext: number | null = null;
    if (ros.next) {
      const startMs = ms(ros.next.start_at);
      if (!Number.isNaN(startMs)) {
        minutesToNext = Math.round((startMs - nowMs) / 60000);
      }
    }

    // Hours left in the whole program: the latest end_at, else the latest
    // start_at, minus now. Clamped at 0 (never negative).
    let lastMs = Number.NEGATIVE_INFINITY;
    for (const b of blocks) {
      const end = b.end_at ? ms(b.end_at) : NaN;
      const start = ms(b.start_at);
      if (!Number.isNaN(end)) lastMs = Math.max(lastMs, end);
      else if (!Number.isNaN(start)) lastMs = Math.max(lastMs, start);
    }
    const hoursLeftInProgram = Number.isFinite(lastMs)
      ? Math.max(0, Math.round(((lastMs - nowMs) / 3600000) * 10) / 10)
      : null;

    return {
      mode: 'program',
      minutesToNext,
      nextLabel: ros.next?.label ?? null,
      hoursLeftInProgram,
      allDone: ros.allDone,
    };
  }

  // No run-of-show — honest T-band elapsed.
  const anchor = tbandAnchor ?? new Date(nowMs - 60 * 60 * 1000);
  const minutesElapsed = Math.max(0, Math.round((nowMs - anchor.getTime()) / 60000));
  return { mode: 'tband', minutesElapsed };
}

/** "2h 15m" / "45m" / "0m" — a compact H/M label from a minute count. */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0) return `${h}h ${rem}m`;
  return `${rem}m`;
}
