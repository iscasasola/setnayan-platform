/**
 * seating-3d — pure helpers that map the EXISTING 2D seat-plan data
 * (percent positions, rotation, table type, seat assignments) into a 3D scene,
 * with NO three.js / React dependency. Everything here is plain math + types so
 * it can be unit-reasoned and reused by any renderer.
 *
 * Spike scope (flag `NEXT_PUBLIC_SEATING_3D`): this is a throwaway "Play / Build"
 * prototype. It READS the real plan and never writes back — drags/drops are local
 * state only. The contract it must honour is documented in the corpus as-built
 * doc `0008_Seating_AS_BUILT_2026-06-21.md` §13 (one data model, per-chair seat
 * identity, the room elements). Coordinate convention: 1 world unit = 1 metre;
 * the 2D x% maps to world X, the 2D y% (vertical on the top-down canvas) maps to
 * world Z (depth). Up is +Y.
 */

import type { MonogramConfig } from '@/lib/monogram';

export type ShapeHint = 'round' | 'long_banquet' | 'family_head' | 'sweetheart' | 'serpentine';

/**
 * The couple's CANONICAL mark for a 3D surface — their bespoke/uploaded SVG, or
 * the resolved lockup/initials config (the renderer's `monogramOverlaySvg`
 * branches lockup-vs-initials, so one config covers both). Pure data; the WebGL
 * rasterizer lives in lib/svg-monogram-texture (svgToMonogramTexture). The
 * `import type` above is erased at compile, so this lib stays runtime-dependency
 * free. */
export type MonogramTextureSource =
  | { kind: 'svg'; svg: string }
  | { kind: 'config'; monogram: MonogramConfig };

/** The seating-lab monogram prop: a source, or null → no mark rendered. */
export type Lab3DMonogram = MonogramTextureSource | null;

export type Lab3DTable = {
  id: string;
  label: string;
  type: string;
  shape: ShapeHint;
  capacity: number;
  removedSeats: number[];
  /** percent (0–100) of the 2D canvas — the canonical stored position. */
  xPct: number;
  yPct: number;
  rotationDeg: number;
  linkGroupId: string | null;
};

export type Lab3DFloor = {
  /** metres; null when the couple never set a venue size (free board). */
  venueWidthM: number | null;
  venueLengthM: number | null;
  stage: { xPct: number; yPct: number; wPct: number; hPct: number };
  entrance: { enabled: boolean; xPct: number; yPct: number };
  dance: { enabled: boolean; xPct: number; yPct: number; wPct: number; hPct: number };
  published: boolean;
};

export type RsvpStatus = 'attending' | 'pending' | 'maybe' | 'declined';

/**
 * Floor-plan fields the 3D lab does NOT edit but MUST round-trip when it saves
 * (saveFloorPlan upserts the whole row — omitting these would wipe what the 2D
 * editor set: the service door + the cocktail/waiting room).
 */
export type Lab3DFloorExtras = {
  serviceEntranceEnabled: boolean;
  serviceEntranceX: number;
  serviceEntranceY: number;
  cocktailEnabled: boolean;
  cocktailX: number;
  cocktailY: number;
  cocktailW: number;
  cocktailH: number;
  cocktailLabel: string | null;
  cocktailVendorEdit: boolean;
  cocktailLinked: boolean;
};

/** A custom guest group offered for one-tap "seat this group at a table". */
export type Lab3DGroup = {
  id: string;
  label: string;
  memberCount: number;
};

export type Lab3DGuest = {
  id: string;
  name: string;
  seatedTableId: string | null;
  seatNumber: number | null;
  tier: 1 | 2 | 3 | 4;
  /** Explicit per-guest priority override (1–4), or null to use the role tier.
   * Drives the roster priority chip + feeds the server's auto-seat ordering. */
  seatingPriority: number | null;
  /** First custom-group membership (null = ungrouped) — drives "seat this group". */
  groupId: string | null;
  rsvp: RsvpStatus;
  side: 'bride' | 'groom' | 'both';
  /** Couple allowed this guest a +1 (a held seat beside them). */
  plusOneAllowed: boolean;
  /** When this row IS someone's +1, the primary guest's id (else null). */
  plusOneOfGuestId: string | null;
  /** Resolved selfie/avatar URL (consent-gated upstream) — worn by the 3D
   * avatar's head as a camera-facing photo disc. null → coloured token. */
  photoUrl: string | null;
  /** Resolved attire for the avatar's body silhouette. */
  attire: 'gown' | 'suit' | 'neutral';
  /** Motif colour for a gown/suit body (mood-board attire palette); null for
   * neutral, which keeps the RSVP-coloured token body. */
  attireColor: string | null;
};

/** How a guest's RSVP maps to a seat's treatment. */
export type SeatStatus = 'confirmed' | 'tentative' | 'hidden';
export function seatStatusOf(rsvp: RsvpStatus): SeatStatus {
  if (rsvp === 'attending') return 'confirmed'; // solid seat
  if (rsvp === 'declined') return 'hidden'; // seat is freed
  return 'tentative'; // pending | maybe → held, but shown tentative
}

// Semantic seat colours (palette-independent so status reads clearly).
export const SIDE_COLOR: Record<'bride' | 'groom' | 'both', string> = {
  bride: '#c66b8d',
  groom: '#5b86c9',
  both: '#5aa97a',
};
export const TENTATIVE_COLOR = '#d8a53e'; // pending / maybe
export const PLUS_ONE_COLOR = '#cfd4dd'; // reserved +1 (ghost)

export type Lab3DPalette = {
  ambient: string;
  floor: string;
  table: string;
  accent: string;
  wall: string;
};

export type Vec2 = { x: number; z: number };

// Free-board default — MUST match the 2D editor's default venue (venue_width_m
// ?? 20 · venue_length_m ?? 30 in seating-editor.tsx). When they drift, the stage
// (and everything) scales differently between 2D and 3D — most visibly the stage
// depth (owner 2026-06-26 bug: "stage didn't follow the 2D size").
export const DEFAULT_ROOM = { w: 20, d: 30 } as const;

/** A rectangular zone in world metres (stage / dance floor). */
export type PlaceZone = { cx: number; cz: number; hw: number; hd: number };

/** Does an avoidance disc (x,z,r) overlap a rect zone? (closest-point test) */
function discOverlapsZone(x: number, z: number, r: number, zone: PlaceZone): boolean {
  const dx = Math.max(Math.abs(x - zone.cx) - zone.hw, 0);
  const dz = Math.max(Math.abs(z - zone.cz) - zone.hd, 0);
  return Math.hypot(dx, dz) < r;
}

/**
 * Placement rules (owner 2026-06-26): objects can't overlap each other · no
 * tables on the dance floor · only a SWEETHEART table may sit on the stage.
 * Pure — the editor calls this on drop and reverts + flags the reason if blocked.
 * Footprints are modelled as discs; the −0.1 lets edges kiss without tripping.
 */
export function checkPlacement(
  cand: { x: number; z: number; r: number; isTable: boolean; isSweetheart: boolean },
  others: { x: number; z: number; r: number }[],
  stage: PlaceZone | null,
  dance: PlaceZone | null,
): { ok: true } | { ok: false; reason: string } {
  for (const o of others) {
    if (Math.hypot(cand.x - o.x, cand.z - o.z) < cand.r + o.r - 0.1) {
      return { ok: false, reason: 'Objects can’t overlap each other.' };
    }
  }
  if (cand.isTable && dance && discOverlapsZone(cand.x, cand.z, cand.r, dance)) {
    return { ok: false, reason: 'No tables on the dance floor.' };
  }
  if (stage && discOverlapsZone(cand.x, cand.z, cand.r, stage)) {
    if (!(cand.isTable && cand.isSweetheart)) {
      return { ok: false, reason: 'Only a sweetheart table can sit on the stage.' };
    }
  }
  return { ok: true };
}

export function shapeHintFor(tableType: string): ShapeHint {
  if (tableType.startsWith('round')) return 'round';
  if (tableType.startsWith('long_banquet')) return 'long_banquet';
  if (tableType.startsWith('family_head')) return 'family_head';
  if (tableType.startsWith('sweetheart')) return 'sweetheart';
  return 'serpentine';
}

/** Effective seat count = capacity minus deleted chairs. */
export function effectiveCapacity(capacity: number, removedSeats: number[]): number {
  const removed = new Set(removedSeats.filter((i) => Number.isInteger(i) && i >= 0 && i < capacity));
  return Math.max(0, capacity - removed.size);
}

/** The room's world size in metres (venue dims when set, else the default board). */
export function roomSize(floor: Lab3DFloor): { w: number; d: number } {
  if (floor.venueWidthM && floor.venueLengthM && floor.venueWidthM > 0 && floor.venueLengthM > 0) {
    return { w: floor.venueWidthM, d: floor.venueLengthM };
  }
  return { w: DEFAULT_ROOM.w, d: DEFAULT_ROOM.d };
}

/**
 * World-space bounding box of the placed tables (+ a footprint margin), with its
 * centre and span. The "open canvas" lets tables sit far outside the default
 * room (free-board pct can exceed 0–100), so this is how the camera knows how
 * far to let you zoom out / what to frame — without a fixed venue rectangle.
 * Empty board → falls back to the room itself. Pure.
 */
export function contentBounds(
  tables: { xPct: number; yPct: number }[],
  room: { w: number; d: number },
): { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number; span: number } {
  if (tables.length === 0) {
    return {
      minX: -room.w / 2, maxX: room.w / 2, minZ: -room.d / 2, maxZ: room.d / 2,
      cx: 0, cz: 0, span: Math.max(room.w, room.d),
    };
  }
  const M = 2; // metre margin per table for its footprint + chairs
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of tables) {
    const p = pctToWorld(t.xPct, t.yPct, room);
    minX = Math.min(minX, p.x - M);
    maxX = Math.max(maxX, p.x + M);
    minZ = Math.min(minZ, p.z - M);
    maxZ = Math.max(maxZ, p.z + M);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, span: Math.max(maxX - minX, maxZ - minZ) };
}

/** percent (0–100, origin top-left) → centred world metres (origin room centre). */
export function pctToWorld(xPct: number, yPct: number, room: { w: number; d: number }): Vec2 {
  return {
    x: (xPct / 100 - 0.5) * room.w,
    z: (yPct / 100 - 0.5) * room.d,
  };
}

// ── Serpentine geometry (curved quarter-donut wedge) ───────────────────────
// The 2D catalog's serpentine is ONE 104° curved band (2026-05-09 lock) — NOT a
// rectangle and NOT a round. These helpers reproduce that band in metres so the
// 3D lab draws the real shape: chairs ride the convex OUTER arc (facing in) and
// the concave INNER arc (facing out), and the band pivots on its visual centre.
const SERP_RI = 0.95; // inner (concave) radius, m
const SERP_RO = 1.55; // outer (convex) radius, m
const SERP_SWEEP = (104 * Math.PI) / 180; // angular span (canonical)
const SERP_CHAIR_GAP = 0.5; // chair offset just beyond / inside the band edge, m

// φ = 0 points to −z (the band bulges toward −z); +φ sweeps to +x. The centre of
// curvature sits at the local origin BEFORE the band is recentred on its bbox.
function serpAt(r: number, phi: number): Vec2 {
  return { x: r * Math.sin(phi), z: -r * Math.cos(phi) };
}

export type SerpSeat = { x: number; z: number; faceY: number };

type SerpBand = { outline: Vec2[]; centre: Vec2; bboxW: number; bboxD: number };
let _serpBand: SerpBand | null = null;

/**
 * The serpentine band as a recentred outline + its curvature centre + bbox.
 * Capacity-independent (only the chairs scale), so it's computed once + cached.
 */
export function serpentineBand(): SerpBand {
  if (_serpBand) return _serpBand;
  const STEP = SERP_SWEEP / 16;
  const raw: Vec2[] = [];
  for (let phi = -SERP_SWEEP / 2; phi <= SERP_SWEEP / 2 + 1e-9; phi += STEP) raw.push(serpAt(SERP_RO, phi));
  for (let phi = SERP_SWEEP / 2; phi >= -SERP_SWEEP / 2 - 1e-9; phi -= STEP) raw.push(serpAt(SERP_RI, phi));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const ox = (minX + maxX) / 2;
  const oz = (minZ + maxZ) / 2;
  _serpBand = {
    outline: raw.map((p) => ({ x: p.x - ox, z: p.z - oz })),
    centre: { x: -ox, z: -oz }, // curvature centre, in recentred local coords
    bboxW: maxX - minX,
    bboxD: maxZ - minZ,
  };
  return _serpBand;
}

// Outer-first fill (mirrors the 2D lock): 1→1+0 · 2→2+0 · 3→2+1 · 4→3+1 · 5→3+2.
const SERP_FILL: Record<number, [number, number]> = { 1: [1, 0], 2: [2, 0], 3: [2, 1], 4: [3, 1], 5: [3, 2] };

/**
 * Serpentine chair centres (recentred, table-local) + per-chair facing. Outer
 * chairs face the curvature centre (inward onto the band); inner chairs face
 * away from it (outward onto the band). Seat order = outer L→R, then inner L→R,
 * matching the 2D seat_number map. Replaces the old round-ring approximation.
 */
export function serpentineChairs(capacity: number): SerpSeat[] {
  const cap = Math.max(1, Math.min(5, Math.round(capacity)));
  const [outerN, innerN] = SERP_FILL[cap]!;
  const { centre } = serpentineBand();
  const along = (count: number, r: number, inset: number, outward: boolean): SerpSeat[] => {
    const half = SERP_SWEEP / 2 - inset;
    const seats: SerpSeat[] = [];
    for (let i = 0; i < count; i++) {
      const phi = count === 1 ? 0 : -half + (2 * half * i) / (count - 1);
      const p = serpAt(r, phi); // relative to the curvature centre (origin)
      // Backrest points away from the band. Outer chair: away from centre = +p;
      // inner chair: toward centre = −p (so the guest faces outward onto the band).
      const faceY = outward ? Math.atan2(p.x, p.z) : Math.atan2(-p.x, -p.z);
      seats.push({ x: p.x + centre.x, z: p.z + centre.z, faceY });
    }
    return seats;
  };
  return [
    ...along(outerN, SERP_RO + SERP_CHAIR_GAP, 0.18, true),
    ...along(innerN, SERP_RI - SERP_CHAIR_GAP, 0.36, false),
  ];
}

/** Tabletop footprint (metres) per shape. Mirrors the 2D TABLE_FOOTPRINT_M shape, kept lean. */
export function tableDims(shape: ShapeHint, capacity: number): { w: number; d: number; round: boolean } {
  switch (shape) {
    case 'round':
      return { w: capacity >= 12 ? 1.7 : capacity >= 10 ? 1.5 : 1.3, d: 0, round: true };
    case 'sweetheart':
      return { w: 1.1, d: 0.6, round: false };
    case 'serpentine': {
      const b = serpentineBand();
      return { w: b.bboxW, d: b.bboxD, round: false };
    }
    case 'long_banquet':
      return { w: 0.8 + capacity * 0.22, d: 0.85, round: false };
    case 'family_head':
      return { w: 1.0 + capacity * 0.22, d: 0.95, round: false };
  }
}

/**
 * Local chair centres (metres, table-local, pre-rotation) indexed so that
 * chair[seat_number] is the seat a guest's assignment points at. This mirrors
 * the 2D fill convention closely enough for the walk-to-seat target; exact
 * parity with the 2D ring math is a documented v2 refinement.
 */
export function chairLocalPositions(shape: ShapeHint, capacity: number): Vec2[] {
  const out: Vec2[] = [];
  // Serpentine rides its own curved arcs (outer + inner), not a full ring.
  if (shape === 'serpentine') {
    return serpentineChairs(capacity).map((c) => ({ x: c.x, z: c.z }));
  }
  if (shape === 'round') {
    const r = (tableDims(shape, capacity).w || 1.3) / 2 + 0.45;
    for (let i = 0; i < capacity; i++) {
      const a = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    return out;
  }
  if (shape === 'sweetheart') {
    const xs = capacity <= 1 ? [0] : [-0.32, 0.32];
    for (let i = 0; i < capacity; i++) out.push({ x: xs[i] ?? 0, z: -0.55 });
    return out;
  }
  // long_banquet / family_head: chairs along both long edges, near→far rows.
  const dims = tableDims(shape, capacity);
  const perSide = Math.ceil(capacity / 2);
  const edge = dims.d / 2 + 0.4;
  for (let i = 0; i < capacity; i++) {
    const side = i < perSide ? -1 : 1;
    const slot = i < perSide ? i : i - perSide;
    const countThisSide = side < 0 ? perSide : capacity - perSide;
    const span = dims.w - 0.6;
    const t = countThisSide <= 1 ? 0.5 : slot / (countThisSide - 1);
    out.push({ x: -span / 2 + t * span, z: side * edge });
  }
  return out;
}

/**
 * Rotate a table-local point to match how the rendered table group is rotated
 * (`group.rotation.y = -deg`). MUST stay identical to the mesh transform so the
 * walk-to-seat target lands on the chair that's actually drawn — three.js Y
 * rotation by `ry` maps (x,z) → (x·cos+z·sin, −x·sin+z·cos). Here ry = −deg.
 */
export function rotateLocal(p: Vec2, deg: number): Vec2 {
  const ry = (-deg * Math.PI) / 180;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
}

/** World position of a specific seat at a table. */
export function seatWorld(table: Lab3DTable, seatNumber: number, room: { w: number; d: number }): Vec2 {
  const base = pctToWorld(table.xPct, table.yPct, room);
  const locals = chairLocalPositions(table.shape, table.capacity);
  const local = locals[Math.max(0, Math.min(locals.length - 1, seatNumber))] ?? { x: 0, z: 0 };
  const rot = rotateLocal(local, table.rotationDeg);
  return { x: base.x + rot.x, z: base.z + rot.z };
}

/** Avoidance radius (metres) a walker keeps from a table centre. */
export function tableAvoidR(table: Lab3DTable): number {
  const d = tableDims(table.shape, table.capacity);
  return (d.round ? d.w / 2 : Math.max(d.w, d.d) / 2) + 0.8;
}

/**
 * Lowest free seat index at a table — the seat a tap-to-place guest takes. A
 * seat is unavailable if it's removed (deleted chair) or already occupied. Out-
 * of-range removed/occupied indices are ignored. Returns -1 when the table is
 * full (caller surfaces "that table is full"). Pure + shared so the auto-seat
 * walk-in and the precise tap-a-table placement fill seats identically.
 */
export function firstFreeSeatAtTable(
  capacity: number,
  removedSeats: number[],
  occupiedSeats: number[],
): number {
  const taken = new Set<number>(
    removedSeats.filter((i) => Number.isInteger(i) && i >= 0 && i < capacity),
  );
  for (const s of occupiedSeats) taken.add(s);
  for (let i = 0; i < capacity; i++) if (!taken.has(i)) return i;
  return -1;
}

/**
 * Reconcile link-grouping from the server snapshot onto the lab's local tables.
 * The merge-snapshot effect is otherwise ADD-ONLY (so it can't clobber in-flight
 * position/rotation optimism), which means a link/unlink — which only mutates
 * `linkGroupId`/`label` on EXISTING rows — would never reach the lab after a
 * refresh. This patches just those two grouping fields from server truth while
 * leaving every other field (position, rotation, …) untouched.
 */
export function reconcileGrouping<T extends { id: string; linkGroupId: string | null; label: string }>(
  local: T[],
  server: ReadonlyArray<{ id: string; linkGroupId: string | null; label: string }>,
): T[] {
  const byId = new Map(server.map((s) => [s.id, s]));
  let changed = false;
  const next = local.map((t) => {
    const s = byId.get(t.id);
    if (!s || (s.linkGroupId === t.linkGroupId && s.label === t.label)) return t;
    changed = true;
    return { ...t, linkGroupId: s.linkGroupId, label: s.label };
  });
  return changed ? next : local;
}

/**
 * Every fixed obstacle a walking avatar must clear, as avoidance discs (centre +
 * radius, world metres): each table EXCEPT the walker's destination, the stage,
 * and the dance floor when enabled. Centralised so the single walk path and the
 * (coming) crowd populate-Play share ONE source of truth — and so vendor booths
 * slot in here later as just more discs.
 */
export function floorObstacles(
  floor: Lab3DFloor,
  tables: Lab3DTable[],
  room: { w: number; d: number },
  skipTableIds: readonly (string | null | undefined)[],
): { c: Vec2; r: number }[] {
  const skip = new Set(skipTableIds.filter(Boolean));
  const obs: { c: Vec2; r: number }[] = tables
    .filter((t) => !skip.has(t.id))
    .map((t) => ({ c: pctToWorld(t.xPct, t.yPct, room), r: tableAvoidR(t) }));
  // Stage — always present. Bounding disc of its footprint + a little clearance.
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);
  obs.push({
    c: pctToWorld(floor.stage.xPct, floor.stage.yPct, room),
    r: Math.max(stageW, stageD) / 2 + 0.6,
  });
  // Dance floor — only when the couple enabled one.
  if (floor.dance.enabled) {
    const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
    const danceD = Math.max(1.5, (floor.dance.hPct / 100) * room.d);
    obs.push({
      c: pctToWorld(floor.dance.xPct, floor.dance.yPct, room),
      r: Math.max(danceW, danceD) / 2 + 0.4,
    });
  }
  return obs;
}

// ── Venue objects (whole-venue designer) ───────────────────────────────────
// Placeable NON-seating elements so the 3D edit lays out the ENTIRE space, not
// just guest tables (owner 2026-06-26). The CANONICAL kind list — keep the DB
// CHECK in 20270224150000_event_scene_objects.sql in sync when extending. `w`/`d`
// are the footprint (metres) used for the 3D mesh + the crowd avoidance disc.
export type VenueObjectKind =
  | 'arch'
  | 'buffet'
  | 'bar'
  | 'cake_table'
  | 'gift_table'
  | 'registration'
  | 'photo_booth'
  | 'lounge'
  | 'led_wall'
  | 'plant';

export const VENUE_OBJECT_CATALOG: ReadonlyArray<{
  kind: VenueObjectKind;
  label: string;
  w: number;
  d: number;
}> = [
  { kind: 'arch', label: 'Ceremony arch', w: 2.4, d: 0.6 },
  { kind: 'buffet', label: 'Buffet station', w: 3.0, d: 0.9 },
  { kind: 'bar', label: 'Bar', w: 2.5, d: 0.8 },
  { kind: 'cake_table', label: 'Cake table', w: 1.2, d: 1.2 },
  { kind: 'gift_table', label: 'Gift table', w: 1.6, d: 0.7 },
  { kind: 'registration', label: 'Registration', w: 1.6, d: 0.7 },
  { kind: 'photo_booth', label: 'Photo booth', w: 2.0, d: 2.0 },
  { kind: 'lounge', label: 'Lounge', w: 2.5, d: 1.8 },
  { kind: 'led_wall', label: 'LED wall', w: 4.0, d: 0.4 },
  { kind: 'plant', label: 'Plant / greenery', w: 0.8, d: 0.8 },
];

const VENUE_OBJECT_DIMS: ReadonlyMap<string, { w: number; d: number }> = new Map(
  VENUE_OBJECT_CATALOG.map((o) => [o.kind, { w: o.w, d: o.d }]),
);

/** Footprint (metres) for a venue-object kind; a 1×1 fallback for unknown kinds. */
export function venueObjectDims(kind: string): { w: number; d: number } {
  return VENUE_OBJECT_DIMS.get(kind) ?? { w: 1, d: 1 };
}

/** A placed venue object on the couple's percent canvas. */
export type Lab3DSceneObject = {
  id: string;
  kind: VenueObjectKind;
  label: string | null;
  xPct: number;
  yPct: number;
  rotationDeg: number;
};

/**
 * Avoidance discs for placed venue objects, so the walk-in crowd steers around
 * the buffet / arch / bar just like it does tables. Merge into floorObstacles'
 * output at the call site (objects don't get "skipped" the way a destination
 * table does — a guest never walks INTO a buffet).
 */
export function sceneObjectObstacles(
  objects: Lab3DSceneObject[],
  room: { w: number; d: number },
): { c: Vec2; r: number }[] {
  return objects.map((o) => {
    const dim = venueObjectDims(o.kind);
    return { c: pctToWorld(o.xPct, o.yPct, room), r: Math.max(dim.w, dim.d) / 2 + 0.4 };
  });
}

/**
 * Push a point to the edge of any avoidance disc it sits inside (one pass over
 * the discs). `perp` is the escape heading for the degenerate case where the
 * point lands exactly on a disc centre (no radial direction to push along).
 * Pure — shared by steerPath's hard-clearance AND the per-frame crowd re-clamp,
 * so "don't cross objects" means the same thing for a precomputed path and a
 * live-walking avatar.
 */
export function pushOutOfDiscs(
  p: Vec2,
  discs: { c: Vec2; r: number }[],
  perp: Vec2 = { x: 1, z: 0 },
): Vec2 {
  let x = p.x;
  let z = p.z;
  for (const d of discs) {
    const dx = x - d.c.x;
    const dz = z - d.c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < d.r) {
      const ux = dist < 1e-3 ? perp.x : dx / dist;
      const uz = dist < 1e-3 ? perp.z : dz / dist;
      x = d.c.x + ux * d.r;
      z = d.c.z + uz * d.r;
    }
  }
  return { x, z };
}

/**
 * "Make way for each other": any two agents closer than `minDist` are pushed
 * apart by half their overlap each. Returns NEW positions (input untouched).
 * One relaxation pass — the crowd loop calls it every frame, so it converges
 * over time rather than resolving all overlaps in a single tick. Pure.
 */
export function separateAgents(agents: Vec2[], minDist: number): Vec2[] {
  const out = agents.map((a) => ({ x: a.x, z: a.z }));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const dx = out[j]!.x - out[i]!.x;
      const dz = out[j]!.z - out[i]!.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= minDist) continue;
      if (dist < 1e-6) {
        // Exactly coincident — separate deterministically along x by index.
        out[i]!.x -= minDist / 2;
        out[j]!.x += minDist / 2;
        continue;
      }
      const push = (minDist - dist) / 2;
      const ux = dx / dist;
      const uz = dz / dist;
      out[i]!.x -= ux * push;
      out[i]!.z -= uz * push;
      out[j]!.x += ux * push;
      out[j]!.z += uz * push;
    }
  }
  return out;
}

/**
 * First-person walk movement: given the camera's yaw and a joystick (`moveX` =
 * strafe right+, `moveForward` = forward+), return the unit-ish world (dx,dz) to
 * step. yaw 0 faces +z; forward follows the look direction, strafe is 90° right
 * of it. Pure + unit-tested — the game-pad camera's only directional math.
 */
export function walkVector(yaw: number, moveX: number, moveForward: number): { dx: number; dz: number } {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { dx: moveForward * s + moveX * c, dz: moveForward * c - moveX * s };
}

/**
 * Lightweight "walk around the tables" path: sample the straight line start→end,
 * push each interior sample out of any table's avoidance disc (a cheap potential
 * field), then return the smoothed waypoints. Not a true NavMesh — it just reads
 * as intentional navigation for the spike; NavMesh (three-pathfinding / recast)
 * is the documented upgrade.
 */
export function steerPath(
  start: Vec2,
  end: Vec2,
  tables: { c: Vec2; r: number }[],
  skipR = 0,
): Vec2[] {
  const STEPS = 22;
  const pts: Vec2[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    pts.push({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t });
  }
  // Two relaxation passes of repulsion on interior points.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      for (const tb of tables) {
        const dx = pts[i]!.x - tb.c.x;
        const dz = pts[i]!.z - tb.c.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const keep = tb.r + skipR;
        if (dist < keep) {
          const push = (keep - dist) * 0.9;
          pts[i]!.x += (dx / dist) * push;
          pts[i]!.z += (dz / dist) * push;
        }
      }
    }
  }
  // Smooth (moving average) so the avatar doesn't jitter through the field.
  const out: Vec2[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    out.push({
      x: (pts[i - 1]!.x + pts[i]!.x + pts[i + 1]!.x) / 3,
      z: (pts[i - 1]!.z + pts[i]!.z + pts[i + 1]!.z) / 3,
    });
  }
  out.push(pts[pts.length - 1]!);
  // Hard-clearance: smoothing can pull a waypoint back inside a disc, so push
  // any interior point that still sits inside an obstacle out to its edge. This
  // is what makes the walker actually CLEAR the stage / a big table instead of
  // grazing it — soft repulsion alone under-corrects for large discs. A few
  // passes settle points that get pushed from one disc into another. Endpoints
  // (the entrance + the target chair) are left exact.
  // `perp` is the escape direction for the degenerate case where a waypoint
  // lands exactly on a disc centre (a straight shot through a table/stage) and
  // so has no radial direction to push along — side-step across the heading.
  const hx = end.x - start.x;
  const hz = end.z - start.z;
  const hlen = Math.hypot(hx, hz) || 1;
  const perp = { x: -hz / hlen, z: hx / hlen };
  const discs = tables.map((tb) => ({ c: tb.c, r: tb.r + skipR }));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      out[i] = pushOutOfDiscs(out[i]!, discs, perp);
    }
  }
  return out;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Pick a usable scene palette from the mood-board hex list, with warm fallbacks. */
export function resolvePalette(hexes: string[]): Lab3DPalette {
  const clean = hexes.filter((h) => typeof h === 'string' && HEX.test(h));
  const at = (i: number, fallback: string) => clean[i] ?? fallback;
  return {
    accent: at(0, '#c89b6c'),
    table: at(1, '#f3efe9'),
    floor: at(2, '#e7e1d8'),
    wall: at(3, '#d8cfc2'),
    ambient: at(0, '#fbe9d8'),
  };
}

/** A few demo palettes for the live "watch materials recolour" switcher. */
export const DEMO_PALETTES: { key: string; label: string; palette: Lab3DPalette }[] = [
  { key: 'mood', label: 'Mood board', palette: resolvePalette([]) },
  {
    key: 'champagne',
    label: 'Champagne',
    palette: { accent: '#c8a25a', table: '#f6efe2', floor: '#ece3cf', wall: '#ddd0b3', ambient: '#fff2d6' },
  },
  {
    key: 'mulberry',
    label: 'Mulberry dusk',
    palette: { accent: '#8e3b5b', table: '#f3e7ec', floor: '#2a2030', wall: '#3a2c40', ambient: '#ffd9e6' },
  },
  {
    key: 'forest',
    label: 'Forest',
    palette: { accent: '#3f7d57', table: '#eef3ec', floor: '#1f2a22', wall: '#2c3a30', ambient: '#dff3e2' },
  },
];
