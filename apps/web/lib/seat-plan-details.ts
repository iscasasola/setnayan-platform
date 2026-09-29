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
