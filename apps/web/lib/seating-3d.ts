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

export type ShapeHint = 'round' | 'long_banquet' | 'family_head' | 'sweetheart' | 'serpentine';

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

export type Lab3DGuest = {
  id: string;
  name: string;
  seatedTableId: string | null;
  seatNumber: number | null;
  tier: 1 | 2 | 3 | 4;
  rsvp: RsvpStatus;
  side: 'bride' | 'groom' | 'both';
  /** Couple allowed this guest a +1 (a held seat beside them). */
  plusOneAllowed: boolean;
  /** When this row IS someone's +1, the primary guest's id (else null). */
  plusOneOfGuestId: string | null;
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

/** Default room footprint (metres) when no venue size is set. */
export const DEFAULT_ROOM = { w: 18, d: 12 } as const;

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

/** percent (0–100, origin top-left) → centred world metres (origin room centre). */
export function pctToWorld(xPct: number, yPct: number, room: { w: number; d: number }): Vec2 {
  return {
    x: (xPct / 100 - 0.5) * room.w,
    z: (yPct / 100 - 0.5) * room.d,
  };
}

/** Tabletop footprint (metres) per shape. Mirrors the 2D TABLE_FOOTPRINT_M shape, kept lean. */
export function tableDims(shape: ShapeHint, capacity: number): { w: number; d: number; round: boolean } {
  switch (shape) {
    case 'round':
      return { w: capacity >= 12 ? 1.7 : capacity >= 10 ? 1.5 : 1.3, d: 0, round: true };
    case 'sweetheart':
      return { w: 1.1, d: 0.6, round: false };
    case 'serpentine':
      return { w: 1.6, d: 0.7, round: false };
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
  if (shape === 'round' || shape === 'serpentine') {
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
