import { plannedInstant } from '@/lib/run-of-show';

/**
 * alaala-chapters — an event's frames, split into the moments they happened in.
 *
 * Owner 2026-08-19, deciding the rule that shapes this whole file:
 *   *"chapter happens depending on the time, not who took it."*
 * So a chapter is a WINDOW OF TIME. Every schedule block makes one — guest-facing
 * or backstage — and crew photos and guest photos land in the same chapter when
 * they happened in the same hour. One timeline, never one per source.
 *
 * ══ THE HAZARD THIS FILE EXISTS TO CONTAIN ═════════════════════════════════
 * A SCHEDULE TIME AND A CAPTURE TIME ARE NOT THE SAME KIND OF VALUE.
 *
 *   `event_schedule_blocks.start_at` stores the VENUE'S WALL CLOCK in a UTC
 *   column. Production reads `Dinner 18:45+00` — that is "quarter to seven at
 *   the venue", not an instant. Proof it is a wall clock, from prod: read as
 *   instants the same day becomes Cocktails 01:00, Dinner 02:45, First Dance
 *   04:00, Send-off 05:45. No wedding runs like that.
 *
 *   `papic_photos.captured_at` is a REAL INSTANT. Prod: `04:53:49+00`, which is
 *   12:53 in Manila.
 *
 * Compare the two directly and every frame lands EIGHT HOURS off in Manila —
 * dinner photos file under hair & make-up. Nothing throws. The chapters render
 * perfectly and hold the wrong pictures, which is worse than no chapters at all.
 * This is the defect class that produced 17 live bugs here in a single day.
 *
 * Every schedule value therefore goes through `plannedInstant`, whose own
 * docblock states the rule: "Any comparison between a schedule time and `now`
 * (or any other real timestamp) must go through here."
 *
 * ⚠ AND `actual_start_at` IS ALREADY AN INSTANT — it is stamped when a block
 * really runs. It must NOT be converted. Passing it through `plannedInstant`
 * would shift it by the offset a second time, which is the same bug wearing the
 * fix's clothes.
 */

/** A schedule block as this module needs it. */
export type ChapterBlock = {
  blockId: string;
  label: string;
  /** Stored WALL CLOCK at the venue. Never an instant. */
  startAt: string;
  endAt: string | null;
  /** Stamped when the block really ran. Already a real instant. */
  actualStartAt?: string | null;
  actualEndAt?: string | null;
};

/** A photo or clip. `capturedAt` is a real instant. */
export type Frame = { id: string; capturedAt: string | null };

export type Chapter = {
  /** Stable key: the block id, or `gap:<hour-bucket>`, or `undated`. */
  key: string;
  label: string;
  /** Start of the window, ms. Null for the undated chapter. */
  startMs: number | null;
  /** True when this chapter came from a gap, not from a schedule block. */
  fromGap: boolean;
  frames: Frame[];
};

export type ChapterDay = {
  /** `YYYY-MM-DD` at the venue. */
  dayKey: string;
  chapters: Chapter[];
};

/** Venue-local parts of an instant. Intl is the only correct way to do this. */
function venueParts(ms: number, tz: string): { dayKey: string; hour: number } | null {
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ms));
    const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    const h = Number(get('hour'));
    if (!y || !m || !d || !Number.isFinite(h)) return null;
    return { dayKey: `${y}-${m}-${d}`, hour: h % 24 };
  } catch {
    return null;
  }
}

/**
 * The name a gap gets. Deliberately a TIME OF DAY and not "Untitled": the owner
 * chose "its own chapter, named by time" over folding a 14:30 frame into a
 * block that ended at 11:00, because that grouping would be a small lie.
 */
export function timeOfDayLabel(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 9) return 'Early morning';
  if (hour < 12) return 'Morning';
  if (hour < 14) return 'Midday';
  if (hour < 17) return 'Afternoon';
  if (hour < 20) return 'Evening';
  return 'Night';
}

/** A block's real window, in ms. `null` start means the block is unusable. */
function blockWindow(
  b: ChapterBlock,
  tz: string,
): { start: number; end: number | null } | null {
  // ACTUAL times are already instants — never re-convert them.
  const actualStart = b.actualStartAt ? Date.parse(b.actualStartAt) : NaN;
  if (Number.isFinite(actualStart)) {
    const actualEnd = b.actualEndAt ? Date.parse(b.actualEndAt) : NaN;
    return { start: actualStart, end: Number.isFinite(actualEnd) ? actualEnd : null };
  }
  const start = plannedInstant(b.startAt, tz);
  if (start === null) return null;
  const end = b.endAt ? plannedInstant(b.endAt, tz) : null;
  return { start, end };
}

/**
 * Split an event's frames into days, and each day into chapters.
 *
 * Nothing is ever dropped. A frame with no capture time cannot be placed in
 * time, so it lands in its own trailing chapter rather than disappearing —
 * a gallery that silently loses photographs is the one outcome worse than
 * an ugly one.
 */
export function groupIntoChapters({
  frames,
  blocks,
  tz,
}: {
  frames: Frame[];
  blocks: ChapterBlock[];
  tz: string;
}): { days: ChapterDay[]; undated: Frame[] } {
  const windows = blocks
    .map((b) => ({ block: b, win: blockWindow(b, tz) }))
    .filter((x): x is { block: ChapterBlock; win: { start: number; end: number | null } } =>
      x.win !== null,
    );

  const undated: Frame[] = [];
  // dayKey → chapterKey → chapter
  const days = new Map<string, Map<string, Chapter>>();

  for (const frame of frames) {
    const ms = frame.capturedAt ? Date.parse(frame.capturedAt) : NaN;
    if (!Number.isFinite(ms)) {
      undated.push(frame);
      continue;
    }
    const parts = venueParts(ms, tz);
    if (!parts) {
      undated.push(frame);
      continue;
    }

    // Every window that contains this instant. An open-ended block runs until
    // the next one starts, so it is treated as containing anything at or after
    // its start ONLY when nothing else claims the frame (handled by the sort).
    const containing = windows.filter(
      ({ win }) => ms >= win.start && (win.end === null ? false : ms < win.end),
    );

    let chosen = containing[0] ?? null;
    if (containing.length > 1) {
      // ⚠ OVERLAP IS REAL IN PRODUCTION, not hypothetical: one event has
      // "Hair & makeup / preparations" 08:00–12:00 overlapping "Vendor ingress
      // & styling" 10:00–13:00, so an 11:00 frame sits inside both and time
      // alone cannot choose.
      //
      // THE SHORTER WINDOW WINS. A four-hour block is background; a tighter one
      // is the thing actually happening. Ties break on the later start, then on
      // block id, so the result is stable rather than dependent on row order.
      chosen = [...containing].sort((a, b) => {
        const la = (a.win.end ?? a.win.start) - a.win.start;
        const lb = (b.win.end ?? b.win.start) - b.win.start;
        if (la !== lb) return la - lb;
        if (a.win.start !== b.win.start) return b.win.start - a.win.start;
        return a.block.blockId < b.block.blockId ? -1 : 1;
      })[0]!;
    }

    const dayKey = parts.dayKey;
    if (!days.has(dayKey)) days.set(dayKey, new Map());
    const chapters = days.get(dayKey)!;

    const key = chosen ? chosen.block.blockId : `gap:${timeOfDayLabel(parts.hour)}`;
    if (!chapters.has(key)) {
      chapters.set(key, {
        key,
        label: chosen ? chosen.block.label : timeOfDayLabel(parts.hour),
        startMs: chosen ? chosen.win.start : ms,
        fromGap: !chosen,
        frames: [],
      });
    }
    const chapter = chapters.get(key)!;
    chapter.frames.push(frame);
    // A gap chapter's start is the earliest frame in it.
    if (chapter.fromGap && chapter.startMs !== null && ms < chapter.startMs) {
      chapter.startMs = ms;
    }
  }

  const ordered: ChapterDay[] = [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dayKey, chapters]) => ({
      dayKey,
      chapters: [...chapters.values()].sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0)),
    }));

  return { days: ordered, undated };
}
