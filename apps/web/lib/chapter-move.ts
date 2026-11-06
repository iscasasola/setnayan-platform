/**
 * ↕ MOVING A CHAPTER'S START — ONE RULE for every door that does it (event chapters slice 10).
 *
 * The phone's time edit (the chapter sheet's Starts row, `chapter-sheets.tsx` `moveTo`) and the desktop board's drag
 * (`day-list.tsx`, ≥1280 only) both move a chapter here, so both send the SAME fields to the SAME server action
 * (`updateScheduleBlock` through `ChapterDoors.save`) and lay the SAME row on the page. Owner-approved brief
 * SCHEDULE_SLICES_8_10_BRIEF_2026-11-05: *"It goes through the SAME server action the phone's time edit uses (no new
 * write path, same permission checks)."* 🔒 lib/a-drag-and-the-phone-edit-make-one-row.test.ts
 *
 * A new start moves the chapter, its end and its moments together (`with_moments`, one statement in the database). A
 * Time-TBA chapter that gets a clock leaves TBA in the same save, and its moments keep their own times. Chapters stop at
 * the event's last day.
 */
import { capChapterDay, shiftWall, wallIso, wallLocal, type Chapter } from './schedule-chapters';

/** The clock a TBA chapter is stored at: its DAY at 00:00 (never drawn). */
const TBA_CLOCK = '00:00';

export type ChapterMove = {
  /** What the server action is sent (with `block_id`). */
  fields: Record<string, string>;
  /** What the page lays on the chapter at once. */
  next: Partial<Chapter>;
  /** Minutes the start moved. */
  delta: number;
  /** The day asked for was past the event's last day, and was set back to it. */
  capped: boolean;
  leavingTba: boolean;
};

export function chapterMove(
  c: Pick<Chapter, 'start_at' | 'end_at' | 'time_tba'>,
  day: string,
  hhmm: string,
  lastDay: string | null,
): ChapterMove | null {
  const capped = capChapterDay(day, lastDay);
  const stillTba = c.time_tba === true && hhmm === '';
  const clock = stillTba ? TBA_CLOCK : hhmm;
  const local = wallLocal(capped.day, clock);
  const iso = wallIso(capped.day, clock);
  if (!local || !iso) return null;
  const delta = Math.round((Date.parse(iso) - Date.parse(c.start_at)) / 60_000);
  const leavingTba = c.time_tba === true && !stillTba;
  return {
    fields: { start_at: local, ...(leavingTba ? { time_tba: '0' } : { with_moments: '1' }) },
    next: { start_at: iso, end_at: c.end_at ? shiftWall(c.end_at, delta) : null, time_tba: stillTba },
    delta,
    capped: capped.capped,
    leavingTba,
  };
}

/** The desktop board's drag: a start dragged by `minutes`, snapped to 5 minutes — as the phone would type it. */
export function draggedStart(startIso: string, minutes: number): { day: string; hhmm: string } {
  const snapped = Math.round(minutes / 5) * 5;
  const at = new Date(Date.parse(startIso) + snapped * 60_000).toISOString();
  return { day: at.slice(0, 10), hhmm: at.slice(11, 16) };
}
