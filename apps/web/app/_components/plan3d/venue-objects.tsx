'use client';

/**
 * Shared, READ-ONLY 3D renderers for the couple's placed VENUE FIXTURES —
 * everything on the seat-plan canvas that isn't a guest table: the 10
 * VENUE_OBJECT_CATALOG kinds (arch / buffet / bar / cake & gift & registration
 * tables / photo booth / lounge / LED wall / greenery), vendor BOOTHS
 * (event_floor_booths), wayfinding SIGNS (event_floor_signs) and the cocktail /
 * waiting ROOM (event_floor_plan.cocktail_*).
 *
 * One module, three call sites (owner 2026-06-26 "make full use of this so our
 * edit is not just a seat plan"): the couple 3D lab, the homepage 3D-Plan demo,
 * and the public guest venue explorer. Each passes its own `Lab3DPalette`, so a
 * Wave-2 mood-board recolour picks the fixtures up automatically — the same
 * discipline the shared `TableMesh` follows.
 *
 * Tasteful low-poly primitives on purpose (the demo is a homepage overlay; the
 * guest walk runs on phones): boxes / cylinders / cones, no fetched assets
 * (the cocktail floor shares the procedural roughness map only), no troika
 * text (so nothing fetches a font at runtime). Labels are color-coded panels the
 * surfaces' existing HTML-HUD conventions complement — the fixture READS as what
 * it is from its silhouette + accent colour. Footprints come from
 * `venueObjectDims` (metres); every fixture respects its stored `rotationDeg`.
 *
 * Pure presentational — no DB, no state, no editing. Dragging/adding these stays
 * with the 2D editor + the couple lab's own table tooling.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { floorRoughnessMap } from '@/app/_components/plan3d/scene-lighting';
import {
  pctToWorld,
  venueObjectDims,
  BOOTH_FOOTPRINT_M,
  type Lab3DPalette,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
} from '@/lib/seating-3d';

type Room = { w: number; d: number };

/** Convert a stored rotation (degrees, clockwise on the 2D canvas) to the scene
 *  Y-rotation the rest of the lab uses (`-deg` in radians — matches TableMesh). */
function ry(deg: number): number {
  return (-deg * Math.PI) / 180;
}

/**
 * One placed venue object, rendered as a small low-poly prop sized to its
 * catalog footprint. A `switch` on kind picks the silhouette; unknown kinds fall
 * back to a plain slab so a future catalog addition still shows up.
 */
export function SceneObjectMesh({
  object,
  room,
  palette,
}: {
  object: Lab3DSceneObject;
  room: Room;
  palette: Lab3DPalette;
}) {
  const pos = useMemo(() => pctToWorld(object.xPct, object.yPct, room), [object.xPct, object.yPct, room]);
  const { w, d } = venueObjectDims(object.kind);

  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry(object.rotationDeg), 0]}>
      {renderKind(object.kind, w, d, palette)}
    </group>
  );
}

function renderKind(kind: string, w: number, d: number, palette: Lab3DPalette) {
  switch (kind) {
    case 'arch':
      // Two posts + a curved lintel (a torus half) — the ceremony arch.
      return (
        <group>
          <mesh position={[-w / 2 + 0.12, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 2.2, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.8} />
          </mesh>
          <mesh position={[w / 2 - 0.12, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 2.2, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[w / 2 - 0.12, 0.09, 8, 20, Math.PI]} />
            <meshStandardMaterial color={palette.accent} roughness={0.6} />
          </mesh>
        </group>
      );
    case 'led_wall':
      // A tall thin emissive panel — the LED wall (metal frame grade, Wave 2a).
      return (
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[w, 2.8, Math.max(0.12, d)]} />
          <meshStandardMaterial color="#10131b" emissive={palette.accent} emissiveIntensity={0.45} roughness={0.3} metalness={0.7} />
        </mesh>
      );
    case 'plant':
      // A pot + a soft foliage sphere — greenery.
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.36, 12]} />
            <meshStandardMaterial color={palette.wall} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.75, 0]} castShadow>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshStandardMaterial color="#6f9b6a" roughness={0.9} />
          </mesh>
        </group>
      );
    case 'lounge':
      // A low seat block + a back cushion — a lounge set.
      return (
        <group>
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.5, d]} />
            <meshStandardMaterial color={palette.accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.7, -d / 2 + 0.15]} castShadow>
            <boxGeometry args={[w, 0.55, 0.3]} />
            <meshStandardMaterial color={palette.table} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'bar':
    case 'buffet':
      // A counter with a raised back rail — bar / buffet station. The counter
      // top is the room's clearest metal accent (Wave 2a materials pass).
      return (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 1.1, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.16, 0]} castShadow>
            <boxGeometry args={[w, 0.06, d]} />
            <meshStandardMaterial color={palette.accent} roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      );
    case 'photo_booth':
      // A backdrop panel + a slim frame — the photo booth.
      return (
        <group>
          <mesh position={[0, 1.1, -d / 2 + 0.1]} castShadow>
            <boxGeometry args={[w, 2.2, 0.14]} />
            <meshStandardMaterial color={palette.accent} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, -d / 2 + 0.1]}>
            <boxGeometry args={[w * 0.7, 1.5, 0.16]} />
            <meshStandardMaterial color={palette.table} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'cake_table':
      // A round pedestal table with a stacked "cake" on top.
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, 0.06, 20]} />
            <meshStandardMaterial color={palette.table} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.14, 0.18, 0.42, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.4, 0.3, 16]} />
            <meshStandardMaterial color="#f7f2ea" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.86, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.24, 16]} />
            <meshStandardMaterial color={palette.accent} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'gift_table':
    case 'registration':
    default:
      // A plain draped table — gift / registration tables + the safe fallback.
      return (
        <group>
          <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.06, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[w * 0.94, 0.72, d * 0.94]} />
            <meshStandardMaterial color={palette.wall} roughness={0.9} transparent opacity={0.85} />
          </mesh>
        </group>
      );
  }
}

/** A vendor booth — a compact station block with an accent canopy edge. */
export function BoothMesh({ booth, room, palette }: { booth: Lab3DBooth; room: Room; palette: Lab3DPalette }) {
  const pos = useMemo(() => pctToWorld(booth.xPct, booth.yPct, room), [booth.xPct, booth.yPct, room]);
  const { w, d } = BOOTH_FOOTPRINT_M;
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 1.0, d]} />
        <meshStandardMaterial color={palette.table} roughness={0.6} />
      </mesh>
      {/* Canopy lip — reads as a market-stall booth without a full tent. */}
      <mesh position={[0, 1.06, 0]} castShadow>
        <boxGeometry args={[w + 0.2, 0.08, d + 0.2]} />
        <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.15} />
      </mesh>
    </group>
  );
}

/** A wayfinding sign — a slim post + an arrow panel rotated to its heading.
 *  `rotationDeg` = 0 points up on the canvas (−z in world). */
export function SignMesh({ sign, room, palette }: { sign: Lab3DSign; room: Room; palette: Lab3DPalette }) {
  const pos = useMemo(() => pctToWorld(sign.xPct, sign.yPct, room), [sign.xPct, sign.yPct, room]);
  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry(sign.rotationDeg), 0]}>
      {/* Post */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
        <meshStandardMaterial color={palette.wall} roughness={0.8} />
      </mesh>
      {/* Label panel */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.7, 0.32, 0.05]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
      </mesh>
      {/* Direction arrow (a flat cone) on the panel front, pointing along the heading (−z). */}
      <mesh position={[0, 1.35, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.26, 3]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} />
      </mesh>
    </group>
  );
}

/**
 * The cocktail / waiting room — a second floor plane with low translucent walls
 * and a faint accent trim, sitting on the same canvas as the reception (it's
 * placed OUTSIDE the reception walls by the 2D editor, so it never overlaps).
 */
export function CocktailRoom({ cocktail, room, palette }: { cocktail: NonNullable<Lab3DCocktail>; room: Room; palette: Lab3DPalette }) {
  const c = useMemo(() => pctToWorld(cocktail.xPct, cocktail.yPct, room), [cocktail.xPct, cocktail.yPct, room]);
  const w = Math.max(0.5, (cocktail.wPct / 100) * room.w);
  const d = Math.max(0.5, (cocktail.hPct / 100) * room.d);
  const wallH = 0.9;
  const walls: { p: readonly [number, number, number]; s: readonly [number, number, number] }[] = [
    { p: [0, wallH / 2, -d / 2], s: [w, wallH, 0.1] },
    { p: [0, wallH / 2, d / 2], s: [w, wallH, 0.1] },
    { p: [-w / 2, wallH / 2, 0], s: [0.1, wallH, d] },
    { p: [w / 2, wallH / 2, 0], s: [0.1, wallH, d] },
  ];
  return (
    <group position={[c.x, 0, c.z]}>
      {/* Floor plane — a hair above the ground so it never z-fights the reception floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={palette.floor} roughness={0.95} roughnessMap={floorRoughnessMap()} />
      </mesh>
      {/* Accent trim ring on the floor edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[Math.min(w, d) / 2 - 0.1, Math.min(w, d) / 2, 40]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.p as [number, number, number]}>
          <boxGeometry args={wall.s as [number, number, number]} />
          <meshStandardMaterial color={palette.wall} roughness={0.95} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One-call render of every placed fixture for a scene. Drop it inside a Canvas
 * alongside the tables. Each list defaults to empty so a surface can pass only
 * what it has.
 */
export function VenueFixtures({
  room,
  palette,
  objects = [],
  booths = [],
  signs = [],
  cocktail = null,
}: {
  room: Room;
  palette: Lab3DPalette;
  objects?: Lab3DSceneObject[];
  booths?: Lab3DBooth[];
  signs?: Lab3DSign[];
  cocktail?: Lab3DCocktail;
}) {
  return (
    <group>
      {objects.map((o) => (
        <SceneObjectMesh key={o.id} object={o} room={room} palette={palette} />
      ))}
      {booths.map((b) => (
        <BoothMesh key={b.id} booth={b} room={room} palette={palette} />
      ))}
      {signs.map((s) => (
        <SignMesh key={s.id} sign={s} room={room} palette={palette} />
      ))}
      {cocktail ? <CocktailRoom cocktail={cocktail} room={room} palette={palette} /> : null}
    </group>
  );
}
