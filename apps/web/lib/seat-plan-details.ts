/**
 * lib/seat-plan-details.ts — DETAILS › YOUR EVENT › SEAT PLAN, the parts that
 * are RULES (pure: no React, no I/O, so they are held as functions).
 *
 * Owner 2026-09-28, DECISION_LOG "THE SEAT PLAN MOVES INTO DETAILS AND WEARS
 * THE THREE COLUMNS: THE PLACE LEFT · THE PLAN MIDDLE · THE GUESTS RIGHT":
 * *"navigator lists all the elements of the place. and the toolbar lists who
 * are the guests?"* — and 2026-09-29 "THE SEAT PLAN IS LIVE BEHIND ONE DOOR":
 * faster seating — "Seat at… ▾" per unseated guest, tap an empty seat, "+ Seat
 * next unseated".
 *
 * The seating editor (`seating-editor.tsx`) keeps every piece of state and
 * every save; these functions only decide WHAT the three columns list:
 *
 *   · LEFT  — `seatPlanPlaceRows`: every table (with its seats and shape), then
 *             the place's elements that exist (stage, dance floor, entrance,
 *             service door, cocktail area, each booth, each sign). A row's key
 *             is its piece (`seatPlanPieceKey`), so a tap on the plan picks the
 *             row and a tap on the row selects the object on the plan.
 *   · RIGHT — `seatPlanGuestSections`: the guests, UNSEATED FIRST, then the
 *             seated by side (where the event has two named people — the words
 *             are the event type's own, handed in) or by group.
 *
 * 🎂 Nothing here names a wedding: the side words arrive from the event type
 * (`peopleLabels`), and an event without two named people is listed by group.
 */

import { formatCount } from './format-number';

/** A marker the plan draws once (a singleton), as the editor names it. */
export type SeatPlanMarker = 'stage' | 'entrance' | 'service' | 'dance' | 'cocktail';

/** What is selected on the plan — the editor's own two selections. */
export type SeatPlanSelection = {
  /** `highlightId` — the selected table. */
  table: string | null;
  /** `selMarker` — a marker, booth or sign (singletons carry id null). */
  marker: { kind: SeatPlanMarker | 'booth' | 'sign'; id: string | null } | null;
};

/**
 * The piece key of a selection — the navigator's row key. A table wins (the
 * editor keeps the two mutually exclusive anyway); nothing selected is null.
 */
export function seatPlanPieceKey(sel: SeatPlanSelection): string | null {
  if (sel.table) return `table:${sel.table}`;
  const m = sel.marker;
  if (!m) return null;
  if (m.kind === 'booth' || m.kind === 'sign') return m.id ? `${m.kind}:${m.id}` : null;
  return `place:${m.kind}`;
}

/** A piece key back to the selection it names; anything unknown selects nothing. */
export function parseSeatPlanPiece(key: string | null | undefined): SeatPlanSelection {
  const none: SeatPlanSelection = { table: null, marker: null };
  if (!key) return none;
  const i = key.indexOf(':');
  if (i < 0) return none;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  if (!id) return none;
  if (kind === 'table') return { table: id, marker: null };
  if (kind === 'booth' || kind === 'sign') return { table: null, marker: { kind, id } };
  if (kind === 'place' && (MARKERS as readonly string[]).includes(id)) {
    return { table: null, marker: { kind: id as SeatPlanMarker, id: null } };
  }
  return none;
}

const MARKERS: readonly SeatPlanMarker[] = ['stage', 'entrance', 'service', 'dance', 'cocktail'];

/** One row of the LEFT column. */
export type SeatPlanPlaceRow = {
  key: string;
  group: 'tables' | 'place';
  label: string;
  sub?: string;
};

export type SeatPlanPlaceInput = {
  /** Every table, in the plan's order, with what is already computed for it. */
  tables: ReadonlyArray<{ id: string; label: string; shape: string; seated: number; seats: number }>;
  dance: boolean;
  entrance: { enabled: boolean; walkThrough: boolean };
  service: boolean;
  cocktail: { enabled: boolean; label: string };
  booths: ReadonlyArray<{ id: string; label: string }>;
  signs: ReadonlyArray<{ id: string; label: string }>;
};

/**
 * THE PLACE, AS THE NAVIGATOR LISTS IT: the tables first (each "4/8 seats ·
 * Round"), then the elements that are ON the plan. The stage is always there
 * (the editor never removes it); every other element only once it is added —
 * a row for something that is not on the floor would select nothing.
 */
export function seatPlanPlaceRows(input: SeatPlanPlaceInput): SeatPlanPlaceRow[] {
  const rows: SeatPlanPlaceRow[] = input.tables.map((t) => ({
    key: seatPlanPieceKey({ table: t.id, marker: null })!,
    group: 'tables',
    label: t.label,
    sub: `${t.seated}/${t.seats} ${t.seats === 1 ? 'seat' : 'seats'} · ${t.shape}`,
  }));
  const place = (marker: SeatPlanMarker, label: string, sub?: string) =>
    rows.push({ key: `place:${marker}`, group: 'place', label, ...(sub ? { sub } : {}) });
  place('stage', 'Stage');
  if (input.dance) place('dance', 'Dance floor');
  if (input.entrance.enabled) place('entrance', input.entrance.walkThrough ? 'Walk-through' : 'Entrance');
  if (input.service) place('service', 'Service door');
  if (input.cocktail.enabled) place('cocktail', input.cocktail.label.trim() || 'Cocktail area', 'A second room');
  for (const b of input.booths) rows.push({ key: `booth:${b.id}`, group: 'place', label: b.label.trim() || 'Booth', sub: 'Booth' });
  for (const s of input.signs) rows.push({ key: `sign:${s.id}`, group: 'place', label: s.label.trim() || 'Sign', sub: 'Sign' });
  return rows;
}

/** The fields of a guest these rules read — `SeatingGuest` satisfies it. */
export type SeatPlanGuest = {
  guest_id: string;
  name: string;
  side: 'bride' | 'groom' | 'both';
  group_id: string | null;
  rsvp_status: string;
  seated_table_id: string | null;
};

export type SeatPlanGuestSection = {
  key: string;
  label: string;
  /** Only the Unseated section is warm — it is the work left. */
  unseated?: true;
  guestIds: string[];
};

export type SeatPlanGuestOptions = {
  query: string;
  onlyUnseated: boolean;
  /**
   * The sides in the event's own order and words ("Groom's side", …) — only
   * where the event type has two named people. Null → the seated are listed by
   * group instead.
   */
  sides: ReadonlyArray<{ side: SeatPlanGuest['side']; label: string }> | null;
  groups: ReadonlyArray<{ group_id: string; label: string }>;
};

/** A guest who has said they are not coming is never "left to seat". */
export function isDeclined(g: Pick<SeatPlanGuest, 'rsvp_status'>): boolean {
  return g.rsvp_status === 'declined';
}

/**
 * THE GUESTS COLUMN: "Unseated · N" FIRST (the work left), then everyone
 * seated, by side or by group. A guest who declined and has no seat is not
 * work — they are counted (`notComing`), never listed as unseated. The search
 * filters every section; "Only unseated" drops the seated sections.
 */
export function seatPlanGuestSections(
  guests: readonly SeatPlanGuest[],
  opts: SeatPlanGuestOptions,
): { sections: SeatPlanGuestSection[]; notComing: number } {
  const q = opts.query.trim().toLowerCase();
  const matches = (g: SeatPlanGuest) => !q || g.name.toLowerCase().includes(q);
  const unseated = guests.filter((g) => !g.seated_table_id && !isDeclined(g));
  const notComing = guests.filter((g) => !g.seated_table_id && isDeclined(g)).length;
  const sections: SeatPlanGuestSection[] = [
    { key: 'unseated', label: 'Unseated', unseated: true, guestIds: unseated.filter(matches).map((g) => g.guest_id) },
  ];
  if (opts.onlyUnseated) return { sections, notComing };
  const seated = guests.filter((g) => g.seated_table_id && matches(g));
  if (opts.sides) {
    for (const s of opts.sides) {
      const ids = seated.filter((g) => g.side === s.side).map((g) => g.guest_id);
      if (ids.length) sections.push({ key: `side:${s.side}`, label: s.label, guestIds: ids });
    }
  } else {
    const known = new Set(opts.groups.map((g) => g.group_id));
    for (const grp of opts.groups) {
      const ids = seated.filter((g) => g.group_id === grp.group_id).map((g) => g.guest_id);
      if (ids.length) sections.push({ key: `group:${grp.group_id}`, label: grp.label, guestIds: ids });
    }
    const loose = seated.filter((g) => !g.group_id || !known.has(g.group_id)).map((g) => g.guest_id);
    if (loose.length) sections.push({ key: 'group:none', label: 'No group', guestIds: loose });
  }
  return { sections, notComing };
}

/**
 * "+ Seat next unseated": the first guest of the Unseated section (the same
 * order the column shows, so the button seats the name at the top of it).
 * Null when everyone who is coming has a seat.
 */
export function nextUnseatedGuest<G extends SeatPlanGuest>(guests: readonly G[], skip?: string | null): G | null {
  return guests.find((g) => !g.seated_table_id && !isDeclined(g) && g.guest_id !== skip) ?? null;
}

/**
 * "Seat at… ▾" — the tables that still have a free chair, each with how many,
 * in the plan's order. A full table is not offered (it would seat nobody).
 */
export function seatAtChoices(
  tables: ReadonlyArray<{ id: string; label: string; free: number }>,
): Array<{ id: string; label: string }> {
  return tables
    .filter((t) => t.free > 0)
    .map((t) => ({ id: t.id, label: `${t.label} · ${t.free} free` }));
}

/**
 * 🗺 THE GUESTS' MAP — the Indoor Blueprint's home (owner-approved 2026-09-29,
 * via the controller: *"it's the same room"*). A piece of the Seat plan: picked,
 * the right part shows the shipped Indoor Blueprint studio (`BlueprintStudio`
 * — the entrance handle and each seated guest's "find your table" map), drawn
 * from this plan's own tables. Not an object on the plan, so it has its own key.
 */
export const SEAT_PLAN_MAP_PIECE = 'guests-map';

/* ══════════════ 📱 THE SEAT PLAN ON A PHONE (owner 2026-10-01) ══════════════
 * DECISION_LOG "SEAT PLAN + WALKING ORDER DESIGN — APPROVED" (frames 1–4 of
 * prototypes/seat_plan_and_walking_order_2026-10-01_fable.html): the whole
 * plan on one screen, "Seat plan · N tables", one status line, the Unseated
 * chip, Auto arrange + Rules ▾, 2D ▾; tap a table → its dock and guests; tap a
 * guest → "Move … to…" with ONE Table ▾; NO drag on a phone. The words below
 * are built from data only — a count is always counted, never typed. */

/**
 * The room-size presets (moved here from the editor so the phone's status line
 * and the A3 print name the room the same way). "Standard 20×30" is the
 * historical default board.
 */
export const ROOM_PRESETS: ReadonlyArray<{ label: string; width: number; length: number }> = [
  { label: 'Intimate', width: 14, length: 10 },
  { label: 'Standard', width: 20, length: 30 },
  { label: 'Grand', width: 30, length: 20 },
  { label: 'Garden', width: 60, length: 40 },
  { label: 'Estate', width: 120, length: 90 },
  { label: 'Field', width: 200, length: 200 },
];

/**
 * What the room is called on the phone and on paper: a preset's name ("Standard
 * room"), else its size ("24 × 18 m room"), else — no size set — "Room size not
 * set" (never a made-up size).
 */
export function seatPlanRoomName(room: { width: number | null; length: number | null } | null): string {
  const w = room?.width ?? null;
  const l = room?.length ?? null;
  if (!w || !l || w <= 0 || l <= 0) return 'Room size not set';
  const preset = ROOM_PRESETS.find((p) => p.width === w && p.length === l);
  return preset ? `${preset.label} room` : `${w} × ${l} m room`;
}

/**
 * The phone's head: "N tables" counts UNITS — linked tables once (owner
 * 2026-10-01 "LINKED TABLES ARE ONE TABLE … one count") — and leaves the
 * couple's sweetheart out (it is not a guest table; the approved frame counts
 * ten guest tables beside "A & B"). The status line says the room, how many sit,
 * and when guests see it — from the seat rule's own two facts.
 */
export function seatPlanHeadline(input: {
  units: ReadonlyArray<{ sweetheart: boolean }>;
  seated: number;
  roomName: string;
  /** `seatDayHasCome` — the event's day has come. */
  dayHasCome: boolean;
  /** The "Show guests their seats early" switch. */
  showingEarly: boolean;
}): { count: string; status: string } {
  const n = input.units.filter((u) => !u.sweetheart).length;
  const when = input.dayHasCome ? 'guests see it today' : input.showingEarly ? 'guests see it now' : 'guests see it on the day';
  return {
    count: `${formatCount(n)} ${n === 1 ? 'table' : 'tables'}`,
    status: `${input.roomName} · ${formatCount(input.seated)} seated · ${when}.`,
  };
}

/**
 * NO DRAG ON A PHONE (owner 2026-10-01: "tap → one dropdown → done; drag stays
 * on desktop"). Below 768 px a press on a table, an element, a booth or a sign
 * is a TAP — it selects (or seats the picked guest) — and never moves anything;
 * the canvas still pans and pinch-zooms. The editor asks this once.
 */
export function planPress(isPhone: boolean): 'tap' | 'drag' {
  return isPhone ? 'tap' : 'drag';
}

export type MoveTarget = { id: string; label: string; free: number; current: boolean };

/**
 * "Move Ana to…" — ONE Table ▾. Only units with room for the guest AND the +1s
 * who move with them are listed (owner: "Only tables with room are listed"),
 * plus the table they sit at now (so the list says where they are). Linked
 * tables are one row (their combined name and summed free chairs).
 */
export function moveTargets(
  units: ReadonlyArray<{ id: string; label: string; free: number; tableIds: readonly string[] }>,
  opts: { currentTableId: string | null; party: number },
): MoveTarget[] {
  return units
    .map((u) => ({
      id: u.id,
      label: u.label,
      free: u.free,
      current: opts.currentTableId !== null && u.tableIds.includes(opts.currentTableId),
    }))
    .filter((u) => u.current || u.free >= Math.max(1, opts.party));
}
