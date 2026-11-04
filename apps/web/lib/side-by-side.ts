/**
 * 🧭 SIDE BY SIDE — event chapters slice 9 (owner-approved brief SCHEDULE_SLICES_8_10_BRIEF_2026-11-05; the plan's
 * "People by time"; prototype `prototypes/schedule_redesign_2026-11-04.html`, frames (c3) · (c4) · (c5)).
 *
 * Owner: *"seeing all the schedules interlacing to the same time."* ONE view in View as ▾ — the shipped "Suppliers by
 * time", renamed — never a second one. Everyone on one shared time axis: a column per supplier, then the Host/MC and
 * the couple; chapter bands behind every column; a backstage block dashed; a clash (one column in two places at once)
 * outlined "Two places at once"; "Now" across every column on the day.
 *
 * Three groupings, one dropdown: By person (one column each, and any ONE person can be searched and shown alone so
 * their whole day reads top to bottom) · By chapter (the same columns, grouped under the chapter each first works) ·
 * By role (a column per role or group the schedule names — Bridesmaids, Entourage, Principal sponsors).
 *
 * A view, never a write; it reads the same View as data (`ViewAsData`). Pure: no I/O, no React. The screen is
 * `app/dashboard/[eventId]/schedule/_components/side-by-side.tsx`.
 */
import { initialsOf } from './day-list';
import { RIGHT_AFTER } from './moment-order';
import { chapterWhere, clockWords, isBackstage, taskPlace, type Chapter, type MomentLike, type TaskRow } from './schedule-chapters';
import { readScheduleAudience, SCHEDULE_AUDIENCE_LABEL } from './schedule-audience';
import { roleWords, supplierName, type ViewAsData, type ViewMoment } from './schedule-view-as';

export type SbsGrouping = 'person' | 'chapter' | 'role';
export const SBS_GROUPINGS: readonly { key: SbsGrouping; label: string }[] = [
  { key: 'person', label: 'By person' },
  { key: 'chapter', label: 'By chapter' },
  { key: 'role', label: 'By role' },
];

/** A moment with no end holds its people this long — the rail's own open-ended length. */
const OPEN_MS = 30 * 60_000;
const HOUR = 3_600_000;

export type SbsBlock = {
  id: string;
  /** "Hair and makeup · Bride" */
  title: string;
  /** "Seda · Floor 14" — where; with the crew when one is named. */
  sub: string;
  /** "9:00 AM" · "Right after". */
  time: string;
  startMs: number;
  endMs: number;
  backstage: boolean;
  /** Two places at once in this column. */
  clash: boolean;
};

export type SbsColumn = {
  key: string;
  name: string;
  initials: string;
  kind: 'supplier' | 'coordinator' | 'host' | 'couple' | 'role';
  /** "Hair and makeup" — the trade or the role word under the name. */
  line: string;
  /** By chapter: the chapter it first works, said once above its group of heads. */
  group: string | null;
  blocks: SbsBlock[];
};

export type SbsBand = { id: string; label: string; startMs: number; endMs: number };

export type SideBySide = {
  startMs: number;
  endMs: number;
  bands: SbsBand[];
  columns: SbsColumn[];
  /** Blocks flagged "Two places at once", across every column. */
  clashes: number;
  /** The venue's wall clock on the day, when it falls on the axis. */
  nowMs: number | null;
  /** Chapters with no time yet — not on the axis; said under it. */
  tba: string[];
  /** Chapters on another day — not on this day's axis; said under it. */
  otherDays: string[];
};

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function momentLike(m: ViewMoment): MomentLike {
  return { block_id: m.block_id, start_at: m.start_at, end_at: m.end_at, location: m.location, spot: m.spot, travel_from: m.travel_from, travel_to: m.travel_to };
}

type At = { m: ViewMoment; c: Chapter };

function blockOf(id: string, title: string, startIso: string, at: At, place: string, crew: string | null, own: boolean): SbsBlock & { place: string } {
  const s = ms(startIso);
  const end = ms(at.m.end_at);
  return {
    id,
    title,
    sub: crew ? `${crew} · ${place}` : place,
    place: norm(place),
    time: !own && at.m.time_tba ? RIGHT_AFTER : clockWords(startIso),
    startMs: s,
    endMs: Number.isFinite(end) && end > s ? end : s + OPEN_MS,
    backstage: isBackstage(at.m.start_at, { start_at: at.c.start_at, end_at: at.c.end_at, time_tba: at.c.time_tba }),
    clash: false,
  };
}

/** Two blocks of ONE column that overlap in time at different places are each "Two places at once". */
function flagClashes(blocks: (SbsBlock & { place: string })[]): SbsBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (b.startMs >= a.endMs) break;
      if (a.place && b.place && a.place !== b.place) a.clash = b.clash = true;
    }
  }
  return sorted.map(({ place: _p, ...b }) => b);
}

export function sideBySide(input: {
  chapters: readonly Chapter[];
  data: ViewAsData;
  grouping: SbsGrouping;
  /** Booked suppliers that are the Host / MC (their trade). */
  hostIds?: ReadonlySet<string>;
  /** Supplier id → their trade words ("Photo and video"). */
  trades?: ReadonlyMap<string, string>;
  nowIso?: string | null;
  /** The ONE day on the axis (`YYYY-MM-DD`); default: the day most chapters are on. A chapter on another day (a
   *  fitting the week before) is not stretched onto it. */
  day?: string | null;
}): SideBySide {
  const { data } = input;
  const dated = input.chapters.filter((c) => !c.time_tba);
  const counts = new Map<string, number>();
  for (const c of dated) counts.set(c.start_at.slice(0, 10), (counts.get(c.start_at.slice(0, 10)) ?? 0) + 1);
  const day = input.day ?? [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
  const timed = dated.filter((c) => !day || c.start_at.slice(0, 10) === day).sort((a, b) => ms(a.start_at) - ms(b.start_at));
  const byId = new Map(timed.map((c) => [c.block_id, c]));
  const at = new Map<string, At>();
  for (const m of data.moments) {
    const c = byId.get(m.parent_block_id);
    if (c) at.set(m.block_id, { m, c });
  }
  const tasks: TaskRow[] = data.tasks ?? [];
  const place = (t: { place: string | null }, a: At) => taskPlace(t, momentLike(a.m), a.c) ?? chapterWhere(a.c);

  const columns: SbsColumn[] = [];
  const push = (col: Omit<SbsColumn, 'blocks' | 'group'>, raw: (SbsBlock & { place: string })[]) => {
    if (raw.length > 0) columns.push({ ...col, group: null, blocks: flagClashes(raw) });
  };

  if (input.grouping === 'role') {
    // A column per role or group the schedule names, and per audience a moment is for.
    const keys = new Map<string, (SbsBlock & { place: string })[]>();
    const add = (k: string, b: SbsBlock & { place: string }) => keys.set(k, [...(keys.get(k) ?? []), b]);
    for (const t of tasks) {
      const a = at.get(t.block_id);
      if (!a) continue;
      const k = t.role?.trim() ? `role:${norm(t.role)}` : t.group_id ? `group:${t.group_id}` : null;
      if (k) add(k, blockOf(t.task_id, `${a.m.label} · ${t.what}`, t.call_at ?? a.m.start_at, a, place(t, a), null, Boolean(t.call_at)));
    }
    for (const a of at.values()) {
      const aud = readScheduleAudience(a.m.audience);
      if (aud !== 'everyone' && aud !== 'suppliers') add(`aud:${aud}`, blockOf(a.m.block_id, a.m.label, a.m.start_at, a, place({ place: null }, a), null, false));
    }
    for (const [k, raw] of keys) {
      const name = k.startsWith('aud:') ? SCHEDULE_AUDIENCE_LABEL[readScheduleAudience(k.slice(4))] : roleWords(data, k);
      push({ key: k, name, initials: initialsOf(name), kind: 'role', line: k.startsWith('group:') ? 'Group' : 'Role' }, raw);
    }
    columns.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // People: every supplier named, then the Host/MC, then the couple.
    const named = new Set<string>();
    for (const t of tasks) if (t.vendor_id && at.has(t.block_id)) named.add(t.vendor_id);
    for (const a of at.values()) for (const v of a.m.responsible_vendor_ids) named.add(v);
    for (const v of named) {
      const raw: (SbsBlock & { place: string })[] = [];
      const withTask = new Set<string>();
      for (const t of tasks) {
        const a = at.get(t.block_id);
        if (t.vendor_id !== v || !a) continue;
        withTask.add(t.block_id);
        raw.push(blockOf(t.task_id, t.what, t.call_at ?? a.m.start_at, a, place(t, a), t.crew?.trim() || null, Boolean(t.call_at)));
      }
      for (const a of at.values()) {
        if (!a.m.responsible_vendor_ids.includes(v) || withTask.has(a.m.block_id)) continue;
        raw.push(blockOf(`${a.m.block_id}:${v}`, a.m.label, a.m.start_at, a, place({ place: null }, a), null, false));
      }
      const s = data.suppliers.find((x) => x.vendor_id === v);
      const name = supplierName(data, v);
      const kind: SbsColumn['kind'] = s?.everyChapter ? 'coordinator' : input.hostIds?.has(v) ? 'host' : 'supplier';
      push({ key: `sup:${v}`, name, initials: initialsOf(name), kind, line: kind === 'coordinator' ? 'Coordinator' : kind === 'host' ? 'Host / MC' : (input.trades?.get(v) ?? 'Supplier') }, raw);
    }
    // 💍 The couple — each their own column: their own tasks (as a named guest) and the tasks for their role.
    for (const role of ['bride', 'groom'] as const) {
      const person = data.people?.find((p) => p.roles.some((r) => norm(r) === role)) ?? null;
      const raw: (SbsBlock & { place: string })[] = [];
      for (const t of tasks) {
        const a = at.get(t.block_id);
        if (!a) continue;
        if ((person && t.guest_id === person.guest_id) || norm(t.role) === role) {
          raw.push(blockOf(t.task_id, `${a.m.label} · ${t.what}`, t.call_at ?? a.m.start_at, a, place(t, a), null, Boolean(t.call_at)));
        }
      }
      const name = person?.name ?? (role === 'bride' ? 'The bride' : 'The groom');
      push({ key: `couple:${role}`, name, initials: initialsOf(name), kind: 'couple', line: role === 'bride' ? 'Bride' : 'Groom' }, raw);
    }
    const order = { supplier: 0, coordinator: 1, host: 2, couple: 3, role: 4 } as const;
    columns.sort((a, b) => order[a.kind] - order[b.kind] || (a.kind === 'couple' ? 0 : a.name.localeCompare(b.name)));
    if (input.grouping === 'chapter') {
      // The same columns, grouped under the chapter each first works, in the day's order.
      const firstChapter = (col: SbsColumn) => timed.find((c) => col.blocks.some((b) => b.startMs < (Number.isFinite(ms(c.end_at)) ? ms(c.end_at) : ms(c.start_at) + HOUR) && b.endMs > ms(c.start_at))) ?? timed[0];
      const rank = new Map(timed.map((c, i) => [c.block_id, i]));
      for (const col of columns) col.group = firstChapter(col)?.label ?? null;
      columns.sort((a, b) => {
        const ra = rank.get(timed.find((c) => c.label === a.group)?.block_id ?? '') ?? 99;
        const rb = rank.get(timed.find((c) => c.label === b.group)?.block_id ?? '') ?? 99;
        return ra - rb || a.name.localeCompare(b.name);
      });
    }
  }

  const bands: SbsBand[] = timed.map((c) => {
    const s = ms(c.start_at);
    const e = ms(c.end_at);
    return { id: c.block_id, label: c.label, startMs: s, endMs: Number.isFinite(e) && e > s ? e : s + HOUR };
  });
  const all = [...bands.flatMap((b) => [b.startMs, b.endMs]), ...columns.flatMap((c) => c.blocks.flatMap((b) => [b.startMs, b.endMs]))].filter(Number.isFinite);
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 0;
  const startMs = Math.floor(lo / HOUR) * HOUR;
  const endMs = Math.max(startMs + HOUR, Math.ceil(hi / HOUR) * HOUR);
  const now = ms(input.nowIso ?? null);
  return {
    startMs,
    endMs,
    bands,
    columns,
    clashes: columns.reduce((n, c) => n + c.blocks.filter((b) => b.clash).length, 0),
    nowMs: Number.isFinite(now) && now >= startMs && now <= endMs ? now : null,
    tba: input.chapters.filter((c) => c.time_tba).map((c) => c.label),
    otherDays: dated.filter((c) => day && c.start_at.slice(0, 10) !== day).map((c) => c.label),
  };
}

/** "9 AM" · "12 PM" — the axis's own hour marks. */
export function hourMark(msValue: number): string {
  return clockWords(new Date(msValue).toISOString()).replace(':00 ', ' ');
}
