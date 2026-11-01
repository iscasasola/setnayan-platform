import { manilaDate } from '@/lib/papic-window';
import {
  scheduleWindowFor,
  scheduleWindows,
  timeOfDayLabel,
  venueDayAndHour,
  type ChapterBlock,
  type ChapterDay,
  type Frame,
} from '@/lib/alaala-chapters';

/**
 * apps/web/lib/papic-chapters.ts
 *
 * THE STORY A GALLERY TELLS — photos grouped by how far from the day they were
 * taken.
 *
 * Owner 2026-08-02: a wedding is not one day of photos, it is a journey —
 * planning, milestones, then the day itself. Travel is the days of the trip. So
 * the gallery should read as chapters rather than one flat feed, and the owner's
 * chosen labelling is a COUNTDOWN: *"split by x months away. to x days away."*
 * Far out it counts months; close in it counts days.
 *
 * ── DERIVED, NEVER FILED ──────────────────────────────────────────────────
 * A chapter is computed from `captured_at`, which every capture already stamps.
 * Nothing is stored, nobody files a photo into an album, and no new "sub-event"
 * entity exists. That matters for three reasons the alternative cannot match:
 *
 *   • a photo can never land in the WRONG chapter, or in none;
 *   • it works retroactively on every photo already taken;
 *   • move the event date and the whole gallery re-chapters itself, because the
 *     chapter was never a fact about the photo — it is a fact about the DISTANCE
 *     between the photo and the day.
 *
 * The couple already owns a run-of-show and a travel itinerary. This does not
 * compete with them: those describe the day, this describes the run-up.
 */

/** One chapter heading in a gallery. */
export type PapicChapter = {
  /** Stable grouping key — same key ⇒ same section. */
  key: string;
  /** What a person reads: "3 months to go" · "12 days to go" · "The day". */
  label: string;
  /**
   * Chronological rank, EARLIEST FIRST. Days-from-the-event negated, so a photo
   * 150 days out sorts before one 2 days out, and "after" sorts last.
   */
  sort: number;
};

/** Days between two Manila calendar dates (b - a). Null if either is unusable. */
function dayGap(aIso: string | null, bIso: string | null): number | null {
  if (!aIso || !bIso) return null;
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Average days per month. Used ONLY to name a bucket, never to decide retention
 * or money — "4 months to go" is a heading, and a heading may round.
 */
const DAYS_PER_MONTH = 30.44;

/**
 * Below this many days out, the countdown switches from months to DAYS.
 * 30 on purpose: it is the unit the owner reasons in throughout Papic (the
 * download grace, the window cap), so the gallery speaks the same language.
 */
export const COUNTDOWN_DAYS_THRESHOLD = 30;

/**
 * The chapter for one capture on an ANCHORED event (a wedding, a birthday — one
 * date everything counts toward).
 *
 * Exported for the travel path to fall back to when a trip has no start.
 */
export function countdownChapter(daysBefore: number): PapicChapter {
  // The day itself, and anything after it, are single chapters — nobody thinks
  // of the reception in months, and photos that trickle in afterwards are one
  // epilogue rather than a growing countdown running the wrong way.
  if (daysBefore <= 0) {
    return daysBefore === 0
      ? { key: 'day', label: 'The day', sort: 0 }
      : { key: 'after', label: 'After the day', sort: 1 };
  }
  if (daysBefore <= COUNTDOWN_DAYS_THRESHOLD) {
    return {
      key: `d${daysBefore}`,
      label: `${daysBefore} ${daysBefore === 1 ? 'day' : 'days'} to go`,
      sort: -daysBefore,
    };
  }
  // Rounded, floor 1: 31 days out reads "1 month to go", not "2 months" (which
  // would be a lie by a whole month on the very first bucket past the switch).
  const months = Math.max(1, Math.round(daysBefore / DAYS_PER_MONTH));
  return {
    key: `m${months}`,
    label: `${months} ${months === 1 ? 'month' : 'months'} to go`,
    // Ranked by the month's own distance so every daily bucket (all > -31)
    // sorts after every monthly one, whatever rounding did to the label.
    sort: -(months * DAYS_PER_MONTH) - COUNTDOWN_DAYS_THRESHOLD,
  };
}

/** The chapter for one capture on a ROAMING event — the days of a trip. */
export function tripDayChapter(dayNumber: number): PapicChapter {
  if (dayNumber < 1) {
    // Shot before the trip started: packing, the airport, the drive out.
    return { key: 'pre', label: 'Getting there', sort: -1 };
  }
  return { key: `t${dayNumber}`, label: `Day ${dayNumber}`, sort: dayNumber };
}

export type ChapterContext = {
  /** The date everything counts toward. Null on a trip with no fixed day. */
  eventDateIso: string | null;
  /** 'countdown' for an anchored event · 'trip' for a roaming, multi-day one. */
  mode: 'countdown' | 'trip';
  /** First day of the trip. Trip mode only. */
  tripStartIso?: string | null;
};

/**
 * The chapter one capture belongs to.
 *
 * Returns null when it cannot be placed — no event date, an unparseable capture
 * time. The caller renders those under one honest "Everything else" heading
 * rather than guessing, because a photo in the wrong chapter is worse than a
 * photo in an unnamed one. Same instinct as the untagged-still-delivered rule:
 * a capture we cannot classify is still the couple's photo.
 */
export function chapterFor(
  capturedAtIso: string,
  ctx: ChapterContext,
): PapicChapter | null {
  const captured = manilaDate(capturedAtIso);
  if (!captured) return null;

  if (ctx.mode === 'trip') {
    const start = manilaDate(ctx.tripStartIso ?? null);
    if (start) {
      const offset = dayGap(start, captured);
      if (offset == null) return null;
      return tripDayChapter(offset + 1); // day 1 is the start date itself
    }
    // A trip with no recorded start still has a date to count toward; fall
    // through to the countdown rather than returning nothing.
  }

  const anchor = manilaDate(ctx.eventDateIso);
  if (!anchor) return null;
  const daysBefore = dayGap(captured, anchor);
  if (daysBefore == null) return null;
  return countdownChapter(daysBefore);
}

/**
 * The run of show as a chapter rule — `lib/alaala-chapters.ts`'s windows (owner 2026-08-19: *"chapter happens
 * depending on the time, not who took it"*). Every schedule value is lifted there; nothing here compares a wall clock.
 */
export type ScheduleChapters = { mode: 'schedule'; blocks: readonly ChapterBlock[]; tz: string };

/** How a gallery chapters: the countdown / the days of a trip, or the run of show. */
export type ChapterRule = ChapterContext | ScheduleChapters;

/** A chapter with the items that fell into it. */
export type ChapterGroup<T> = PapicChapter & {
  items: T[];
  /** Schedule rule only: the venue day the chapter is on (`YYYY-MM-DD`). */
  dayKey?: string;
  /** Schedule rule only: the chapter came from a gap, not a schedule block. */
  fromGap?: boolean;
  /** Schedule rule only: the block id, or `gap:<time of day>` — stable within its day. */
  blockKey?: string;
};

const EVERYTHING_ELSE = 'Everything else';

/**
 * 🔗 THE ONE ENGINE — group captures into chapters, earliest first (Memories by chapter, owner 2026-11-01, plan
 * `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §4: "`groupIntoChapters` (two copies → one)"). Until then two functions
 * shared this name — this one (the countdown) and a second in `lib/alaala-chapters.ts` (the run of show) — each with its
 * own "never drop a photo" loop. Now there is one loop and two RULES: a countdown/trip (`ChapterContext`) or the run of
 * show (`{ mode: 'schedule', blocks, tz }`). `chapterDays` below is the schedule rule split by venue day.
 *
 * ⚠ EVERY item comes out the other side. Anything that cannot be placed lands in
 * a trailing "Everything else" group rather than being dropped — a gallery that
 * silently loses photos is the one bug this whole feature must not introduce.
 * Empty chapters never appear, so a couple who shot on four days sees four
 * headings, not thirty.
 */
export function groupIntoChapters<T>(
  items: readonly T[],
  capturedAtOf: (item: T) => string | null,
  rule: ChapterRule,
): ChapterGroup<T>[] {
  const byKey = new Map<string, ChapterGroup<T>>();
  const orphans: T[] = [];

  if (rule.mode === 'schedule') {
    const windows = scheduleWindows(rule.blocks, rule.tz);
    for (const item of items) {
      const at = capturedAtOf(item);
      const ms = at ? Date.parse(at) : NaN;
      const parts = Number.isFinite(ms) ? venueDayAndHour(ms, rule.tz) : null;
      if (!parts) {
        orphans.push(item);
        continue;
      }
      const chosen = scheduleWindowFor(ms, windows);
      const blockKey = chosen ? chosen.block.blockId : `gap:${timeOfDayLabel(parts.hour)}`;
      const key = `${parts.dayKey}|${blockKey}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.items.push(item);
        // A gap chapter starts at the earliest frame in it.
        if (existing.fromGap && ms < existing.sort) existing.sort = ms;
        continue;
      }
      byKey.set(key, {
        key,
        label: chosen ? chosen.block.label : timeOfDayLabel(parts.hour),
        sort: chosen ? chosen.win.start : ms,
        dayKey: parts.dayKey,
        fromGap: !chosen,
        blockKey,
        items: [item],
      });
    }
  } else {
    for (const item of items) {
      const chapter = chapterFor(capturedAtOf(item) ?? '', rule);
      if (!chapter) {
        orphans.push(item);
        continue;
      }
      const existing = byKey.get(chapter.key);
      if (existing) existing.items.push(item);
      else byKey.set(chapter.key, { ...chapter, items: [item] });
    }
  }

  const groups = [...byKey.values()].sort((a, b) => {
    const da = a.dayKey ?? '';
    const db = b.dayKey ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return a.sort - b.sort;
  });
  if (orphans.length > 0) {
    groups.push({
      key: 'other',
      label: EVERYTHING_ELSE,
      sort: Number.MAX_SAFE_INTEGER,
      items: orphans,
    });
  }
  return groups;
}

/**
 * The run of show's chapters, split by venue day — the ONE engine above, in the shape the day-by-day galleries draw
 * (`days` · `undated`). Nothing is dropped: a frame with no usable capture time is `undated`.
 */
export function chapterDays({
  frames,
  blocks,
  tz,
}: {
  frames: Frame[];
  blocks: readonly ChapterBlock[];
  tz: string;
}): { days: ChapterDay[]; undated: Frame[] } {
  const groups = groupIntoChapters(frames, (f) => f.capturedAt, { mode: 'schedule', blocks, tz });
  const days: ChapterDay[] = [];
  let undated: Frame[] = [];
  for (const g of groups) {
    if (!g.dayKey) {
      undated = g.items;
      continue;
    }
    let day = days[days.length - 1];
    if (!day || day.dayKey !== g.dayKey) {
      day = { dayKey: g.dayKey, chapters: [] };
      days.push(day);
    }
    day.chapters.push({ key: g.blockKey ?? g.key, label: g.label, startMs: g.sort, fromGap: g.fromGap === true, frames: g.items });
  }
  return { days, undated };
}
