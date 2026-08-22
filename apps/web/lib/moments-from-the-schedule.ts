import { plannedInstant } from '@/lib/run-of-show';

/**
 * moments-from-the-schedule.ts — the couple already named their day.
 *
 * "As the Day Unfolded" chapters are an even time-order split of the day's
 * photos, and every one of them ships with `title: null`. A slice of a timeline
 * can only ever be called "Moment 3". But the couple wrote a run-of-show months
 * earlier — *Ceremony, 2:00pm, Casa Ysabel* — and a photo taken at 2:14pm IS the
 * ceremony. This names a chapter from the block its lead photo falls inside.
 *
 * ⚠⚠ THE WALL-CLOCK TRAP, AND IT IS THE WHOLE REASON THIS FILE IS SEPARATE.
 * `event_schedule_blocks.start_at` stores the VENUE'S WALL CLOCK in a timestamptz
 * column — prod holds `Ceremony 14:00+00` for a 2pm Manila ceremony. A photo's
 * `captured_at` is a REAL INSTANT. Comparing them directly is out by exactly the
 * venue's offset — 480 minutes in Manila — which put every afternoon photo in
 * the morning's block. This repo has already shipped that defect nine times in
 * one day across other surfaces.
 *
 * So the block's wall clock is lifted to a real instant with `plannedInstant`
 * before any comparison, and a block whose time cannot be parsed is SKIPPED
 * rather than guessed at: an unnamed moment is honest, a wrongly-named one is a
 * lie about somebody's wedding.
 */

export type ScheduleBlock = {
  label: string | null;
  start_at: string | null;
  end_at: string | null;
};

/** A block lifted into real instants, ready to compare against a capture time. */
type Window = { label: string; startMs: number; endMs: number };

/**
 * How long a block with no end time is assumed to run.
 *
 * 🔑 IT CAPS EVERY OPEN BLOCK, NOT ONLY THE LAST ONE. The first cut closed an
 * open block at the NEXT block's start, reasoning that a run-of-show reads that
 * way. That makes a 2pm ceremony with a 6pm reception a FOUR-HOUR ceremony, and
 * every photo of the gap in between — the drive, the portraits, the waiting —
 * gets filed under "Ceremony". A moment that swallows the day names nothing.
 *
 * So an open block ends at whichever comes first: the next block, or ninety
 * minutes. Photos in the gap keep no name, which is the honest answer.
 */
const OPEN_BLOCK_MINUTES = 90;

/**
 * Turn the couple's schedule into comparable windows, in start order.
 *
 * A block with no label is dropped — it names nothing. A block whose start
 * cannot be parsed is dropped for the same reason: it cannot be placed.
 */
export function scheduleWindows(
  blocks: readonly ScheduleBlock[],
  tz: string,
): Window[] {
  const windows: Window[] = [];
  for (const b of blocks) {
    const label = (b.label ?? '').trim();
    if (!label || !b.start_at) continue;
    const startMs = plannedInstant(b.start_at, tz);
    if (startMs === null) continue;
    const endRaw = b.end_at ? plannedInstant(b.end_at, tz) : null;
    windows.push({ label, startMs, endMs: endRaw ?? Number.NaN });
  }
  windows.sort((a, b) => a.startMs - b.startMs);

  // Close each open-ended block at the next one's start OR a fixed run,
  // whichever is sooner. Done AFTER sorting, because "the next block" is only
  // meaningful in start order.
  for (let i = 0; i < windows.length; i += 1) {
    const w = windows[i]!;
    if (!Number.isNaN(w.endMs)) continue;
    const next = windows[i + 1];
    const capped = w.startMs + OPEN_BLOCK_MINUTES * 60_000;
    w.endMs = next ? Math.min(next.startMs, capped) : capped;
  }
  return windows;
}

/**
 * Which block was happening when this photo was taken?
 *
 * Returns the block's label, or `null` when the photo falls in no block — the
 * gaps between the ceremony and the reception, the shots taken before anybody
 * started counting. Those moments keep no name rather than borrowing the wrong
 * one.
 *
 * The END is exclusive: a photo at exactly 3:00pm belongs to the block that
 * STARTS at 3:00, not the one that ended there. Otherwise every boundary photo
 * lands in the moment that just finished.
 */
export function labelForCapture(
  capturedAtIso: string | null,
  windows: readonly Window[],
): string | null {
  if (!capturedAtIso) return null;
  const t = Date.parse(capturedAtIso);
  if (Number.isNaN(t)) return null;
  for (const w of windows) {
    if (t >= w.startMs && t < w.endMs) return w.label;
  }
  return null;
}
