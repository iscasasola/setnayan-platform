/**
 * 🛂 THE CHECK-IN DESK, IN THREE PARTS — the pure half (owner, 16 Nov 2026, "Yes, as drawn":
 * *"checkin desk for all suppliers and coordinators and guests? a coordinator/host control?"* — DECISION_LOG, specs
 * 9f6ff16e; prototype `prototypes/event_pages_guests_doors_2026-11-16/…_fable.html` § "Check-in desk (three parts)").
 *
 * One desk, picked from one dropdown:
 *   · Guests    — the shipped desk, as it is (QR / name search, Mark arrived, Recent arrivals with undo);
 *   · Suppliers — an arrivals board: each supplier's OWN shipped status (`VENDOR_STATUS_PRESETS` in
 *                 lib/day-requests.ts — "On site" · "Setup done" · "Ready to start" · "Packed up"), with "On site"
 *                 checked against the time they said they arrive (`supplier_own_times.arrive_clock`) → On time · Late ·
 *                 Not yet. NOT a second arrival mechanism: a supplier arrives by pressing the preset they already have;
 *   · Team      — who is on the desk now, read off who scanned (`guest_checkins.checked_in_by_user_id`) and who handed
 *                 a souvenir (`guest_souvenir_claims.claimed_by_user_id`). A coordinator checks in by working the door.
 *
 * ⚙ Who runs the desk: hosts always (every part); the coordinator, helpers and one supplier at the door each get the
 * parts the hosts choose. To start (owner answer 3, 16 Nov): the coordinator sees all three, helpers see Guests, a
 * supplier at the door is Off until the hosts pick one. Stored on `events.checkin_desk_access`; NULL = those defaults.
 *
 * Nothing here reads or writes the database — the page reads, `guests/checkin/actions.ts` writes.
 */

import { presetByKey } from './day-requests';

/* ── The three parts ───────────────────────────────────────────────────────────────────────────────────────────── */

export type DeskPart = 'guests' | 'suppliers' | 'team';

export const DESK_PARTS: readonly DeskPart[] = ['guests', 'suppliers', 'team'];

export const DESK_PART_LABEL: Readonly<Record<DeskPart, string>> = {
  guests: 'Guests',
  suppliers: 'Suppliers',
  team: 'Team',
};

export function isDeskPart(v: unknown): v is DeskPart {
  return typeof v === 'string' && (DESK_PARTS as readonly string[]).includes(v);
}

/** The parts in the drawing's order, de-duplicated, unknown words dropped. */
export function cleanParts(raw: unknown): DeskPart[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter(isDeskPart));
  return DESK_PARTS.filter((p) => set.has(p));
}

/** "Guests · Suppliers · Team", "Guests", "Off". */
export function partsWords(parts: readonly DeskPart[]): string {
  return parts.length ? parts.map((p) => DESK_PART_LABEL[p]).join(' · ') : 'Off';
}

/* ── Who runs the desk ─────────────────────────────────────────────────────────────────────────────────────────── */

export type DeskAccess = {
  coordinator: DeskPart[];
  helpers: DeskPart[];
  /** The ONE supplier at the door: the seat holder's account, and the parts they get. Null = Off. */
  door: { userId: string; parts: DeskPart[] } | null;
};

/** Owner answer 3 (16 Nov): the coordinator sees all three parts, helpers see Guests, a supplier is off. */
export const DEFAULT_DESK_ACCESS: DeskAccess = {
  coordinator: ['guests', 'suppliers', 'team'],
  helpers: ['guests'],
  door: null,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The stored jsonb → the rules. NULL (never set) is the defaults. A key that is present is the hosts' answer, even
 * an empty list (they turned that role Off) — an absent key falls back to its default, never to "everything".
 */
export function parseDeskAccess(raw: unknown): DeskAccess {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_DESK_ACCESS };
  const o = raw as Record<string, unknown>;
  const door = o.door as { user_id?: unknown; parts?: unknown } | null | undefined;
  const doorUser = door && typeof door === 'object' && typeof door.user_id === 'string' && UUID_RE.test(door.user_id) ? door.user_id : null;
  const doorParts = doorUser ? cleanParts(door?.parts) : [];
  return {
    coordinator: 'coordinator' in o ? cleanParts(o.coordinator) : [...DEFAULT_DESK_ACCESS.coordinator],
    helpers: 'helpers' in o ? cleanParts(o.helpers) : [...DEFAULT_DESK_ACCESS.helpers],
    door: doorUser && doorParts.length ? { userId: doorUser, parts: doorParts } : null,
  };
}

/** The rules → what is stored (snake_case, the column's own words). */
export function serializeDeskAccess(a: DeskAccess): Record<string, unknown> {
  return {
    coordinator: cleanParts(a.coordinator),
    helpers: cleanParts(a.helpers),
    door: a.door && UUID_RE.test(a.door.userId) && cleanParts(a.door.parts).length
      ? { user_id: a.door.userId, parts: cleanParts(a.door.parts) }
      : null,
  };
}

/** Who this person is at the desk. `null` = nobody the desk knows. */
export type DeskRole = 'host' | 'coordinator' | 'helper' | 'supplier';

export const DESK_ROLE_WORD: Readonly<Record<DeskRole, string>> = {
  host: 'Host',
  coordinator: 'Coordinator',
  helper: 'Helper',
  supplier: 'Supplier',
};

/**
 * The viewer's desk role, from facts the event already holds:
 *   · a couple member, or a full co-host seat → host (hosts always run every part);
 *   · the BOOKED coordinator (`is_booked_coordinator`) → coordinator;
 *   · a booked supplier who proposes only (`supplier_proposes_only`) → supplier;
 *   · the hired planner's seat held by somebody who is not a booked supplier → coordinator (the hosts' own planner);
 *   · any other live seat → helper;
 *   · an event `coordinator` member with no seat at all (a legacy row) → coordinator.
 */
export function deskRoleOf(input: {
  isHost: boolean;
  bookedCoordinator: boolean;
  supplierProposesOnly: boolean;
  seatRole: string | null;
  isCoordinatorMember: boolean;
}): DeskRole | null {
  if (input.isHost) return 'host';
  if (input.bookedCoordinator) return 'coordinator';
  if (input.supplierProposesOnly) return 'supplier';
  if (input.seatRole === 'wedding_planner_external') return 'coordinator';
  if (input.seatRole) return 'helper';
  if (input.isCoordinatorMember) return 'coordinator';
  return null;
}

/** The parts one person may open. A supplier gets parts only when they are THE supplier the hosts picked. */
export function partsForRole(role: DeskRole | null, access: DeskAccess, userId: string): DeskPart[] {
  switch (role) {
    case 'host':
      return [...DESK_PARTS];
    case 'coordinator':
      return [...access.coordinator];
    case 'helper':
      return [...access.helpers];
    case 'supplier':
      return access.door && access.door.userId === userId ? [...access.door.parts] : [];
    default:
      return [];
  }
}

/* ── Suppliers: the arrivals board ─────────────────────────────────────────────────────────────────────────────── */

/** The four shipped presets the board reads — the two `issue` presets are the coordinator's inbox, not arrival. */
export const ARRIVAL_PRESETS = ['on_site', 'setup_done', 'ready', 'packed_up'] as const;
export type ArrivalPreset = (typeof ARRIVAL_PRESETS)[number];

export type ArrivalVerdict = 'on_time' | 'late' | 'not_yet';

export const ARRIVAL_VERDICT_WORD: Readonly<Record<ArrivalVerdict, string>> = {
  on_time: 'On time',
  late: 'Late',
  not_yet: 'Not yet',
};

export type BoardSupplier = { vendorProfileId: string; name: string };
export type BoardStatusRow = { vendorProfileId: string | null; presetKey: string | null; at: string };
export type BoardTimes = { arrive: string | null; done: string | null };

export type BoardLine = {
  vendorProfileId: string;
  name: string;
  initials: string;
  /** "On site 11:52 AM · due 12:00 PM · Setup done 12:40 PM" / "Due 2:00 PM · 20m ago" / "No times yet". */
  line: string;
  verdict: ArrivalVerdict;
  /** They pressed "On site". */
  here: boolean;
  /** No arrival time was ever given — drawn with the dashed initials. */
  noTimes: boolean;
};

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w?.[0] ?? '');
  return letters.join('').toUpperCase() || '·';
}

/** "20m", "1h 05m". */
export function minutesWords(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * The board, one line per booked supplier (in the order given). `wallToMs` turns the event day's 'HH:MM' into an
 * instant at the venue (null when the event has no day); `clockOf` writes an instant as the venue's clock;
 * `ownClock` writes a stored 'HH:MM'. "On site" is the FIRST time they pressed it (a second press does not make an
 * early supplier late); every later status is its LATEST press.
 */
export function arrivalsBoard(input: {
  suppliers: readonly BoardSupplier[];
  rows: readonly BoardStatusRow[];
  times: ReadonlyMap<string, BoardTimes>;
  nowMs: number;
  wallToMs: (hhmm: string) => number | null;
  clockOf: (iso: string) => string;
  ownClock: (hhmm: string) => string;
}): { lines: BoardLine[]; here: number } {
  const first = new Map<string, string>();
  const latest = new Map<string, Map<ArrivalPreset, string>>();
  for (const r of input.rows) {
    if (!r.vendorProfileId || !r.presetKey) continue;
    if (!(ARRIVAL_PRESETS as readonly string[]).includes(r.presetKey)) continue;
    const key = r.presetKey as ArrivalPreset;
    const t = Date.parse(r.at);
    if (!Number.isFinite(t)) continue;
    if (key === 'on_site') {
      const prev = first.get(r.vendorProfileId);
      if (!prev || Date.parse(prev) > t) first.set(r.vendorProfileId, r.at);
    }
    const m = latest.get(r.vendorProfileId) ?? new Map<ArrivalPreset, string>();
    const prev = m.get(key);
    if (!prev || Date.parse(prev) < t) m.set(key, r.at);
    latest.set(r.vendorProfileId, m);
  }

  let here = 0;
  const lines = input.suppliers.map((s): BoardLine => {
    const times = input.times.get(s.vendorProfileId) ?? { arrive: null, done: null };
    const dueMs = times.arrive ? input.wallToMs(times.arrive) : null;
    const doneMs = times.done ? input.wallToMs(times.done) : null;
    const onSite = first.get(s.vendorProfileId) ?? null;
    const later = latest.get(s.vendorProfileId) ?? new Map<ArrivalPreset, string>();
    const parts: string[] = [];
    let verdict: ArrivalVerdict;
    if (onSite) {
      here += 1;
      const onMs = Date.parse(onSite);
      verdict = dueMs != null && onMs > dueMs ? 'late' : 'on_time';
      parts.push(`On site ${input.clockOf(onSite)}`);
      if (times.arrive) parts.push(`due ${input.ownClock(times.arrive)}`);
      for (const k of ['setup_done', 'ready', 'packed_up'] as const) {
        const at = later.get(k);
        if (!at) continue;
        const label = presetByKey(k)?.label ?? k;
        // "Packed up" is checked against when they said they are done.
        if (k === 'packed_up' && doneMs != null && Date.parse(at) > doneMs) {
          parts.push(`${label} ${input.clockOf(at)} · ${minutesWords(Date.parse(at) - doneMs)} past done`);
        } else {
          parts.push(`${label} ${input.clockOf(at)}`);
        }
      }
    } else if (dueMs != null && times.arrive) {
      const over = input.nowMs - dueMs;
      verdict = over > 0 ? 'late' : 'not_yet';
      parts.push(`Due ${input.ownClock(times.arrive)}`);
      if (over > 0) parts.push(`${minutesWords(over)} ago`);
    } else {
      verdict = 'not_yet';
      parts.push(times.arrive ? `Due ${input.ownClock(times.arrive)}` : 'No times yet');
    }
    return {
      vendorProfileId: s.vendorProfileId,
      name: s.name,
      initials: initialsOf(s.name),
      line: parts.join(' · '),
      verdict,
      here: Boolean(onSite),
      noTimes: !times.arrive,
    };
  });
  return { lines, here };
}

/* ── Team: who is on the desk now ──────────────────────────────────────────────────────────────────────────────── */

/** Somebody who worked the desk within this many minutes is still on it. */
export const ON_DESK_WINDOW_MIN = 5;

export type DeskActivity = { userId: string | null; at: string; kind: 'scan' | 'souvenir' };
export type TeamPerson = { name: string | null; role: DeskRole | null };

export type TeamLine = {
  userId: string;
  name: string;
  initials: string;
  /** "Host · this phone", "Coordinator · 41 scans", "Helper · Souvenir table". */
  line: string;
  /** "Scanning" (or "Souvenirs") while active, "Away 5m" after, "On the desk" for this phone before its first scan. */
  status: string;
  active: boolean;
};

/**
 * The Team part. This phone's person is always first; then everybody who scanned a guest or handed a souvenir, most
 * recent first. Their status is their LAST action: within {@link ON_DESK_WINDOW_MIN} minutes they are on the desk.
 */
export function teamOnDesk(input: {
  viewerId: string;
  viewerRole: DeskRole | null;
  activity: readonly DeskActivity[];
  people: ReadonlyMap<string, TeamPerson>;
  nowMs: number;
}): TeamLine[] {
  type Agg = { scans: number; souvenirs: number; lastMs: number; lastKind: 'scan' | 'souvenir' };
  const by = new Map<string, Agg>();
  for (const a of input.activity) {
    if (!a.userId) continue;
    const t = Date.parse(a.at);
    if (!Number.isFinite(t)) continue;
    const g = by.get(a.userId) ?? { scans: 0, souvenirs: 0, lastMs: -Infinity, lastKind: a.kind };
    if (a.kind === 'scan') g.scans += 1;
    else g.souvenirs += 1;
    if (t > g.lastMs) {
      g.lastMs = t;
      g.lastKind = a.kind;
    }
    by.set(a.userId, g);
  }
  const ids = [...by.keys()].filter((id) => id !== input.viewerId).sort((a, b) => by.get(b)!.lastMs - by.get(a)!.lastMs);
  const windowMs = ON_DESK_WINDOW_MIN * 60_000;
  const lineFor = (userId: string, isMe: boolean): TeamLine => {
    const person = input.people.get(userId) ?? { name: null, role: null };
    const role = isMe ? input.viewerRole ?? person.role : person.role;
    const roleWord = role ? DESK_ROLE_WORD[role] : 'On the team';
    const name = person.name?.trim() || (isMe ? 'You' : roleWord === 'On the team' ? 'Somebody on the team' : `A ${roleWord.toLowerCase()}`);
    const g = by.get(userId);
    const active = g ? input.nowMs - g.lastMs <= windowMs : false;
    const tail = isMe
      ? 'this phone'
      : g && g.lastKind === 'souvenir'
        ? 'Souvenir table'
        : `${g?.scans ?? 0} ${g?.scans === 1 ? 'scan' : 'scans'}`;
    const status = !g
      ? 'On the desk'
      : active
        ? g.lastKind === 'souvenir'
          ? 'Souvenirs'
          : 'Scanning'
        : `Away ${minutesWords(input.nowMs - g.lastMs)}`;
    return { userId, name, initials: initialsOf(name), line: `${roleWord} · ${tail}`, status, active: !g ? isMe : active };
  };
  return [lineFor(input.viewerId, true), ...ids.map((id) => lineFor(id, false))];
}
