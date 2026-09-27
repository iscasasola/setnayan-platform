/**
 * The Schedule's time rail — the pure half (Schedule rebuild slice 1,
 * 2026-09-27; build spec `prototypes/schedule_redesign_2026-09-25.html`,
 * approved in DECISION_LOG "SCHEDULE REDESIGN PROTOTYPE APPROVED").
 *
 * The Event Day view draws the day as a rail: an hour ruler, every moment a
 * block whose top is its start and whose height is its length, a tap on an
 * empty stretch adds a moment there, and a drag moves or resizes one, snapping
 * to five minutes. Everything that turns stored rows into positions — and a
 * drag back into stored times — lives here, with no React and no clock, so the
 * arithmetic is tested rather than eyeballed.
 *
 * ── THE ONE RULE ABOUT TIME ──────────────────────────────────────────────
 * `event_schedule_blocks.start_at` holds the VENUE'S WALL CLOCK written into a
 * UTC column (see `lib/schedule-datetime-local.ts`): a 2 PM ceremony is
 * `…T14:00:00Z`. So every read here takes the UTC components, and every write
 * builds a `datetime-local` string from those same components — the shape the
 * existing server actions already parse (`fromDatetimeLocalValue`). There is
 * no timezone arithmetic anywhere in this file, on purpose: the value is not
 * an instant, and treating it as one is what once moved weddings eight hours.
 */

/** Every drag and stepper lands on a multiple of this. Owner-approved spec. */
export const SNAP_MINUTES = 5;

/** A moment with no end time is drawn this long, so it can still be tapped. */
export const OPEN_ENDED_MINUTES = 30;

/** The shortest a resize may make a moment. */
export const MIN_MOMENT_MINUTES = 5;

/** The smallest empty stretch worth offering as "tap to add". */
export const MIN_GAP_MINUTES = 15;

const DAY = 24 * 60;

/** "YYYY-MM-DD" of a stored time's wall-clock date (UTC components). */
export function wallDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minutes since that wall-clock date's midnight. */
export function wallMinutes(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export type RailSpan = {
  /** Minutes from the rail date's midnight. */
  startMin: number;
  /** Minutes from the SAME midnight — above 1440 when a moment runs past it. */
  endMin: number;
  /** False when the row has no end_at; the rail still draws it. */
  hasEnd: boolean;
};

/**
 * Where a stored moment sits on its own date's rail. An end on a later date
 * (an after-party to 1 AM) keeps counting from the start's midnight, so it is
 * drawn running off the bottom rather than wrapping to the top.
 */
export function spanOf(start_at: string, end_at: string | null): RailSpan {
  const startMin = wallMinutes(start_at);
  if (!end_at) {
    return { startMin, endMin: startMin + OPEN_ENDED_MINUTES, hasEnd: false };
  }
  const s = new Date(start_at).getTime();
  const e = new Date(end_at).getTime();
  const len = Number.isNaN(e) || e <= s ? OPEN_ENDED_MINUTES : Math.round((e - s) / 60_000);
  return { startMin, endMin: startMin + len, hasEnd: !Number.isNaN(e) && e > s };
}

/** Round to the nearest multiple of `step` (5 by default). */
export function snapMinutes(min: number, step: number = SNAP_MINUTES): number {
  return Math.round(min / step) * step;
}

/**
 * A rail position back into the `datetime-local` value the server actions
 * take — the wall clock, verbatim. Minutes past 1440 roll onto the next date.
 */
export function toDatetimeLocal(dateKey: string, minutes: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return '';
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(base + Math.round(minutes) * 60_000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function clockParts(minutes: number): { h: number; m: number; pm: boolean } {
  const within = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const h24 = Math.floor(within / 60);
  const m = within % 60;
  return { h: h24 % 12 === 0 ? 12 : h24 % 12, m, pm: h24 >= 12 };
}

/** "2:00 PM". */
export function formatClock(minutes: number): string {
  const { h, m, pm } = clockParts(minutes);
  return `${h}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}

/** "7 AM" — the hour ruler's label. */
export function formatHour(hour: number): string {
  const { h, pm } = clockParts(hour * 60);
  return `${h} ${pm ? 'PM' : 'AM'}`;
}

/**
 * "2:00 – 3:30 PM" when both ends share AM/PM, "8:00 AM – 12:00 PM" when they
 * do not — the prototype's reading, which drops the repeated half.
 */
export function formatClockRange(startMin: number, endMin: number): string {
  const a = clockParts(startMin);
  const b = clockParts(endMin);
  const aClock = `${a.h}:${String(a.m).padStart(2, '0')}`;
  if (a.pm === b.pm) return `${aClock} – ${formatClock(endMin)}`;
  return `${formatClock(startMin)} – ${formatClock(endMin)}`;
}

/** "1 h 30 min" · "30 min" · "4 h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "Thursday 18 December" for a "YYYY-MM-DD". */
export function formatDateHeading(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const dayMonth = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return `${weekday} ${dayMonth}`;
}

/** Whole days from one "YYYY-MM-DD" to another (negative when past). */
export function daysBetween(fromKey: string, toKey: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromKey);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toKey);
  if (!a || !b) return null;
  const am = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const bm = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((bm - am) / 86_400_000);
}

/**
 * Split top-level moments into one rail per wall-clock date, dates ascending.
 * Most events are one date; a rehearsal dinner the night before is its own
 * rail rather than a block stranded fourteen hours above the ceremony.
 */
export function groupByWallDate<T extends { start_at: string }>(
  rows: readonly T[],
): Array<{ dateKey: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = wallDateKey(r.start_at);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dateKey, list]) => ({ dateKey, rows: list }));
}

/**
 * The hours the ruler shows: from the hour the earliest moment starts to the
 * hour after the latest ends, never fewer than `minHours`. An empty day shows
 * 8 AM – 10 PM, where a first tap is most likely to land.
 */
export function railHours(
  spans: readonly RailSpan[],
  minHours = 8,
): { startHour: number; endHour: number } {
  if (spans.length === 0) return { startHour: 8, endHour: 22 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of spans) {
    lo = Math.min(lo, s.startMin);
    hi = Math.max(hi, s.endMin);
  }
  let startHour = Math.max(0, Math.floor(lo / 60));
  let endHour = Math.ceil(hi / 60);
  if (endHour <= startHour) endHour = startHour + 1;
  if (endHour - startHour < minHours) {
    const need = minHours - (endHour - startHour);
    const down = Math.min(startHour, Math.floor(need / 2));
    startHour -= down;
    endHour += need - down;
  }
  return { startHour, endHour };
}

/**
 * Side-by-side lanes for moments that overlap (hair and makeup while the
 * florist styles the church). Overlapping moments form a cluster; each takes
 * the first free lane, and every member of a cluster is drawn at 1/lanes of
 * the width. A moment that overlaps nothing gets the full width.
 */
export function layoutLanes(
  items: ReadonlyArray<{ id: string; startMin: number; endMin: number }>,
): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMin);
    } else {
      laneEnds[lane] = it.endMin;
    }
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

/**
 * The empty stretches between moments, within [fromMin, toMin), at least
 * `minGap` long — each is offered as "＋ 1:00 PM".
 */
export function findGaps(
  spans: readonly RailSpan[],
  fromMin: number,
  toMin: number,
  minGap: number = MIN_GAP_MINUTES,
): Array<{ startMin: number; endMin: number }> {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  const gaps: Array<{ startMin: number; endMin: number }> = [];
  let cursor = fromMin;
  for (const s of sorted) {
    if (s.startMin - cursor >= minGap) gaps.push({ startMin: cursor, endMin: s.startMin });
    cursor = Math.max(cursor, s.endMin);
  }
  if (toMin - cursor >= minGap) gaps.push({ startMin: cursor, endMin: toMin });
  return gaps;
}

export type DragMode = 'move' | 'top' | 'bottom';

/**
 * Where a moment lands after a drag of `deltaMin` minutes: the edge that moved
 * lands ON the five-minute grid (the ticks the rail shows while dragging), and
 * a moved moment keeps its length. Resizing keeps at least MIN_MOMENT_MINUTES
 * and never flips the ends. A drag that lands where it started is a no-op for
 * the caller (`sameSpan`), so a tap that wobbled a pixel writes nothing.
 */
export function applyDrag(
  span: { startMin: number; endMin: number },
  mode: DragMode,
  deltaMin: number,
): { startMin: number; endMin: number } {
  if (mode === 'move') {
    const startMin = snapMinutes(span.startMin + deltaMin);
    return { startMin, endMin: startMin + (span.endMin - span.startMin) };
  }
  if (mode === 'top') {
    const startMin = Math.min(
      snapMinutes(span.startMin + deltaMin),
      span.endMin - MIN_MOMENT_MINUTES,
    );
    return { startMin, endMin: span.endMin };
  }
  const endMin = Math.max(snapMinutes(span.endMin + deltaMin), span.startMin + MIN_MOMENT_MINUTES);
  return { startMin: span.startMin, endMin };
}

/** True when a drag put the moment back exactly where it was. */
export function sameSpan(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): boolean {
  return a.startMin === b.startMin && a.endMin === b.endMin;
}

/** Pixels on the rail → minutes, for a ruler `hourPx` tall per hour. */
export function pxToMinutes(px: number, hourPx: number): number {
  return (px / hourPx) * 60;
}
