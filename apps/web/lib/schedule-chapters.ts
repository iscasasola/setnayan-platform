import { isOrMinutes, isTimeShape, type TimeShape } from './time-shape';
import { TIME_TBA, isTimeTba } from './time-tba';

/**
 * 📖 CHAPTERS, MOMENTS AND THEIR PARALLEL TASKS — the pure half (owner 2026-11-01, DECISION_LOG "SCHEDULE AND
 * CHAPTERS — THE PLAN" · "THE BLOW BY BLOW FROM THE REAL RUN OF SHOW"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §2, §3, §3c).
 *
 * The model (migration 20271300072429): a CHAPTER is a top-level `event_schedule_blocks` row, a MOMENT is its child,
 * and a moment holds parallel TASKS (`event_schedule_tasks`) — one per person, supplier or crew. No chapter table.
 *
 * ⏰ EVERY TIME HERE IS A WALL CLOCK (lib/schedule-datetime-local.ts): `start_at` holds the venue's clock written into a
 * UTC column, so this module reads and writes the UTC components and never does time-zone maths. Ingress and egress
 * are MINUTES FROM THE CHAPTER'S START, so they move with it and cross midnight with no special case.
 *
 * Nothing here reads the database or knows a screen.
 */

/* ── the chapter's words and choices ───────────────────────────────────────────────────────────────────────────── */

/** Call time, minutes before a person's first task (owner: *"Call time can be set from 0-60 minutes"*). */
export const CALL_LEAD_CHOICES = [0, 15, 30, 45, 60] as const;
export type CallLead = (typeof CALL_LEAD_CHOICES)[number];
export const DEFAULT_CALL_LEAD: CallLead = 60;

export function isCallLead(v: unknown): v is CallLead {
  return typeof v === 'number' && (CALL_LEAD_CHOICES as readonly number[]).includes(v);
}

/** "60 minutes before their first task" — the approved prototype's words; 0 reads as "At their first task". */
export function callLeadWords(m: CallLead): string {
  return m === 0 ? 'At their first task' : `${m} minutes before their first task`;
}

/** Who sees a chapter's photos (owner: *"the people part of that initially or tagged only or to everybody"*). */
export const PHOTO_WHO = ['chapter', 'tagged', 'everybody'] as const;
export type PhotoWho = (typeof PHOTO_WHO)[number];
export const PHOTO_WHO_WORDS: Readonly<Record<PhotoWho, string>> = {
  chapter: 'People in this chapter',
  tagged: 'Only people tagged',
  everybody: 'Everybody',
};

/** When they see them (owner: *"show instantly for everybody or will only show once event is done"*). */
export const PHOTO_WHEN = ['right_away', 'after_event'] as const;
export type PhotoWhen = (typeof PHOTO_WHEN)[number];
export const PHOTO_WHEN_WORDS: Readonly<Record<PhotoWhen, string>> = {
  right_away: 'Right away',
  after_event: 'After the event',
};

export function isPhotoWho(v: unknown): v is PhotoWho {
  return typeof v === 'string' && (PHOTO_WHO as readonly string[]).includes(v);
}
export function isPhotoWhen(v: unknown): v is PhotoWhen {
  return typeof v === 'string' && (PHOTO_WHEN as readonly string[]).includes(v);
}

/** A chapter with no venue yet (owner: *"Sometime it can be tba"*). */
export const VENUE_TBA = 'Venue TBA';
// ⏰ `TIME_TBA` and `isTimeTba` live in the leaf `lib/time-tba.ts` (no imports), so a client bundle that only needs the
// words — the Maker's ceremony-time box, `blockTime` — never carries this whole module (the Maker's JS budget).
export { TIME_TBA, isTimeTba };

/** The fields a chapter is read with (a chapter-only subset of the block, never the canonical block list) — one list, so the reader and the lab can never disagree. */
export const CHAPTER_FIELDS =
  'block_id, parent_block_id, label, start_at, end_at, location, spot, notes, ingress_minutes_before, egress_minutes_after, call_lead_minutes, on_invitation, photo_who, photo_when, is_public, sort_order, time_tba, is_optional, travel_from, travel_to, march_key, responsible_vendor_ids, follows_block_id, time_shape, time_or_minutes, hours_vendor_id, block_type';

export type Chapter = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  /** The venue; null = Venue TBA. */
  location: string | null;
  /** Exact spot inside it (bridal suite, ballroom). */
  spot: string | null;
  notes: string | null;
  ingress_minutes_before: number | null;
  egress_minutes_after: number | null;
  call_lead_minutes: CallLead;
  on_invitation: boolean;
  photo_who: PhotoWho;
  photo_when: PhotoWhen;
  /** Shown to guests — never changed by the chapter form (no guest-visible change in Step 2). */
  is_public: boolean;
  /** How many moments it holds (its children). */
  moments: number;
  /**
   * The time is not known yet (migration 20271300482585): `start_at` keeps the DAY at 00:00 and the clock is never
   * drawn — "Time TBA", no call time. Never shown to guests while set (the database refuses it).
   */
  time_tba?: boolean;
  /** 👷 The suppliers tagged on the chapter itself (`responsible_vendor_ids`, event_vendors ids). */
  vendor_ids?: string[];
  /** 🏛 The venue booking that HOLDS the chapter's hours (migration 20271307658341); null = the host sets them. */
  hours_vendor_id?: string | null;
  /** Its kind (`block_type`) — the rail tints a chapter by it (Prep · Ceremony · Reception · After Party). */
  block_type?: string | null;
};

type BlockRow = Record<string, unknown> & { block_id: string; parent_block_id?: string | null };

/**
 * Every block of an event → its chapters, in time order, each with its moment count. One read feeds it (the
 * reader asks for every block once and splits here — never one read per chapter).
 */
export function chaptersFromBlocks(rows: readonly BlockRow[]): Chapter[] {
  const moments = new Map<string, number>();
  for (const r of rows) {
    if (typeof r.parent_block_id === 'string') moments.set(r.parent_block_id, (moments.get(r.parent_block_id) ?? 0) + 1);
  }
  return rows
    .filter((r) => !r.parent_block_id)
    .map((r) => ({
      block_id: r.block_id,
      label: String(r.label ?? ''),
      start_at: isoOf(r.start_at) ?? '',
      end_at: isoOf(r.end_at),
      location: blankToNull(r.location),
      spot: blankToNull(r.spot),
      notes: blankToNull(r.notes),
      ingress_minutes_before: typeof r.ingress_minutes_before === 'number' ? r.ingress_minutes_before : null,
      egress_minutes_after: typeof r.egress_minutes_after === 'number' ? r.egress_minutes_after : null,
      call_lead_minutes: isCallLead(r.call_lead_minutes) ? r.call_lead_minutes : DEFAULT_CALL_LEAD,
      on_invitation: r.on_invitation === true,
      photo_who: isPhotoWho(r.photo_who) ? r.photo_who : 'chapter',
      photo_when: isPhotoWhen(r.photo_when) ? r.photo_when : 'right_away',
      is_public: r.is_public === true,
      moments: moments.get(r.block_id) ?? 0,
      time_tba: r.time_tba === true,
      vendor_ids: Array.isArray(r.responsible_vendor_ids) ? r.responsible_vendor_ids.filter((v): v is string => typeof v === 'string') : [],
      hours_vendor_id: typeof r.hours_vendor_id === 'string' ? r.hours_vendor_id : null,
      block_type: typeof r.block_type === 'string' ? r.block_type : null,
    }))
    .sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0));
}

/** A stored time as an ISO string (PostgREST sends strings; a driver may hand a Date). */
function isoOf(v: unknown): string | null {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function blankToNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/* ── wall clocks ─────────────────────────────────────────────────────────────────────────────────────────────── */

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const HHMM = /^(\d{2}):(\d{2})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The day a stored wall clock is on ("2026-12-18"), or '' when unreadable. */
export function wallDay(iso: string | null | undefined): string {
  const m = typeof iso === 'string' ? WALL.exec(iso) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** The clock of a stored wall clock ("14:00"), or '' when unreadable. */
export function wallTime(iso: string | null | undefined): string {
  const m = typeof iso === 'string' ? WALL.exec(iso) : null;
  return m ? `${m[4]}:${m[5]}` : '';
}

/** A day + a clock → what is stored (the clock verbatim, as `fromDatetimeLocalValue` writes it). Null when unreadable. */
export function wallIso(day: string, hhmm: string): string | null {
  if (!DAY.test(day) || !HHMM.test(hhmm)) return null;
  const [h, mi] = hhmm.split(':').map(Number) as [number, number];
  if (h > 23 || mi > 59) return null;
  return `${day}T${hhmm}:00.000Z`;
}

/** The same value as an `<input type="datetime-local">` takes — what the schedule's actions read. */
export function wallLocal(day: string, hhmm: string): string | null {
  const iso = wallIso(day, hhmm);
  return iso ? iso.slice(0, 16) : null;
}

function minutesOfDay(hhmm: string): number | null {
  const m = HHMM.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** Whole minutes added to a stored wall clock, staying a wall clock (pure UTC arithmetic — no zone ever applies). */
export function shiftWall(iso: string, minutes: number): string {
  const t = Date.parse(iso);
  return new Date(t + minutes * 60_000).toISOString();
}

/**
 * "Ingress from" typed as a clock → minutes before the chapter's start. A clock LATER than the start is the night
 * before (ingress from 11 PM for a 6 AM preparation = 420) — ingress may cross midnight (§3c #3). Blank → null (none).
 */
export function ingressMinutesFrom(startIso: string, hhmm: string): number | null {
  if (!hhmm.trim()) return null;
  const t = minutesOfDay(hhmm.trim());
  const s = minutesOfDay(wallTime(startIso));
  if (t === null || s === null) return null;
  const before = s - t;
  return before >= 0 ? before : before + 1440;
}

/**
 * "Egress until" typed as a clock → minutes after the chapter's start: the first such clock at or after the start, so
 * 1 AM after a 6 PM reception is the next day (420). Blank → null (none).
 */
export function egressMinutesFrom(startIso: string, hhmm: string): number | null {
  if (!hhmm.trim()) return null;
  const t = minutesOfDay(hhmm.trim());
  const s = minutesOfDay(wallTime(startIso));
  if (t === null || s === null) return null;
  const after = t - s;
  return after >= 0 ? after : after + 1440;
}

/** When ingress opens (a stored wall clock), or null for none. */
export function ingressAt(c: Pick<Chapter, 'start_at' | 'ingress_minutes_before'>): string | null {
  return c.ingress_minutes_before === null ? null : shiftWall(c.start_at, -c.ingress_minutes_before);
}

/** When egress ends (a stored wall clock), or null for none. */
export function egressAt(c: Pick<Chapter, 'start_at' | 'egress_minutes_after'>): string | null {
  return c.egress_minutes_after === null ? null : shiftWall(c.start_at, c.egress_minutes_after);
}

/**
 * "Ends" typed as a clock → the stored end: the same day, or the NEXT day when it is at or before the start (an
 * after party 10 PM – 2 AM). Blank → null (no end).
 */
export function endIsoFrom(startIso: string, hhmm: string): string | null {
  if (!hhmm.trim()) return null;
  const t = minutesOfDay(hhmm.trim());
  const s = minutesOfDay(wallTime(startIso));
  if (t === null || s === null) return null;
  const after = t - s;
  return shiftWall(startIso, after > 0 ? after : after + 1440);
}

/**
 * What is wrong with a chapter's window, said as flags — never refused (the owner's rule: only real problems need
 * you, and they are flagged, not blocked). `egress_before_end`: the egress clock falls before the chapter ends.
 */
export function chapterWindowFlags(c: Pick<Chapter, 'start_at' | 'end_at' | 'egress_minutes_after'>): ('egress_before_end')[] {
  const out: 'egress_before_end'[] = [];
  const egress = egressAt(c);
  if (egress && c.end_at && Date.parse(egress) < Date.parse(c.end_at)) out.push('egress_before_end');
  return out;
}

/**
 * 📅 DATES STOP AT THE EVENT DAY (owner: *"date must be until event day only"*). A day after the event's last day is
 * set back to it, and says so. No event day yet (`lastDay` null) = no cap.
 */
export function capChapterDay(day: string, lastDay: string | null): { day: string; capped: boolean } {
  if (!lastDay || !DAY.test(lastDay) || !DAY.test(day)) return { day, capped: false };
  return day > lastDay ? { day: lastDay, capped: true } : { day, capped: false };
}

/** "2:00 PM" from a stored wall clock (never a zone conversion). */
export function clockWords(iso: string | null | undefined): string {
  const t = wallTime(iso);
  if (!t) return '';
  const [h, m] = t.split(':').map(Number) as [number, number];
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Where a chapter is: "Seda, bridal suite" · "San Vicente Parish" · "Venue TBA". */
export function chapterWhere(c: Pick<Chapter, 'location' | 'spot'>): string {
  return c.location ? (c.spot ? `${c.location}, ${c.spot}` : c.location) : VENUE_TBA;
}

/**
 * When a chapter is, in words: "1:30 PM – 3:30 PM" · "1:30 PM onward" (no end) · "Time TBA". A TBA chapter's stored
 * 00:00 is a placeholder for its DAY and is never drawn as a clock.
 */
export function chapterWhen(c: Pick<Chapter, 'start_at' | 'end_at' | 'time_tba'>): string {
  if (c.time_tba) return TIME_TBA;
  const start = clockWords(c.start_at);
  if (!start) return TIME_TBA;
  const end = clockWords(c.end_at);
  return end ? `${start} – ${end}` : `${start} onward`;
}

/** The chapter's one line: "2:00 PM · San Vicente Parish" · "6:00 AM · Seda, bridal suite" · "Time TBA · Venue TBA". */
export function chapterLine(c: Pick<Chapter, 'start_at' | 'location' | 'spot' | 'time_tba'>): string {
  const where = chapterWhere(c);
  const when = c.time_tba ? TIME_TBA : clockWords(c.start_at);
  return when ? `${when} · ${where}` : where;
}

/**
 * 📅 WHERE A CHAPTER LIVES ON THE SCHEDULE (plan §3 "A chapter dated before the day lives in Planning Stage"): on Event
 * Day when it is on (or, never, after) the event's first day; in Planning Stage when its day is before it. An event
 * with no exact day yet keeps every chapter on Event Day — nothing is hidden.
 */
export function chapterStage(c: Pick<Chapter, 'start_at'>, eventDay: string | null): 'day' | 'planning' {
  const day = wallDay(c.start_at);
  if (!eventDay || !DAY.test(eventDay) || !day) return 'day';
  return day < eventDay ? 'planning' : 'day';
}

/** "1h 30m" · "45m" · "2h" — the time between two chapters on the rail. */
export function gapWords(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
}

// 🎭 Which part of its chapter a moment is in, and BACKSTAGE — in the leaf `lib/chapter-section.ts` (no imports), so the
// Event Hub's client bundle reads the rule without carrying this whole module.
export { BACKSTAGE_TIP, BACKSTAGE_WORDS, isBackstage, momentSection, withoutBackstage, type ChapterSection } from './chapter-section';
import { momentSection, type ChapterSection } from './chapter-section';

/* ── tasks: who, where, and the clash ─────────────────────────────────────────────────────────────────────────── */

/** A task row as stored (`event_schedule_tasks`). */
export type TaskRow = {
  task_id: string;
  block_id: string;
  vendor_id: string | null;
  crew: string | null;
  guest_id: string | null;
  group_id: string | null;
  role: string | null;
  who_label: string | null;
  what: string;
  call_at: string | null;
  place: string | null;
  sort_order: number;
};

export const TASK_COLUMNS = 'task_id, block_id, vendor_id, crew, guest_id, group_id, role, who_label, what, call_at, place, sort_order';

/** Exactly one who: a supplier (optionally one of its crews), a person, a group, a role, or anyone in words. */
export type TaskWho =
  | { kind: 'supplier'; vendorId: string; crew: string | null }
  | { kind: 'guest'; guestId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'role'; role: string }
  | { kind: 'label'; label: string };

export type TaskInput = { who: TaskWho; what: string; callAt?: string | null; place?: string | null; sortOrder?: number };

/** The row a task is written as — or the plain words of what is wrong. The database checks the same (one who, …). */
export function taskRowFrom(blockId: string, input: TaskInput): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const what = input.what.trim();
  if (!what) return { ok: false, error: 'Say what they do.' };
  if (what.length > 500) return { ok: false, error: 'Keep what they do under 500 letters.' };
  const place = input.place?.trim() || null;
  if (place && place.length > 120) return { ok: false, error: 'Keep the place under 120 letters.' };
  const row: Record<string, unknown> = {
    block_id: blockId,
    vendor_id: null,
    crew: null,
    guest_id: null,
    group_id: null,
    role: null,
    who_label: null,
    what,
    call_at: input.callAt ?? null,
    place,
    sort_order: input.sortOrder ?? 0,
  };
  const w = input.who;
  switch (w.kind) {
    case 'supplier': {
      const crew = w.crew?.trim() || null;
      if (crew && crew.length > 60) return { ok: false, error: 'Keep the crew’s name under 60 letters.' };
      row.vendor_id = w.vendorId;
      row.crew = crew;
      break;
    }
    case 'guest':
      row.guest_id = w.guestId;
      break;
    case 'group':
      row.group_id = w.groupId;
      break;
    case 'role': {
      const role = w.role.trim();
      if (!role) return { ok: false, error: 'Pick who does it.' };
      row.role = role;
      break;
    }
    case 'label': {
      const label = w.label.trim();
      if (!label) return { ok: false, error: 'Pick who does it.' };
      if (label.length > 120) return { ok: false, error: 'Keep the name under 120 letters.' };
      row.who_label = label;
      break;
    }
  }
  return { ok: true, row };
}

/** A stored task → its who. */
export function taskWho(t: Pick<TaskRow, 'vendor_id' | 'crew' | 'guest_id' | 'group_id' | 'role' | 'who_label'>): TaskWho | null {
  if (t.vendor_id) return { kind: 'supplier', vendorId: t.vendor_id, crew: t.crew };
  if (t.guest_id) return { kind: 'guest', guestId: t.guest_id };
  if (t.group_id) return { kind: 'group', groupId: t.group_id };
  if (t.role) return { kind: 'role', role: t.role };
  if (t.who_label) return { kind: 'label', label: t.who_label };
  return null;
}

/**
 * The one identity a clash is measured on: the same person or the same CREW. A supplier's crews are different people
 * (Team A with the bride, Team B with the groom — no clash); the supplier with no crew named is its own whole team.
 */
export function whoKey(w: TaskWho): string {
  switch (w.kind) {
    case 'supplier':
      return `supplier:${w.vendorId}:${norm(w.crew ?? '')}`;
    case 'guest':
      return `guest:${w.guestId}`;
    case 'group':
      return `group:${w.groupId}`;
    case 'role':
      return `role:${norm(w.role)}`;
    case 'label':
      return `label:${norm(w.label)}`;
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The parts of a moment (and its chapter) a task's place and time are read from. */
export type MomentLike = {
  block_id: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  spot: string | null;
  travel_from?: string | null;
  travel_to?: string | null;
};

/**
 * Where a task happens: its own place, else the moment's room, else the moment's venue, else the chapter's room or
 * venue (§3c #2: *"defaults to the moment's room"*). A travel moment is "from → to". Null = nowhere said yet.
 */
export function taskPlace(task: Pick<TaskRow, 'place'>, moment: MomentLike, chapter?: Pick<MomentLike, 'location' | 'spot'> | null): string | null {
  if (task.place?.trim()) return task.place.trim();
  if (moment.travel_to?.trim()) return `${moment.travel_from?.trim() || 'Here'} → ${moment.travel_to.trim()}`;
  const venue = moment.location?.trim() || chapter?.location?.trim() || null;
  const room = moment.spot?.trim() || (moment.location?.trim() ? null : chapter?.spot?.trim()) || null;
  if (venue && room) return `${venue}, ${room}`;
  return room ?? venue;
}

export type TaskAt = { task: TaskRow; moment: MomentLike; chapter?: Pick<MomentLike, 'location' | 'spot'> | null };

export type TaskClash = { who: string; first: string; second: string; places: [string, string] };

/**
 * ⚠ THE SAME PERSON OR CREW IN TWO PLACES AT ONCE (§3c #5). Overlaps are normal; this only FINDS clashes, it never
 * refuses anything. A task is busy from its own call time (else its moment's start) to its moment's end (a moment
 * with no end is one minute). Two tasks clash when they share a `whoKey`, their places differ, and their times
 * overlap. A task with no place said cannot clash.
 */
export function findTaskClashes(items: readonly TaskAt[]): TaskClash[] {
  const busy = items
    .map((it) => {
      const w = taskWho(it.task);
      const place = taskPlace(it.task, it.moment, it.chapter);
      if (!w || !place) return null;
      const start = Date.parse(it.task.call_at ?? it.moment.start_at);
      const endRaw = it.moment.end_at ? Date.parse(it.moment.end_at) : NaN;
      const end = Number.isFinite(endRaw) && endRaw > start ? endRaw : start + 60_000;
      return { id: it.task.task_id, key: whoKey(w), place, at: norm(place), start, end };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Number.isFinite(x.start));
  const out: TaskClash[] = [];
  for (let i = 0; i < busy.length; i++) {
    for (let j = i + 1; j < busy.length; j++) {
      const a = busy[i]!;
      const b = busy[j]!;
      if (a.key !== b.key || a.at === b.at) continue;
      if (a.start < b.end && b.start < a.end) out.push({ who: a.key, first: a.id, second: b.id, places: [a.place, b.place] });
    }
  }
  return out;
}

/* ── a moment's own facts, its time, and the sheet's words (Step 3b) ──────────────────────────────────────────── */

/**
 * 📖 STEP 3b — A MOMENT AND ITS PARALLEL TASKS (owner 2026-11-01, plan §3 "Moments work the same way" · §3c; DECISION_LOG
 * "THE BLOW BY BLOW FROM THE REAL RUN OF SHOW"). What a moment carries beyond the block every reader already has: its
 * room (`spot`, the default place of each task in it), the "if kept" mark, and a travel moment's from → to. Read from
 * the SAME one read as the chapters (`CHAPTER_FIELDS`), never a second read of the blocks.
 */
export type MomentFacts = {
  block_id: string;
  parent_block_id: string;
  spot: string | null;
  notes: string | null;
  is_optional: boolean;
  travel_from: string | null;
  travel_to: string | null;
  /** Which march this moment is (migration 20271301571290): null = not a march · `WHOLE_MARCH` · an own march's key. */
  march_key: string | null;
  /** 👷 The suppliers it is for (`responsible_vendor_ids`) — the "yours" on their day; the Suppliers and crew row ticks them. */
  vendor_ids: string[];
  /** ⏭ No clock of its own — "right after the one above" (migration 20271302727358); `start_at` is only its order key. */
  time_tba: boolean;
  /** ⏭ The moment it comes right after (same chapter); null when it is timed, or first. */
  follows_block_id: string | null;
  /** 🕑 How its clock is meant — 'at' · 'about' · 'or' (migration 20271303051692, lib/time-shape.ts). */
  time_shape: TimeShape;
  /** 🕑 On 'or': the second time, minutes after its start. */
  time_or_minutes: number | null;
};

/** Every moment's own facts, from the rows the chapter read already holds. */
export function momentFactsFromBlocks(rows: readonly BlockRow[]): MomentFacts[] {
  return rows
    .filter((r): r is BlockRow & { parent_block_id: string } => typeof r.parent_block_id === 'string' && r.parent_block_id.length > 0)
    .map((r) => ({
      block_id: r.block_id,
      parent_block_id: r.parent_block_id,
      spot: blankToNull(r.spot),
      notes: blankToNull(r.notes),
      is_optional: r.is_optional === true,
      travel_from: blankToNull(r.travel_from),
      travel_to: blankToNull(r.travel_to),
      march_key: isMarchKey(r.march_key) ? r.march_key : null,
      vendor_ids: Array.isArray(r.responsible_vendor_ids) ? r.responsible_vendor_ids.filter((v): v is string => typeof v === 'string') : [],
      time_tba: r.time_tba === true,
      follows_block_id: typeof r.follows_block_id === 'string' ? r.follows_block_id : null,
      time_shape: isTimeShape(r.time_shape) ? r.time_shape : 'at',
      time_or_minutes: isOrMinutes(r.time_or_minutes) ? r.time_or_minutes : null,
    }));
}

/** A moment's length when none is given — the approved prototype's 30. */
export const DEFAULT_MOMENT_MINUTES = 30;

/** Whole minutes from `a` to `b` (two stored wall clocks); null when either is unreadable. */
export function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = typeof a === 'string' ? Date.parse(a) : NaN;
  const y = typeof b === 'string' ? Date.parse(b) : NaN;
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 60_000) : null;
}

/**
 * A moment's clock → the stored wall clock, ON THE RIGHT DAY. A chapter's window may cross midnight both ways
 * (§3c #3: ingress from 11 PM the night before; egress until 1 AM after), so the clock alone does not say the day.
 * Of the chapter's day and the days either side, the one inside the chapter's window wins (ingress → egress, else
 * start → end, else that day); none inside → the chapter's own day. Null when the clock is unreadable.
 */
export function momentStartFrom(c: Pick<Chapter, 'start_at' | 'end_at' | 'ingress_minutes_before' | 'egress_minutes_after'>, hhmm: string): string | null {
  const day = wallDay(c.start_at);
  const same = wallIso(day, hhmm.trim());
  if (!same) return null;
  const from = Date.parse(ingressAt(c) ?? c.start_at);
  const lastEnd = egressAt(c) ?? c.end_at;
  const to = lastEnd ? Date.parse(lastEnd) : Date.parse(c.start_at) + 24 * 3_600_000;
  for (const shift of [0, 1440, -1440]) {
    const at = shift === 0 ? same : shiftWall(same, shift);
    const t = Date.parse(at);
    if (t >= from && t <= to) return at;
  }
  return same;
}

/**
 * Where a picked SECTION puts a moment (the section is read from the time — `momentSection` — never stored, so picking
 * one moves the moment into it): Ingress → when ingress opens (else 30 minutes before the start) · Event → the
 * chapter's start · Egress → the chapter's end. Null when that section has no time to go to.
 */
export function sectionStartFor(c: Pick<Chapter, 'start_at' | 'end_at' | 'ingress_minutes_before' | 'time_tba'>, section: ChapterSection): string | null {
  if (section === 'Event') return c.start_at;
  if (c.time_tba) return null;
  if (section === 'Ingress') return ingressAt(c) ?? shiftWall(c.start_at, -DEFAULT_MOMENT_MINUTES);
  return c.end_at;
}

/** The sections a moment of this chapter may be put in: Event always; Ingress once the time is known; Egress once it has an end. */
export function sectionsFor(c: Pick<Chapter, 'end_at' | 'time_tba'>): ChapterSection[] {
  if (c.time_tba) return ['Event'];
  return c.end_at ? ['Ingress', 'Event', 'Egress'] : ['Ingress', 'Event'];
}

/** Who a task can name, as the sheet's one Who ▾ lists them (`readTaskPeople`). Suppliers come from the page's supplier read. */
export type TaskPeople = {
  guests: { id: string; name: string; role: string }[];
  groups: { id: string; name: string }[];
  /** The roles held on this event — key and word. */
  roles: { key: string; name: string }[];
};

/** The names a task's who is said with — the event's own suppliers, guests and groups, by id. */
export type TaskNames = {
  suppliers: ReadonlyMap<string, string>;
  guests: ReadonlyMap<string, string>;
  groups: ReadonlyMap<string, string>;
  /** A role key → its word ("bridesmaid" → "Bridesmaid"). */
  roles: ReadonlyMap<string, string>;
};

/** "Glow HMUA · Team B" · "Ana Reyes" · "Bridesmaids" · "Bridesmaid" · "Seda banquet captain". */
export function taskWhoWords(t: Pick<TaskRow, 'vendor_id' | 'crew' | 'guest_id' | 'group_id' | 'role' | 'who_label'>, names: TaskNames): string {
  const w = taskWho(t);
  if (!w) return 'Someone';
  switch (w.kind) {
    case 'supplier': {
      const shop = names.suppliers.get(w.vendorId) ?? 'A supplier';
      return w.crew ? `${shop} · ${w.crew}` : shop;
    }
    case 'guest':
      return names.guests.get(w.guestId) ?? 'A guest';
    case 'group':
      return names.groups.get(w.groupId) ?? 'A group';
    case 'role':
      return names.roles.get(w.role) ?? w.role;
    case 'label':
      return w.label;
  }
}

/** A moment as the clash check reads it: its times, its own room, and its chapter's venue. */
export type ClashMoment = MomentLike & { label: string; parent_block_id: string };

/**
 * ⚠ THE CLASHES THAT TOUCH ONE MOMENT (§3c #5 — flagged, never blocked): every pair from `findTaskClashes` over the
 * WHOLE event's tasks in which one side is a task of this moment, as the words the sheet shows: "Glow HMUA · Team B is
 * in two places at once: 2F holding room and Lobby (Florist arrives)". Keyed by this moment's task id.
 */
export function clashesForMoment(
  momentId: string,
  tasks: readonly TaskRow[],
  moments: readonly ClashMoment[],
  chapters: readonly Pick<Chapter, 'block_id' | 'location' | 'spot'>[],
  names: TaskNames,
): Map<string, string> {
  const byMoment = new Map(moments.map((m) => [m.block_id, m]));
  const byChapter = new Map(chapters.map((c) => [c.block_id, c]));
  const items: TaskAt[] = [];
  for (const task of tasks) {
    const moment = byMoment.get(task.block_id);
    if (!moment) continue;
    items.push({ task, moment, chapter: byChapter.get(moment.parent_block_id) ?? null });
  }
  const byTask = new Map(items.map((it) => [it.task.task_id, it]));
  const out = new Map<string, string>();
  for (const clash of findTaskClashes(items)) {
    const a = byTask.get(clash.first)!;
    const b = byTask.get(clash.second)!;
    for (const [mine, other, myPlace, otherPlace] of [
      [a, b, clash.places[0], clash.places[1]],
      [b, a, clash.places[1], clash.places[0]],
    ] as const) {
      if (mine.task.block_id !== momentId || out.has(mine.task.task_id)) continue;
      const where = other.task.block_id === momentId ? otherPlace : `${otherPlace} (${(other.moment as ClashMoment).label})`;
      out.set(mine.task.task_id, `${taskWhoWords(mine.task, names)} is in two places at once: ${myPlace} and ${where}.`);
    }
  }
  return out;
}

/** How many Papic items a moment delete removes, and how many stay because they are also in another chapter. */
export type MomentPapic = { removed: number; stays: number };
export function isMomentPapic(v: unknown): v is MomentPapic {
  const o = v as MomentPapic | null;
  return typeof o === 'object' && o !== null && Number.isInteger(o.removed) && Number.isInteger(o.stays) && o.removed >= 0 && o.stays >= 0;
}

/**
 * 🗑 WHAT DELETE MOMENT SAYS BEFORE IT DELETES (owner 2026-11-01: *"deleting this moment will also delete the papic
 * photos and videos"* — the warning names the count). Each Papic capture knows the moment of its chapter that was on at
 * the shutter (`papic_chapter_captures.moment_block_id`, migration 20271302139013); deleting the moment deletes those —
 * Papic items only, never uploads or supplier shots — except one also in another chapter, which stays there. A count
 * that could not be read is said, never drawn as 0.
 */
export function momentDeleteWords(input: {
  label: string;
  tasks: number;
  papic: { ok: true; value: MomentPapic } | { ok: false } | null;
}): string {
  const tasks = input.tasks > 0 ? `, with its ${input.tasks} task${input.tasks === 1 ? '' : 's'},` : '';
  const head = `${input.label}${tasks} will be deleted. This cannot be undone.`;
  if (input.papic === null) return `${head} Counting the Papic photos and videos taken during it…`;
  if (!input.papic.ok) {
    return `${head} The Papic photos and videos taken during it couldn’t be counted just now — any there are will be deleted with it.`;
  }
  const { removed, stays } = input.papic.value;
  const items = (n: number) => (n === 1 ? '1 Papic photo or video' : `${n} Papic photos and videos`);
  const staying = stays > 0 ? ` ${items(stays)} also in another chapter ${stays === 1 ? 'stays' : 'stay'} there.` : '';
  if (removed === 0 && stays === 0) return `${head} No Papic photos or videos were taken during it.`;
  if (removed === 0) return `${head}${staying}`;
  return `${head} This also deletes the ${items(removed)} taken during it.${staying}`;
}

/**
 * A task's call time typed as a clock → the stored wall clock, on the day nearest its moment's start (a 11:30 PM call
 * for a 12:30 AM moment is the night before). Blank → null (the moment's own start is their time).
 */
export function callAtFrom(momentStart: string, hhmm: string): string | null {
  if (!hhmm.trim()) return null;
  const same = wallIso(wallDay(momentStart), hhmm.trim());
  if (!same) return null;
  const gap = Date.parse(same) - Date.parse(momentStart);
  const half = 12 * 3_600_000;
  return gap > half ? shiftWall(same, -1440) : gap < -half ? shiftWall(same, 1440) : same;
}

/** "3 tasks at once · 2 places" — how a moment's tasks read on its row; '' for none. */
export function tasksLine(tasks: readonly TaskRow[], moment: MomentLike, chapter?: Pick<MomentLike, 'location' | 'spot'> | null): string {
  if (tasks.length === 0) return '';
  const places = new Set(tasks.map((t) => taskPlace(t, moment, chapter)).filter((p): p is string => Boolean(p)).map(norm));
  const head = tasks.length === 1 ? '1 task' : `${tasks.length} tasks at once`;
  return places.size > 1 ? `${head} · ${places.size} places` : head;
}

/** The moment sheet's operations, posted as `moment_op` on the Schedule's own update door (no new server action). */
// 'ask_supplier' — the moment sheet's "Ask a supplier to change their times" (D2, `lib/schedule-ask.server.ts`).
// 📇 `contact_set` (4 additions (3), migration 20271303218631): a task's contact — a name and a phone — kept or removed.
export const MOMENT_OPS = ['task_add', 'task_save', 'task_remove', 'papic_count', 'march_set', 'march_new', 'for_set', 'ask_supplier', 'contact_set'] as const;
export type MomentOp = (typeof MOMENT_OPS)[number];
export function isMomentOp(v: unknown): v is MomentOp {
  return typeof v === 'string' && (MOMENT_OPS as readonly string[]).includes(v);
}

const WHO_KINDS = ['supplier', 'guest', 'group', 'role', 'label'] as const;
/** A call time is posted as the stored wall clock itself (`wallIso`): "2026-12-18T07:30:00.000Z". */
const WALL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;

/** A task as posted → its input, or what is wrong in words. */
export function taskInputFromForm(fd: FormData): { ok: true; input: TaskInput } | { ok: false; error: string } {
  const kind = fd.get('who_kind');
  const ref = String(fd.get('who_ref') ?? '').trim();
  if (typeof kind !== 'string' || !(WHO_KINDS as readonly string[]).includes(kind) || !ref) return { ok: false, error: 'Pick who does it.' };
  const crew = String(fd.get('crew') ?? '').trim() || null;
  const who: TaskWho =
    kind === 'supplier'
      ? { kind: 'supplier', vendorId: ref, crew }
      : kind === 'guest'
        ? { kind: 'guest', guestId: ref }
        : kind === 'group'
          ? { kind: 'group', groupId: ref }
          : kind === 'role'
            ? { kind: 'role', role: ref }
            : { kind: 'label', label: ref };
  const callRaw = String(fd.get('call_at') ?? '').trim();
  if (callRaw && !WALL_ISO.test(callRaw)) return { ok: false, error: 'That call time could not be read.' };
  const sort = Number(fd.get('sort_order') ?? 0);
  return {
    ok: true,
    input: {
      who,
      what: String(fd.get('what') ?? ''),
      callAt: callRaw || null,
      place: String(fd.get('place') ?? ''),
      sortOrder: Number.isInteger(sort) ? sort : 0,
    },
  };
}


/* ── a task as the moment sheet posts it ──────────────────────────────────────────────────────────────────────── */

/** A who as Who ▾ keys it: `s:<supplier>` · `c:<supplier>:<crew>` · `r:<role>` · `g:<group>` · `p:<guest>`. */
export function whoKeyOf(t: Pick<TaskRow, 'vendor_id' | 'crew' | 'guest_id' | 'group_id' | 'role' | 'who_label'>): string | null {
  const w = taskWho(t);
  if (!w) return null;
  switch (w.kind) {
    case 'supplier':
      return w.crew ? `c:${w.vendorId}:${w.crew}` : `s:${w.vendorId}`;
    case 'guest':
      return `p:${w.guestId}`;
    case 'group':
      return `g:${w.groupId}`;
    case 'role':
      return `r:${w.role}`;
    case 'label':
      return `o:${w.label}`;
  }
}

export type WhoFields = { who_kind: string; who_ref: string; crew: string };

export function whoFieldsOf(key: string): WhoFields | null {
  const [k, ...rest] = key.split(':');
  const ref = rest.join(':');
  if (!ref) return null;
  if (k === 's') return { who_kind: 'supplier', who_ref: ref, crew: '' };
  if (k === 'c') {
    const [vendor, ...crew] = ref.split(':');
    return vendor ? { who_kind: 'supplier', who_ref: vendor, crew: crew.join(':') } : null;
  }
  if (k === 'p') return { who_kind: 'guest', who_ref: ref, crew: '' };
  if (k === 'g') return { who_kind: 'group', who_ref: ref, crew: '' };
  if (k === 'r') return { who_kind: 'role', who_ref: ref, crew: '' };
  if (k === 'o') return { who_kind: 'label', who_ref: ref, crew: '' };
  return null;
}

/** The row a task becomes once saved (the client's copy of what the door wrote). */
export function rowOf(id: string, blockId: string, f: WhoFields, what: string, callAt: string | null, place: string | null, sort: number): TaskRow {
  return {
    task_id: id,
    block_id: blockId,
    vendor_id: f.who_kind === 'supplier' ? f.who_ref : null,
    crew: f.who_kind === 'supplier' && f.crew.trim() ? f.crew.trim() : null,
    guest_id: f.who_kind === 'guest' ? f.who_ref : null,
    group_id: f.who_kind === 'group' ? f.who_ref : null,
    role: f.who_kind === 'role' ? f.who_ref : null,
    who_label: f.who_kind === 'label' ? f.who_ref : null,
    what,
    call_at: callAt,
    place,
    sort_order: sort,
  };
}

/**
 * What the moment sheet POSTS for a task (`moment_op` on the Schedule's update door) — the one encoding, read back by
 * `taskInputFromForm`. A blank call time or place is posted as '' and stored as none (the moment's time and room).
 */
export function taskFields(w: WhoFields, what: string, callAt: string | null, place: string | null, sort: number, taskId: string | null): Record<string, string> {
  return {
    who_kind: w.who_kind,
    who_ref: w.who_ref,
    crew: w.crew,
    what: what.trim(),
    call_at: callAt ?? '',
    place: place?.trim() ?? '',
    sort_order: String(sort),
    ...(taskId ? { task_id: taskId } : {}),
  };
}


/* ── 🚶 "This is a march" (migration 20271301571290) ─────────────────────────────────────────────────────────────── */

/**
 * 🚶 A MOMENT PICKS WHICH MARCH (owner 2026-11-01: *"When we say this is a march. It picks which march. So in march we
 * can create a march similar to schedule"* · *"And pick guests to add to the march."*; plan §3, DECISION_LOG "A MOMENT
 * PICKS WHICH MARCH"). The marches are the ones Guests › March already makes — the event's Wedding March itself
 * (`WHOLE_MARCH`) and the couple's own marches (`march_groups`, the 29 Oct custom March groups), each with the guests
 * picked into it. A moment stores only WHICH (`event_schedule_blocks.march_key`). Two moments may name one march;
 * "Not a march" clears the link and never deletes the march.
 *
 * 🔒 app/dashboard/[eventId]/schedule/a-moment-picks-a-march.test.ts · tests/db/a-moment-picks-a-march.db.test.ts
 */
export const WHOLE_MARCH = 'entourage';
const OWN_MARCH_KEY = /^own_[0-9a-z]{6,24}$/;
/** The dropdown's two words that are not marches. */
export const NOT_A_MARCH = 'none';
export const NEW_MARCH = 'new';
export const MARCH_NAME_MAX = 64;

/** A value a moment may store as its march (the database's own CHECK, said once for the screen and the door). */
export function isMarchKey(v: unknown): v is string {
  return typeof v === 'string' && (v === WHOLE_MARCH || OWN_MARCH_KEY.test(v));
}

export type MarchChoice = { key: string; label: string };
/** The event's own marches as the page read them; `ok: false` = the read failed (said, never "no marches"). */
export type MarchList = { ok: true; marches: MarchChoice[] } | { ok: false };

/** What the event's Wedding March itself is called in the dropdown — the name Guests › March gives it. */
export function wholeMarchLabel(eventType: string | null | undefined): string {
  return (eventType ?? 'wedding') === 'wedding' ? 'Wedding March' : 'The entourage march';
}

/**
 * The "This is a march" dropdown: Not a march · the Wedding March · every own march · + New march. A moment already
 * linked to a march this reader cannot list (a coordinator does not read the guest list's marches) keeps its own line,
 * so the dropdown never claims it is "Not a march".
 */
export function marchPickOptions(list: MarchList, wholeLabel: string, current: string | null): { key: string; label: string }[] {
  const own = list.ok ? list.marches : [];
  const out = [
    { key: NOT_A_MARCH, label: 'Not a march' },
    { key: WHOLE_MARCH, label: wholeLabel },
    ...own.map((m) => ({ key: m.key, label: m.label })),
  ];
  if (current && !out.some((o) => o.key === current)) out.push({ key: current, label: 'A march made in Guests › March' });
  out.push({ key: NEW_MARCH, label: '+ New march' });
  return out;
}

/** A new march's name as typed → as stored, or what is wrong in words. */
export function marchNameFrom(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return { ok: false, error: 'A march needs a name.' };
  if (name.length > MARCH_NAME_MAX) return { ok: false, error: `Up to ${MARCH_NAME_MAX} letters.` };
  return { ok: true, name };
}

/* ── 👷 suppliers in a chapter (owner 2026-11-04, prototype frame 2) ─────────────────────────────────────────── */

/** One row of a chapter's "Suppliers in this chapter". */
export type ChapterSupplier = { id: string; name: string; trade?: string | null; everyChapter?: boolean };

export const CHAPTER_SUPPLIERS_TIP =
  'The suppliers booked to this chapter. Their call time is the first task they have in it. Coordinators are on every chapter.';

/** "Catering" · "Coordinator · every chapter" · "Booked" (no trade read). */
export function chapterSupplierLine(s: ChapterSupplier): string {
  if (s.everyChapter) return 'Coordinator · every chapter';
  return s.trade ?? 'Booked';
}

/** The suppliers in a chapter: those on it, its moments or a task in them — then the coordinators. One row each. */
export function chapterSuppliers(
  c: Pick<Chapter, 'block_id' | 'vendor_ids'>,
  moments: readonly { block_id: string; parent_block_id: string; vendor_ids: readonly string[] }[],
  tasks: readonly { block_id: string; vendor_id: string | null }[] | null,
  suppliers: readonly ChapterSupplier[],
): ChapterSupplier[] {
  const ids = new Set(c.vendor_ids ?? []);
  const inIt = moments.filter((m) => m.parent_block_id === c.block_id);
  for (const m of inIt) for (const v of m.vendor_ids) ids.add(v);
  const momentIds = new Set(inIt.map((m) => m.block_id));
  for (const t of tasks ?? []) if (t.vendor_id && momentIds.has(t.block_id)) ids.add(t.vendor_id);
  const on = suppliers.filter((s) => ids.has(s.id) && !s.everyChapter);
  const everywhere = suppliers.filter((s) => s.everyChapter);
  return [...on, ...everywhere];
}


/* ── 🏛 venue hours (migration 20271307658341) ─────────────────────────────────────────────────────────────── */

/** "5:00 PM – 10:00 PM · setup from 1:00 PM · out by 11:30 PM" — a held chapter's hours in one line. */
export function heldHoursLine(c: Pick<Chapter, 'start_at' | 'end_at' | 'ingress_minutes_before' | 'egress_minutes_after'>): string {
  // The prototype's words (frame 2): "5:00 PM – 10:00 PM · setup from 1 PM, out by 11:30 PM" — the window in one part,
  // a whole hour without its ":00".
  const short = (iso: string) => clockWords(iso).replace(':00 ', ' ');
  const hours = `${clockWords(c.start_at)}${c.end_at ? ` – ${clockWords(c.end_at)}` : ' onward'}`;
  const i = ingressAt(c);
  const e = egressAt(c);
  const window = [i ? `setup from ${short(i)}` : null, e ? `out by ${short(e)}` : null].filter(Boolean).join(', ');
  return window ? `${hours} · ${window}` : hours;
}

