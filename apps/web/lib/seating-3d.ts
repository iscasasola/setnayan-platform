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
import type { RolePalette } from '@/lib/mood-board';

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
  /** LAB-ONLY (couple-scoped): the guest picked a meal — `guests.meal_preference`
   * boiled to a boolean (the choice itself never rides the slice). Drives the
   * Play-mode plate emote (Fable §3.6). The demo/public slices deliberately
   * never widen to this: Plan3DGuest stays name/seat/side(+attire) and the
   * public venue walk stays anonymized (RA 10173 posture). */
  mealChosen: boolean;
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

/** The ONE avoidance-obstacle shape every steering primitive speaks: a disc
 * (centre + radius, world metres). Named so the new multi-disc footprint /
 * chair / grid helpers share a type, but structurally identical to the inline
 * `{ c, r }` the existing consumers (steerPath, pushOutOfDiscs, the roam
 * clamp, the lab crowd) already pass — nothing downstream changes shape. */
export type ObstacleDisc = { c: Vec2; r: number };

/**
 * A seat's position + FACING — the direction the seated guest's gaze points
 * (radians, walkVector's heading convention: yaw θ ↔ world vector (sinθ, cosθ),
 * so faceY 0 looks down +z). For every shape the gaze points AT the table, so
 * `-faceY` is "behind the chair" — where a walker stands before sitting
 * (approachPoint) and where a stand-up animation steps back to.
 *
 * ⚠ Convention bridge: this is the GAZE, not the chair-mesh yaw. The instanced
 * chair renderer (chairPlacements / SerpSeat.faceY) carries the yaw that swings
 * the BACKREST — local +Z outward, i.e. gaze + π — and the seated `<Figure>`
 * un-flips it with a `rotation={[0, Math.PI, 0]}` group. SeatPose promotes the
 * flipped (human) direction so pure-math consumers (walk targets, sit-down
 * choreography, camera framing) never re-derive that π.
 */
export type SeatPose = { x: number; z: number; faceY: number };

/** Normalize an angle into atan2's (−π, π] range so composed facings compare
 *  cleanly (e.g. local −π/2 + a 270° table spin doesn't return 3π/2). */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

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
 * The dance floor as a world rect (centre + half-extents), or null when the
 * couple didn't enable one. SAME dimensions the mural mesh renders and the
 * avoidance disc circumscribes (`floorObstacles`) — the single source the
 * tap-to-dance hit test + clamp read, so "is this tap on the dance floor?" can
 * never drift from what's drawn. Pure.
 */
export function danceFloorRect(
  floor: Pick<Lab3DFloor, 'dance'>,
  room: { w: number; d: number },
): PlaceZone | null {
  if (!floor.dance.enabled) return null;
  const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
  const danceD = Math.max(1.5, (floor.dance.hPct / 100) * room.d);
  const c = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);
  return { cx: c.x, cz: c.z, hw: danceW / 2, hd: danceD / 2 };
}

/** Is a world point inside a rect zone? `inset` shrinks the zone on every side
 *  (a point exactly on the edge counts as inside at inset 0). Pure. */
export function pointInZone(p: Vec2, zone: PlaceZone, inset = 0): boolean {
  return (
    Math.abs(p.x - zone.cx) <= Math.max(0, zone.hw - inset) &&
    Math.abs(p.z - zone.cz) <= Math.max(0, zone.hd - inset)
  );
}

/** Clamp a world point to inside a rect zone (optionally inset from the edge),
 *  so a dance walk ends comfortably ON the floor rather than on its lip. Pure. */
export function clampPointToZone(p: Vec2, zone: PlaceZone, inset = 0): Vec2 {
  const hw = Math.max(0, zone.hw - inset);
  const hd = Math.max(0, zone.hd - inset);
  return {
    x: Math.max(zone.cx - hw, Math.min(zone.cx + hw, p.x)),
    z: Math.max(zone.cz - hd, Math.min(zone.cz + hd, p.z)),
  };
}

/**
 * Standing spots on the dance floor for the tap-to-dance party — a grid of
 * non-overlapping points inside the rect, INSET from the lip (a dancer stands ON
 * the floor, not on its edge), ordered CENTRE-FIRST so the party grows from the
 * middle outward as more guests are tapped out. `spacing` is the minimum gap
 * between neighbouring dancers (personal space): it lays the grid AND guarantees
 * no two dancers overlap — the actual grid pitch is ≥ `spacing` by construction
 * (`floor(span/spacing)` cells over the span), so the closest pair is never
 * nearer than `spacing`. The array length is the floor's dance capacity: the Nth
 * dancer takes `spots[N-1]`; past the last spot the caller stops adding (floor
 * full). Deterministic in its inputs → unit-tested.
 */
export function danceSpots(
  rect: PlaceZone,
  opts: { spacing?: number; inset?: number } = {},
): Vec2[] {
  const spacing = Math.max(0.5, opts.spacing ?? 0.9);
  const inset = Math.max(0, opts.inset ?? 0.35);
  const hw = Math.max(0, rect.hw - inset);
  const hd = Math.max(0, rect.hd - inset);
  const nx = Math.max(1, Math.floor((hw * 2) / spacing) + 1);
  const nz = Math.max(1, Math.floor((hd * 2) / spacing) + 1);
  const spots: { x: number; z: number; k: number; d: number }[] = [];
  let k = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = nx === 1 ? rect.cx : rect.cx - hw + (i * (hw * 2)) / (nx - 1);
      const z = nz === 1 ? rect.cz : rect.cz - hd + (j * (hd * 2)) / (nz - 1);
      spots.push({ x, z, k: k++, d: (x - rect.cx) ** 2 + (z - rect.cz) ** 2 });
    }
  }
  // Centre-first: closest to the rect centre dances first; ties break by the
  // stable generation order (i-major, j-minor) so the layout is deterministic.
  return spots.sort((a, b) => a.d - b.d || a.k - b.k).map(({ x, z }) => ({ x, z }));
}

/**
 * Pick the seated guest to send to the dance floor: the candidate nearest the
 * `target` spot (shortest walk onto the floor). The caller pre-filters out
 * anyone already dancing / mid-swap / walking in, so this just minimises
 * distance; ties break by the given order (stable — first candidate wins).
 * Returns the guest id, or null when there's no one to send. Pure → unit-tested.
 */
export function pickDanceGuest(
  candidates: readonly { gid: string; world: Vec2 }[],
  target: Vec2,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = (c.world.x - target.x) ** 2 + (c.world.z - target.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.gid;
    }
  }
  return best;
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

type SerpBand = {
  outline: Vec2[];
  centre: Vec2;
  bboxW: number;
  bboxD: number;
  /** Recentred local mid-band end points (the two tips the chain joins at). */
  endPlus: Vec2;
  endMinus: Vec2;
};
let _serpBand: SerpBand | null = null;

/**
 * The serpentine band as a recentred outline + its curvature centre + bbox +
 * the two end-edge midpoints. Capacity-independent (only the chairs scale), so
 * it's computed once + cached.
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
  // The tips sit at the mid-band radius, at ±half-sweep — the join points a
  // chained neighbour's tip must land on (mirrors the 2D serpentineFrame).
  const rm = (SERP_RI + SERP_RO) / 2;
  const tip = (sign: 1 | -1): Vec2 => ({ x: serpAt(rm, (sign * SERP_SWEEP) / 2).x - ox, z: serpAt(rm, (sign * SERP_SWEEP) / 2).z - oz });
  _serpBand = {
    outline: raw.map((p) => ({ x: p.x - ox, z: p.z - oz })),
    centre: { x: -ox, z: -oz }, // curvature centre, in recentred local coords
    bboxW: maxX - minX,
    bboxD: maxZ - minZ,
    endPlus: tip(1),
    endMinus: tip(-1),
  };
  return _serpBand;
}

/**
 * Rotate a local band point into world space using the 3D lab's render
 * convention: a table drawn at world (X,Z) with `rotationDeg` renders each
 * local (x,z) via `g.rotation.y = -rotationDeg·π/180`. This is the SINGLE
 * source of the rotation math shared by the snap below AND its test, so "the
 * tips coincide" is provable without a GPU.
 */
function serpRotVec(v: Vec2, rotDeg: number): Vec2 {
  const t = (-rotDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
}

/** A serpentine placed in the lab: world centre (m) + rotationDeg. */
export type SerpPlacement = { x: number; z: number; rotDeg: number };

/** World-space position of a serpentine's two tips, given its placement. */
export function serpentineTipsWorld(p: SerpPlacement): [Vec2, Vec2] {
  const b = serpentineBand();
  return [b.endPlus, b.endMinus].map((e) => {
    const r = serpRotVec(e, p.rotDeg);
    return { x: p.x + r.x, z: p.z + r.z };
  }) as [Vec2, Vec2];
}

/**
 * Magnetic end-to-end snap for serpentine tables IN THE 3D LAB (world metres) —
 * the 3D twin of lib/seating.ts's pixel-space `serpentineChainSnap`, using the
 * lab's own band geometry + rotation convention. Given the dragged wedge's
 * candidate centre and every OTHER serpentine on the floor, returns the closest
 * legal chained placement (position + rotationDeg) within `tolM`, or null.
 * 4 candidates per neighbour: continue-the-circle past either tip, or S-bend.
 * Deterministic: nearest candidate wins; ties keep the first.
 */
export function serpentineChainSnapWorld(
  drag: Vec2,
  neighbours: ReadonlyArray<SerpPlacement & { id: string }>,
  tolM: number,
): (SerpPlacement & { neighbourId: string }) | null {
  const band = serpentineBand();
  const norm = (d: number) => ((d % 360) + 360) % 360;
  const sweep = (SERP_SWEEP * 180) / Math.PI; // SERP_SWEEP is radians → degrees
  let best: (SerpPlacement & { neighbourId: string }) | null = null;
  let bestD = tolM * tolM;
  const consider = (c: SerpPlacement, neighbourId: string) => {
    const d = (c.x - drag.x) ** 2 + (c.z - drag.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { ...c, neighbourId };
    }
  };
  for (const b of neighbours) {
    // Neighbour's arc centre in world.
    const cLocal = serpRotVec(band.centre, b.rotDeg);
    const cw = { x: b.x + cLocal.x, z: b.z + cLocal.z };
    // Continue the circle: neighbour rotated ±sweep about its arc centre.
    for (const sgn of [1, -1] as const) {
      const v = serpRotVec({ x: b.x - cw.x, z: b.z - cw.z }, sgn * sweep);
      consider({ x: cw.x + v.x, z: cw.z + v.z, rotDeg: norm(b.rotDeg + sgn * sweep) }, b.id);
    }
    // S-bend: neighbour rotated 180° about a tip midpoint (point reflection).
    for (const e of [band.endPlus, band.endMinus]) {
      const el = serpRotVec(e, b.rotDeg);
      const m = { x: b.x + el.x, z: b.z + el.z };
      consider({ x: 2 * m.x - b.x, z: 2 * m.z - b.z, rotDeg: norm(b.rotDeg + 180) }, b.id);
    }
  }
  return best;
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
 * Local chair POSES (metres + gaze, table-local, pre-rotation) indexed so that
 * chair[seat_number] is the seat a guest's assignment points at. This mirrors
 * the 2D fill convention closely enough for the walk-to-seat target; exact
 * parity with the 2D ring math is a documented v2 refinement.
 *
 * `faceY` is the seated guest's gaze (see SeatPose), derived per shape to match
 * what each renderer actually draws:
 *   · round — every gaze converges on the table centre: atan2(−x, −z), the
 *     exact π flip of the chair-yaw `atan2(x, z)` the instanced renderer uses;
 *   · serpentine — SerpSeat.faceY (the reference implementation, untouched)
 *     + the same π bridge: outer chairs gaze at the curvature centre, inner
 *     chairs gaze away from it — both onto the band;
 *   · sweetheart — the couple faces the room straight-on (+z, faceY 0), not
 *     the atan2 convergence: two gazes crossing over a 1.1 m table read
 *     cross-eyed, and every sweetheart render fronts the room;
 *   · long_banquet / family_head — row seats gaze straight ACROSS the table by
 *     row sign (−z row looks +z and vice versa), square to the linen the way
 *     banquet places are laid. No head/end seats exist in this local math yet;
 *     when they land they gaze down the table axis (faceY ±π/2).
 *
 * The return is a structural SUPERSET of the old Vec2[] — position consumers
 * keep destructuring `{ x, z }` untouched.
 */
export function chairLocalPositions(shape: ShapeHint, capacity: number): SeatPose[] {
  const out: SeatPose[] = [];
  // Serpentine rides its own curved arcs (outer + inner), not a full ring.
  // SerpSeat.faceY is the CHAIR yaw (backrest heading) InstancedChairs composes
  // directly; the sitter's gaze is its π flip — promote the gaze (SeatPose
  // contract) so approachPoint lands behind the chair, never on the band.
  if (shape === 'serpentine') {
    return serpentineChairs(capacity).map((c) => ({
      x: c.x,
      z: c.z,
      faceY: wrapAngle(c.faceY + Math.PI),
    }));
  }
  if (shape === 'round') {
    const r = (tableDims(shape, capacity).w || 1.3) / 2 + 0.45;
    for (let i = 0; i < capacity; i++) {
      const a = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      out.push({ x, z, faceY: Math.atan2(-x, -z) });
    }
    return out;
  }
  if (shape === 'sweetheart') {
    const xs = capacity <= 1 ? [0] : [-0.32, 0.32];
    for (let i = 0; i < capacity; i++) out.push({ x: xs[i] ?? 0, z: -0.55, faceY: 0 });
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
    // Gaze straight across the table: the −z row looks toward +z (faceY 0),
    // the +z row looks back toward −z (faceY π).
    out.push({ x: -span / 2 + t * span, z: side * edge, faceY: side < 0 ? 0 : Math.PI });
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

/**
 * Radian sibling of `rotateLocal`: rotate a group-local point to world by the
 * group's yaw `ry` (three.js `rotation.y = ry`) directly — no degrees, no sign
 * flip. Same (x,z) → (x·cos+z·sin, −x·sin+z·cos) map. Use this for booth-local
 * offsets, whose group yaw is `boothFacingY` (radians): a booth turned to face
 * the room must swing its chassis discs / staff discs / hit box / sign anchor
 * by the SAME yaw, or collision + tap + logo de-register from the visual.
 * Identity check: `rotateLocal(p, deg) === rotateLocalRad(p, -deg·π/180)`.
 */
export function rotateLocalRad(p: Vec2, ry: number): Vec2 {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
}

/**
 * World-space pose of a specific seat at a table: position through the SAME
 * `pctToWorld` + `rotateLocal` pipeline the meshes use, and facing composed as
 * world faceY = local faceY + table rotation. rotateLocal spins by the render's
 * group yaw ry = −rotationDeg (three.js `rotation.y = -deg`), and rotating a
 * heading vector (sinθ, cosθ) by ry lands on (sin(θ+ry), cos(θ+ry)) — so the
 * gaze composes by the SAME ry the position does, keeping pose and mesh in
 * lockstep for any table spin.
 */
export function worldSeatPose(
  table: Lab3DTable,
  seatNumber: number,
  room: { w: number; d: number },
): SeatPose {
  const base = pctToWorld(table.xPct, table.yPct, room);
  const locals = chairLocalPositions(table.shape, table.capacity);
  const local = locals[Math.max(0, Math.min(locals.length - 1, seatNumber))] ?? { x: 0, z: 0, faceY: 0 };
  const rot = rotateLocal(local, table.rotationDeg);
  return {
    x: base.x + rot.x,
    z: base.z + rot.z,
    faceY: wrapAngle(local.faceY - (table.rotationDeg * Math.PI) / 180),
  };
}

/** World position of a specific seat at a table. Now returns the full SeatPose
 *  (a structural superset of Vec2) — existing `{ x, z }` consumers are
 *  untouched, and pose-aware callers get the facing for free. */
export function seatWorld(table: Lab3DTable, seatNumber: number, room: { w: number; d: number }): SeatPose {
  return worldSeatPose(table, seatNumber, room);
}

/**
 * Where a walker STANDS before sitting (and where a stand-up steps back to):
 * `distM` out along −faceY — directly behind the chair, since the gaze points
 * at the table. The 0.55 m default clears the chair footprint (0.42 m box +
 * body slack) without drifting into a neighbouring table's lane. Pure — the
 * sit-down choreography steers to this point, turns to faceY, then sits.
 */
export function approachPoint(seat: SeatPose, distM = 0.55): Vec2 {
  return {
    x: seat.x - Math.sin(seat.faceY) * distM,
    z: seat.z - Math.cos(seat.faceY) * distM,
  };
}

/** Avoidance radius (metres) a walker keeps from a table centre. Still the
 * single-disc summary (seatApproachPath's approach ring, checkPlacement) —
 * PATH obstacles now come from tableFootprintDiscs, which keeps the same
 * 0.8 m clearance intent but hugs the true outline. */
export function tableAvoidR(table: Lab3DTable): number {
  const d = tableDims(table.shape, table.capacity);
  return (d.round ? d.w / 2 : Math.max(d.w, d.d) / 2) + 0.8;
}

// ── True table footprints (multi-disc) ──────────────────────────────────────
// Standing clearance a walker keeps beyond a tabletop edge — the same 0.8 m
// tableAvoidR has always added past the footprint half-span, now applied along
// the TRUE outline instead of one fat bounding circle.
const FOOTPRINT_CLEARANCE_M = 0.8;
// The serpentine band's clearance is deliberately tighter: its chairs ride both
// arcs 0.5 m out and now carry their OWN discs (chairObstacles), and a 0.8 m
// ring around the 0.6 m-thick band would swallow the concave pocket this
// multi-disc upgrade exists to open up.
const SERP_FOOTPRINT_CLEARANCE_M = 0.5;
const SERP_FOOTPRINT_DISCS = 5;

/**
 * TRUE table footprint as avoidance discs. The owner watched walkers clip
 * banquet-table corners: the single bounding disc per table either had to span
 * the long half-diagonal (swallowing whole aisles) or, sized to the half-span
 * the way tableAvoidR is, left the end corners poking out of coverage — and
 * per-frame clamps that exclude the destination table relaxed it further.
 * Shape-aware multi-disc coverage instead:
 *   · round / sweetheart — one disc (the old behaviour was already true here:
 *     a round IS a circle; a sweetheart is a small 1.1×0.6 slab);
 *   · long_banquet / family_head — a capsule: 3–4 discs strung along the local
 *     x axis, each r = short-half-span + clearance, end centres at
 *     ±(w/2 − d/2) so the union is the rectangle inflated by the clearance
 *     and the end caps wrap the corners;
 *   · serpentine — discs strung along the band's centreline arc (the same
 *     serpAt math the outline uses), so the concave pocket is finally
 *     walkable instead of one huge bbox disc.
 * Every disc composes through the table's rotation via rotateLocal — the SAME
 * transform the mesh gets — so a spun banquet's corners stay covered. Returns
 * the shared `{ c, r }` obstacle type, so steerPath / pushOutOfDiscs / the
 * roam clamp consume it unchanged.
 */
export function tableFootprintDiscs(
  table: Lab3DTable,
  room: { w: number; d: number },
): ObstacleDisc[] {
  const base = pctToWorld(table.xPct, table.yPct, room);
  const place = (local: Vec2, r: number): ObstacleDisc => {
    const p = rotateLocal(local, table.rotationDeg);
    return { c: { x: base.x + p.x, z: base.z + p.z }, r };
  };
  switch (table.shape) {
    case 'round':
    case 'sweetheart':
      return [{ c: base, r: tableAvoidR(table) }];
    case 'serpentine': {
      const { centre } = serpentineBand();
      const rm = (SERP_RI + SERP_RO) / 2; // band centreline radius
      const r = (SERP_RO - SERP_RI) / 2 + SERP_FOOTPRINT_CLEARANCE_M;
      const out: ObstacleDisc[] = [];
      for (let i = 0; i < SERP_FOOTPRINT_DISCS; i++) {
        const phi = -SERP_SWEEP / 2 + (SERP_SWEEP * i) / (SERP_FOOTPRINT_DISCS - 1);
        const p = serpAt(rm, phi); // relative to the curvature centre
        out.push(place({ x: p.x + centre.x, z: p.z + centre.z }, r));
      }
      return out;
    }
    case 'long_banquet':
    case 'family_head': {
      const dims = tableDims(table.shape, table.capacity);
      const r = dims.d / 2 + FOOTPRINT_CLEARANCE_M;
      // End centres at ±(w/2 − d/2): the classic capsule of the rectangle, so
      // every edge keeps the full clearance and the end caps wrap the corners
      // — the exact spots the old sizing left walkable.
      const half = Math.max(0, dims.w / 2 - dims.d / 2);
      const n = dims.w > dims.d * 3 ? 4 : 3;
      const out: ObstacleDisc[] = [];
      for (let i = 0; i < n; i++) {
        out.push(place({ x: -half + (2 * half * i) / (n - 1), z: 0 }, r));
      }
      return out;
    }
  }
}

/** A walker's clearance disc per CHAIR — the 0.42 m chair box's half-diagonal
 * plus a little body slack, matching how snugly the sit choreography's own
 * approach distances are tuned. */
export const CHAIR_OBSTACLE_R = 0.3;

/**
 * Is `p` inside the approach corridor of `seat` — the strip a sit walk OWNS,
 * running from the chair out through its approachPoint (the −faceY side,
 * behind the backrest)? Chair discs inside this strip must not be obstacles
 * for the walker heading to THAT seat, or the final step-in gets shoved off
 * the hand-off spot. `along` is signed distance behind the chair; `across` is
 * lateral offset off the corridor axis. Pure — exported so a caller can also
 * filter a NEIGHBOURING table's chair that happens to crowd the corridor.
 *
 * The default half-width sits just UNDER the tightest same-row chair pitch a
 * long banquet reaches (0.547 m at capacity 14, 0.531 m at 16 — span
 * (w − 0.6) / (perSide − 1)): at 0.55 the corridor swallowed BOTH chairs
 * flanking the destination on a 14+ banquet, leaving nothing to clamp a
 * crowd-mode shove out of the neighbouring seat backs. 0.5 keeps the flanks
 * solid on every catalog capacity while the straight radial step-in (which
 * runs on the corridor axis) still clears them.
 */
export function inSeatApproachCorridor(
  p: Vec2,
  seat: SeatPose,
  halfWidthM = 0.5,
  lengthM = 1.4,
): boolean {
  const ax = -Math.sin(seat.faceY);
  const az = -Math.cos(seat.faceY);
  const vx = p.x - seat.x;
  const vz = p.z - seat.z;
  const along = vx * ax + vz * az;
  const across = Math.abs(vx * az - vz * ax);
  return along >= -0.05 && along <= lengthM && across <= halfWidthM;
}

/**
 * Avoidance discs for a table's CHAIRS — one small disc per chair (occupied or
 * not: an empty chair is just as solid, and a seated guest is covered by their
 * chair's disc, so the crowd needs no separate person-discs for the seated).
 * Removed (deleted) chairs get none. When the walker is heading to a seat at
 * THIS table, pass it as `destinationSeat`: that chair AND any chair sitting
 * in its approach corridor (the approachPoint side — see
 * inSeatApproachCorridor) are excluded, so the sit walk can still reach its
 * hand-off spot. The index clamps exactly like worldSeatPose so an
 * out-of-range seat number excludes the SAME chair the seat math resolves to.
 */
export function chairObstacles(
  table: Lab3DTable,
  room: { w: number; d: number },
  opts: { destinationSeat?: number | null } = {},
): ObstacleDisc[] {
  const removed = new Set(
    table.removedSeats.filter((i) => Number.isInteger(i) && i >= 0 && i < table.capacity),
  );
  const destIdx =
    opts.destinationSeat == null
      ? null
      : Math.max(0, Math.min(table.capacity - 1, opts.destinationSeat));
  const destPose = destIdx == null ? null : worldSeatPose(table, destIdx, room);
  const out: ObstacleDisc[] = [];
  for (let i = 0; i < table.capacity; i++) {
    if (removed.has(i)) continue; // a deleted chair isn't there to bump into
    if (i === destIdx) continue; // the walker's own chair — they must reach it
    const pose = worldSeatPose(table, i, room);
    if (destPose && inSeatApproachCorridor(pose, destPose)) continue;
    out.push({ c: { x: pose.x, z: pose.z }, r: CHAIR_OBSTACLE_R });
  }
  return out;
}

/**
 * Chair discs for EVERY table, filtered for a walker heading to `dest` — the
 * one answer to "which chairs block this walk", shared by the single walk-in
 * and each populate-Play crowd agent so the two flows can never disagree:
 *   · the destination table's chairs go through chairObstacles' own
 *     destinationSeat handling (dest chair + same-table corridor crowders
 *     excluded);
 *   · a NEIGHBOURING table's chair that happens to crowd the destination's
 *     approach corridor is dropped too (the inSeatApproachCorridor export
 *     exists exactly for this) — two tables set back-to-back must not wall off
 *     the hand-off spot between them;
 *   · every other chair, occupied or not, is solid.
 * An unknown dest.tableId (guest row raced a table delete) degrades to ALL
 * chairs unfiltered — strictly more conservative, never a crash. Pure.
 */
export function chairObstaclesForWalk(
  tables: readonly Lab3DTable[],
  room: { w: number; d: number },
  dest: { tableId: string; seatNumber: number },
): ObstacleDisc[] {
  const destTable = tables.find((t) => t.id === dest.tableId) ?? null;
  // seatWorld clamps the seat index exactly like chairObstacles does, so the
  // corridor is anchored on the SAME chair the exclusion resolves to.
  const destPose = destTable ? seatWorld(destTable, dest.seatNumber, room) : null;
  const out: ObstacleDisc[] = [];
  for (const t of tables) {
    if (destTable && t.id === destTable.id) {
      out.push(...chairObstacles(t, room, { destinationSeat: dest.seatNumber }));
      continue;
    }
    for (const d of chairObstacles(t, room)) {
      if (destPose && inSeatApproachCorridor(d.c, destPose)) continue;
      out.push(d);
    }
  }
  return out;
}

/**
 * Drop every disc that CONTAINS `p` (within r + inflateR) — the footprint-disc
 * analogue of the chair corridor exclusion, for a walk's PER-FRAME clamp set.
 * A seat-destined walk already drops its destination table's footprint from
 * the clamp (its avoidance ring contains the sit hand-off point), but on
 * cramped back-to-back layouts (two 8-cap banquets ~2.4 m centre-to-centre) a
 * NEIGHBOURING table's capsule disc still reaches the hand-off spot, and a
 * clamp that keeps it shoves the walker 0.4–0.9 m off the spot every frame —
 * the sit clip then starts with a visible teleport. Filter the clamp's
 * footprint/fixture discs through this with the path's final waypoint: only
 * the specific disc(s) overlapping the hand-off go away (the rest of the
 * neighbour's capsule stays solid), and its chair discs — which the corridor
 * filter keeps solid outside the strip — remain what stops the final metre
 * clipping a seat back. Pure.
 */
export function dropDiscsContaining(
  discs: readonly ObstacleDisc[],
  p: Vec2,
  inflateR = 0,
): ObstacleDisc[] {
  return discs.filter((d) => Math.hypot(p.x - d.c.x, p.z - d.c.z) >= d.r + inflateR);
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
 * radius, world metres): each table EXCEPT the walker's destination — now as
 * its TRUE multi-disc footprint (tableFootprintDiscs), so a banquet reads as a
 * capsule and a serpentine as its band instead of one fat bounding circle —
 * plus the stage, and the dance floor when enabled. Centralised so the single
 * walk path and the crowd populate-Play share ONE source of truth — and so
 * vendor booths slot in here later as just more discs. Skipping a table by id
 * skips ALL of its footprint discs.
 *
 * `opts.skipDanceFloor` drops the dance-floor disc for a DANCE-DESTINED walk —
 * the tap-the-dance-floor flow, mirroring `skipTableIds` for a seat-destined
 * walk: the floor stays an obstacle for ordinary roam (so the character rounds
 * it), but a walk that MEANS to end on the floor must be able to reach it.
 */
export function floorObstacles(
  floor: Lab3DFloor,
  tables: Lab3DTable[],
  room: { w: number; d: number },
  skipTableIds: readonly (string | null | undefined)[],
  opts: { skipDanceFloor?: boolean } = {},
): ObstacleDisc[] {
  const skip = new Set(skipTableIds.filter(Boolean));
  const obs: ObstacleDisc[] = tables
    .filter((t) => !skip.has(t.id))
    .flatMap((t) => tableFootprintDiscs(t, room));
  // Stage — always present. Bounding disc of its footprint + a little clearance.
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);
  obs.push({
    c: pctToWorld(floor.stage.xPct, floor.stage.yPct, room),
    r: Math.max(stageW, stageD) / 2 + 0.6,
  });
  // Entrance doorway frame (2026-07-08 collision pass): the two metal posts
  // (±0.55 m local X, 0.1 m square) get small discs so walkers and the roam
  // step-in never stand THROUGH them. The 1.1 m gap between posts stays a
  // legal channel (0.7 m clear at r 0.2 — wider than a chair corridor), and
  // the scripted walk's start point at the frame centre remains outside both.
  if (floor.entrance.enabled) {
    const e = pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room);
    obs.push({ c: { x: e.x - 0.55, z: e.z }, r: 0.2 }, { c: { x: e.x + 0.55, z: e.z }, r: 0.2 });
  }
  // Dance floor — only when the couple enabled one, and NOT for a dance-destined
  // walk (which needs to reach it). Ordinary roam keeps the disc and rounds it.
  if (floor.dance.enabled && !opts.skipDanceFloor) {
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

// ── Booths + signs + cocktail room (whole-venue fixtures) ──────────────────
// The 2D editor also places vendor booths (event_floor_booths), wayfinding
// signs (event_floor_signs) and a second "cocktail / waiting" room on the same
// percent canvas. The 3D surfaces render these now; the walk-in crowd steers
// around the ones that occupy floor space, exactly like it does for tables and
// venue objects. All pure — unit-tested in lib.

/** The booked vendor running a booth — BUSINESS IDENTITY ONLY (never PII). Joined
 *  through event_floor_booths.event_vendor_id → event_vendors (+ vendor_profiles
 *  for the logo). `logoUrl` is already the server-resolved display URL (or null).
 *  Powers the booth vendor card's "who's here" block. */
export type BoothVendor = {
  name: string;
  category: string;
  logoUrl: string | null;
  /** The booked vendor's subscription tier (`vendor_profiles.tier_state`), or
   *  null. Only pro / enterprise booths brand their 3D booth with the vendor's
   *  logo (see boothCanBrand); free / verified / solo render the generic booth.
   *  Optional so an older cached scene payload (pre-tier) still parses. */
  tier?: string | null;
  /** Marketplace profile slug (`vendor_profiles.business_slug`) when the vendor
   *  has a PUBLICLY VISIBLE profile — powers the booth card's `/v/[slug]`
   *  profile CTA (owner-locked surface D: free for verified vendors). Null /
   *  absent → no CTA. Optional so older cached scene payloads still parse. */
  slug?: string | null;
  /** Whether the profile can take bookings (`public_visibility === 'verified'`
   *  — lib/vendor-visibility isBookable). Gates the booth card's "Book this
   *  vendor" wording: a coming_soon profile keeps its slug (the profile page
   *  is publicly visible) but must not invite a booking it can't take.
   *  Optional (older payloads → falsy → the conservative "view" wording). */
  bookable?: boolean;
};

/** One structured "what you get" line on the booth vendor card — a menu dish,
 *  a set-list song, a bar pour, or a package inclusion, per the booth
 *  template's `cardKind`. `worthPhp` renders the marketplace's "₱X free"
 *  value chip; null/absent = no stated worth. */
export type BoothCardItem = { label: string; worthPhp?: number | null };

/** Booth branding is a PRO / ENTERPRISE perk (owner-locked 2026-07-04): those
 *  tiers texture their logo onto the 3D booth; free / verified / solo stay
 *  generic. One gate, shared by every 3D surface's BoothMesh. */
export function boothCanBrand(tier: string | null | undefined): boolean {
  return tier === 'pro' || tier === 'enterprise';
}

/** A placed vendor booth (percent canvas). `kind` mirrors event_floor_booths.booth_type. */
export type Lab3DBooth = {
  id: string;
  kind: string;
  label: string;
  xPct: number;
  yPct: number;
  /** "What they're serving" line (event_floor_booths.offerings), or null. */
  offerings?: string | null;
  /** Booked booth vendor's public business identity, or null when unlinked. */
  vendor?: BoothVendor | null;
  /** Structured card lines (vendor-authored service inclusions / menu items),
   *  fetched server-side per surface via `fetchBoothCardItems`. Null / absent
   *  → the card shows the free-text offerings line only. */
  cardItems?: BoothCardItem[] | null;
};

/** A wayfinding sign (percent canvas). `rotationDeg` = the arrow heading. */
export type Lab3DSign = {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  rotationDeg: number;
};

/** The optional cocktail / waiting room — a second rectangle on the same canvas
 *  (centre + size in percent), sitting outside the reception walls. null when the
 *  couple never enabled one. */
export type Lab3DCocktail = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  label: string | null;
} | null;

// Booth footprint (metres) used for both the 3D mesh and the avoidance disc.
// Booths are ~2 m stations regardless of type — a single tasteful size keeps the
// low-poly render legible without a per-type dimension table.
export const BOOTH_FOOTPRINT_M = { w: 2.0, d: 1.0 } as const;

/** Human label for an event_floor_booths.booth_type — the booth card's "type"
 *  line. Mirrors the 2D editor's booth catalog; an unknown/custom type falls
 *  back to a title-cased slug so a future type still reads. Pure. */
const BOOTH_TYPE_LABELS: Record<string, string> = {
  photo_booth: 'Photo booth',
  mobile_bar: 'Mobile bar',
  dessert_station: 'Dessert station',
  gift_table: 'Gift table',
  souvenir_table: 'Souvenir table',
  registration_desk: 'Front desk',
  band: 'Band / stage',
  live_cooking: 'Live cooking',
  live_performance: 'Live performance',
  custom: 'Booth',
  unassigned: 'Booth',
};
export function boothTypeLabel(kind: string): string {
  return (
    BOOTH_TYPE_LABELS[kind] ??
    kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * A walk-up point + facing for "Walk to this booth": a spot just OUTSIDE the
 * booth's avoidance ring, on the bearing from the booth toward the room centre
 * (guests approach a perimeter booth from the room side, never from the wall),
 * facing back into the booth. Pure — the renderer steers to `point` then blends
 * the walker's facing toward `faceY`. When the booth sits dead-centre (no bearing
 * to the origin) it approaches from the entrance side (−z, "front of house").
 */
export function boothApproach(
  booth: { xPct: number; yPct: number },
  room: { w: number; d: number },
): { point: Vec2; faceY: number } {
  const c = pctToWorld(booth.xPct, booth.yPct, room);
  let dx = -c.x;
  let dz = -c.z;
  let len = Math.hypot(dx, dz);
  if (len < 1e-3) {
    dx = 0;
    dz = 1; // centre booth → stand on its +z (front-of-house) side
    len = 1;
  }
  const rr = Math.max(BOOTH_FOOTPRINT_M.w, BOOTH_FOOTPRINT_M.d) / 2 + 0.9;
  const point: Vec2 = { x: c.x + (dx / len) * rr, z: c.z + (dz / len) * rr };
  // Face from the approach point back toward the booth centre.
  const faceY = Math.atan2(c.x - point.x, c.z - point.z);
  return { point, faceY };
}

/**
 * The yaw (radians, three.js `group.rotation.y`) that turns a booth's FRONT
 * (default +z) to point at the room centre — the SAME bearing `boothApproach`
 * walks in from, so a booth faces the room and is approached from the room
 * side, back to its nearest wall. A group at `rotation.y = θ` maps local +z to
 * world (sinθ, cosθ); setting θ = atan2(−c.x, −c.z) sends the front toward the
 * origin. Dead-centre booth (no bearing to origin) → 0 (front-of-house +z),
 * matching `boothApproach`'s centre fallback. Pure; used directly as
 * `rotation.y` (no sign flip) and as the yaw for `rotateLocalRad` on every
 * booth-local offset (chassis discs, staff discs, hit box, branded sign).
 */
export function boothFacingY(
  booth: { xPct: number; yPct: number },
  room: { w: number; d: number },
): number {
  const c = pctToWorld(booth.xPct, booth.yPct, room);
  if (Math.hypot(c.x, c.z) < 1e-3) return 0; // dead-centre → +z front-of-house
  return Math.atan2(-c.x, -c.z);
}
// A sign is a slim post — a small clearance disc so walkers don't stand on it.
const SIGN_AVOID_R = 0.35;

/**
 * Avoidance discs for placed booths, so the crowd rounds the photo booth / bar
 * the same way it rounds a buffet. Merge into floorObstacles' output at the call
 * site (a guest never walks INTO a booth).
 */
export function boothObstacles(
  booths: Lab3DBooth[],
  room: { w: number; d: number },
): { c: Vec2; r: number }[] {
  return booths.map((b) => ({
    c: pctToWorld(b.xPct, b.yPct, room),
    r: Math.max(BOOTH_FOOTPRINT_M.w, BOOTH_FOOTPRINT_M.d) / 2 + 0.4,
  }));
}

/** Small avoidance discs for wayfinding signs (slim posts). */
export function signObstacles(
  signs: Lab3DSign[],
  room: { w: number; d: number },
): { c: Vec2; r: number }[] {
  return signs.map((s) => ({ c: pctToWorld(s.xPct, s.yPct, room), r: SIGN_AVOID_R }));
}

/**
 * Avoidance discs tracing the walls of the cocktail room, so a roaming walker in
 * the reception can't stroll through it. Approximates the rectangle's four wall
 * segments with a ring of overlapping discs (the crowd/steer primitives work in
 * discs, not rects) sized to the room's larger half-span so the interior stays
 * enclosed. Empty when there's no cocktail room.
 */
export function cocktailObstacles(
  cocktail: Lab3DCocktail,
  room: { w: number; d: number },
): { c: Vec2; r: number }[] {
  if (!cocktail) return [];
  const c = pctToWorld(cocktail.xPct, cocktail.yPct, room);
  const halfW = Math.max(0.5, (cocktail.wPct / 100) * room.w) / 2;
  const halfD = Math.max(0.5, (cocktail.hPct / 100) * room.d) / 2;
  // One disc per corner + one per wall midpoint, each ~0.5 m thick, so the
  // walker treats the room's perimeter as solid without blocking its interior.
  const wallR = 0.5;
  const pts: Vec2[] = [
    { x: c.x - halfW, z: c.z - halfD },
    { x: c.x + halfW, z: c.z - halfD },
    { x: c.x - halfW, z: c.z + halfD },
    { x: c.x + halfW, z: c.z + halfD },
    { x: c.x, z: c.z - halfD },
    { x: c.x, z: c.z + halfD },
    { x: c.x - halfW, z: c.z },
    { x: c.x + halfW, z: c.z },
  ];
  return pts.map((p) => ({ c: p, r: wallR }));
}

// ── Spatial hash (obstacle grid) ────────────────────────────────────────────
// With true footprints + chair discs a 15-table/150-guest room carries ~170
// obstacle discs; every per-frame primitive touching all of them for every
// agent is the phone budget's death by a thousand hypots. A tiny uniform grid
// (cell ~1.5 m — about one obstacle diameter) built per obstacle-set change
// gives O(nearby) queries instead. Discs are inserted into EVERY cell their
// bounding square overlaps, so a query only reads the cells around the point.

/** Grid cell edge, metres. ~one chair-cluster across: small enough that a
 * query's 3×3-ish neighbourhood stays cheap, big enough that bucket counts
 * don't balloon. */
export const OBSTACLE_GRID_CELL_M = 1.5;

/**
 * Discs wider than this stay OUT of the buckets and are checked directly on
 * every query instead. The point of the split: the fast paths add 2·maxR of
 * movement slack to their query reach, and one stage/dance bounding disc
 * (r ≈ 3–4 m via max(w,d)/2 + clearance) would drag maxR — and with it EVERY
 * per-frame query — up to a ~15 m scan square touching most of the room,
 * slower than the brute-force loop the grid replaced. Kept above the largest
 * catalog table disc (round-12 avoid ring 1.65 m) so all table footprints
 * stay gridded; a real room has only a handful of bigger discs (stage, dance
 * floor, an LED wall), and testing those few directly is cheaper than letting
 * them poison the reach. Big discs skip the distance filter entirely — always
 * candidates — so their interaction matches brute force exactly no matter how
 * far an expulsion moved the point.
 */
export const BIG_DISC_R = 1.75;

export type ObstacleGrid = {
  cellM: number;
  /** Largest GRIDDED disc radius (big discs excluded — see BIG_DISC_R) — the
   * movement slack the fast paths add to their query reach (an expulsion can
   * move a point up to ~one radius). */
  maxR: number;
  /** The full set, insertion order — the parity contract with brute force. */
  all: readonly ObstacleDisc[];
  /** Ascending indices of the oversized discs (r > BIG_DISC_R): never
   * bucketed, merged into every query unconditionally. */
  big: readonly number[];
  /** cell key `${ix},${iz}` → ascending indices into `all`. */
  buckets: ReadonlyMap<string, readonly number[]>;
};

/** Build the grid. Cheap enough (~170 discs → a few hundred bucket pushes) to
 * rebuild per frame when agents move, or per obstacle-set change when static. */
export function buildObstacleGrid(
  discs: readonly ObstacleDisc[],
  cellM = OBSTACLE_GRID_CELL_M,
): ObstacleGrid {
  const buckets = new Map<string, number[]>();
  const big: number[] = [];
  let maxR = 0;
  discs.forEach((d, i) => {
    if (d.r > BIG_DISC_R) {
      big.push(i);
      return;
    }
    maxR = Math.max(maxR, d.r);
    const x0 = Math.floor((d.c.x - d.r) / cellM);
    const x1 = Math.floor((d.c.x + d.r) / cellM);
    const z0 = Math.floor((d.c.z - d.r) / cellM);
    const z1 = Math.floor((d.c.z + d.r) / cellM);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const key = `${ix},${iz}`;
        const b = buckets.get(key);
        if (b) b.push(i);
        else buckets.set(key, [i]);
      }
    }
  });
  return { cellM, maxR, all: discs, big, buckets };
}

/**
 * The discs whose (radius + reachM) reaches `p` — i.e. everything that could
 * push/repel a point at `p` with `reachM` of slack — plus every oversized
 * disc (stage/dance class, r > BIG_DISC_R) unconditionally. Returned in
 * INSERTION order, so a fast-path consumer walks them in the exact sequence
 * brute force over `grid.all` would — that's what keeps grid results
 * bit-identical to the plain-array paths (the parity test's contract).
 */
export function obstaclesNear(grid: ObstacleGrid, p: Vec2, reachM = 0): ObstacleDisc[] {
  const x0 = Math.floor((p.x - reachM) / grid.cellM);
  const x1 = Math.floor((p.x + reachM) / grid.cellM);
  const z0 = Math.floor((p.z - reachM) / grid.cellM);
  const z1 = Math.floor((p.z + reachM) / grid.cellM);
  const seen = new Set<number>(grid.big);
  for (let ix = x0; ix <= x1; ix++) {
    for (let iz = z0; iz <= z1; iz++) {
      const b = grid.buckets.get(`${ix},${iz}`);
      if (b) for (const i of b) seen.add(i);
    }
  }
  const idx = [...seen].sort((a, b) => a - b);
  const out: ObstacleDisc[] = [];
  for (const i of idx) {
    const d = grid.all[i]!;
    // Big discs bypass the distance filter: their expulsions can move a point
    // further than the gridded movement slack budgets for, so they must stay
    // in the candidate list exactly as the brute-force walk would keep them.
    if (d.r > BIG_DISC_R || Math.hypot(p.x - d.c.x, p.z - d.c.z) < d.r + reachM + 1e-9) out.push(d);
  }
  return out;
}

/**
 * Push a point to the edge of any avoidance disc it sits inside (one pass over
 * the discs). `perp` is the escape heading for the degenerate case where the
 * point lands exactly on a disc centre (no radial direction to push along).
 * Pure — shared by steerPath's hard-clearance AND the per-frame crowd re-clamp,
 * so "don't cross objects" means the same thing for a precomputed path and a
 * live-walking avatar.
 *
 * Fast path: pass an ObstacleGrid instead of the array and only nearby discs
 * are visited. The query reach adds 2·maxR movement slack on top of `inflateR`
 * because each expulsion can move the point up to one disc radius, and the
 * chained disc must still be in the (fixed) candidate list — the same list
 * semantics the array walk has. maxR covers the GRIDDED discs only; the few
 * oversized stage/dance-class discs ride along unconditionally (see
 * BIG_DISC_R), so they can't balloon every query's scan square while their
 * own interaction stays exactly brute-force. `inflateR` inflates every disc at check time
 * (the body-radius pattern), so grid callers don't have to materialise an
 * inflated copy of the set; array callers may keep pre-inflating as before.
 */
export function pushOutOfDiscs(
  p: Vec2,
  discs: ObstacleDisc[] | ObstacleGrid,
  perp: Vec2 = { x: 1, z: 0 },
  inflateR = 0,
): Vec2 {
  const source = Array.isArray(discs)
    ? discs
    : obstaclesNear(discs, p, inflateR + 2 * discs.maxR);
  let x = p.x;
  let z = p.z;
  for (const d of source) {
    const rr = d.r + inflateR;
    const dx = x - d.c.x;
    const dz = z - d.c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < rr) {
      const ux = dist < 1e-3 ? perp.x : dx / dist;
      const uz = dist < 1e-3 ? perp.z : dz / dist;
      x = d.c.x + ux * rr;
      z = d.c.z + uz * rr;
    }
  }
  return { x, z };
}

/** Velocity a predictive crowd agent carries (m/s, world axes). Optional on
 * every agent — a plain Vec2 crowd falls back to the reactive-only v1. */
export type AgentVel = { x: number; z: number };

// Predictive-separation tuning. LOOKAHEAD projects each agent 0.4 s down its
// velocity — far enough to see a head-on conflict ~1.5 m out at walking speed,
// short enough that projections through the far side of a table don't panic
// unrelated agents. GAIN corrects only a fraction of the projected shortfall
// per frame (the crowd's one-relaxation-pass-per-frame philosophy: converge
// over frames, never teleport). RIGHT_BIAS rotates each agent's evasion toward
// its OWN right — pass-on-the-right reads naturally AND breaks the
// mutual-mirror deadlock two symmetric head-on walkers otherwise lock into.
const SEP_LOOKAHEAD_S = 0.4;
const SEP_PRED_GAIN = 0.35;
const SEP_RIGHT_BIAS = 0.9;
// Predictive-push frame normalisation: the push is applied once per FRAME, so
// without delta scaling the correction RATE rides the display refresh — the
// same head-on encounter sidesteps ~4× harder per second at 120 Hz than at a
// throttled 30 Hz. Callers that run per-frame pass their delta; it scales the
// predictive push against the 60 fps reference the gain was tuned at (capped
// so one long-stalled frame can't fire a single huge dodge). The REACTIVE
// overlap push stays unscaled — it's self-limiting (half the overlap) and is
// the hard no-overlap guarantee.
const SEP_REF_FRAME_S = 1 / 60;
const SEP_PRED_SCALE_MAX = 3;
// Agent count past which separateAgents culls pairs through a uniform grid
// instead of the full O(n²) sweep. Small casts (every unit test, the demo's
// walker + ≤8 remote movers) keep the plain loop — identical output, zero new
// machinery on the hot single-walker path.
const SEP_GRID_MIN_AGENTS = 32;

/**
 * "Make way for each other", v2. Two layers, one relaxation pass per frame
 * (the crowd loop calls it every frame, so it converges over time — never
 * resolves everything in a single tick). Returns NEW positions, input
 * untouched. Pure.
 *
 *  1. REACTIVE (v1, byte-identical): any two agents already closer than
 *     `minDist` are pushed apart by half their overlap each — the hard
 *     guarantee that a committed frame never overlaps.
 *  2. PREDICTIVE (new): agents carrying a `vel` are compared at positions
 *     projected SEP_LOOKAHEAD_S ahead; if the PROJECTED pair would come inside
 *     `minDist`, each gets a small steering push away from the conflict,
 *     biased toward its own RIGHT — so approaching walkers sidestep early and
 *     pass right-shifted instead of colliding into the reactive shove (or
 *     mirror-stalling forever on a shared line).
 *
 * The old signature keeps working: `vel` is optional, and a velocity-less pair
 * projects to where it already stands — reactive-only, exactly v1.
 *
 * `deltaS` (optional): the caller's frame delta, in seconds — scales the
 * PREDICTIVE push to a per-second correction rate (see SEP_REF_FRAME_S).
 * Omitted → 1.0, the pre-scaling behaviour every existing test pins.
 *
 * Big casts (≥ SEP_GRID_MIN_AGENTS — the populate-Play crowd) cull candidate
 * pairs through a uniform grid instead of the full O(n²) sweep: an agent's
 * interaction radius is minDist + |vel|·lookahead (its own half of the
 * reactive band + everything its projection can close), plus minDist of
 * combined slack for mid-pass drift, so every pair the sweep could push is
 * still visited — in the same ascending (i, j) order, on the same mutated
 * positions — and skipped pairs are exactly the sweep's no-ops. A 150-guest
 * room where only ~24 agents move drops from ~11k pair hypots per frame to
 * the walkers' local neighbourhoods.
 */
export function separateAgents(
  agents: readonly (Vec2 & { vel?: AgentVel })[],
  minDist: number,
  deltaS?: number,
): Vec2[] {
  const out = agents.map((a) => ({ x: a.x, z: a.z }));
  const predScale = deltaS == null ? 1 : Math.min(deltaS / SEP_REF_FRAME_S, SEP_PRED_SCALE_MAX);
  // Steering direction for one agent: the away-vector blended toward the
  // agent's own right (right of heading (sinθ,cosθ) is (cosθ,−sinθ), i.e.
  // (v.z,−v.x)/|v| — the same convention walkVector's strafe uses). A
  // stationary agent has no "right", so it evades straight away.
  const evade = (v: AgentVel | undefined, awayX: number, awayZ: number): Vec2 => {
    const speed = v ? Math.hypot(v.x, v.z) : 0;
    if (!v || speed < 1e-6) return { x: awayX, z: awayZ };
    const bx = awayX + SEP_RIGHT_BIAS * (v.z / speed);
    const bz = awayZ + SEP_RIGHT_BIAS * (-v.x / speed);
    const bl = Math.hypot(bx, bz) || 1;
    return { x: bx / bl, z: bz / bl };
  };
  const resolvePair = (i: number, j: number): void => {
    const dx = out[j]!.x - out[i]!.x;
    const dz = out[j]!.z - out[i]!.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) {
      // Exactly coincident — separate deterministically along x by index.
      out[i]!.x -= minDist / 2;
      out[j]!.x += minDist / 2;
      return;
    }
    if (dist < minDist) {
      // Reactive fallback — the same-frame overlap push, unchanged from v1.
      const push = (minDist - dist) / 2;
      const ux = dx / dist;
      const uz = dz / dist;
      out[i]!.x -= ux * push;
      out[i]!.z -= uz * push;
      out[j]!.x += ux * push;
      out[j]!.z += uz * push;
      return;
    }
    // Predictive: compare the pair 0.4 s ahead. Velocity-less agents project
    // in place, so a legacy Vec2 crowd never reaches the push below.
    const vi = agents[i]!.vel;
    const vj = agents[j]!.vel;
    if (!vi && !vj) return;
    const pdx = dx + ((vj?.x ?? 0) - (vi?.x ?? 0)) * SEP_LOOKAHEAD_S;
    const pdz = dz + ((vj?.z ?? 0) - (vi?.z ?? 0)) * SEP_LOOKAHEAD_S;
    const pdist = Math.hypot(pdx, pdz);
    if (pdist >= minDist) return;
    // Away axis at the PROJECTED conflict; if the projections collapse onto
    // each other, fall back to the current separation axis (never zero here).
    const ux = pdist > 1e-6 ? pdx / pdist : dx / dist;
    const uz = pdist > 1e-6 ? pdz / pdist : dz / dist;
    const push = ((minDist - pdist) / 2) * SEP_PRED_GAIN * predScale;
    const di = evade(vi, -ux, -uz);
    const dj = evade(vj, ux, uz);
    out[i]!.x += di.x * push;
    out[i]!.z += di.z * push;
    out[j]!.x += dj.x * push;
    out[j]!.z += dj.z * push;
  };
  if (agents.length < SEP_GRID_MIN_AGENTS) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) resolvePair(i, j);
    }
    return out;
  }
  // Grid cull. Insert each agent into every cell its interaction square
  // overlaps; a pair whose radii sum reaches across then always co-buckets
  // (their squares overlap, and both cover every cell of the intersection).
  const cellM = Math.max(1, minDist * 2);
  const reach = (i: number): number => {
    const v = agents[i]!.vel;
    return minDist + (v ? Math.hypot(v.x, v.z) * SEP_LOOKAHEAD_S : 0);
  };
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]!;
    const r = reach(i);
    const x0 = Math.floor((a.x - r) / cellM);
    const x1 = Math.floor((a.x + r) / cellM);
    const z0 = Math.floor((a.z - r) / cellM);
    const z1 = Math.floor((a.z + r) / cellM);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const key = `${ix},${iz}`;
        const b = buckets.get(key);
        if (b) b.push(i);
        else buckets.set(key, [i]);
      }
    }
  }
  const seen = new Set<number>();
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]!;
    const r = reach(i);
    const x0 = Math.floor((a.x - r) / cellM);
    const x1 = Math.floor((a.x + r) / cellM);
    const z0 = Math.floor((a.z - r) / cellM);
    const z1 = Math.floor((a.z + r) / cellM);
    seen.clear();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const b = buckets.get(`${ix},${iz}`);
        if (b) for (const j of b) if (j > i) seen.add(j);
      }
    }
    // Ascending j order — the exact sequence the O(n²) sweep resolves in.
    const js = [...seen].sort((x, y) => x - y);
    for (const j of js) resolvePair(i, j);
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
 * Where the first-person walk camera DROPS IN when Walk around starts. The
 * orbit camera's maxDistance rides room depth, so it can sit 15–30 m OUTSIDE
 * the venue — naively spawning at its x/z put the walker in the black void
 * with the room reading as a thin band. Rules, in order:
 *   - camera already inside the room rectangle (small 0.4 m inset, so "inside"
 *     means properly inside rather than straddling a wall) → keep its x/z:
 *     the original drop-in-where-you-are feel is preserved;
 *   - camera inside the rectangle but within the 0.4 m near-wall band (or
 *     exactly on a wall) → still YOUR spot: clamp it 0.8 m off the wall.
 *     The entrance jump is reserved for cameras genuinely OUTSIDE the room —
 *     a strictly-inside camera must never cross-room teleport to the doorway;
 *   - outside with an entrance → stand ~1.5 m inside the doorway, stepping
 *     from the entrance point toward the room centre (the entrance sits on
 *     the room edge, so "toward (0,0)" always points inward) — clear of the
 *     two r 0.2 doorway-post discs at ±0.55 m local X;
 *   - outside with no entrance → clamp the camera's x/z into the rectangle
 *     with a 0.8 m wall margin.
 * Every branch finishes through pushOutOfDiscs so the spawn can never sit
 * inside a table / booth / stage disc — and if that radial expulsion would
 * eject the spawn THROUGH a wall (a dance-floor/buffet disc overlapping the
 * doorway or a wall-adjacent table), the offending discs are re-expelled
 * toward the room centre instead, then the result is clamped into the
 * rectangle: the spawn is always inside the room, the exact void bug this
 * function exists to fix. Margins are floored at 0 so a degenerate (tiny)
 * room clamps to its centre instead of inverting the bounds.
 */
export function walkSpawnPoint(
  cam: Vec2,
  room: { w: number; d: number },
  entrance: Vec2 | null,
  obstacles: ObstacleDisc[] | ObstacleGrid,
): Vec2 {
  const hw = room.w / 2;
  const hd = room.d / 2;
  let p: Vec2;
  const insideRect = Math.abs(cam.x) <= hw && Math.abs(cam.z) <= hd;
  if (Math.abs(cam.x) <= Math.max(0, hw - 0.4) && Math.abs(cam.z) <= Math.max(0, hd - 0.4)) {
    // Inside: keep the spot as-is (no wall clamp — the inset already vouches
    // for it); only the disc expulsion below may still move it.
    p = { x: cam.x, z: cam.z };
  } else {
    if (entrance && !insideRect) {
      // Genuinely outside → doorway spawn. (A camera inside the rectangle but
      // within the 0.4 m band falls through to the clamp: keep-your-spot,
      // nudged ≤ 0.8 m off the wall — never a jump to the opposite doorway.)
      // Unit vector entrance → room centre. A centred (degenerate) entrance
      // has no direction — fall back to −z, the doorway's usual inward facing.
      const len = Math.hypot(entrance.x, entrance.z);
      const ux = len < 1e-6 ? 0 : -entrance.x / len;
      const uz = len < 1e-6 ? -1 : -entrance.z / len;
      p = { x: entrance.x + ux * 1.5, z: entrance.z + uz * 1.5 };
    } else {
      p = { x: cam.x, z: cam.z };
    }
    // Clamp into the rectangle with a wall margin — covers the no-entrance
    // fallback AND the entrance step overshooting the centre of a tiny room.
    const mx = Math.max(0, hw - 0.8);
    const mz = Math.max(0, hd - 0.8);
    p = { x: Math.max(-mx, Math.min(mx, p.x)), z: Math.max(-mz, Math.min(mz, p.z)) };
  }
  const q = pushOutOfDiscs(p, obstacles);
  // In-room guarantee: the radial expulsion above can eject the spawn through
  // a wall when the containing disc overlaps one (doorway dance floor, wall-
  // adjacent table). Detect it and redo the expulsion with an interior bias.
  const mx = Math.max(0, hw - 0.4);
  const mz = Math.max(0, hd - 0.4);
  if (Math.abs(q.x) <= mx + 1e-9 && Math.abs(q.z) <= mz + 1e-9) return q;
  // Re-expel each containing disc toward the room centre (from the disc's
  // centre toward (0,0), one radius out) — obstacle centres live in the room,
  // so the exit lands room-side of the disc instead of through the wall. The
  // 3·maxR reach keeps chained discs in the candidate list across the larger
  // interior jump (radial expulsion budgets 2·maxR). Final clamp is the hard
  // never-in-the-void guarantee for degenerate layouts (disc at the origin,
  // disc wider than the room).
  const source = Array.isArray(obstacles)
    ? obstacles
    : obstaclesNear(obstacles, p, 3 * obstacles.maxR);
  let x = p.x;
  let z = p.z;
  for (const d of source) {
    if (Math.hypot(x - d.c.x, z - d.c.z) >= d.r - 1e-9) continue;
    const len = Math.hypot(d.c.x, d.c.z);
    if (len < 1e-6) continue; // disc at the room centre: no inward direction — leave to the clamp
    const k = 1 - d.r / len;
    x = d.c.x * k;
    z = d.c.z * k;
  }
  return { x: Math.max(-mx, Math.min(mx, x)), z: Math.max(-mz, Math.min(mz, z)) };
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
  tables: ObstacleDisc[] | ObstacleGrid,
  skipR = 0,
): Vec2[] {
  // Grid fast path: query only the discs near each sample point. The reach
  // carries skipR (the repulsion trigger is dist < r + skipR) plus 2·maxR of
  // movement slack, so a point pushed mid-pass still sees the disc it lands
  // in — keeping grid results identical to the brute-force array walk.
  const nearReach = Array.isArray(tables) ? 0 : skipR + 2 * tables.maxR;
  const discsAt = (p: Vec2): readonly ObstacleDisc[] =>
    Array.isArray(tables) ? tables : obstaclesNear(tables, p, nearReach);
  // Denser sampling (was 22) keeps waypoints close together so the straight
  // CHORD a walker interpolates between two disc-edge-clamped waypoints barely
  // dips into the disc — the visible "walking through the table" artefact.
  // Strictly smoother for every caller (couple lab, guest venue, 3D demo);
  // same endpoints, same clamp logic, just finer.
  const STEPS = 40;
  const pts: Vec2[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    pts.push({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t });
  }
  // Two relaxation passes of repulsion on interior points.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      for (const tb of discsAt(pts[i]!)) {
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
  // skipR rides through pushOutOfDiscs' inflateR (same math as pre-inflating
  // a copied array, without materialising one — the grid stays usable as-is).
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      out[i] = pushOutOfDiscs(out[i]!, tables, perp, skipR);
    }
  }
  return out;
}

/**
 * Full "walk up to my seat" path. A person walks AROUND their own table and sits
 * from the outside — they never cross the tabletop. The naive approach was to
 * drop the destination table from the obstacle set so the walker "could reach
 * its chair", but that let the straight line from the entrance cut clean across
 * the tabletop whenever the seat sat on the far side (owner 2026-07-03: "still
 * walks through the table not around it").
 *
 * The fix routes in TWO legs:
 *   1. Steer from `start` around EVERY table — the destination included — to an
 *      approach point just OUTSIDE the destination table's avoidance ring, on the
 *      chair's bearing (the direction from the table centre out through the seat).
 *   2. Step straight in from that approach point to the chair. Both points lie on
 *      the outward radial, so this final leg never re-enters the footprint.
 *
 * `obstacles` MUST be the FULL set with the destination table PRESENT — build it
 * with `floorObstacles(floor, tables, room, [])`. Pure; unit-tested.
 */
export function seatApproachPath(
  start: Vec2,
  table: Lab3DTable,
  seatNumber: number,
  room: { w: number; d: number },
  obstacles: ObstacleDisc[] | ObstacleGrid,
  skipR = 0,
): Vec2[] {
  const centre = pctToWorld(table.xPct, table.yPct, room);
  const chair = seatWorld(table, seatNumber, room);
  let dx = chair.x - centre.x;
  let dz = chair.z - centre.z;
  let len = Math.hypot(dx, dz);
  if (len < 1e-3) {
    // Degenerate: the seat resolves to the table centre (e.g. a 1-seat
    // sweetheart at origin) — approach along the incoming heading instead.
    dx = centre.x - start.x;
    dz = centre.z - start.z;
    len = Math.hypot(dx, dz) || 1;
  }
  // Approach point sits just beyond the table's avoidance ring, so leg 1 ends
  // clear of the footprint and leg 2 is a clean radial step-in to the chair.
  const rr = tableAvoidR(table) + skipR + 0.35;
  const approach: Vec2 = { x: centre.x + (dx / len) * rr, z: centre.z + (dz / len) * rr };
  const leg = steerPath(start, approach, obstacles, skipR);
  leg.push(chair);
  return leg;
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

/**
 * Map `events.role_palette` (the couple's mood-board palette) to scene materials.
 * Reception colors drive venue surfaces: [0]=accent/stage, [1]=table linen,
 * [2]=floor, [3]=backdrop wall. Falls back to resolvePalette([]) when unset.
 *
 * TAXONOMY v2: the couple's optional room-dressing OVERRIDES (linens/lighting)
 * are applied on top of the reception-derived surfaces — linen → the table
 * material, lighting warmth → the ambient wash. Applied surgically so a palette
 * with NO `room_dressing` override returns the exact pre-taxonomy result.
 */
export function resolvePaletteFromRoles(rp: RolePalette): Lab3DPalette {
  const r = (rp.reception ?? []).filter((h): h is string => HEX.test(h));
  const base: Lab3DPalette =
    r.length === 0
      ? resolvePalette([])
      : {
          accent:  r[0] ?? '#c89b6c',
          table:   r[1] ?? '#f3efe9',
          floor:   r[2] ?? '#e7e1d8',
          wall:    r[3] ?? '#d8cfc2',
          ambient: r[0] ?? '#fbe9d8',
        };
  const rd = rp.room_dressing;
  if (!rd) return base;
  return {
    ...base,
    table:   rd.linens ?? base.table,
    ambient: rd.lighting_warmth ?? base.ambient,
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
