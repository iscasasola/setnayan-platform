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
  'block_id, parent_block_id, label, start_at, end_at, location, spot, notes, ingress_minutes_before, egress_minutes_after, call_lead_minutes, on_invitation, photo_who, photo_when, is_public, sort_order, time_tba';

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

/**
 * Which part of its chapter a moment is in — Ingress · Event · Egress (plan §3 "Opening a chapter shows Ingress · Event
 * · Egress"). Read from the times, never stored: before the chapter starts is Ingress, at or after it ends is Egress,
 * the rest is the Event. A chapter with no end has no Egress by time.
 */
export type ChapterSection = 'Ingress' | 'Event' | 'Egress';
export function momentSection(momentStart: string, c: Pick<Chapter, 'start_at' | 'end_at' | 'time_tba'>): ChapterSection {
  if (c.time_tba) return 'Event';
  const t = Date.parse(momentStart);
  if (!Number.isFinite(t)) return 'Event';
  if (t < Date.parse(c.start_at)) return 'Ingress';
  if (c.end_at && t >= Date.parse(c.end_at)) return 'Egress';
  return 'Event';
}

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
