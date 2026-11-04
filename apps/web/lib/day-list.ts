/**
 * 📋 THE EVENT DAY AS A LIST — event chapters slice 8 (owner-approved brief SCHEDULE_SLICES_8_10_BRIEF_2026-11-05;
 * the prototype `prototypes/schedule_redesign_2026-11-04.html`, "What changed vs today" · "Changed 4").
 *
 * "No more giant empty blocks": a chapter is a row sized by its CONTENT (its time, its venue, its suppliers, its
 * moments), with a thin tinted spine — never an hour grid whose height is its duration. The gaps between chapters
 * read as one calm line: "1h 30m free · travel to Seda Vertis North". On the day, the running chapter says
 * "Happening now · 6:12 PM" and names its running moment.
 *
 * The data is the hour rail's own (start, end, venue, kind) — only the drawing changes. Pure: no I/O, no React.
 * The screen is `app/dashboard/[eventId]/schedule/_components/day-list.tsx`.
 */
import { formatCount } from './format-number';
import { RIGHT_AFTER } from './moment-order';
import { TIME_TBA, clockWords, isBackstage } from './schedule-chapters';

/** A chapter as the list reads it (a top-level block on this day). */
export type ListChapter = {
  block_id: string;
  label: string;
  block_type: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  time_tba?: boolean;
};

/** A moment inside a chapter. */
export type ListMoment = {
  block_id: string;
  parent_block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  /** ⏭ "Right after the one above" — its start is only an order key. */
  time_tba?: boolean;
  responsible_vendor_ids: readonly string[];
};

export type ListFace = { id: string; initials: string; name: string; /** Hasn't picked this chapter yet (dashed). */ picking: boolean };

export type ListRow = {
  id: string;
  /** "Happening now" — on the day, while it runs. */
  now: boolean;
};

export type ListChapterRow = ListRow & {
  kind: 'chapter';
  chapter: ListChapter;
  /** "9 AM" · "Time TBA" — large. */
  start: string;
  /** "to 1:30 PM" · "onward" — small, under it. */
  end: string;
  /** "4h 30m" — smallest; null when there is no end. */
  length: string | null;
  faces: ListFace[];
  /** "2 suppliers · 1 picking" · "no suppliers yet". */
  facesWords: string;
  moments: { id: string; time: string; title: string; sub: string; backstage: boolean; now: boolean }[];
  /** "Happening now · 6:12 PM" — the running chapter only. */
  nowWords: string | null;
};

export type ListGapRow = ListRow & { kind: 'gap'; /** "1h 30m" */ length: string; /** "free · travel to Seda Vertis North" */ words: string };

export type DayListRow = ListChapterRow | ListGapRow;

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** "45m" · "1h" · "4h 30m". */
export function lengthWords(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${formatCount(r)}m`;
  return r === 0 ? `${formatCount(h)}h` : `${formatCount(h)}h ${formatCount(r)}m`;
}

/** "9 AM" — a whole hour without its ":00", as the prototype draws a chapter's start. */
export function shortClock(iso: string): string {
  return clockWords(iso).replace(':00 ', ' ');
}

/** "GH" for Glow HMUA, "LF" for Lumen Films, "D" for a one-word name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?').slice(0, 2);
}

/** "2 suppliers · 1 picking" · "1 supplier" · "no suppliers yet". */
export function facesWords(faces: readonly ListFace[]): string {
  const on = faces.filter((f) => !f.picking).length;
  const picking = faces.length - on;
  if (faces.length === 0) return 'no suppliers yet';
  const head = `${formatCount(on)} supplier${on === 1 ? '' : 's'}`;
  if (on === 0) return `${formatCount(picking)} picking`;
  return picking > 0 ? `${head} · ${formatCount(picking)} picking` : head;
}

/**
 * The day's chapters in time order, with the line between each pair. `vendorsOf` is who is ON a chapter (its own tags,
 * its moments' and its tasks'); `pickingOf` is a booked supplier whose usual chapters include this one but who has not
 * picked a chapter yet (slice 2's "needs a chapter") — drawn dashed. `nowIso` is the venue's wall clock on the day
 * (null = not the day), in the same UTC-written form the blocks are stored in.
 */
export function dayList(input: {
  chapters: readonly ListChapter[];
  moments: readonly ListMoment[];
  names: ReadonlyMap<string, string>;
  vendorsOf: (chapterId: string) => readonly string[];
  pickingOf?: (chapterId: string) => readonly string[];
  nowIso?: string | null;
}): DayListRow[] {
  const now = ms(input.nowIso ?? null);
  const timed = [...input.chapters].sort((a, b) => ms(a.start_at) - ms(b.start_at));
  const out: DayListRow[] = [];
  let prev: ListChapter | null = null;
  for (let i = 0; i < timed.length; i++) {
    const c = timed[i]!;
    const start = ms(c.start_at);
    const end = ms(c.end_at);
    const next = timed[i + 1];
    // A chapter with no end runs until the next one starts (for "now" only — never drawn as an end).
    const runsUntil = Number.isFinite(end) ? end : next ? ms(next.start_at) : start + 4 * 3_600_000;
    if (prev) {
      const prevEnd = Number.isFinite(ms(prev.end_at)) ? ms(prev.end_at) : NaN;
      const free = (start - prevEnd) / 60_000;
      if (Number.isFinite(free) && free > 0) {
        const there = c.location?.trim() || null;
        const travel = there && there !== (prev.location?.trim() || null) ? ` · travel to ${there}` : '';
        out.push({ kind: 'gap', id: `gap:${prev.block_id}:${c.block_id}`, now: Number.isFinite(now) && now >= prevEnd && now < start, length: lengthWords(free), words: `free${travel}` });
      }
    }
    const running = Number.isFinite(now) && !c.time_tba && now >= start && now < runsUntil;
    const kids = input.moments
      .filter((m) => m.parent_block_id === c.block_id)
      .sort((a, b) => ms(a.start_at) - ms(b.start_at));
    const nowMoment = running ? [...kids].reverse().find((m) => ms(m.start_at) <= now && (!m.end_at || ms(m.end_at) > now)) ?? null : null;
    const on = [...new Set(input.vendorsOf(c.block_id))];
    const picking = [...new Set(input.pickingOf?.(c.block_id) ?? [])].filter((id) => !on.includes(id));
    const faces: ListFace[] = [
      ...on.map((id) => ({ id, name: input.names.get(id) ?? 'A supplier', initials: initialsOf(input.names.get(id) ?? '?'), picking: false })),
      ...picking.map((id) => ({ id, name: input.names.get(id) ?? 'A supplier', initials: initialsOf(input.names.get(id) ?? '?'), picking: true })),
    ];
    const chapterTimes = { start_at: c.start_at, end_at: c.end_at, time_tba: c.time_tba ?? false };
    out.push({
      kind: 'chapter',
      id: c.block_id,
      chapter: c,
      now: running,
      start: c.time_tba ? TIME_TBA : shortClock(c.start_at),
      end: c.time_tba ? 'tap to set' : Number.isFinite(end) ? `to ${clockWords(c.end_at)}` : 'onward',
      length: !c.time_tba && Number.isFinite(end) ? lengthWords((end - start) / 60_000) : null,
      faces,
      facesWords: facesWords(faces),
      moments: kids.map((m) => ({
        id: m.block_id,
        time: c.time_tba ? TIME_TBA : m.time_tba ? RIGHT_AFTER : clockWords(m.start_at).replace(/ (AM|PM)$/, ''),
        title: m.label,
        sub: m.responsible_vendor_ids.map((v) => input.names.get(v)).filter(Boolean).join(', '),
        backstage: !c.time_tba && isBackstage(m.start_at, chapterTimes),
        now: nowMoment?.block_id === m.block_id,
      })),
      nowWords: running && input.nowIso ? `Happening now · ${clockWords(input.nowIso)}` : null,
    });
    prev = c;
  }
  return out;
}
