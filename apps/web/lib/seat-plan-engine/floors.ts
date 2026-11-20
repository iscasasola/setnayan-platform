/**
 * lib/seat-plan-engine/floors.ts — 🏨 FLOORS: ONE FLOOR PLAN USED ON MANY FLOORS, EACH NUMBERING ITS OWN ROOMS.
 *
 * Owner rulings, 19 Nov 2026 (DECISION_LOG, "Naming + shared floors APPROVED", owner: "we are good"):
 *   · one floor plan used on many floors — edit once, every linked floor changes;
 *   · each floor numbers its own rooms (2F: 201–212, 3F: 301–312);
 *   · "Make this floor different" unlinks ONE floor; the others stay linked;
 *   · a booked room is never removed — "A booked room is never moved. That change waits." (the drawing's words);
 *   · generic labels by kind on Verified and Plus: Hall001 · Room001 · Cart001 · Clothing001 · Object001 ·
 *     Vehicle001 · Item001 (Others); renaming at Pro and up;
 *   · no duplicate names per branch; renaming never breaks a booking (a booking holds the room's id, not its name).
 * Drawing: specs `prototypes/spaces_final_screens_2026-11-19.html` §7 ("Pro · one plan, many floors").
 *
 * Who decides the tier is the PAGE (it reads the shop's plan and the paywall switch): this file only says which tier
 * opens what (`SUPPLIER_FLOOR_PLAN_MIN_TIER`). A couple's event has one floor and never reaches this file's naming.
 *
 * Pure. 🔒 lib/seat-plan-engine/engine.test.ts
 */

// ── Who gets what (the page applies it) ──────────────────────────────────────

/** "Floor plan is Pro and up" (DECISION_LOG 2026-11-19, CORRECTION). The Grid is every shop's. Renaming is Pro too. */
export const SUPPLIER_FLOOR_PLAN_MIN_TIER = 'pro' as const;

/** The views a plan offers. A couple always has the floor; a supplier has the Grid, and the floor when it is open. */
export function planViewsFor(side: 'event' | 'supplier', floorPlanOpen: boolean): Array<'grid' | 'floor'> {
  if (side === 'event') return ['floor', 'grid'];
  return floorPlanOpen ? ['grid', 'floor'] : ['grid'];
}

// ── Names ────────────────────────────────────────────────────────────────────

export type SpaceKind = 'hall' | 'room' | 'cart' | 'clothing' | 'object' | 'vehicle' | 'item';

const GENERIC_PREFIX: Record<SpaceKind, string> = {
  hall: 'Hall',
  room: 'Room',
  cart: 'Cart',
  clothing: 'Clothing',
  object: 'Object',
  vehicle: 'Vehicle',
  item: 'Item',
};

/** "Room001" — the generic label for the nth space of a kind (Verified and Plus). */
export function genericSpaceName(kind: SpaceKind, n: number): string {
  return `${GENERIC_PREFIX[kind]}${String(Math.max(1, Math.floor(n))).padStart(3, '0')}`;
}

/** The next `count` generic names of a kind, counting on from the highest one already used ("Counts on from your last one"). */
export function nextGenericNames(kind: SpaceKind, existing: readonly string[], count: number): string[] {
  const re = new RegExp(`^${GENERIC_PREFIX[kind]}(\\d+)$`, 'i');
  let last = 0;
  for (const name of existing) {
    const m = re.exec(name.trim());
    if (m) last = Math.max(last, Number(m[1]));
  }
  return Array.from({ length: Math.max(0, count) }, (_, i) => genericSpaceName(kind, last + 1 + i));
}

/** How rooms on a floor are named: Generic · By floor · Letters · Your own (the "Names" pick). */
export type RoomNaming = 'generic' | 'by_floor' | 'letters' | 'own';

/** A floor's short name: level 1 is the Ground floor, then 2F, 3F … */
export function floorName(level: number): string {
  return level <= 1 ? 'Ground floor' : `${level}F`;
}

/** "2F to 5F" — the "Used on" pick's words for a run of floors (one floor reads as its own name). */
export function floorRangeWords(levels: readonly number[]): string {
  const sorted = [...new Set(levels)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'No floors';
  if (sorted.length === 1) return floorName(sorted[0]!);
  const run = sorted.every((l, i) => i === 0 || l === sorted[i - 1]! + 1);
  return run ? `${floorName(sorted[0]!)} to ${floorName(sorted[sorted.length - 1]!)}` : sorted.map(floorName).join(', ');
}

/**
 * The names for `count` rooms on a floor. By floor: 201 … 212 on 2F (start at `startAt`, default level·100 + 1), and
 * the same run reads 301 … 312 on 3F. Letters: 2A, 2B … Generic and Your own are not per floor — Generic counts on
 * across the branch (`nextGenericNames`) and Your own is typed — so they return null here.
 */
export function roomNamesOnFloor(naming: RoomNaming, level: number, count: number, startAt?: number): string[] | null {
  if (naming === 'by_floor') {
    // The start is typed on ONE floor (e.g. 201); every floor keeps the same offset inside its own hundred.
    const offset = startAt === undefined ? 1 : startAt % 100;
    return Array.from({ length: count }, (_, i) => String(level * 100 + offset + i));
  }
  if (naming === 'letters') {
    return Array.from({ length: count }, (_, i) => `${level}${lettersFor(i)}`);
  }
  return null;
}

/** 0 → A … 25 → Z, 26 → AA … */
function lettersFor(i: number): string {
  let n = i;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Names used more than once in one branch (case and spaces ignored) — none is allowed. */
export function duplicateNames(names: readonly string[]): string[] {
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const raw of names) {
    const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    if (seen.has(key)) dup.add(seen.get(key)!);
    else seen.set(key, raw.trim());
  }
  return [...dup];
}

// ── Floors and the shared floor plan ─────────────────────────────────────────

export type FloorRoom = {
  id: string;
  /** Its place in the floor plan (0-based): the same slot on every linked floor is the same spot on the drawing. */
  slot: number;
  name: string;
  /** Someone is booked into it. A booked room is never removed by a plan change. */
  booked: boolean;
};

export type PlanFloor = {
  id: string;
  /** 1 = Ground floor, 2 = 2F … */
  level: number;
  /** The shared floor plan it uses; null = its own (made different). */
  layoutId: string | null;
  rooms: FloorRoom[];
};

export type FloorChange = {
  floors: PlanFloor[];
  /** Booked rooms the change would have removed — kept, and the change to them waits. */
  held: Array<{ floorId: string; room: FloorRoom }>;
};

/**
 * Edit once, every linked floor changes: the shared plan `layoutId` now has `slots` rooms. Every floor using it gets
 * exactly that many — extra rooms are removed (unless booked: held, the change waits), missing ones are added and
 * named by the floor's own numbers. A floor made different is untouched. `idFor` mints a new room's id.
 */
export function applyFloorPlan(
  floors: readonly PlanFloor[],
  layoutId: string,
  slots: number,
  naming: RoomNaming,
  idFor: (level: number, slot: number) => string,
  startAt?: number,
): FloorChange {
  const held: FloorChange['held'] = [];
  const next = floors.map((f) => {
    if (f.layoutId !== layoutId) return f;
    const names = roomNamesOnFloor(naming, f.level, slots, startAt);
    const kept: FloorRoom[] = [];
    for (const r of f.rooms) {
      if (r.slot < slots) kept.push(names ? { ...r, name: names[r.slot]! } : r);
      else if (r.booked) {
        held.push({ floorId: f.id, room: r });
        kept.push(r);
      }
    }
    const have = new Set(kept.map((r) => r.slot));
    for (let s = 0; s < slots; s++) {
      if (have.has(s)) continue;
      kept.push({ id: idFor(f.level, s), slot: s, name: names ? names[s]! : '', booked: false });
    }
    kept.sort((a, b) => a.slot - b.slot);
    return { ...f, rooms: kept };
  });
  return { floors: next, held };
}

/**
 * "Used on 2F to 5F": these levels use the shared plan. A level with no floor yet is made (its rooms come from
 * `applyFloorPlan`); an existing floor is linked to the plan. Floors not named keep what they have.
 */
export function setFloorPlanOn(
  floors: readonly PlanFloor[],
  layoutId: string,
  levels: readonly number[],
  floorIdFor: (level: number) => string,
): PlanFloor[] {
  const want = new Set(levels);
  const out = floors.map((f) => (want.has(f.level) ? { ...f, layoutId } : f));
  for (const level of [...want].sort((a, b) => a - b)) {
    if (!out.some((f) => f.level === level)) out.push({ id: floorIdFor(level), level, layoutId, rooms: [] });
  }
  return out.sort((a, b) => a.level - b.level);
}

/** Copy a floor plan to more floors — the same thing as "Used on", from one floor's point of view. */
export function copyFloor(
  floors: readonly PlanFloor[],
  fromFloorId: string,
  toLevels: readonly number[],
  floorIdFor: (level: number) => string,
): PlanFloor[] {
  const from = floors.find((f) => f.id === fromFloorId);
  if (!from || from.layoutId === null) return [...floors];
  const levels = [...new Set([...floors.filter((f) => f.layoutId === from.layoutId).map((f) => f.level), ...toLevels])];
  return setFloorPlanOn(floors, from.layoutId, levels, floorIdFor);
}

/**
 * "Make 5F different": that floor gets its own copy of the plan (`newLayoutId`) and leaves the shared one. Its rooms,
 * names and bookings stay exactly as they are; the other floors stay linked.
 */
export function makeFloorDifferent(floors: readonly PlanFloor[], floorId: string, newLayoutId: string): PlanFloor[] {
  return floors.map((f) => (f.id === floorId ? { ...f, layoutId: newLayoutId } : f));
}

/** "4 floors · 48 rooms" — what a shared plan serves. */
export function floorPlanServesWords(floors: readonly PlanFloor[], layoutId: string): string {
  const on = floors.filter((f) => f.layoutId === layoutId);
  const rooms = on.reduce((s, f) => s + f.rooms.length, 0);
  return `${on.length} ${on.length === 1 ? 'floor' : 'floors'} · ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
}
