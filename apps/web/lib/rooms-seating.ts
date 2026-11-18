/**
 * 🛏 ROOMS & SEATING — the shop's places, made once (piece A of the units map, owner 2026-11-18;
 * specs `prototypes/units_rooms_seating_2026-11-18/MAP.md`; storage: migration 20271350389612).
 *
 *   · Hotel rooms — floors, each with its rooms.
 *   · Halls — the shop's ONE room size (the shipped `vendor_profiles.venue_width_m` / `venue_length_m`) and its doors.
 *     Size + doors only, never wiring.
 *   · Dining tables — areas (optional room size + doors), each with its tables: Round · Long (with a "chairs at the
 *     ends" switch) · Half-moon booth, ONE chair count each.
 *
 * Grid only. Move = shift a tile within its floor or area; Line up = every group back in name order. The Floor plan view
 * (Pro · Max · Ultra, ruling 35) waits on the owner's one-line confirm (MAP.md conflict 1) and is NOT drawn.
 *
 * 🔒 Supplier-only. Couples never see which room or table (owner 18 Nov). Nothing here is read by a couple surface.
 *
 * Pure: no React, no database. 🔒 lib/rooms-seating.test.ts
 */

export type UnitKind = 'room' | 'table';
export type GroupKind = 'floor' | 'dining_area';
export type TableShape = 'round' | 'long' | 'half_moon';
export type DoorKind = 'main' | 'service';
export type Wall = 'front' | 'back' | 'left' | 'right';
export type Along = 'left' | 'middle' | 'right';

export type UnitGroup = {
  id: string;
  kind: GroupKind;
  name: string;
  widthM: number | null;
  lengthM: number | null;
  sortOrder: number;
};
export type Unit = {
  id: string;
  groupId: string;
  kind: UnitKind;
  name: string;
  shape: TableShape | null;
  chairs: number | null;
  chairsAtEnds: boolean;
  sortOrder: number;
};
export type Door = { id: string; groupId: string | null; kind: DoorKind; wall: Wall; along: Along };
export type RoomsSeating = { groups: UnitGroup[]; units: Unit[]; doors: Door[] };

/** The page's three sections — one dropdown ("Show"), the drawing's order. */
export const SECTIONS = [
  { key: 'rooms', label: 'Hotel rooms', line: 'Floors and rooms you rent by the night' },
  { key: 'halls', label: 'Halls', line: 'Your hall’s size and doors' },
  { key: 'tables', label: 'Dining tables', line: 'Areas, tables and chairs' },
] as const;
export type Section = (typeof SECTIONS)[number]['key'];
export function isSection(v: unknown): v is Section {
  return typeof v === 'string' && SECTIONS.some((s) => s.key === v);
}

export const TABLE_SHAPES: ReadonlyArray<{ key: TableShape; label: string; hint: string }> = [
  { key: 'round', label: 'Round', hint: 'Chairs all around' },
  { key: 'long', label: 'Long', hint: 'Square when 4 chairs or fewer' },
  { key: 'half_moon', label: 'Half-moon booth', hint: 'A curved cushion, seats along it' },
];
export function isTableShape(v: unknown): v is TableShape {
  return typeof v === 'string' && TABLE_SHAPES.some((s) => s.key === v);
}

export const DOOR_KINDS: ReadonlyArray<{ key: DoorKind; label: string }> = [
  { key: 'main', label: 'Main door' },
  { key: 'service', label: 'Service door' },
];
export const WALLS: ReadonlyArray<{ key: Wall; label: string }> = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
];
export const ALONGS: ReadonlyArray<{ key: Along; label: string }> = [
  { key: 'left', label: 'Left' },
  { key: 'middle', label: 'Middle' },
  { key: 'right', label: 'Right' },
];
export const isDoorKind = (v: unknown): v is DoorKind => DOOR_KINDS.some((d) => d.key === v);
export const isWall = (v: unknown): v is Wall => WALLS.some((d) => d.key === v);
export const isAlong = (v: unknown): v is Along => ALONGS.some((d) => d.key === v);

/** Limits, matched to the database CHECKs (migration 20271350389612). */
export const MAX_CHAIRS = 60;
export const MAX_UNIT_NAME = 30;
export const MAX_GROUP_NAME = 60;
/** One "Add" may make at most this many rooms or tables (a typo like "1-10000" is refused, never half-made). */
export const MAX_ADD = 200;
/** Metres — the ceiling `vendor_profiles_venue_dimensions_check` uses. */
export const MAX_SIDE_M = 500;

/** "Round · 8 chairs", "Long · 10 chairs · at the ends", "Half-moon booth · seats 4". */
export function tableWords(shape: TableShape, chairs: number, atEnds: boolean): string {
  if (shape === 'half_moon') return `Half-moon booth · seats ${chairs}`;
  const look = shapeDrawn(shape, chairs, atEnds) === 'square' ? 'Square' : shape === 'long' ? 'Long' : 'Round';
  return `${look} · ${chairs} ${chairs === 1 ? 'chair' : 'chairs'}${shape === 'long' && atEnds ? ' · at the ends' : ''}`;
}

/** The drawing's rule: a Long table with 4 chairs or fewer and no end chairs draws as a square. */
export function shapeDrawn(shape: TableShape, chairs: number, atEnds: boolean): TableShape | 'square' {
  return shape === 'long' && chairs <= 4 && !atEnds ? 'square' : shape;
}

/** Where each chair sits around a table, in a 100 × 100 box (the tile's little picture). */
export function chairPoints(shape: TableShape, chairs: number, atEnds: boolean): Array<{ x: number; y: number }> {
  const n = Math.max(0, Math.min(MAX_CHAIRS, Math.floor(chairs)));
  const drawn = shapeDrawn(shape, n, atEnds);
  if (drawn === 'round') {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
    });
  }
  if (drawn === 'half_moon') {
    return Array.from({ length: n }, (_, i) => {
      const a = Math.PI + ((i + 0.5) / Math.max(1, n)) * Math.PI;
      return { x: 50 + 40 * Math.cos(a), y: 62 + 40 * Math.sin(a) };
    });
  }
  if (drawn === 'square') {
    const sides = [
      { x: 50, y: 14 },
      { x: 86, y: 50 },
      { x: 50, y: 86 },
      { x: 14, y: 50 },
    ];
    return sides.slice(0, n);
  }
  // Long: one at each end when switched on (counted in the one number); the rest along the two sides.
  const ends = atEnds ? Math.min(2, n) : 0;
  const side = n - ends;
  const top = Math.ceil(side / 2);
  const bottom = side - top;
  const row = (count: number, y: number) =>
    Array.from({ length: count }, (_, i) => ({ x: 22 + ((i + 0.5) / Math.max(1, count)) * 56, y }));
  const out = [...row(top, 28), ...row(bottom, 72)];
  if (ends >= 1) out.push({ x: 8, y: 50 });
  if (ends >= 2) out.push({ x: 92, y: 50 });
  return out;
}

/**
 * Names typed into "Room names or numbers" / "Table names or numbers": commas or new lines between them, and a range
 * makes a run — "301-310" · "T1-T8" · "Penthouse, 401-403". A refused entry says why; nothing is half-made.
 */
export function parseUnitNames(input: string): { ok: true; names: string[] } | { ok: false; error: string } {
  const parts = String(input ?? '')
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'Type at least one name or number.' };
  const names: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(\D*?)(\d+)\s*[-–]\s*(?:\1)?\s*(\d+)$/);
    if (m) {
      const prefix = m[1]!;
      const from = Number(m[2]);
      const to = Number(m[3]);
      if (to < from) return { ok: false, error: `“${p}” counts down. Write the smaller number first.` };
      if (to - from + 1 > MAX_ADD) return { ok: false, error: `“${p}” is more than ${MAX_ADD} at once.` };
      const width = m[2]!.length > 1 && m[2]!.startsWith('0') ? m[2]!.length : 0;
      for (let k = from; k <= to; k++) names.push(`${prefix}${width ? String(k).padStart(width, '0') : k}`);
    } else {
      names.push(p);
    }
    if (names.length > MAX_ADD) return { ok: false, error: `That is more than ${MAX_ADD} at once.` };
  }
  for (const n of names) {
    if (n.length > MAX_UNIT_NAME) return { ok: false, error: `“${n.slice(0, 12)}…” is longer than ${MAX_UNIT_NAME} letters.` };
  }
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) return { ok: false, error: `“${n}” is typed twice.` };
    seen.add(k);
  }
  return { ok: true, names };
}

/** Name order a person expects: 2 before 10, "T9" before "T10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Line up: each group's units back in name order. Returns the ids in their new order, per group. */
export function lineUp(units: readonly Unit[]): Map<string, string[]> {
  const by = new Map<string, Unit[]>();
  for (const u of units) by.set(u.groupId, [...(by.get(u.groupId) ?? []), u]);
  const out = new Map<string, string[]>();
  for (const [g, list] of by) out.set(g, [...list].sort((x, y) => naturalCompare(x.name, y.name)).map((u) => u.id));
  return out;
}

/** Move one tile a step earlier (-1) or later (+1) inside its own list. Unchanged at an edge. */
export function moveStep(ids: readonly string[], id: string, step: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** A group's units in their saved order (ties broken by name, so two equal sort numbers never shuffle). */
export function unitsOf(units: readonly Unit[], groupId: string): Unit[] {
  return units
    .filter((u) => u.groupId === groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder || naturalCompare(a.name, b.name));
}

/** A room size in metres from a typed field: blank = none; else a number above 0 and up to 500. */
export function parseSide(raw: unknown): number | null | 'bad' {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SIDE_M) return 'bad';
  return Math.round(n * 10) / 10;
}

/** Both sides or neither — the database's pairwise CHECK, said in words first. */
export function parseRoomSize(w: unknown, l: unknown): { ok: true; widthM: number | null; lengthM: number | null } | { ok: false; error: string } {
  const a = parseSide(w);
  const b = parseSide(l);
  if (a === 'bad' || b === 'bad') return { ok: false, error: `Enter a size in metres, up to ${MAX_SIDE_M}.` };
  if ((a === null) !== (b === null)) return { ok: false, error: 'Enter both the width and the depth, or leave both blank.' };
  return { ok: true, widthM: a, lengthM: b };
}

/** "Main door · Front, middle". */
export function doorWords(d: Pick<Door, 'kind' | 'wall' | 'along'>): string {
  const k = DOOR_KINDS.find((x) => x.key === d.kind)?.label ?? 'Door';
  const w = WALLS.find((x) => x.key === d.wall)?.label ?? '';
  return `${k} · ${w}, ${d.along}`;
}

/** The count line under the page title: "12 rooms · 1 hall · 18 tables". */
export function countsLine(data: RoomsSeating, hasHallSize: boolean): string {
  const rooms = data.units.filter((u) => u.kind === 'room').length;
  const tables = data.units.filter((u) => u.kind === 'table').length;
  const seats = data.units.reduce((s, u) => s + (u.kind === 'table' ? u.chairs ?? 0 : 0), 0);
  const parts = [`${rooms} ${rooms === 1 ? 'room' : 'rooms'}`];
  if (hasHallSize) parts.push('1 hall');
  parts.push(`${tables} ${tables === 1 ? 'table' : 'tables'}${tables ? ` · ${seats} ${seats === 1 ? 'seat' : 'seats'}` : ''}`);
  return parts.join(' · ');
}
