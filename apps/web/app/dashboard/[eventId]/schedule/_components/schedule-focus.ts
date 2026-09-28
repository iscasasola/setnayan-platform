/**
 * TAP A MOMENT ON A STAGE → THAT MOMENT, IN DETAILS › SCHEDULE (Details part 2b;
 * controller answer 2026-09-29, from DECISION_LOG "DETAILS IS THE ONE FILL-IN
 * AREA; STAGES ARE LOOK AND MOTION; TAP IS A SHORTCUT").
 *
 * The Schedule is a whole page (its rail and its inspector), too big for the
 * stage's right panel — so a tapped moment opens Details › Schedule, and the
 * rail there selects that moment (`ScheduleDay`, its own inspector). The Maker
 * asks here; the rail answers when it is mounted, or takes the ask when it
 * mounts (Details draws an item's page the first time it opens). The same
 * ask-and-queue shape as the Love Story's (`love-story-open.ts`).
 *
 * Pure DOM — no React, no server imports.
 */
export const SCHEDULE_FOCUS_EVENT = 'setnayan:schedule-focus';

const QUEUE_MS = 15_000;
let queued: { id: string; at: number } | null = null;

/** Ask the schedule to select one moment (by its `block_id`). */
export function askScheduleFocus(blockId: string): void {
  if (typeof window === 'undefined' || !blockId) return;
  queued = { id: blockId, at: Date.now() };
  window.dispatchEvent(new CustomEvent<string>(SCHEDULE_FOCUS_EVENT, { detail: blockId }));
}

/** The moment asked for before the rail mounted — taken once; stale asks are dropped. */
export function takeQueuedScheduleFocus(): string | null {
  if (!queued) return null;
  const q = queued;
  queued = null;
  return Date.now() - q.at > QUEUE_MS ? null : q.id;
}
