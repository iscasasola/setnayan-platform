/**
 * story-spine.ts — the geometry and the arithmetic of the story's clock.
 *
 * `01_The_Story.md` §1 · `08` step 2.1 · ported from
 * `Design_Editorial_By_The_Minute_2026-09-07/prototypes/story.html`.
 *
 * The public page stops being a list of sections and becomes the event's clock:
 *
 *     THE ROAD ──────────────┃ DAY 1 ┊ DAY 2 ─────────────┃ AFTER
 *     how it was made        ┃ one segment per calendar day┃ what came after
 *
 * PURE + total. No React, no `server-only`, no I/O, no `Date.now()` — every
 * function takes the instants it needs. That is what lets the guard exercise the
 * real arithmetic instead of a class name in a stylesheet, and it is why the
 * axis maths lives here rather than inside the client component that draws it.
 *
 * ⚠ MANILA, ALWAYS. A "day" is a Manila calendar day (`PAPIC_TZ_OFFSET`, no
 * DST), never the runtime's local zone and never a bare UTC day slice. CI runs
 * in UTC, which hides both mistakes: a 1 a.m. Manila capture is 5 p.m. UTC the
 * day before, so a UTC slice draws it on the wrong day's bar. `manilaDayOf`
 * (lib/story-day-window.ts) is the only correct way to ask which day a capture
 * is on; `manilaMinuteOfDay` below is the only correct way to ask what time it
 * says on the venue's wall.
 */

import { PAPIC_TZ_OFFSET } from '@/lib/papic-window';

// ─── The axis ───────────────────────────────────────────────────────────────
//
// One thousand units wide, exactly as the prototype's `viewBox="0 0 1000 58"`.
// The SVG stretches (`preserveAspectRatio="none"`) so a unit is not a pixel;
// nothing that has to stay legible may be drawn inside it. That is the whole
// reason the dial's LABELS are HTML positioned in percent of this same axis —
// SVG <text> in a stretched viewBox was squashing every label to ~35% width on
// a phone (review finding). `percentOf` below is the bridge between the two.

/** The dial's coordinate space. Not pixels — see the note above. */
export const DIAL_WIDTH = 1000;

/** How the road · the days · after divide the axis. */
export const ROAD_BAND = { x0: 0, x1: 300 } as const;
export const DAY_BAND = { x0: 312, x1: 940 } as const;
export const AFTER_BAND = { x0: 950, x1: 1000 } as const;

/** Blank axis between one calendar day's segment and the next. */
const DAY_GUTTER = 12;

/** A day narrower than this is unreadable however short its span really was. */
const MIN_DAY_WIDTH = 60;

/** Axis position → a CSS percentage, for the HTML label layer. */
export function percentOf(x: number): string {
  return `${((x / DIAL_WIDTH) * 100).toFixed(3)}%`;
}

// ─── Manila wall-clock ──────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000;

/**
 * Minutes since Manila midnight for a real instant — 0 … 1439.
 *
 * ⚠ NOT `new Date(iso).getHours()`. That reads the RUNTIME's zone: correct on
 * the owner's laptop, eight hours wrong on Vercel, and silently so. The offset
 * is applied to the epoch value instead, which needs no zone database and
 * cannot drift.
 */
export function manilaMinuteOfDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return manilaMinuteOfDayMs(ms);
}

/** Same, from epoch milliseconds. */
export function manilaMinuteOfDayMs(ms: number): number | null {
  if (!Number.isFinite(ms)) return null;
  const offsetMinutes = parseOffsetMinutes(PAPIC_TZ_OFFSET);
  const shifted = ms + offsetMinutes * MS_PER_MINUTE;
  const dayMs = 24 * 60 * MS_PER_MINUTE;
  const intoDay = ((shifted % dayMs) + dayMs) % dayMs;
  return Math.floor(intoDay / MS_PER_MINUTE);
}

/** '+08:00' → 480. Written out rather than hard-coded so the constant stays the
 *  single source of the offset even if it ever moves. */
function parseOffsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * The real instant of a Manila wall-clock minute on a given calendar day —
 * the inverse of `manilaMinuteOfDay`.
 *
 * ⚠ THE OFFSET IS IMPORTED, NEVER TYPED OUT. A second `'+08:00'` in the tree is
 * a second thing to change, and the one that gets missed is always the one on
 * the page nobody opened that week.
 */
export function manilaInstantAt(dateStr: string, minuteOfDay: number): number {
  const wrapped = Math.max(0, Math.min(1439, Math.round(minuteOfDay)));
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const m = String(wrapped % 60).padStart(2, '0');
  const t = Date.parse(`${dateStr}T${h}:${m}:00${PAPIC_TZ_OFFSET}`);
  return Number.isFinite(t) ? t : Number.NaN;
}

/** 1152 → { t: '7:12', ap: 'PM' }. Tabular, 12-hour, the way the stamp reads. */
export function formatClock(minuteOfDay: number): { t: string; ap: 'AM' | 'PM' } {
  const wrapped = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const mm = String(wrapped % 60).padStart(2, '0');
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return { t: `${h}:${mm}`, ap };
}

// ─── The days ───────────────────────────────────────────────────────────────

/** One calendar day the event covers, before it is placed on the axis. */
export type SpineDayInput = {
  /** Manila calendar date, 'YYYY-MM-DD'. */
  date: string;
  /** Manila minute-of-day of every written minute on this day. May be empty. */
  minutes: readonly number[];
};

/** The same day, placed. `x0`/`x1` are axis units; `startMin`/`endMin` its own clock. */
export type SpineDay = {
  date: string;
  startMin: number;
  endMin: number;
  x0: number;
  x1: number;
};

/**
 * The clock a day is drawn against.
 *
 * A day's segment does NOT run midnight to midnight — 40% of the axis would be
 * a sleeping venue. It runs from the hour before its first written minute to
 * the half-hour after its last, so "the day keeps its real proportions" is a
 * statement about the hours that happened, not the hours on a clock face.
 *
 * A day with no written minute yet (nothing has been named, or the guests'
 * layer is withheld from this reader) still gets a segment — the dial is where
 * a reader learns a day exists — and falls back to a plain daytime span.
 */
export function dayClock(minutes: readonly number[]): { startMin: number; endMin: number } {
  const clean = minutes.filter((m) => Number.isFinite(m)).map((m) => Math.max(0, Math.min(1439, m)));
  if (clean.length === 0) return { startMin: 8 * 60, endMin: 22 * 60 };
  const lo = Math.min(...clean);
  const hi = Math.max(...clean);
  let startMin = Math.max(0, Math.floor((lo - 60) / 60) * 60);
  let endMin = Math.min(1440, Math.ceil((hi + 30) / 30) * 30);
  // A single written minute would otherwise give a 90-minute day whose one bar
  // fills the segment. Widen to a readable span around it.
  if (endMin - startMin < 120) {
    const mid = (startMin + endMin) / 2;
    startMin = Math.max(0, Math.floor((mid - 60) / 60) * 60);
    endMin = Math.min(1440, startMin + 120);
  }
  return { startMin, endMin };
}

/**
 * Place every calendar day on the day band, in order.
 *
 * Width is proportional to the day's OWN span, so a ten-hour wedding day and
 * the two-hour despedida the night before are not drawn the same size — the
 * mistake that made the prototype's first cut read as two equal days. Every day
 * still gets `MIN_DAY_WIDTH`, because a segment nobody can hit is not a segment.
 */
export function layOutDays(days: readonly SpineDayInput[]): SpineDay[] {
  if (days.length === 0) return [];
  const clocks = days.map((d) => dayClock(d.minutes));
  const gutters = DAY_GUTTER * (days.length - 1);
  const usable = Math.max(1, DAY_BAND.x1 - DAY_BAND.x0 - gutters);

  const spans = clocks.map((c) => Math.max(1, c.endMin - c.startMin));
  const totalSpan = spans.reduce((a, b) => a + b, 0);

  // Proportional first, then lift anything under the floor and take the
  // difference back off the days that are over it, largest first — so the floor
  // never pushes the last day off the end of the band.
  const widths = spans.map((s) => (s / totalSpan) * usable);
  const floor = Math.min(MIN_DAY_WIDTH, usable / days.length);
  let debt = 0;
  for (let i = 0; i < widths.length; i += 1) {
    if (widths[i]! < floor) {
      debt += floor - widths[i]!;
      widths[i] = floor;
    }
  }
  if (debt > 0) {
    const donors = widths
      .map((w, i) => ({ i, slack: w - floor }))
      .filter((d) => d.slack > 0)
      .sort((a, b) => b.slack - a.slack);
    const totalSlack = donors.reduce((a, d) => a + d.slack, 0);
    if (totalSlack > 0) {
      for (const d of donors) {
        widths[d.i] = widths[d.i]! - (d.slack / totalSlack) * Math.min(debt, totalSlack);
      }
    }
  }

  const out: SpineDay[] = [];
  let cursor = DAY_BAND.x0;
  days.forEach((d, i) => {
    const w = widths[i]!;
    out.push({
      date: d.date,
      startMin: clocks[i]!.startMin,
      endMin: clocks[i]!.endMin,
      x0: cursor,
      x1: cursor + w,
    });
    cursor += w + DAY_GUTTER;
  });
  return out;
}

/** Where a minute-of-day sits on that day's segment. Clamped to the segment. */
export function dayX(day: SpineDay, minuteOfDay: number): number {
  const span = Math.max(1, day.endMin - day.startMin);
  const f = Math.min(1, Math.max(0, (minuteOfDay - day.startMin) / span));
  return day.x0 + f * (day.x1 - day.x0);
}

/**
 * Where a road date sits on the road band.
 *
 * The road runs from the day the date was set to the night before day one, and
 * a date outside that span is clamped rather than dropped — a story whose road
 * facts predate `events.created_at` (an imported event, a backfilled love
 * story) still has somewhere to put them.
 */
export function roadX(atMs: number, startMs: number, endMs: number): number {
  const span = Math.max(1, endMs - startMs);
  const f = Math.min(1, Math.max(0, (atMs - startMs) / span));
  return ROAD_BAND.x0 + f * (ROAD_BAND.x1 - ROAD_BAND.x0);
}

/** Where an "after" date sits. Same clamping, same reason. */
export function afterX(atMs: number, startMs: number, endMs: number): number {
  const span = Math.max(1, endMs - startMs);
  const f = Math.min(1, Math.max(0, (atMs - startMs) / span));
  return AFTER_BAND.x0 + f * (AFTER_BAND.x1 - AFTER_BAND.x0);
}

// ─── The bins ───────────────────────────────────────────────────────────────

/**
 * Bucket width for `story_dial_bucket_counts`, in minutes.
 *
 * Five minutes is the design's resolution (§1) and the right answer for a one-
 * or two-day event. A seven-day trip at five minutes is 2,016 buckets crossing
 * the wire to draw a strip a few hundred pixels wide, so the width grows to keep
 * the payload near `MAX_DIAL_BINS`. It only ever grows — a coarser bar is a
 * blunter bar, never a wrong one.
 *
 * ⚠ The RPC itself clamps to 1…180 and would loop forever on 0; this never
 * returns either, and the guard asserts that.
 */
export const DIAL_BUCKET_MINUTES = 5;
export const MAX_DIAL_BINS = 720;

export function dialBucketMinutes(days: number): number {
  const d = Math.max(1, Math.floor(days));
  const wanted = (d * 1440) / MAX_DIAL_BINS;
  const stepped = Math.ceil(wanted / DIAL_BUCKET_MINUTES) * DIAL_BUCKET_MINUTES;
  return Math.min(180, Math.max(DIAL_BUCKET_MINUTES, stepped));
}

// ─── Gaps ───────────────────────────────────────────────────────────────────

/**
 * The distance between two written minutes, drawn AS A GAP.
 *
 * "4 h 8 m — golden hour · the reception opens · the toasts run long." The day
 * keeps its real proportions only if the empty stretches are visible; a list
 * that runs 11:20 → 2:38 → 3:04 → 7:12 with even spacing tells the reader the
 * afternoon was as busy as the ceremony.
 *
 * Null under the threshold: two minutes eight apart do not need a rule drawn
 * between them saying so.
 */
export const GAP_MINUTES_THRESHOLD = 25;

export function gapText(fromMinute: number, toMinute: number): string | null {
  const mins = Math.round(toMinute - fromMinute);
  if (!Number.isFinite(mins) || mins < GAP_MINUTES_THRESHOLD) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

// ─── The films ──────────────────────────────────────────────────────────────

/**
 * ONE CARD PER BROADCAST SESSION, NOT ONE FILM (§6).
 *
 * 🔴 A single 2h48 file cannot span 2:38 PM → 9:47 PM. The shipped page reads
 * ONE `watchFilmEmbedUrl` — the most recent completed broadcast — and a timecode
 * measured against it puts the money dance at hour seven of a three-hour video.
 * A minute's timecode is its clock time minus THAT SESSION'S own `went_live_at`,
 * and a minute inside no session has no timecode at all.
 */
export type BroadcastSession = {
  /** YouTube video id — already through `isYouTubeVideoId`, never a raw column. */
  videoId: string;
  /** When this session actually went live, epoch ms. */
  liveAtMs: number;
  /** When it ended, epoch ms. Null → still running / never stamped. */
  endedAtMs: number | null;
};

export type FilmTimecode = {
  videoId: string;
  /** Seconds into that session's recording. */
  seconds: number;
  /** '0:44:00' — hours are always shown, the way a broadcast timecode reads. */
  label: string;
};

/**
 * How long after `went_live_at` a session with no `ended_at` is still assumed
 * to be running. A broadcast row whose end was never stamped (the controller
 * crashed, the operator closed the tab) otherwise swallows every minute for the
 * rest of the story, and stamps a timecode of thirteen hours on the morning
 * after. Twelve hours is longer than any single Setnayan broadcast has run.
 */
const OPEN_SESSION_HOURS = 12;

export function filmTimecode(
  atMs: number,
  sessions: readonly BroadcastSession[],
): FilmTimecode | null {
  if (!Number.isFinite(atMs)) return null;
  for (const s of sessions) {
    if (!Number.isFinite(s.liveAtMs) || atMs < s.liveAtMs) continue;
    const end = s.endedAtMs ?? s.liveAtMs + OPEN_SESSION_HOURS * 3_600_000;
    if (atMs >= end) continue;
    const seconds = Math.floor((atMs - s.liveAtMs) / 1000);
    return { videoId: s.videoId, seconds, label: timecodeLabel(seconds) };
  }
  return null;
}

/** 2640 → '0:44:00'. */
export function timecodeLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
}

// ─── The room ───────────────────────────────────────────────────────────────

/**
 * OWNER LOCK 6 — assigned seats exist ONLY while the reception venue is in use.
 *
 * 🔒 DERIVED FROM THE BLOCK IN USE, NEVER FROM A CLOCK THRESHOLD. "After 5:30
 * PM" is a fact about one wedding, and the story renders every event: a garden
 * ceremony that runs late, a reception that starts at noon, a wake with no
 * seating at all. Before the reception there is no plan, because a photograph
 * taken during the ceremony belongs to a person, not to a table.
 *
 * `send_off` and `after_party` are deliberately OUT. They are the end of the
 * night and frequently somewhere else entirely; attributing a capture to a
 * table the guest has already left from is a claim about where somebody was.
 */
export const SEATED_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'reception',
  'dinner',
  'program',
  'dancing',
]);

export type VenueState = 'before' | 'ceremony' | 'unseated' | 'seated' | 'no_venue';

export type VenueBlock = {
  label: string | null;
  blockType: string | null;
  startMs: number;
  endMs: number;
  location: string | null;
  /**
   * The suppliers this block is theirs to run
   * (`event_schedule_blocks.responsible_vendor_ids`), resolved to names.
   *
   * 🔑 THIS IS HOW A SUPPLIER IS CREDITED FOR A MINUTE, and it is the whole
   * "Made by" layer. The alternative — crediting every supplier on every
   * minute — is not a credit, it is a footer.
   */
  vendorNames: string[];
};

/** The block a minute falls inside, or null for the gaps between them. */
export function blockAt(atMs: number, blocks: readonly VenueBlock[]): VenueBlock | null {
  for (const b of blocks) {
    if (atMs >= b.startMs && atMs < b.endMs) return b;
  }
  return null;
}

/**
 * Which state the venue was in at this instant.
 *
 * `no_venue` is the honest answer for an event with no schedule at all — a
 * roaming celebration, a hangout, a story built before anyone wrote a run of
 * show. It is NOT the same as `before`, which means the day had a plan and this
 * minute happened ahead of it.
 */
export function venueStateAt(atMs: number, blocks: readonly VenueBlock[]): VenueState {
  if (blocks.length === 0) return 'no_venue';
  for (const b of blocks) {
    if (atMs < b.startMs || atMs >= b.endMs) continue;
    if (b.blockType && SEATED_BLOCK_TYPES.has(b.blockType)) return 'seated';
    if (b.blockType === 'ceremony') return 'ceremony';
    return 'unseated';
  }
  const first = blocks.reduce((p, c) => (c.startMs < p.startMs ? c : p), blocks[0]!);
  return atMs < first.startMs ? 'before' : 'unseated';
}

// ─── The edition ────────────────────────────────────────────────────────────

// Setnayan awards-cycle Volume for an event date. The edition year runs
// Nov 18 → Nov 17 (not Jan–Dec): Vol. I = Nov 18 2026 → Nov 17 2027, Vol. II =
// Nov 18 2027 → Nov 17 2028, … A December wedding starts a Volume; the following
// June is still that same Volume. Clamped to ≥ I — the inaugural edition covers
// anything before the first cycle's Nov-18-2026 start.
//
// ⚠ MOVED HERE FROM `editorial-content.tsx`, NOT COPIED. The cover and the
// colophon must print the same volume, and the shipped copy lived inside a
// server component that imports the admin client — unreachable from the client
// half of the dial and from a unit test. One definition, in the pure module.
const AWARDS_CUTOFF_MONTH = 11; // November
const AWARDS_CUTOFF_DAY = 18; // 18th

export function editionVolume(eventDate: string | null): number {
  if (!eventDate) return 1;
  const [y, m, d] = eventDate.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const onOrAfterCutoff =
    m > AWARDS_CUTOFF_MONTH || (m === AWARDS_CUTOFF_MONTH && d >= AWARDS_CUTOFF_DAY);
  const cycleStartYear = onOrAfterCutoff ? y : y - 1;
  return Math.max(1, cycleStartYear - 2025);
}

// Volume number as a masthead Roman numeral (1 → I, 2 → II, …).
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return 'I';
  const table: Array<[number, string]> = [
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
    [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = Math.floor(n);
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

/**
 * THE EDITION NUMBER APPEARS ONLY AT PUBLISH (§3.1, review finding).
 *
 * 🔴 Before publish the masthead reads "Vol. I" alone. `editionNo` is
 * recomputed on every render (`03` §2.4) — it counts the event's place in the
 * awards cycle as the cycle stands TODAY — so a number shown before publish is
 * a number that can still change, printed under the words "theirs forever". A
 * couple who opens their draft on Tuesday as No. 3 and publishes on Friday as
 * No. 5 was told something untrue, by us, twice. The volume is a property of
 * the date alone and is safe to show; the number is not.
 */
export function mastheadEdition(
  eventDate: string | null,
  editionNo: number | null,
  published: boolean,
): string {
  const vol = `Vol. ${toRoman(editionVolume(eventDate))}`;
  if (!published || editionNo == null) return vol;
  return `${vol} · No. ${editionNo}`;
}
