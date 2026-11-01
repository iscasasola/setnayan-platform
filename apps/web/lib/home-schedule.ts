/**
 * lib/home-schedule.ts — HOME'S SCHEDULE WIDGET, AS FACTS (owner 2026-11-01, DECISION_LOG "SCHEDULE AND BUDGET GO TO
 * HOME" · "HOME PROTOTYPE APPROVED"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §5, approved prototype
 * `prototypes/home_frames_where_you_act_2026-11-01/`).
 *
 * Owner, verbatim: *"Happening now: chapter with exact schedule if there is"* · *"What's next: next schedule/s"* ·
 * *"Multiple schedules can run at the same time. So all happening now will show."* · and on the doors: *"Keep the
 * doors"*.
 *
 *   HAPPENING NOW — EVERY chapter running now (a chapter is a top-level `event_schedule_blocks` row, read through
 *                   `chaptersFromBlocks`), each with its running moment when one is (the "exact schedule"). Never only
 *                   the first: `pickTriggerNowNext` returns ONE block, which is why this reader exists (§5 ⚠).
 *   WHAT'S NEXT   — the next chapter, or all of them when they start together; then the group after ("Then").
 *   THE DOORS     — N to approve (open supplier requests) · Release (the last week, ◆ PRO on Free) · N need you (the
 *                   same person or crew in two places at once, `findTaskClashes`) · N owe times (a booked supplier the
 *                   schedule names on nothing yet).
 *
 * Pure: no React, no I/O, no clock of its own (`nowMs` is handed in). Every time is a WALL CLOCK at the venue
 * (`lib/schedule-chapters.ts`), compared with now only through `plannedInstant` — never a zone sum of its own.
 */
import { TIME_TBA, chaptersFromBlocks, clockWords, findTaskClashes, wallDay, type Chapter, type MomentLike, type TaskRow } from '@/lib/schedule-chapters';
import { plannedInstant } from '@/lib/run-of-show';

/** One stored block, as the widget reads it — chapters and their moments in ONE read (`HOME_SCHEDULE_FIELDS`). */
export type HomeScheduleBlock = {
  block_id: string;
  parent_block_id: string | null;
  label: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  spot: string | null;
  responsible_vendor_ids?: string[] | null;
} & Record<string, unknown>;

/** One line of a face: the chapter (k) and when · what · where (v). `chapterId` is what a tap on it opens. */
export type HomeScheduleLine = { chapterId: string; k: string; v: string };

export type HomeScheduleFacts = {
  /** How many chapters the event has — 0 = none yet (a measured zero: the read answered). */
  chapters: number;
  /** Every chapter running now, in start order. */
  now: HomeScheduleLine[];
  /** The next chapter(s) — every one starting at the same minute. */
  next: HomeScheduleLine[];
  /** The group after `next` (drawn only when nothing is running). */
  then: HomeScheduleLine[];
  /** Open supplier requests (`event_schedule_suggestions`, status open). */
  toApprove: number;
  /** Clashes — the same person or crew in two places at once. */
  needYou: number;
  /** Booked suppliers the schedule names on nothing yet. */
  oweTimes: number;
};

/** What a chapter is busy for: its own end, else its last moment's end or start, else one hour. */
function chapterEndMs(c: Chapter, kids: readonly HomeScheduleBlock[], tz: string): number | null {
  const start = plannedInstant(c.start_at, tz);
  if (start === null) return null;
  const own = c.end_at ? plannedInstant(c.end_at, tz) : null;
  if (own !== null && own > start) return own;
  let last = start;
  for (const k of kids) {
    const e = k.end_at ? plannedInstant(k.end_at, tz) : null;
    const s = k.start_at ? plannedInstant(k.start_at, tz) : null;
    last = Math.max(last, e ?? s ?? last);
  }
  return last > start ? last : start + 60 * 60_000;
}

const SHORT_DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "Sat, Nov 7" from a wall-clock day (its UTC components ARE the venue's day). */
function dayWords(iso: string): string {
  const d = wallDay(iso);
  if (!d) return '';
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) ? SHORT_DAY.format(new Date(t)) : '';
}

function placeOf(b: { location: string | null; spot: string | null }): string | null {
  if (b.location && b.spot) return `${b.location} · ${b.spot}`;
  return b.location ?? b.spot ?? null;
}

/**
 * The event's blocks + what waits on the hosts → the widget's facts. `today` is the venue's day ("2026-12-12"): a line
 * on it says only its clock; any other day says "Sat, Nov 7 · 2:00 PM".
 */
export function homeScheduleFrom(i: {
  blocks: readonly HomeScheduleBlock[];
  tasks: readonly TaskRow[];
  openRequests: number;
  bookedVendorIds: readonly string[];
  nowMs: number;
  tz: string;
  today: string;
}): HomeScheduleFacts {
  const chapters = chaptersFromBlocks(i.blocks);
  const kidsOf = new Map<string, HomeScheduleBlock[]>();
  for (const b of i.blocks) {
    if (b.parent_block_id) kidsOf.set(b.parent_block_id, [...(kidsOf.get(b.parent_block_id) ?? []), b]);
  }
  const when = (iso: string) => {
    const clock = clockWords(iso);
    return wallDay(iso) === i.today ? clock : [dayWords(iso), clock].filter(Boolean).join(' · ');
  };

  const now: HomeScheduleLine[] = [];
  const upcoming: Array<{ at: number; line: HomeScheduleLine }> = [];
  for (const c of chapters) {
    const kids = (kidsOf.get(c.block_id) ?? []).slice().sort((a, b) => String(a.start_at ?? '').localeCompare(String(b.start_at ?? '')));
    // ⏰ TIME TBA (#7151, `time_tba`): the chapter's DAY is known, its clock is not — never "happening now" (a guessed
    // midnight), and in What's next only from a later day, saying "Time TBA" in place of a clock.
    if (c.time_tba) {
      const day = wallDay(c.start_at);
      const dayStart = plannedInstant(`${day}T00:00`, i.tz);
      if (day > i.today && dayStart !== null) {
        upcoming.push({ at: dayStart, line: { chapterId: c.block_id, k: c.label, v: [dayWords(c.start_at), TIME_TBA, placeOf(c)].filter(Boolean).join(' · ') } });
      }
      continue;
    }
    const start = plannedInstant(c.start_at, i.tz);
    const end = chapterEndMs(c, kids, i.tz);
    if (start === null || end === null) continue;
    if (start <= i.nowMs && i.nowMs < end) {
      // The exact line: the moment running inside it, if one is (its end, else the next moment's start, else the chapter's).
      const running = kids.find((k, n) => {
        const ks = k.start_at ? plannedInstant(k.start_at, i.tz) : null;
        if (ks === null || ks > i.nowMs) return false;
        const ke = k.end_at ? plannedInstant(k.end_at, i.tz) : null;
        const after = kids[n + 1]?.start_at ? plannedInstant(kids[n + 1]!.start_at!, i.tz) : null;
        return i.nowMs < (ke ?? after ?? end);
      });
      const v = running
        ? [clockWords(running.start_at), running.label, placeOf(running)].filter(Boolean).join(' · ')
        : [clockWords(c.start_at), placeOf(c)].filter(Boolean).join(' · ');
      now.push({ chapterId: c.block_id, k: c.label, v });
    } else if (start > i.nowMs) {
      upcoming.push({ at: start, line: { chapterId: c.block_id, k: c.label, v: [when(c.start_at), placeOf(c)].filter(Boolean).join(' · ') } });
    }
  }
  upcoming.sort((a, b) => a.at - b.at);
  const firstAt = upcoming[0]?.at;
  const next = upcoming.filter((u) => u.at === firstAt).map((u) => u.line);
  const thenAt = upcoming.find((u) => u.at !== firstAt)?.at;
  const then = thenAt === undefined ? [] : upcoming.filter((u) => u.at === thenAt).map((u) => u.line);

  // ⚠ Clashes — every task placed on its moment and that moment's chapter (`findTaskClashes`, flagged never blocked).
  const byId = new Map(i.blocks.map((b) => [b.block_id, b]));
  const at = i.tasks.flatMap((task) => {
    const m = byId.get(task.block_id);
    if (!m || !m.start_at) return [];
    const moment: MomentLike = { block_id: m.block_id, start_at: m.start_at, end_at: m.end_at, location: m.location, spot: m.spot };
    const parent = m.parent_block_id ? byId.get(m.parent_block_id) : null;
    return [{ task, moment, chapter: parent ? { location: parent.location, spot: parent.spot } : null }];
  });
  const needYou = findTaskClashes(at).length;

  // Who the schedule names: tagged on a block, or holding a task.
  const named = new Set<string>();
  for (const b of i.blocks) for (const v of b.responsible_vendor_ids ?? []) named.add(v);
  for (const t of i.tasks) if (t.vendor_id) named.add(t.vendor_id);
  const oweTimes = new Set(i.bookedVendorIds.filter((v) => !named.has(v))).size;

  return { chapters: chapters.length, now, next, then, toApprove: i.openRequests, needYou, oweTimes };
}

/** Release shows in the last week before the day, and on the day (plan §3b: "Release (one week out, Pro)"). */
export const RELEASE_DAYS_BEFORE = 7;
export function releaseOpen(daysToGo: number | null): boolean {
  return daysToGo !== null && daysToGo >= 0 && daysToGo <= RELEASE_DAYS_BEFORE;
}
