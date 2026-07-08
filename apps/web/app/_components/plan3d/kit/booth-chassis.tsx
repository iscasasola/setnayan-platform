'use client';

/**
 * kit/booth-chassis — the 9 shared booth CHASSIS of the 3D-Plan booth-template
 * kit (owner-locked catalog: `0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`
 * — "9 shared chassis × per-category prop kits × staff mascot × signage").
 * A chassis is a booth's mascot-smooth BODY: COUNTER · STATION · RISER ·
 * BACKDROP · DESK · DISPLAY · VEHICLE · CHAIR_STATION · GARDEN. Templates
 * (kit/booth-templates.ts) pick one and layer category props + staff on top.
 *
 * MASCOT-SMOOTH art direction (owner-locked for everything, 2026-07-08):
 * every box is a filleted RoundedBoxGeometry (three's examples build — part
 * of the installed three package, no new dep), every profile a high-segment
 * lathe, and the body cloth/wood takes the kit's soft 0.45-roughness sheen
 * (kit/outfits skinMaterial precedent). No hard edges anywhere.
 *
 * BUDGET DISCIPLINE: all geometry is MODULE-SCOPE shared buffers (the kit /
 * GOWN_GEO precedent — R3F never disposes module constants); materials come
 * from keyed caches bounded by the palette, so a floor of 12 booths shares a
 * handful of GPU programs. Each chassis stays ≤ 8 meshes.
 *
 * COORDINATES: booth-local, origin at the floor centre of the booth's
 * footprint, FRONT toward +z (the room side — the shared BoothSign backdrop
 * already sits at −z). Each chassis exports, via CHASSIS_SPECS:
 *   · its footprint + local avoidance DISCS (the slice-3 obstacle system —
 *     kit/booth-templates.ts places them into world space);
 *   · a SIGN anchor (where the vendor sign/backdrop group mounts);
 *   · STAFF anchor point(s) (+ facing) where the mascot figure(s) stand.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lab3DPalette } from '@/lib/seating-3d';
import { plainMaterial } from './outfits';

// ─────────────────────────────────────────────────────────────────────────────
// Kinds + specs
// ─────────────────────────────────────────────────────────────────────────────

export type BoothChassisKind =
  | 'COUNTER'
  | 'STATION'
  | 'RISER'
  | 'BACKDROP'
  | 'DESK'
  | 'DISPLAY'
  | 'VEHICLE'
  | 'CHAIR_STATION'
  | 'GARDEN';

/** A booth-local avoidance disc (metres, origin = booth centre). */
export type LocalDisc = { x: number; z: number; r: number };

/** Where a staff mascot stands, booth-local. `faceY` is the figure's heading
 *  (rotation.y — 0 faces +z, the room). `y` lifts riser performers. */
export type StaffAnchor = { x: number; z: number; y?: number; faceY: number };

export type ChassisSpec = {
  /** Footprint (metres) — drives the template's tap-target sizing intuition
   *  and documents the visual span; obstacles come from `discs`. */
  w: number;
  d: number;
  /** Local avoidance discs — the slice-3 obstacle contract. Radii include
   *  the same ~0.4 m walking clearance boothObstacles has always added. */
  discs: readonly LocalDisc[];
  /** Local mount point for the sign/backdrop group (BoothSign reuse). */
  signAnchor: readonly [number, number, number];
  /** Staff spots in priority order — a template's `staff.count` takes the
   *  first N (≤ 3 per the catalog's multi-figure cap). */
  staffAnchors: readonly StaffAnchor[];
};

/**
 * The 9 chassis specs. Footprints stay in the family of the shared
 * BOOTH_FOOTPRINT_M (2×1 m) so the scene's existing oversized tap-target box
 * still covers every chassis; only the wider bodies (VEHICLE / BACKDROP /
 * GARDEN) add a second disc to keep their ends solid.
 */
export const CHASSIS_SPECS: Record<BoothChassisKind, ChassisSpec> = {
  COUNTER: {
    w: 2.0,
    d: 1.0,
    discs: [{ x: 0, z: 0, r: 1.4 }],
    signAnchor: [0, 0, 0],
    staffAnchors: [{ x: 0, z: -0.62, faceY: 0 }],
  },
  STATION: {
    w: 2.0,
    d: 1.1,
    discs: [{ x: 0, z: 0, r: 1.4 }],
    signAnchor: [0, 0, 0],
    staffAnchors: [
      { x: 0.15, z: -0.62, faceY: 0 },
      { x: -0.7, z: -0.55, faceY: 0.35 },
    ],
  },
  RISER: {
    w: 2.4,
    d: 2.0,
    discs: [{ x: 0, z: 0, r: 1.6 }],
    signAnchor: [0, 0, -0.35],
    // Performers stand ON the platform (y = deck height), facing the room.
    staffAnchors: [
      { x: 0, z: 0.15, y: 0.18, faceY: 0 },
      { x: -0.72, z: -0.32, y: 0.18, faceY: 0.2 },
      { x: 0.72, z: -0.32, y: 0.18, faceY: -0.2 },
    ],
  },
  BACKDROP: {
    w: 2.4,
    d: 1.8,
    discs: [
      { x: -0.6, z: -0.5, r: 1.0 },
      { x: 0.6, z: -0.5, r: 1.0 },
    ],
    // Lifted above the 2.24 m frame — at the default hang height the board
    // would hide behind the backdrop panel itself.
    signAnchor: [0, 0.85, 0.35],
    staffAnchors: [{ x: 0.95, z: 0.45, faceY: -0.7 }],
  },
  DESK: {
    w: 1.8,
    d: 1.0,
    discs: [{ x: 0, z: 0, r: 1.3 }],
    signAnchor: [0, 0, 0],
    staffAnchors: [{ x: 0, z: -0.55, faceY: 0 }],
  },
  DISPLAY: {
    w: 2.0,
    d: 0.9,
    discs: [{ x: 0, z: 0, r: 1.35 }],
    signAnchor: [0, 0, 0],
    staffAnchors: [{ x: 0.85, z: 0.3, faceY: -0.6 }],
  },
  VEHICLE: {
    w: 2.6,
    d: 1.3,
    discs: [
      { x: -0.65, z: 0, r: 1.1 },
      { x: 0.65, z: 0, r: 1.1 },
    ],
    signAnchor: [0, 0, -0.1],
    staffAnchors: [{ x: 0.35, z: 0.75, faceY: 0 }],
  },
  CHAIR_STATION: {
    w: 2.0,
    d: 1.2,
    discs: [{ x: 0, z: 0, r: 1.4 }],
    signAnchor: [0, 0, 0],
    staffAnchors: [{ x: 0.55, z: 0.35, faceY: -0.9 }],
  },
  GARDEN: {
    w: 2.2,
    d: 1.4,
    discs: [
      { x: -0.5, z: 0, r: 1.05 },
      { x: 0.5, z: 0, r: 1.05 },
    ],
    signAnchor: [0, 0, -0.2],
    // Clear of the x=±0.85 planters — the florist stands in the pergola gap.
    staffAnchors: [{ x: 0.3, z: 0.55, faceY: -0.35 }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared geometry (module scope — one GPU buffer each, mascot-smooth fillets)
// ─────────────────────────────────────────────────────────────────────────────

/** Build a closed high-segment lathe from (radius, y) profile points — the
 *  outfits.ts latheProfile shape, re-declared here to keep that module's
 *  export surface untouched. */
function lathe(points: ReadonlyArray<readonly [number, number]>, segments = 32): THREE.LatheGeometry {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  const last = points[points.length - 1]!;
  pts.push(new THREE.Vector2(0.001, last[1]));
  return new THREE.LatheGeometry(pts, segments);
}

// COUNTER — body slab, thicker top, canopy roof + posts, low back shelf.
const COUNTER_BODY_GEO = new RoundedBoxGeometry(1.8, 1.0, 0.62, 4, 0.07);
const COUNTER_TOP_GEO = new RoundedBoxGeometry(1.96, 0.09, 0.76, 4, 0.045);
const CANOPY_GEO = new RoundedBoxGeometry(2.05, 0.1, 0.95, 4, 0.05);
const CANOPY_POST_GEO = new THREE.CapsuleGeometry(0.035, 1.05, 6, 14);
const BACK_SHELF_GEO = new RoundedBoxGeometry(1.7, 0.06, 0.28, 3, 0.03);

// STATION — a work table: filleted top slab + two rounded pedestal legs.
const STATION_TOP_GEO = new RoundedBoxGeometry(1.7, 0.1, 0.92, 4, 0.05);
const STATION_LEG_GEO = new RoundedBoxGeometry(0.34, 0.82, 0.7, 4, 0.06);

// RISER — a drum platform: a properly-capped cylinder (lathe caps on a huge
// flat deck z-fight/shade badly) with a torus rim carrying the mascot fillet.
const RISER_BODY_GEO = new THREE.CylinderGeometry(1.08, 1.1, 0.17, 48);
const RISER_RIM_GEO = new THREE.TorusGeometry(1.045, 0.035, 12, 48);

// BACKDROP — two posts + top bar + the frame panel.
const FRAME_POST_GEO = new THREE.CapsuleGeometry(0.05, 2.15, 6, 14);
const FRAME_BAR_GEO = new THREE.CapsuleGeometry(0.05, 2.1, 6, 14);
const BACKDROP_PANEL_GEO = new RoundedBoxGeometry(2.1, 2.0, 0.08, 4, 0.04);
const FLOOR_ZONE_GEO = new THREE.CylinderGeometry(1.05, 1.05, 0.035, 40);

// DESK — welcome table + a display board on two short posts.
const DESK_TOP_GEO = new RoundedBoxGeometry(1.5, 0.08, 0.72, 4, 0.04);
const DESK_BODY_GEO = new RoundedBoxGeometry(1.4, 0.68, 0.62, 4, 0.06);
const BOARD_GEO = new RoundedBoxGeometry(1.3, 0.85, 0.07, 4, 0.035);
const BOARD_POST_GEO = new THREE.CapsuleGeometry(0.03, 1.45, 6, 12);

// DISPLAY — vitrine: plinth + back panel + two floating shelves.
const DISPLAY_PLINTH_GEO = new RoundedBoxGeometry(1.9, 0.32, 0.8, 4, 0.06);
const DISPLAY_BACK_GEO = new RoundedBoxGeometry(1.9, 1.85, 0.1, 4, 0.05);
const DISPLAY_SHELF_GEO = new RoundedBoxGeometry(1.7, 0.055, 0.36, 3, 0.027);

// VEHICLE — mascot-proportioned body + cab + puffy wheels + a serving hatch.
const VEHICLE_BODY_GEO = new RoundedBoxGeometry(2.3, 1.15, 1.15, 5, 0.16);
const VEHICLE_CAB_GEO = new RoundedBoxGeometry(0.8, 0.62, 1.02, 5, 0.14);
const WHEEL_GEO = new THREE.TorusGeometry(0.18, 0.1, 14, 24);
const HATCH_GEO = new RoundedBoxGeometry(1.05, 0.6, 0.08, 4, 0.04);

// CHAIR_STATION — service chair (seat + back + pedestal) + a tool cart.
const SEAT_GEO = new RoundedBoxGeometry(0.52, 0.14, 0.5, 4, 0.06);
const SEATBACK_GEO = new RoundedBoxGeometry(0.5, 0.62, 0.12, 4, 0.055);
const PEDESTAL_GEO = lathe(
  [
    [0.06, 0.5],
    [0.07, 0.12],
    [0.26, 0.04],
    [0.28, 0.0],
  ],
  28,
);
const CART_GEO = new RoundedBoxGeometry(0.6, 0.78, 0.42, 4, 0.06);
const CART_TRAY_GEO = new RoundedBoxGeometry(0.66, 0.05, 0.48, 3, 0.025);

// GARDEN — pergola posts + beam, foliage puffs + planter boxes.
const PERGOLA_POST_GEO = new THREE.CapsuleGeometry(0.045, 1.9, 6, 14);
const PERGOLA_BEAM_GEO = new THREE.CapsuleGeometry(0.045, 1.9, 6, 14);
const FOLIAGE_GEO = new THREE.SphereGeometry(0.34, 20, 16);
const PLANTER_GEO = new RoundedBoxGeometry(0.55, 0.34, 0.4, 4, 0.05);

// ─────────────────────────────────────────────────────────────────────────────
// Materials (keyed module caches — palette-aware, mascot sheen)
// ─────────────────────────────────────────────────────────────────────────────

const sheenMats = new Map<string, THREE.MeshStandardMaterial>();

/** Mascot-smooth body material: the kit's soft 0.45-roughness sheen (the
 *  skinMaterial precedent) so booth bodies pick up the vinyl-figure polish
 *  from the env light. Cached per colour. */
export function boothSheenMaterial(color: string): THREE.MeshStandardMaterial {
  let m = sheenMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    sheenMats.set(color, m);
  }
  return m;
}

const metalMats = new Map<string, THREE.MeshStandardMaterial>();

/** Soft metal for posts / rails / trims — polished but not mirror. */
export function boothMetalMaterial(color: string): THREE.MeshStandardMaterial {
  let m = metalMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.65 });
    metalMats.set(color, m);
  }
  return m;
}

// Fixed prop-true tones (the venue-objects BOOTH_* precedent — a chrome
// espresso machine recoloured to the wedding motif reads WRONG).
export const KIT_CHROME = '#b9bec7';
export const KIT_DARK = '#2a2c30';
export const KIT_WOOD = '#8a6a4c';
export const KIT_CREAM = '#f4efe4';
export const KIT_GREEN = '#6f9b6a';

// ─────────────────────────────────────────────────────────────────────────────
// The chassis renderers
// ─────────────────────────────────────────────────────────────────────────────

function CounterChassis({ palette }: { palette: Lab3DPalette }) {
  const body = boothSheenMaterial(palette.table);
  const top = boothMetalMaterial(palette.accent);
  const canopy = boothSheenMaterial(palette.accent);
  const post = boothMetalMaterial(KIT_CHROME);
  const shelf = boothSheenMaterial(KIT_WOOD);
  return (
    <group>
      <mesh geometry={COUNTER_BODY_GEO} material={body} position={[0, 0.5, 0.15]} castShadow receiveShadow />
      <mesh geometry={COUNTER_TOP_GEO} material={top} position={[0, 1.03, 0.15]} castShadow />
      {[-0.92, 0.92].map((x) => (
        <mesh key={x} geometry={CANOPY_POST_GEO} material={post} position={[x, 1.55, 0.15]} castShadow />
      ))}
      <mesh geometry={CANOPY_GEO} material={canopy} position={[0, 2.12, 0.05]} castShadow />
      <mesh geometry={BACK_SHELF_GEO} material={shelf} position={[0, 1.28, -0.42]} castShadow />
    </group>
  );
}

function StationChassis({ palette }: { palette: Lab3DPalette }) {
  const top = boothMetalMaterial(KIT_CHROME);
  const leg = boothSheenMaterial(palette.table);
  return (
    <group>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} geometry={STATION_LEG_GEO} material={leg} position={[x, 0.41, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={STATION_TOP_GEO} material={top} position={[0, 0.88, 0]} castShadow />
    </group>
  );
}

function RiserChassis({ palette }: { palette: Lab3DPalette }) {
  const body = boothSheenMaterial(palette.accent);
  return (
    <group>
      {/* Bottom floats 5 mm off the floor so the caps never z-fight it. */}
      <mesh geometry={RISER_BODY_GEO} material={body} position={[0, 0.09, 0]} castShadow receiveShadow />
      <mesh geometry={RISER_RIM_GEO} material={body} position={[0, 0.172, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
    </group>
  );
}

function BackdropChassis({ palette }: { palette: Lab3DPalette }) {
  const post = boothMetalMaterial(palette.accent);
  const panel = boothSheenMaterial(palette.table);
  const zone = boothSheenMaterial(palette.accent);
  return (
    <group>
      {[-1.08, 1.08].map((x) => (
        <mesh key={x} geometry={FRAME_POST_GEO} material={post} position={[x, 1.12, -0.6]} castShadow />
      ))}
      <mesh geometry={FRAME_BAR_GEO} material={post} position={[0, 2.22, -0.6]} rotation={[0, 0, Math.PI / 2]} castShadow />
      <mesh geometry={BACKDROP_PANEL_GEO} material={panel} position={[0, 1.12, -0.68]} castShadow />
      {/* The floor zone the activity owns (photo spot / dance mark). */}
      <mesh geometry={FLOOR_ZONE_GEO} material={zone} position={[0, 0.018, 0.25]} receiveShadow />
    </group>
  );
}

function DeskChassis({ palette }: { palette: Lab3DPalette }) {
  const body = boothSheenMaterial(palette.table);
  const top = boothSheenMaterial(KIT_WOOD);
  const post = boothMetalMaterial(KIT_CHROME);
  const board = boothSheenMaterial(KIT_CREAM);
  return (
    <group>
      <mesh geometry={DESK_BODY_GEO} material={body} position={[0, 0.36, 0.1]} castShadow receiveShadow />
      <mesh geometry={DESK_TOP_GEO} material={top} position={[0, 0.74, 0.1]} castShadow />
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} geometry={BOARD_POST_GEO} material={post} position={[x, 0.85, -0.42]} castShadow />
      ))}
      <mesh geometry={BOARD_GEO} material={board} position={[0, 1.45, -0.42]} castShadow />
    </group>
  );
}

function DisplayChassis({ palette }: { palette: Lab3DPalette }) {
  const plinth = boothSheenMaterial(palette.table);
  const back = boothSheenMaterial(palette.wall);
  const shelf = boothSheenMaterial(KIT_WOOD);
  return (
    <group>
      <mesh geometry={DISPLAY_PLINTH_GEO} material={plinth} position={[0, 0.16, 0]} castShadow receiveShadow />
      <mesh geometry={DISPLAY_BACK_GEO} material={back} position={[0, 1.24, -0.34]} castShadow />
      <mesh geometry={DISPLAY_SHELF_GEO} material={shelf} position={[0, 0.95, -0.12]} castShadow />
      <mesh geometry={DISPLAY_SHELF_GEO} material={shelf} position={[0, 1.5, -0.12]} castShadow />
    </group>
  );
}

function VehicleChassis({ palette }: { palette: Lab3DPalette }) {
  const body = boothSheenMaterial(palette.accent);
  const cab = boothSheenMaterial(KIT_CREAM);
  const wheel = boothSheenMaterial(KIT_DARK);
  const hatch = boothSheenMaterial('#fffdf6');
  return (
    <group>
      <mesh geometry={VEHICLE_BODY_GEO} material={body} position={[0.15, 0.72, 0]} castShadow receiveShadow />
      <mesh geometry={VEHICLE_CAB_GEO} material={cab} position={[-1.0, 0.72, 0]} castShadow />
      {/* Puffy torus wheels — mascot proportions, rolled onto their sides. */}
      {[
        [-0.95, 0.55] as const,
        [-0.95, -0.55] as const,
        [0.75, 0.55] as const,
        [0.75, -0.55] as const,
      ].map(([x, z]) => (
        <mesh key={`${x}|${z}`} geometry={WHEEL_GEO} material={wheel} position={[x, 0.26, z]} castShadow />
      ))}
      {/* The serving hatch on the room side — templates hang the awning here. */}
      <mesh geometry={HATCH_GEO} material={hatch} position={[0.35, 1.0, 0.56]} />
    </group>
  );
}

function ChairStationChassis({ palette }: { palette: Lab3DPalette }) {
  const cushion = boothSheenMaterial(palette.accent);
  const frame = boothMetalMaterial(KIT_CHROME);
  const cart = boothSheenMaterial(palette.table);
  const tray = boothSheenMaterial(KIT_WOOD);
  return (
    <group>
      {/* The service chair, angled to face the mirror/cart side. */}
      <group position={[-0.25, 0, 0.15]} rotation={[0, -0.5, 0]}>
        <mesh geometry={PEDESTAL_GEO} material={frame} castShadow />
        <mesh geometry={SEAT_GEO} material={cushion} position={[0, 0.56, 0]} castShadow />
        <mesh geometry={SEATBACK_GEO} material={cushion} position={[0, 0.94, -0.21]} castShadow />
      </group>
      {/* The tool cart. */}
      <group position={[0.62, 0, -0.35]}>
        <mesh geometry={CART_GEO} material={cart} position={[0, 0.39, 0]} castShadow receiveShadow />
        <mesh geometry={CART_TRAY_GEO} material={tray} position={[0, 0.81, 0]} castShadow />
      </group>
    </group>
  );
}

function GardenChassis({ palette }: { palette: Lab3DPalette }) {
  const post = boothSheenMaterial(KIT_WOOD);
  const leaf = boothSheenMaterial(KIT_GREEN);
  const planter = boothSheenMaterial(palette.table);
  return (
    <group>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} geometry={PERGOLA_POST_GEO} material={post} position={[x, 1.0, -0.45]} castShadow />
      ))}
      <mesh geometry={PERGOLA_BEAM_GEO} material={post} position={[0, 1.98, -0.45]} rotation={[0, 0, Math.PI / 2]} castShadow />
      {/* Foliage puffs riding the beam + flanking the posts. */}
      <mesh geometry={FOLIAGE_GEO} material={leaf} position={[-0.55, 2.02, -0.45]} castShadow />
      <mesh geometry={FOLIAGE_GEO} material={leaf} position={[0.35, 2.1, -0.45]} scale={[1.2, 1, 1.1]} castShadow />
      {[-0.85, 0.85].map((x) => (
        <group key={x}>
          <mesh geometry={PLANTER_GEO} material={planter} position={[x, 0.17, 0.15]} castShadow receiveShadow />
          <mesh geometry={FOLIAGE_GEO} material={leaf} position={[x, 0.55, 0.15]} scale={[0.85, 0.75, 0.85]} castShadow />
        </group>
      ))}
    </group>
  );
}

/** One booth chassis body, palette-recoloured. Pure presentational — the
 *  template renderer (kit/booth-template.tsx) owns placement, props, staff,
 *  signage and the obstacle/tap-target contracts. */
export function BoothChassis({ kind, palette }: { kind: BoothChassisKind; palette: Lab3DPalette }) {
  switch (kind) {
    case 'COUNTER':
      return <CounterChassis palette={palette} />;
    case 'STATION':
      return <StationChassis palette={palette} />;
    case 'RISER':
      return <RiserChassis palette={palette} />;
    case 'BACKDROP':
      return <BackdropChassis palette={palette} />;
    case 'DESK':
      return <DeskChassis palette={palette} />;
    case 'DISPLAY':
      return <DisplayChassis palette={palette} />;
    case 'VEHICLE':
      return <VehicleChassis palette={palette} />;
    case 'CHAIR_STATION':
      return <ChairStationChassis palette={palette} />;
    case 'GARDEN':
      return <GardenChassis palette={palette} />;
  }
}
