/**
 * 🗓 CHANGE THE SCHEDULE — the day-of move / skip, the pure half (owner 2026-11-04, SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES
 * · Supplier › Hub: *"'Change the schedule' (move a part ± minutes, later parts follow; skip a part) replaces Hold 10
 * min"*; supplier prototype v59 `rosMoveSheet`: Part ▾ · Move it Later/Earlier ▾ · N min ▾ · Move · Skip this part).
 *
 * One rule for both doors — the coordinator's floor (`ScheduleUpdater`, the emcee's desk too) and a crew Member's phone
 * (`app/join/crew/[token]`). The writes are `lib/change-the-schedule.server.ts`; nothing here reads the database.
 *
 *   · MOVE — the picked part and every part after it that has not run yet move by the same minutes, so how long each
 *     takes stays the same ("later parts follow"). A part that is done keeps its time: it already happened. A pure
 *     shift — the shipped running-late write, which the owner let past a supplier's change lock (DECISION_LOG
 *     2026-11-03 (2)); the supplier is told.
 *   · CREW — a crew Member's phone only ASKS to move (owner 2026-11-05, DECISION_LOG "WHO CHANGES THE SCHEDULE…" (D));
 *     the coordinator / hosts approve with one tap. No skip request yet (the shipped request carries times only).
 *   · SKIP — one part that has not started becomes `skipped` (migration 20271308380805): it did not happen, so it is
 *     never a ✓, and "Done · next" passes over it. Later parts keep their times. A skip of a locked supplier's part is
 *     refused by the database with the lock's calm line, and the sheet offers the request instead.
 *
 * 🔒 lib/change-the-schedule.test.ts
 */
import type { RunState } from './run-of-show';
import { formatWallClock } from './schedule-datetime-local';
import { isTimeTba } from './time-tba';

/** The minutes the sheet offers — the prototype's list. One PickMenu, never a pill row. */
export const MOVE_MINUTES: readonly number[] = [5, 10, 15, 20, 30, 45, 60];

export type ScheduleChange =
  /** `ids` — Undo only: the exact rows the move carried, so it is undone row for row. */
  | { op: 'move'; blockId: string; minutes: number; ids?: readonly string[] }
  | { op: 'skip'; blockId: string }
  | { op: 'unskip'; blockId: string };

/** The fields the rule reads — every run-of-show read already selects them. */
export type ChangeablePart = {
  block_id: string;
  label: string;
  start_at: string;
  run_state: RunState;
  /** ⏰ A Time-TBA part has no time yet (its 00:00 is a placeholder): never offered, never carried by a move. */
  time_tba?: boolean | null;
};

/** A part that is over — it happened, or it was skipped. Neither is "next", and neither is left to do. */
export const isFinishedRunState = (s: RunState | string | null | undefined): boolean => s === 'done' || s === 'skipped';

export const wasSkipped = (b: { run_state?: RunState | string | null }): boolean => b.run_state === 'skipped';

/**
 * 🎟 A GUEST NEVER SEES A SKIPPED PART — it is not happening, and the couple's timeline and the crew already show it
 * struck. One filter for every guest read (`fetchPublicScheduleBlocks`, the header's `fetchRunOfShowBlocks(…, true)`,
 * the guests' live poll `api/live/run-of-show`), applied AFTER the query so the guests' pinned fence chain
 * (`onlyWhatGuestsMaySee`) stays exactly as it is.
 */
export const withoutSkipped = <T extends { run_state?: RunState | string | null }>(blocks: readonly T[]): T[] =>
  blocks.filter((b) => !wasSkipped(b));

/** The order the floor reads the day in: by the written clock, then by id (stable). */
function byClock<T extends ChangeablePart>(a: T, b: T): number {
  if (a.start_at !== b.start_at) return a.start_at < b.start_at ? -1 : 1;
  return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
}

/** The parts the sheet offers to move: everything that has not run — the live part included (it is running late). */
export function movableParts<T extends ChangeablePart>(blocks: readonly T[]): T[] {
  return [...blocks].filter((b) => !isTimeTba(b) && (b.run_state === 'upcoming' || b.run_state === 'live')).sort(byClock);
}

/** The parts the sheet offers to skip: only what has not started. A live part is finished with "Done · next". */
export const skippableParts = <T extends ChangeablePart>(blocks: readonly T[]): T[] =>
  [...blocks].filter((b) => !isTimeTba(b) && b.run_state === 'upcoming').sort(byClock);

/**
 * What a move of `fromId` carries: that part, and every part at or after its time that is not done. Skipped parts later
 * in the day move too, so putting one back puts it where it was in the order. Empty when the part is not movable.
 */
export function partsThatFollow<T extends ChangeablePart>(blocks: readonly T[], fromId: string): T[] {
  const from = blocks.find((b) => b.block_id === fromId);
  if (!from || isTimeTba(from) || !(from.run_state === 'upcoming' || from.run_state === 'live')) return [];
  return [...blocks]
    .filter((b) => !isTimeTba(b))
    .filter((b) => b.block_id === fromId || (b.start_at >= from.start_at && b.run_state !== 'done' && b.run_state !== 'live'))
    .sort(byClock);
}

/** "+10 min" · "−15 min" — `minutes` is signed: later is positive. */
export function moveWords(minutes: number): string {
  const abs = Math.abs(minutes);
  const body = abs >= 60 && abs % 60 === 0 ? `${abs / 60} h` : abs > 60 ? `${Math.floor(abs / 60)} h ${abs % 60} min` : `${abs} min`;
  return `${minutes < 0 ? 'earlier' : 'later'} ${body}`;
}

/** A wall clock `minutes` after `iso` (stored wall clock in, words out — never converted to a zone). */
export function clockAfter(iso: string, minutes: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return formatWallClock(new Date(t + minutes * 60_000).toISOString(), { hour12: true });
}

/** The sheet's line under the pickers — what Move will do, before it is pressed. */
export function moveLead(part: ChangeablePart, minutes: number, following: number): string {
  const to = clockAfter(part.start_at, minutes);
  const rest =
    following === 0
      ? 'Nothing after it moves.'
      : `the ${following === 1 ? 'part' : `${following} parts`} after it move${following === 1 ? 's' : ''} with it — how long each takes stays the same.`;
  return following === 0
    ? `${part.label} moves to ${to}. ${rest} The couple, your crew and the guests see the new time.`
    : `${part.label} moves to ${to}, and ${rest} The couple, your crew and the guests see the new times.`;
}

/** The crew phone's line under the pickers — a request, so it says who decides (owner 2026-11-05 (D)). */
export function requestLead(part: ChangeablePart, minutes: number, following: number): string {
  const to = clockAfter(part.start_at, minutes);
  const rest = following === 0 ? '' : ` and the ${following === 1 ? 'part' : `${following} parts`} after it`;
  return `Asks the hosts to move ${part.label}${rest} — ${part.label} to ${to}. Nothing changes until they approve it with one tap.`;
}

/** The request's words in the hosts' notice. */
export function requestWords(minutes: number, part: { label: string }, parts: number): string {
  const rest = parts > 1 ? ` and the ${parts - 1 === 1 ? 'part' : `${parts - 1} parts`} after it` : '';
  return `Move ${part.label}${rest} ${moveWords(minutes)}.`;
}

/** The sheet's line for Skip. */
export const skipLead = (part: ChangeablePart): string =>
  `${part.label} won’t happen today. The parts after it keep their times. The couple and your crew see it skipped; guests no longer see it.`;

/** What the floor says after the change landed — also the Undo toast's words. */
export function changedWords(change: ScheduleChange, part: { label: string } | null, moved: number): string {
  const name = part?.label ?? 'That part';
  if (change.op === 'skip') return `Skipped · ${name} · later parts keep their times`;
  if (change.op === 'unskip') return `${name} is back on the schedule`;
  return `Moved ${moveWords(change.minutes)} · ${moved} ${moved === 1 ? 'part' : 'parts'}`;
}

/** The change that undoes `change` — the same rows back by the same minutes, a skip put back. */
export function undoOf(change: ScheduleChange, moved: readonly string[] = []): ScheduleChange {
  if (change.op === 'move') return { op: 'move', blockId: change.blockId, minutes: -change.minutes, ids: moved };
  return { op: change.op === 'skip' ? 'unskip' : 'skip', blockId: change.blockId };
}

/** Guests are told only when a part THEY can see changed (shown to guests, for everyone). */
export const guestsSeePart = (b: { is_public?: boolean | null; audience?: unknown }): boolean =>
  b.is_public === true && (b.audience === null || b.audience === undefined);

/** The guests' in-app notice — one per change, nothing re-sent (plan §3 "Time moves"). */
export function guestNotice(change: ScheduleChange, part: ChangeablePart, following: number): { title: string; body: string } {
  if (change.op === 'move') {
    const to = clockAfter(part.start_at, change.minutes);
    return {
      title: `${part.label} is now at ${to}`,
      body:
        following > 0
          ? `The schedule moved ${moveWords(change.minutes)} from ${part.label} on. Open Details for the new times.`
          : `It moved ${moveWords(change.minutes)}. Open Details for the new times.`,
    };
  }
  if (change.op === 'skip') {
    return { title: `${part.label} is off the schedule`, body: 'The rest of the day keeps its times. Open Details for the schedule.' };
  }
  return { title: `${part.label} is back on the schedule`, body: 'Open Details for the schedule.' };
}
