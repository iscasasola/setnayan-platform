/**
 * 👁 VIEW AS — the Schedule seen as one person sees it (owner 2026-11-01; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3
 * "Suppliers by time" · "Unlimited people", §3b "View as is Pro", §4 "View as ▾", §12 Step 3; the approved prototype
 * `prototypes/schedule_chapters_2026-11-01/` — `asPick`, `personBody`, `supBody`, `supTimeBody`). The pure half: no
 * I/O, no React. The read is `schedule-view-as.server.ts`; the screen is `schedule/_components/schedule-view-as.tsx`.
 *
 * Every view is a FILTER over the one master (chapters · moments · `event_schedule_tasks`), never a copy, and never a
 * write — it only narrows what the host already reads:
 *   · Everyone — the host's full view (the rail, as shipped). The default.
 *   · A guest — only the chapters on the invitation, and in them only the moments on the guests' schedule
 *     (`isOnTheGuestsSchedule`: shown to guests, for Everyone, not a coordinator's staged prep — the same three
 *     questions the database's anonymous read asks). No task ever: supplier times and crew calls never reach a guest.
 *   · A role (Entourage · Bridesmaid · a guest group) — the chapters, moments and tasks that NAME that role.
 *   · A supplier or one of its crews — their tasks across chapters, each with its place and call time, plus a moment
 *     the host tagged them on that holds no task of theirs yet. Nobody else's line.
 *   · Suppliers by time — the day grouped into stretches of overlapping supplier work, "N suppliers at once".
 *
 * 🛑 HONEST: a task read that was refused is `tasks: null` and the view SAYS so — a supplier's day is never drawn as
 * empty over tasks it merely failed to read.
 * 🔒 app/dashboard/[eventId]/schedule/view-as-shows-only-whats-theirs.test.ts
 */
import { guestInvitedTo } from './invitation-chapters';
import {
  TIME_TBA,
  chapterWhere,
  clockWords,
  findTaskClashes,
  taskPlace,
  type Chapter,
  type MomentLike,
  type TaskRow,
  isBackstage,
} from './schedule-chapters';
import { RIGHT_AFTER } from './moment-order';
import { SCHEDULE_AUDIENCE_LABEL, isOnTheGuestsSchedule, readScheduleAudience, type ScheduleAudience } from './schedule-audience';

/* ── what the views read ──────────────────────────────────────────────────────────────────────────────────────── */

/** A moment (a chapter's child block) with everything a view filters on. */
export type ViewMoment = {
  block_id: string;
  parent_block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  is_public: boolean;
  /** A coordinator's unreleased prep — never on the guests' schedule. */
  staged: boolean;
  /** For ▾ (`lib/schedule-audience.ts`): NULL = Everyone. */
  audience: string | null;
  responsible_vendor_ids: readonly string[];
  location: string | null;
  spot: string | null;
  travel_from: string | null;
  travel_to: string | null;
  /** ⏭ No clock of its own — "right after the one above" (migration 20271302727358); `start_at` is only its order key. */
  time_tba?: boolean;
};

/** `everyChapter` — a coordinator (`isOnEveryChapter`): offered "Coordinator" in View as (slice 6). */
/** `host` — the booked Host / MC; `trade` — "Photo and video" (Side by side's column heads, slice 9). */
export type ViewSupplier = { vendor_id: string; name: string; booked: boolean; everyChapter?: boolean; host?: boolean; trade?: string | null };

/**
 * 👤 A NAMED GUEST, as View as › Guests reads them (slice 6, owner 2026-11-04 "What they see now"): the same three facts
 * their own Event Hub card reads (`readYourSchedule`) — the roles they hold, their groups, the chapters the hosts took
 * them off — so the host's preview and the guest's card are one rule (`yourSchedule`).
 */
export type ViewPerson = { guest_id: string; name: string; roles: string[]; groupIds: string[]; notInvited: string[] };

export type ViewAsData = {
  moments: ViewMoment[];
  /** Every task on the event's moments; NULL = the read was refused (said, never drawn as none). */
  tasks: TaskRow[] | null;
  suppliers: ViewSupplier[];
  /** A guest group's name by id; NULL = the read was refused. */
  groups: Record<string, string> | null;
  /** A task's role word → how it reads ("bridesmaid" → "Bridesmaid"). */
  roleNames: Record<string, string>;
  /** 👤 The event's guests for View as › a named guest (slice 6); NULL = the read was refused, absent = not read here. */
  people?: ViewPerson[] | null;
  /** The schedule is released (`events.schedule_released_at`) AND the event holds Pro — the guests' own `released`. */
  released?: boolean;
  /** The invitation's Arrive by ("4:45 PM", `guestsArriveTime`) — a plain guest's call. */
  guestsArriveBy?: string | null;
};

/** What the View as ▾ needs from the page: the data, and whether this event owns the view (Pro, plan §3b). */
export type ViewAsInput = {
  data: ViewAsData;
  /** The event owns Pro (as this viewer is shown it — `asViewed`). */
  pro: boolean;
  /** Where a Free event's View as opens the upgrade; NULL = no door here (a store shell that sells none). */
  proHref: string | null;
};

/* ── the lens ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export type ViewLens =
  | { kind: 'everyone' }
  | { kind: 'guest' }
  | { kind: 'suptime' }
  /** `aud:entourage` · `role:bridesmaid` · `group:<id>`. */
  | { kind: 'role'; key: string }
  | { kind: 'supplier'; vendorId: string; crew: string | null }
  /** 👤 One named guest — exactly their Event Hub card today (slice 6). */
  | { kind: 'person'; guestId: string }
  /** 📋 The coordinator: every chapter and moment, with their own tasks marked (slice 6). */
  | { kind: 'coord'; vendorId: string };

export const EVERYONE: ViewLens = { kind: 'everyone' };

/** The lens as one string — the dropdown's key. */
export function lensKey(l: ViewLens): string {
  switch (l.kind) {
    case 'everyone':
    case 'guest':
    case 'suptime':
      return l.kind;
    case 'role':
      return `role=${l.key}`;
    case 'supplier':
      return l.crew ? `sup=${l.vendorId}=${l.crew}` : `sup=${l.vendorId}`;
    case 'person':
      return `guest=${l.guestId}`;
    case 'coord':
      return `coord=${l.vendorId}`;
  }
}

/** The dropdown's key → the lens. Anything unknown is Everyone (never guessed narrower or wider). */
export function lensFromKey(key: string): ViewLens {
  if (key === 'guest' || key === 'suptime') return { kind: key };
  if (key.startsWith('role=')) return { kind: 'role', key: key.slice(5) };
  if (key.startsWith('guest=') && key.length > 6) return { kind: 'person', guestId: key.slice(6) };
  if (key.startsWith('coord=') && key.length > 6) return { kind: 'coord', vendorId: key.slice(6) };
  if (key.startsWith('sup=')) {
    const [vendorId, ...crew] = key.slice(4).split('=');
    if (vendorId) return { kind: 'supplier', vendorId, crew: crew.length ? crew.join('=') : null };
  }
  return EVERYONE;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** A supplier by name; one the schedule names but the page cannot (a refused read) is "A supplier", never blank. */
export function supplierName(data: Pick<ViewAsData, 'suppliers'>, vendorId: string): string {
  return data.suppliers.find((s) => s.vendor_id === vendorId)?.name ?? 'A supplier';
}

/** "Bridesmaid" · "Entourage" · "Bride's family" — what a role key reads as. */
export function roleWords(data: Pick<ViewAsData, 'groups' | 'roleNames'>, key: string): string {
  if (key.startsWith('aud:')) return SCHEDULE_AUDIENCE_LABEL[readScheduleAudience(key.slice(4))];
  if (key.startsWith('group:')) return data.groups?.[key.slice(6)] ?? 'A group';
  if (key.startsWith('role:')) {
    const word = key.slice(5);
    return data.roleNames[word] ?? (word.charAt(0).toUpperCase() + word.slice(1)).replace(/_/g, ' ');
  }
  return key;
}

/**
 * 🆓 WHICH VIEWS ARE FREE (owner 2026-11-02, DECISION_LOG "TEN OWNER YESES" item 3: *"Suppliers by time is FREE"*).
 * Everyone (the rail itself) and Suppliers by time — the host's own clash check — are every event's. Seeing the day AS
 * a guest, a role, a supplier or a crew stays Pro (plan §3b). The menu, the body and the rail all ask THIS.
 */
export function lensIsFree(l: ViewLens): boolean {
  return l.kind === 'everyone' || l.kind === 'suptime';
}

/** May this event draw this view? A Pro event every view; a Free one only the free ones (never guessed wider). */
export function lensAllowed(pro: boolean, l: ViewLens): boolean {
  return pro || lensIsFree(l);
}

/** The key of the Free menu's one door to the upgrade (never a lens: `lensFromKey('pro')` is Everyone). */
export const VIEW_AS_PRO_DOOR = 'pro';

/**
 * The View as ▾ list THIS event is shown. Pro: every view (`viewAsOptions`). Free: the free views, then — only where
 * Pro is sold here (`proDoor`) — one row that opens the upgrade for the per-person views. No guest, role or supplier
 * is ever listed as pickable on a Free event.
 */
export function viewAsMenuOptions(data: ViewAsData, pro: boolean, proDoor: boolean): ViewOption[] {
  const all = viewAsOptions(data);
  if (pro) return all;
  const free = all.filter((o) => lensIsFree(lensFromKey(o.key)));
  return proDoor ? [...free, { key: VIEW_AS_PRO_DOOR, label: 'A guest, a role, a supplier or the coordinator', group: 'Part of Pro' }] : free;
}

/** The words the button and the "back to Everyone" line say for a lens. */
export function lensWords(data: ViewAsData, l: ViewLens): string {
  switch (l.kind) {
    case 'everyone':
      return 'Everyone';
    case 'guest':
      return 'A guest';
    case 'suptime':
      return 'Side by side';
    case 'role':
      return roleWords(data, l.key);
    case 'supplier':
      return l.crew ? `${supplierName(data, l.vendorId)} · ${l.crew}` : supplierName(data, l.vendorId);
    case 'person':
      return data.people?.find((p) => p.guest_id === l.guestId)?.name ?? 'A guest';
    case 'coord':
      return `Coordinator · ${supplierName(data, l.vendorId)}`;
  }
}

export type ViewOption = { key: string; label: string; group?: string };

/**
 * The View as ▾ list: Everyone · A guest · Suppliers by time, then By role (only roles the schedule names), then
 * Suppliers (booked ones, and anyone the schedule names) with each named crew under its supplier. Unlimited people:
 * the menu searches it (`schedule-view-as.tsx`); nobody is listed who is on no line and not booked.
 */
export function viewAsOptions(data: ViewAsData): ViewOption[] {
  const out: ViewOption[] = [
    { key: 'everyone', label: 'Everyone' },
    { key: 'guest', label: 'A guest' },
    { key: 'suptime', label: 'Side by side' },
  ];
  const roles = new Map<string, string>();
  for (const m of data.moments) {
    const a = readScheduleAudience(m.audience);
    if (a !== 'everyone' && a !== 'suppliers') roles.set(`aud:${a}`, roleWords(data, `aud:${a}`));
  }
  for (const t of data.tasks ?? []) {
    if (t.role?.trim()) roles.set(`role:${norm(t.role)}`, roleWords(data, `role:${norm(t.role)}`));
    if (t.group_id) roles.set(`group:${t.group_id}`, roleWords(data, `group:${t.group_id}`));
  }
  // 📋 The coordinator first under By role (slice 6): a booked coordinator is on every chapter (`everyChapter`).
  for (const s of data.suppliers.filter((x) => x.everyChapter).sort((a, b) => a.name.localeCompare(b.name))) {
    out.push({ key: `coord=${s.vendor_id}`, label: `Coordinator · ${s.name}`, group: 'By role' });
  }
  for (const [key, label] of [...roles].sort((a, b) => a[1].localeCompare(b[1]))) out.push({ key: `role=${key}`, label, group: 'By role' });

  const named = new Set<string>();
  for (const t of data.tasks ?? []) if (t.vendor_id) named.add(t.vendor_id);
  for (const m of data.moments) for (const v of m.responsible_vendor_ids) named.add(v);
  const shown = new Set<string>();
  const sups = [...data.suppliers.filter((s) => s.booked || named.has(s.vendor_id))];
  for (const v of named) if (!data.suppliers.some((s) => s.vendor_id === v)) sups.push({ vendor_id: v, name: 'A supplier', booked: false });
  for (const s of sups.sort((a, b) => a.name.localeCompare(b.name))) {
    if (shown.has(s.vendor_id)) continue;
    shown.add(s.vendor_id);
    out.push({ key: `sup=${s.vendor_id}`, label: s.name, group: 'Suppliers' });
    const crews = [...new Set((data.tasks ?? []).filter((t) => t.vendor_id === s.vendor_id && t.crew?.trim()).map((t) => t.crew!.trim()))];
    for (const crew of crews.sort()) out.push({ key: `sup=${s.vendor_id}=${crew}`, label: `${s.name} · ${crew}`, group: 'Suppliers' });
  }
  // 👤 Every guest by name (slice 6) — unlimited, so the menu searches; listed last.
  for (const p of [...(data.people ?? [])].sort((a, b) => a.name.localeCompare(b.name))) out.push({ key: `guest=${p.guest_id}`, label: p.name, group: 'Guests' });
  return out;
}

/* ── one person's day: chapters, each with its rows ──────────────────────────────────────────────────────────── */

export type ViewRow = {
  id: string;
  /** "6:30 AM", or "Time TBA" in a chapter with no time yet. */
  time: string;
  /** What happens: the task, or the moment. */
  title: string;
  /** The moment it belongs to, and where. */
  sub: string;
  /** This line also puts the same person or crew somewhere else at once (§3c #5) — flagged, never refused. */
  clash?: boolean;
  /** 📋 The coordinator's own task on this line (slice 6). */
  mine?: boolean;
};

export type ViewChapter = { chapter: Chapter; rows: ViewRow[] };

export type ViewDay = {
  chapters: ViewChapter[];
  /** A supplier's or crew's call time: their first line on the day (a supplier's lead is 0 — plan §3 "Call time"). */
  call: { time: string; where: string } | null;
  /** The tasks could not be read — said, never drawn as none. */
  tasksUnread: boolean;
};

type Line = { id: string; startIso: string; title: string; sub: string; place?: string; chapter: Chapter; clash?: boolean; rightAfter?: boolean };

const byStart = (a: { startIso: string }, b: { startIso: string }) => (a.startIso < b.startIso ? -1 : a.startIso > b.startIso ? 1 : 0);

function momentLike(m: ViewMoment): MomentLike {
  return { block_id: m.block_id, start_at: m.start_at, end_at: m.end_at, location: m.location, spot: m.spot, travel_from: m.travel_from, travel_to: m.travel_to };
}

/** Lines → chapters in time order, each its rows in time order. A TBA chapter's lines read "Time TBA". */
function toDay(lines: Line[], call: ViewDay['call'], tasksUnread: boolean): ViewDay {
  const by = new Map<string, Line[]>();
  for (const l of lines) by.set(l.chapter.block_id, [...(by.get(l.chapter.block_id) ?? []), l]);
  const chapters = [...by.values()]
    .map((ls) => ({ chapter: ls[0]!.chapter, rows: ls.sort(byStart).map((l) => ({ id: l.id, time: l.chapter.time_tba ? TIME_TBA : l.rightAfter ? RIGHT_AFTER : clockWords(l.startIso), title: l.title, sub: l.sub, ...(l.clash ? { clash: true } : {}) })) }))
    .sort((a, b) => (a.chapter.start_at < b.chapter.start_at ? -1 : a.chapter.start_at > b.chapter.start_at ? 1 : 0));
  return { chapters, call, tasksUnread };
}

/** Each moment with its chapter — only moments that sit in one of these chapters. */
function withChapter(chapters: readonly Chapter[], moments: readonly ViewMoment[]): Map<string, { m: ViewMoment; c: Chapter }> {
  const cs = new Map(chapters.map((c) => [c.block_id, c]));
  const out = new Map<string, { m: ViewMoment; c: Chapter }>();
  for (const m of moments) {
    const c = cs.get(m.parent_block_id);
    if (c) out.set(m.block_id, { m, c });
  }
  return out;
}

/**
 * 🔒 Is this chapter on a guest's schedule? On the invitation (`on_invitation` on a top-level block — every guest
 * replies to it). ✉ ONE SOURCE (Step 5): the rule lives in `lib/invitation-chapters.ts`, and the reply card, the reply's
 * write, the notices, the hosts' counts and Details › Schedule ask the same function View as does. A per-guest
 * narrowing belongs there and nowhere else.
 */
export { guestInvitedTo };

/** 🔒 Is this moment on the guests' schedule — the database's own three questions (`isOnTheGuestsSchedule`). */
export function guestSeesMoment(m: Pick<ViewMoment, 'is_public' | 'audience' | 'staged'>): boolean {
  return isOnTheGuestsSchedule({ is_public: m.is_public, audience: m.audience, visibility: m.staged ? 'coordinator_only' : null });
}

/**
 * A GUEST: the chapters on the invitation, each with only the moments on the guests' schedule. A chapter with none yet
 * is still listed (they reply to it), with its time and place. No task, ever.
 */
export function guestDay(chapters: readonly Chapter[], data: ViewAsData): ViewDay {
  const invited = chapters.filter((c) => guestInvitedTo(c));
  const lines: Line[] = [];
  for (const { m, c } of withChapter(invited, data.moments).values()) {
    if (!guestSeesMoment(m)) continue;
    // 🎭 Backstage (Ingress · Egress) — the guest view never shows it, exactly as the Event Hub never does.
    if (isBackstage(m.start_at, c)) continue;
    lines.push({ id: m.block_id, startIso: m.start_at, title: m.label, sub: m.location ?? '', chapter: c, rightAfter: m.time_tba === true });
  }
  const day = toDay(lines, null, false);
  for (const c of invited) if (!day.chapters.some((x) => x.chapter.block_id === c.block_id)) day.chapters.push({ chapter: c, rows: [] });
  day.chapters.sort((a, b) => (a.chapter.start_at < b.chapter.start_at ? -1 : a.chapter.start_at > b.chapter.start_at ? 1 : 0));
  return day;
}

/** A ROLE: the moments for that audience, and the tasks naming that role or group — only those. */
export function roleDay(chapters: readonly Chapter[], data: ViewAsData, key: string): ViewDay {
  const at = withChapter(chapters, data.moments);
  const lines: Line[] = [];
  if (key.startsWith('aud:')) {
    const aud = readScheduleAudience(key.slice(4)) as ScheduleAudience;
    for (const { m, c } of at.values()) {
      if (aud === 'everyone' || readScheduleAudience(m.audience) !== aud) continue;
      lines.push({ id: m.block_id, startIso: m.start_at, title: m.label, sub: placeOf(m, c), chapter: c, rightAfter: m.time_tba === true });
    }
    return toDay(lines, null, false);
  }
  const names = (t: TaskRow) =>
    key.startsWith('role:') ? Boolean(t.role) && norm(t.role) === key.slice(5) : key.startsWith('group:') ? t.group_id === key.slice(6) : false;
  for (const t of data.tasks ?? []) {
    const hit = at.get(t.block_id);
    if (!hit || !names(t)) continue;
    lines.push(taskLine(t, hit.m, hit.c));
  }
  return toDay(lines, null, data.tasks === null);
}

/**
 * A SUPPLIER (or one crew of theirs): their tasks across the chapters, each with its place and time, and their call
 * time — and, for the whole supplier, a moment the host tagged them on that holds no task of theirs yet. ONLY theirs:
 * nobody else's task, and no moment they are not on.
 */
export function supplierDay(chapters: readonly Chapter[], data: ViewAsData, vendorId: string, crew: string | null): ViewDay {
  const at = withChapter(chapters, data.moments);
  const mine = (data.tasks ?? []).filter((t) => t.vendor_id === vendorId && (crew === null || norm(t.crew) === norm(crew)));
  const clashed = clashIds(data, at);
  const lines: Line[] = [];
  for (const t of mine) {
    const hit = at.get(t.block_id);
    if (!hit) continue;
    lines.push({ ...taskLine(t, hit.m, hit.c, crew === null), clash: clashed.has(t.task_id) });
  }
  if (crew === null) {
    const withTask = new Set(mine.map((t) => t.block_id));
    for (const { m, c } of at.values()) {
      if (!m.responsible_vendor_ids.includes(vendorId) || withTask.has(m.block_id)) continue;
      const place = placeOf(m, c);
      lines.push({ id: m.block_id, startIso: m.start_at, title: m.label, sub: place, place, chapter: c, rightAfter: m.time_tba === true });
    }
  }
  const timed = lines.filter((l) => !l.chapter.time_tba).sort(byStart)[0];
  const call = timed ? { time: clockWords(timed.startIso), where: timed.place ?? chapterWhere(timed.chapter) } : null;
  return toDay(lines, call, data.tasks === null);
}

function placeOf(m: ViewMoment, c: Chapter): string {
  return taskPlace({ place: null }, momentLike(m), c) ?? chapterWhere(c);
}

function taskLine(t: TaskRow, m: ViewMoment, c: Chapter, sayCrew = false): Line {
  const place = taskPlace(t, momentLike(m), c) ?? chapterWhere(c);
  const crew = sayCrew && t.crew?.trim() ? `${t.crew.trim()} · ` : '';
  return { id: t.task_id, startIso: t.call_at ?? m.start_at, title: t.what, sub: `${crew}${m.label} · ${place}`, place, chapter: c, rightAfter: !t.call_at && m.time_tba === true };
}

function clashIds(data: ViewAsData, at: Map<string, { m: ViewMoment; c: Chapter }>): Set<string> {
  const items = (data.tasks ?? []).flatMap((task) => {
    const hit = at.get(task.block_id);
    return hit && !hit.c.time_tba ? [{ task, moment: momentLike(hit.m), chapter: hit.c }] : [];
  });
  const out = new Set<string>();
  for (const c of findTaskClashes(items)) {
    out.add(c.first);
    out.add(c.second);
  }
  return out;
}

/* ── Suppliers by time ───────────────────────────────────────────────────────────────────────────────────────── */

/** A moment with no end is drawn 30 minutes long on the rail (`OPEN_ENDED_MINUTES`); the same here. */
const OPEN_ENDED_MS = 30 * 60_000;

export type TimeItem = { id: string; vendorId: string; who: string; time: string; title: string; sub: string; until: string; clash?: boolean };
export type TimeStretch = { from: string; to: string; suppliers: number; items: TimeItem[] };
/** A Time-TBA chapter's supplier lines — listed "Time TBA", never hidden (owner 2026-11-02, "TEN OWNER YESES" item 4). */
export type TbaStretch = { chapter: Chapter; where: string; suppliers: number; items: TimeItem[] };

/**
 * SUPPLIERS BY TIME (owner: *"I want to see when there are multiple suppliers having same schedules with other
 * schedules"*): every supplier line on timed chapters — their tasks, and moments they are tagged on with no task of
 * theirs — grouped into stretches of overlapping work, each with "N suppliers at once" (N counts suppliers, not
 * crews). A list, not columns: suppliers are unlimited and columns crush on a phone.
 * ⏰ A TIME-TBA CHAPTER IS NEVER HIDDEN (owner 2026-11-02, "TEN OWNER YESES" item 4): it has no time to overlap, so its
 * supplier lines are listed after the timed stretches, one group per chapter, each line "Time TBA" with no until.
 */
export function suppliersByTime(chapters: readonly Chapter[], data: ViewAsData): { stretches: TimeStretch[]; tba: TbaStretch[]; tasksUnread: boolean } {
  const at = withChapter(chapters.filter((c) => !c.time_tba), data.moments);
  const clashed = clashIds(data, at);
  const raw: Array<TimeItem & { s: number; e: number }> = [];
  const span = (startIso: string, m: ViewMoment) => {
    const s = Date.parse(startIso);
    const end = m.end_at ? Date.parse(m.end_at) : NaN;
    return { s, e: Number.isFinite(end) && end > s ? end : s + OPEN_ENDED_MS };
  };
  const withTask = new Set<string>();
  for (const t of data.tasks ?? []) {
    const hit = at.get(t.block_id);
    if (!t.vendor_id || !hit) continue;
    withTask.add(`${t.vendor_id}|${t.block_id}`);
    const startIso = t.call_at ?? hit.m.start_at;
    const { s, e } = span(startIso, hit.m);
    const place = taskPlace(t, momentLike(hit.m), hit.c) ?? chapterWhere(hit.c);
    const who = t.crew?.trim() ? `${supplierName(data, t.vendor_id)} · ${t.crew.trim()}` : supplierName(data, t.vendor_id);
    raw.push({ id: t.task_id, vendorId: t.vendor_id, who, time: clockWords(startIso), title: t.what, sub: `${hit.m.label} · ${place}`, until: clockWords(new Date(e).toISOString()), s, e, ...(clashed.has(t.task_id) ? { clash: true } : {}) });
  }
  for (const { m, c } of at.values()) {
    for (const v of m.responsible_vendor_ids) {
      if (withTask.has(`${v}|${m.block_id}`)) continue;
      const { s, e } = span(m.start_at, m);
      raw.push({ id: `${m.block_id}:${v}`, vendorId: v, who: supplierName(data, v), time: clockWords(m.start_at), title: m.label, sub: placeOf(m, c), until: clockWords(new Date(e).toISOString()), s, e });
    }
  }
  raw.sort((a, b) => a.s - b.s || a.e - b.e);
  const groups: Array<{ s: number; e: number; items: typeof raw }> = [];
  for (const it of raw) {
    const g = groups[groups.length - 1];
    if (g && it.s < g.e) {
      g.items.push(it);
      g.e = Math.max(g.e, it.e);
    } else groups.push({ s: it.s, e: it.e, items: [it] });
  }
  return {
    stretches: groups.map((g) => ({
      from: clockWords(new Date(g.s).toISOString()),
      to: clockWords(new Date(g.e).toISOString()),
      suppliers: new Set(g.items.map((i) => i.vendorId)).size,
      items: g.items.map((i): TimeItem => ({ id: i.id, vendorId: i.vendorId, who: i.who, time: i.time, title: i.title, sub: i.sub, until: i.until, ...(i.clash ? { clash: true } : {}) })),
    })),
    tba: tbaStretches(chapters, data),
    tasksUnread: data.tasks === null,
  };
}

/** The supplier lines on each Time-TBA chapter: their tasks, and moments they are tagged on with no task of theirs. */
function tbaStretches(chapters: readonly Chapter[], data: ViewAsData): TbaStretch[] {
  const tbaChapters = chapters.filter((c) => c.time_tba);
  const at = withChapter(tbaChapters, data.moments);
  const by = new Map<string, TimeItem[]>();
  const add = (c: Chapter, it: TimeItem) => by.set(c.block_id, [...(by.get(c.block_id) ?? []), it]);
  const withTask = new Set<string>();
  for (const t of data.tasks ?? []) {
    const hit = at.get(t.block_id);
    if (!t.vendor_id || !hit) continue;
    withTask.add(`${t.vendor_id}|${t.block_id}`);
    const place = taskPlace(t, momentLike(hit.m), hit.c) ?? chapterWhere(hit.c);
    const who = t.crew?.trim() ? `${supplierName(data, t.vendor_id)} · ${t.crew.trim()}` : supplierName(data, t.vendor_id);
    add(hit.c, { id: t.task_id, vendorId: t.vendor_id, who, time: TIME_TBA, title: t.what, sub: `${hit.m.label} · ${place}`, until: '' });
  }
  for (const { m, c } of at.values()) {
    for (const v of m.responsible_vendor_ids) {
      if (withTask.has(`${v}|${m.block_id}`)) continue;
      add(c, { id: `${m.block_id}:${v}`, vendorId: v, who: supplierName(data, v), time: TIME_TBA, title: m.label, sub: placeOf(m, c), until: '' });
    }
  }
  return tbaChapters.flatMap((c) => {
    const items = by.get(c.block_id);
    return items?.length ? [{ chapter: c, where: chapterWhere(c), suppliers: new Set(items.map((i) => i.vendorId)).size, items }] : [];
  });
}
