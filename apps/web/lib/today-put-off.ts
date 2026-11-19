/**
 * lib/today-put-off.ts — "DO IT TOMORROW" (Today v3 part 2 · pure, no I/O, no clock of its own).
 *
 * Owner, 19 Nov 2026, on the drawing `Today, tap opens a card` v3.5 (artifact F4vQbaCwFtu2iawYd2r6q2):
 * *"so it is drag left to do tomorrow / drag right open it / tap to open a quick way to resond"* · on putting a task
 * off again and again: *"yes. except urgent"* · *"you cannot delete a task until its complete"*.
 *
 *   · A put-off is a record (migration `supplier_today_put_offs`): which shop, which task, until which Manila day.
 *   · It is ACTIVE while `until_day` is after today. On `until_day` the task is back on Today by itself.
 *   · A RED row (Overdue · Today) can never go to tomorrow: it has no "Do it tomorrow", a drag left springs back with
 *     "Urgent · can't go to tomorrow", and a record left over from before it turned red is IGNORED — an urgent task is
 *     never hidden.
 *   · There is no delete: a task leaves Today only by being finished, or by going to tomorrow — and it comes back.
 *
 * 🔒 lib/today-put-off.test.ts · app/vendor-dashboard/_components/today-rows-drag-both-ways.test.ts
 */

/** A Today row key the record may hold — the same shape the table's CHECK allows. */
export const PUT_OFF_KEY = /^[A-Za-z0-9_-]{1,120}$/;

/** The words the drawing uses (V3 · 2 · 2b), in one place. */
export const PUT_OFF_WORDS = {
  link: 'Do it tomorrow',
  pane: 'Tomorrow',
  back: 'Back on Today tomorrow',
  moved: 'Moved to tomorrow',
  undo: 'Undo',
  refused: 'Urgent · can’t go to tomorrow',
  failed: 'That did not go through. Please try again.',
  heading: 'Tomorrow',
} as const;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` + one calendar day (UTC arithmetic on a date with no time — no zone can shift it). */
export function tomorrowOf(todayIso: string): string {
  if (!ISO_DAY.test(todayIso)) throw new Error(`tomorrowOf: not a day: ${todayIso}`);
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type PutOffRecord = { task_key: string; until_day: string };

/**
 * The records that still hold a task off Today. `null` = the records could NOT be read — then no task is held off
 * (every task stays listed, which is the honest side: an unread record never hides work).
 */
export function activePutOffs(rows: readonly PutOffRecord[] | null, todayIso: string): Set<string> {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    if (typeof r?.task_key !== 'string' || !PUT_OFF_KEY.test(r.task_key)) continue;
    if (typeof r.until_day !== 'string' || !ISO_DAY.test(r.until_day.slice(0, 10))) continue;
    if (r.until_day.slice(0, 10) > todayIso) out.add(r.task_key);
  }
  return out;
}

/** May this row go to tomorrow? Every level but red (ruled 19 Nov: "yes. except urgent"). */
export function canPutOff(level: 'red' | 'amber' | null | undefined): boolean {
  return level !== 'red';
}

/* ─── THE DRAG (V3 · 2b) — two directions, the shipped swipe's own numbers ────────────────────────────────────────
 * The action area is the shipped `SWIPE_REVEAL_PX` (84) wide; past HALF of it (42) the drag counts. Right opens the
 * task's page; left moves it to tomorrow. A red row dragged left follows about a THIRD of the finger and always
 * springs back. These are plain functions so the gesture is tested without a DOM. */

export type DragOutcome = 'open' | 'tomorrow' | 'refused' | 'back';

/** Where the row sits for a finger `dx` px from where it started. */
export function dragOffset(dx: number, red: boolean, reveal: number): number {
  const right = Math.min(reveal, Math.max(0, dx));
  if (dx >= 0) return right;
  const left = Math.max(-reveal, dx);
  return red ? Math.round(left / 3) : left;
}

/** What letting go at offset `tx` does. A red row dragged left past a small nudge is "refused" (the toast says why). */
export function dragOutcome(tx: number, red: boolean, reveal: number): DragOutcome {
  const half = reveal / 2;
  if (tx >= half) return 'open';
  if (red && tx <= -half / 3) return 'refused';
  if (!red && tx <= -half) return 'tomorrow';
  return 'back';
}

/** Has the drag passed halfway — the moment the pane's colour and icon fill in (motion "Status change"). */
export function dragArmed(tx: number, red: boolean, reveal: number): 'open' | 'tomorrow' | null {
  if (tx >= reveal / 2) return 'open';
  if (!red && tx <= -reveal / 2) return 'tomorrow';
  return null;
}
