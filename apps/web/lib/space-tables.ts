/**
 * 🪑 THE TABLES AND DOORS IN A HALL OR ROOM — what #7968 (Rooms & seating, 18 Nov) keeps once it is reworked into Spaces
 * (owner 19 Nov, DECISION_LOG "SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS & SEATING": "#7968 keeps only tables,
 * table types, doors and the shared plan core, hung on a space"). Storage: `vendor_units` / `vendor_unit_doors`, each
 * row on a hall or room (`pool_id`, migration 20271356372536).
 *
 *   · Tables: Round · Long (with a "chairs at the ends" switch) · Half-moon booth, ONE chair count each.
 *   · Doors: Main or Service · which wall · where along it. Size + doors only, never wiring.
 *
 * A "group" here IS a space (a hall or room): its id is the pool id, its size the space's Floor size.
 *
 * 🔒 Supplier-only. Couples never see which table (owner 18 Nov). Nothing here is read by a couple surface.
 *
 * Pure: no React, no database. 🔒 lib/space-tables.test.ts
 */

import { PLAN_MAX_CHAIRS, PLAN_MAX_SIDE_M, parsePlanSide, planDrawnShape, planTableWords, type PlanTable } from '@/lib/seat-plan-engine';

export type UnitKind = 'table';
/** The spaces that hold tables. */
export type GroupKind = 'hall' | 'room';
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
  /** Floor plan place — the SAME sense as `event_tables.x_pos / y_pos / rotation_deg` (lib/seating.ts). Null = never placed. */
  x?: number | null;
  y?: number | null;
  rotationDeg?: number;
};
export type Door = { id: string; groupId: string; kind: DoorKind; wall: Wall; along: Along };
/** A shop's halls and rooms (as groups) with the tables and doors in them. */
export type SpaceTables = { groups: UnitGroup[]; units: Unit[]; doors: Door[] };

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

/** Limits, matched to the database CHECKs (migrations 20271350389612 + 20271356372536). */
export const MAX_CHAIRS = PLAN_MAX_CHAIRS;
export const MAX_UNIT_NAME = 30;
/** One "Add" may make at most this many tables (a typo like "1-10000" is refused, never half-made). */
export const MAX_ADD = 200;
/** Metres — the ceiling `vendor_profiles_venue_dimensions_check` uses. */
export const MAX_SIDE_M = PLAN_MAX_SIDE_M;

/** "Round · 8 chairs", "Long · 10 chairs · 2 at the ends", "Half-moon booth · seats 4". */
export function tableWords(shape: TableShape, chairs: number, atEnds: boolean): string {
  // The engine's words — the tile and the floor plan never disagree (ADAPTER.md §4).
  return planTableWords({ id: '', label: '', kind: shape, chairs, chairsAtEnds: atEnds, x: null, y: null } satisfies PlanTable);
}

/** The drawing's rule: a Long table with 4 chairs or fewer and no end chairs draws as a square. */
export function shapeDrawn(shape: TableShape, chairs: number, atEnds: boolean): TableShape | 'square' {
  return planDrawnShape({ kind: shape, chairs, chairsAtEnds: atEnds }) as TableShape | 'square';
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
 * Names typed into "Table names or numbers": commas or new lines between them, and a range makes a run —
 * "T1-T8" · "VIP, T9-T12". A refused entry says why; nothing is half-made.
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
  return parsePlanSide(raw);
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

/**
 * 🔌 ONE HALL OR ROOM AS THE SHARED SEAT-PLAN CORE DRAWS IT (`planFromShopPlan`, lib/seat-plan-engine): its Floor size,
 * its tables with their type and one chair count, and its doors. No guest is ever on it. Writes come back through
 * `placeTable` (x · y · rotation) in `app/vendor-dashboard/spaces/actions.ts`.
 */
export type ShopPlan = {
  areaId: string;
  name: string;
  room: { widthM: number; lengthM: number } | null;
  tables: Array<{ id: string; label: string; shape: TableShape; chairs: number; chairsAtEnds: boolean; x: number | null; y: number | null; rotationDeg: number }>;
  doors: Array<{ id: string; kind: DoorKind; wall: Wall; along: Along }>;
};

export function shopPlanOf(data: SpaceTables, spaceId: string): ShopPlan | null {
  const g = data.groups.find((x) => x.id === spaceId);
  if (!g) return null;
  return {
    areaId: spaceId,
    name: g.name,
    room: g.widthM != null && g.lengthM != null ? { widthM: g.widthM, lengthM: g.lengthM } : null,
    tables: unitsOf(data.units, g.id)
      .filter((u) => u.shape && u.chairs)
      .map((u) => ({ id: u.id, label: u.name, shape: u.shape!, chairs: u.chairs!, chairsAtEnds: u.chairsAtEnds, x: u.x ?? null, y: u.y ?? null, rotationDeg: u.rotationDeg ?? 0 })),
    doors: data.doors.filter((d) => d.groupId === spaceId).map((d) => ({ id: d.id, kind: d.kind, wall: d.wall, along: d.along })),
  };
}
