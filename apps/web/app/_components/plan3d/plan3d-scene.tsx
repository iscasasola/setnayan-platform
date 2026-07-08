'use client';

/**
 * Plan3DScene — the shared, READ-ONLY 3D renderer behind the homepage 3D
 * Plan demo (owner spec, DECISION_LOG 2026-07-03). Props-only presentational
 * component, no DB, no server actions — same discipline as the public tour's
 * `<WayfindingMap>` (`app/_components/wayfinding-map.tsx`), just in 3D. It is
 * deliberately NOT the couple-facing edit-capable seating lab
 * (`seating/lab/_components/seating-lab-3d.tsx`, 3400+ lines of drag/build/
 * save tooling) — this only ever reads a scene and (optionally) plays one
 * scripted walk. Two call sites share it:
 *   - the desktop overlay: whole-room orbit view, click a seated guest to
 *     mint their QR (`onGuestClick`)
 *   - the phone guest view: the SAME room, camera fixed until the guest taps
 *     "Where am I seated?", then a scripted entrance→seat walk (`walkTarget`)
 *
 * Low-poly on purpose (brief note: "a low-poly room is fine on mobile") —
 * simple primitives, no fetched assets, no monogram, reuses the pure geometry
 * math from `lib/seating-3d.ts` (the couple lab's engine) so table shapes/seat
 * positions match the real product exactly. Realism (Wave 2a): lighting comes
 * from the shared `SceneLighting` rig (procedural IBL + one warm shadow key),
 * chairs render through the shared per-table `InstancedChairs` (2 draw calls a
 * table regardless of capacity), and the floor carries a subtle procedural
 * roughness map. `quality` picks the shadow/env budget: the desktop overlay
 * runs 'high' (2048 shadow map), the phone walk 'low' (1024 / 128 env).
 *
 * Figures (kit slice 1): guests render as the shared articulated figure kit
 * (`./kit` — the owner-locked "Sims-like" direction) instead of the original
 * cylinder+sphere tokens. Seated guests STAND at their seats for now (the
 * crowd's baked sit pose is a later slice) in side-derived Filipino formalwear
 * (gown/filipiniana · suit/barong, deterministic per guest id), and the
 * walker is a walk-cycle figure phased by the same bob clock as before. The
 * crowd inherits the scene `quality` knob ('low' bakes static poses on the
 * phone); the single player figure always runs 'high'.
 *
 * Sit clip (kit slice 2, 2026-07-08): the scripted "Where am I seated?" walk no
 * longer ends standing ON the chair — it ends at the seat's `approachPoint`
 * (0.55 m behind the chair) and hands the figure to `<SitController>`, which
 * detaches that one instanced chair, pulls it back, turns + sits the figure,
 * and tucks both in together. `onWalkComplete` (the phone UI's "You're at
 * <table>" line) fires ONLY from the controller's `onSeated` — after the tuck
 * lands, or immediately under reduced motion (which snaps straight to the
 * seated end-state and never detaches a chair). The chase camera simply stops
 * being written when the Walker unmounts, so it holds its last frame through
 * the whole sit — no snap. Roam is untouched: no auto-sit on floor taps, and
 * the gold own-seat ring keeps its walk-to behaviour.
 *
 * ROAM mode (owner 2026-07-03 "show my seat OR walk around the event"): when
 * `roam` is set, the guest's figure stands in the room and every tap on the
 * floor steers them there — same `steerPath` obstacle avoidance and the same
 * chase camera as the scripted walk, just re-aimed per tap. Their own seat is
 * marked with a gold ring so "find my seat" still works inside free roam.
 *
 * Theming (owner 2026-07-03 "add apply mood board toggle so the place is
 * themed"): when a `rolePalette` is passed the room recolours through
 * `resolvePaletteFromRoles` — the SAME mapping the couple-facing venue walk
 * (`guest-venue-3d.tsx`) uses — otherwise it renders the neutral default.
 *
 * Walk quality (owner 2026-07-03 "movement is not fluid, and the person is
 * walking through the table not going around it"): the walker is speed-paced
 * (not a fixed duration regardless of distance), eased at both ends, turns are
 * smoothed (no snapping at each waypoint), the chase camera is damped
 * frame-rate-independently, and — the collision fix — every frame the sampled
 * position is re-clamped out of the obstacle discs (`pushOutOfDiscs`), so the
 * avatar physically cannot cross a table/stage even where the interpolated
 * chord between two path waypoints would. This applies to BOTH the scripted
 * seat walk and every roam tap (each carries its obstacle discs).
 *
 * Avoidance v2 (this slice): the obstacle set is upgraded from one fat disc
 * per table to TRUE footprints (a banquet is a capsule of discs, a serpentine
 * its band — corners included) plus a disc per CHAIR, occupied or not (a
 * seated guest is covered by their chair's disc), so the walker rounds table
 * corners and never cuts through seat backs. The scripted seat walk excludes
 * its own destination chair + its approach corridor (`chairObstaclesForWalk`
 * — the same shared filter the couple lab's walks use) so the sit hand-off
 * spot stays reachable. Every set is pre-hashed into an `ObstacleGrid`
 * (spatial hash) because this surface runs on PHONES: the per-frame re-clamp
 * queries only nearby discs out of the ~170–400 a real room carries, while
 * staying bit-identical to the brute-force walk (the engine's parity
 * contract). All obstacle inputs here are static props, so each grid builds
 * once per scene — no per-frame rebuilds for `quality` to gate (the knob
 * would only matter if obstacles ever moved). The Walker also feeds the
 * predictive `{pos, vel}` separation form (velocity from its own committed
 * frame deltas) so slice 8's shared-room remote players drop straight in —
 * today the remote-mover list is empty and the pass is skipped.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  roomSize,
  pctToWorld,
  boothFacingY,
  rotateLocalRad,
  seatWorld,
  tableDims,
  floorObstacles,
  sceneObjectObstacles,
  signObstacles,
  cocktailObstacles,
  pushOutOfDiscs,
  steerPath,
  seatApproachPath,
  approachPoint,
  boothApproach,
  chairObstacles,
  chairObstaclesForWalk,
  dropDiscsContaining,
  buildObstacleGrid,
  separateAgents,
  resolvePalette,
  resolvePaletteFromRoles,
  SIDE_COLOR,
  type ObstacleDisc,
  type ObstacleGrid,
  type AgentVel,
  type Lab3DTable,
  type Lab3DFloor,
  type Lab3DPalette,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
  type Vec2,
  type SeatPose,
} from '@/lib/seating-3d';
import { useLookGesture, type LookState } from '@/app/_components/plan3d/use-look-gesture';
import { BoothVendorCard } from '@/app/_components/plan3d/booth-vendor-card';
import { boothHitVolume, templateBoothObstacles } from '@/app/_components/plan3d/kit/booth-templates';
import {
  resolveAttirePaletteColor,
  sideAttireColor,
  type RolePalette,
} from '@/lib/mood-board';
import type { Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';
import { preloadGuestPhotos } from './guest-avatar';
import {
  Figure,
  SitController,
  SIT_TIMING,
  EmoteBubbles,
  EMOTE_SEATED_Y,
  StringLights,
  InstancedSeatedCrowd,
  seatRootMatrix,
  type EmoteEmitter,
  type EmoteGlyph,
  type FigureSpec,
  type FigureQuality,
  type SeatedInstance,
} from './kit';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';
import { DanceFloorMural } from '@/app/_components/plan3d/dance-floor-mural';
import {
  SceneLighting,
  RECOMMENDED_TONEMAP,
  floorRoughnessMap,
  floorAlbedoMap,
  floorBumpMap,
  fabricBumpMap,
  type SceneLightingQuality,
} from '@/app/_components/plan3d/scene-lighting';
import { InstancedChairs, chairPlacements } from '@/app/_components/plan3d/instanced-chairs';
import {
  VenueShell,
  VenueDecor,
  archetypeFor,
  archetypeFloorColor,
  archetypeBackground,
  ceilingDecorOccupied,
} from '@/app/_components/plan3d/venue-decor';
import { sel, type ReceptionDesign } from '@/lib/reception-scene';
import {
  coldSparkFrame,
  coldSparkObstacles,
  coldSparkPathNodes,
  coldSparkProgress,
  type ColdSparkFrame,
} from '@/app/_components/plan3d/kit/entrance-tunnel';

const NEUTRAL_PALETTE = resolvePalette([]); // the lab's warm-neutral default

/** Sample fallback entrance (mirrors the couple lab's own fallback when the
 *  couple never placed one — `{ xPct: 50, yPct: 96 }` in seating-lab-3d.tsx). */
function entrancePct(floor: Lab3DFloor): { xPct: number; yPct: number } {
  return floor.entrance.enabled ? floor.entrance : { xPct: 50, yPct: 96 };
}

function TableMesh({
  table,
  room,
  palette,
  occupiedSeats,
}: {
  table: Lab3DTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  /** Seat numbers with a guest on them — tints the instanced chairs. */
  occupiedSeats?: ReadonlySet<number>;
}) {
  const pos = pctToWorld(table.xPct, table.yPct, room);
  const dims = tableDims(table.shape, table.capacity);
  const ry = (-table.rotationDeg * Math.PI) / 180;
  // Table-local chair placements — 2 instanced draw calls per table (Wave 2a).
  const chairs = useMemo(
    () => chairPlacements(table.shape, table.capacity),
    [table.shape, table.capacity],
  );
  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry, 0]}>
      {/* Tabletop at the product-true 0.74 m (was a toy-height 0.38 before the
          chairs landed — a 0.46 m chair seat must tuck UNDER the top). */}
      {dims.round ? (
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.06, 24]} />
          <meshStandardMaterial color={palette.table} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.006} />
        </mesh>
      ) : (
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.w, 0.06, dims.d || dims.w]} />
          <meshStandardMaterial color={palette.table} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.006} />
        </mesh>
      )}
      {/* one leg-post per table, purely for a grounded look at low-poly cost */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.72, 8]} />
        <meshStandardMaterial color={palette.wall} roughness={0.6} />
      </mesh>
      <InstancedChairs
        chairs={chairs}
        removedSeats={table.removedSeats}
        occupiedSeats={occupiedSeats}
        color={palette.wall}
        accent={palette.accent}
        // Opt in to the detach-one-chair registry so the sit clip can swap the
        // destination seat's instance for the animatable ActiveChair.
        tableId={table.id}
      />
    </group>
  );
}

// ── Kit-figure crowd (replaces the cylinder+sphere GuestToken) ───────────────

/**
 * Invisible click volume over each guest figure. The articulated kit figure's
 * thin limbs are a far harder raycast target than the old chunky token
 * (body cylinder r 0.19 spanning y 0.46–0.96 + head sphere to ≈1.21), and the
 * QR-minting click must NOT get harder — so a hit cylinder at least as large
 * as the whole old token (r 0.22 × 1.5 m, floor to above the head) catches
 * the pointer instead. Module-scope shared buffers, the kit's own budget rule.
 */
const GUEST_HIT_GEO = new THREE.CylinderGeometry(0.22, 0.22, 1.5, 10);

// Hover affordance: the kit's materials are module-cached ACROSS figures, so
// the old per-mesh emissive tint would light every same-coloured guest at
// once. The highlight moved onto the (per-guest) hit volume instead — a faint
// status-coloured shell. Keyed cache stays tiny (three side colours).
const hoverMats = new Map<string, THREE.MeshBasicMaterial>();
function hoverMaterial(color: string): THREE.MeshBasicMaterial {
  let m = hoverMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
    hoverMats.set(color, m);
  }
  return m;
}

/**
 * FNV-1a 32-bit over the guest id — the SAME tiny stable-hash recipe the kit
 * uses internally for looks (resolveFigureLook). Deliberately re-stated here
 * rather than exported from the kit: WHICH outfits a side alternates through
 * is demo-scene policy, not figure-kit policy, so the scene owns the bits it
 * reads. Stability is the requirement — a guest must wear the same outfit on
 * every visit, on both the desktop overlay and the phone walk.
 */
function hashGuestId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Attire class → cultural variant alternation so the demo crowd reads as a
// real PH wedding: gown-class guests alternate gown/filipiniana, suit-class
// suit/barong. The CLASS comes from the guest's resolved attire (the same
// resolveGuestAttire chain the couple lab uses — explicit couple pick ≻
// gendered role ≻ neutral); the hash only picks the variant WITHIN the class.
// 2026-07-08 fix: deriving the class itself from side+hash dressed male-named
// sample guests in gowns (owner caught "Antonio Bautista" in one) — side says
// whose guest you are, never what you wear.
const GOWN_CLASS_OUTFITS: readonly FigureSpec['outfit'][] = ['gown', 'filipiniana'];
const SUIT_CLASS_OUTFITS: readonly FigureSpec['outfit'][] = ['suit', 'barong'];

/** Deterministic outfit per guest. Reads a HIGH bit window (h >>> 16) so the
 *  choice doesn't correlate with the kit's look fields, which hash the LOW
 *  bits (skin tone = h % 6 — sharing parity would give every gown-wearer the
 *  same skin-tone subset). */
function outfitForGuest(g: Plan3DGuest): FigureSpec['outfit'] {
  const h = hashGuestId(g.id) >>> 16;
  if (g.attire === 'gown') return GOWN_CLASS_OUTFITS[h % GOWN_CLASS_OUTFITS.length]!;
  if (g.attire === 'suit') return SUIT_CLASS_OUTFITS[h % SUIT_CLASS_OUTFITS.length]!;
  return 'neutral';
}

function GuestToken({
  position,
  heading,
  spec,
  name,
  quality,
  onClick,
  seated = false,
  bodyless = false,
}: {
  position: Vec2;
  /** Facing (radians) — each figure looks toward its own table's centre. */
  heading: number;
  spec: FigureSpec;
  name: string;
  /** Crowd budget knob: mirrors the scene's lighting quality — the phone walk
   *  runs 'low' (static baked pose), the desktop overlay 'high' (idle sway). */
  quality: FigureQuality;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  /** True once this guest's sit choreography completed (slice-2 review fix):
   *  when the SitController unmounts (retarget / roam), the guest must stay
   *  SEATED — popping back to standing undoes the payoff the user just
   *  watched. The rest of the crowd stays standing until slice 3's room-wide
   *  seated default. */
  seated?: boolean;
  /** Drop the articulated `<Figure>` body but KEEP the per-guest hit/hover
   *  cylinder (2026-07-08 instancing split). A static seated guest's body is
   *  drawn by the room-wide `<InstancedSeatedCrowd>` batch instead; the QR-mint
   *  tap target has no per-instance equivalent, so it stays here individually so
   *  tap-to-open-card + the hover shell keep working. */
  bodyless?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, heading, 0]}>
      {/* Room-wide seated default (2026-07-08 collision pass — the owner kept
          seeing figures standing THROUGH their chairs): the ambient crowd sits
          in its chairs, exactly like the lab's SeatedAvatar. `seated={false}`
          remains available for callers that need a stander. QR hit target is
          full-height, so taps are unchanged. `bodyless` skips the body when this
          guest's static seated figure is drawn by the instanced batch. */}
      {bodyless ? null : (
        <Figure spec={spec} pose={seated ? 'sit' : 'stand'} quality={quality} name={name} />
      )}
      {onClick ? (
        // PERF: the hit cylinder is `visible` only while hovered (when it doubles
        // as the hover shell). three's Raycaster never tests object.visible, so
        // pointer events keep firing on the invisible mesh — but an always-
        // rendered opacity-0 material would still cost a full-figure-height
        // alpha-blended draw call per guest for literally no pixels.
        <mesh
          geometry={GUEST_HIT_GEO}
          material={hoverMaterial(spec.statusColor)}
          visible={hovered}
          position={[0, 0.75, 0]}
          onClick={onClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        />
      ) : null}
    </group>
  );
}

function EntranceMark({ position, palette }: { position: Vec2; palette: Lab3DPalette }) {
  // A metal doorway frame — one of the room's metallic accents (Wave 2a).
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[-0.55, 0.55, 0]} castShadow>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0.55, 0.55, 0]} castShadow>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[1.3, 0.08, 0.1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.35} metalness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * A pulsing gold floor ring on the target chair, shown while the guest walks to
 * it — so they can SEE their destination before the avatar arrives. Same gold
 * ring vocabulary as the roam "find my seat" marker, gently pulsing.
 */
function SeatDestinationMarker({ position, color }: { position: Vec2; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.0) * 0.18;
    if (ring.current) ring.current.scale.set(pulse, pulse, 1);
  });
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.42, 0.64, 40]} />
        <meshBasicMaterial color={color} transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Arc-length-even sample along a waypoint path at t ∈ [0,1] + the facing (radians). */
function sampleAlongPath(path: Vec2[], t: number): { p: Vec2; heading: number } {
  if (path.length < 2) {
    const p = path[0] ?? { x: 0, z: 0 };
    return { p, heading: 0 };
  }
  const lens: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    lens.push(lens[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z));
  }
  const total = lens[lens.length - 1]! || 1;
  const target = Math.max(0, Math.min(1, t)) * total;
  let seg = 0;
  while (seg < lens.length - 2 && lens[seg + 1]! < target) seg++;
  const segLen = lens[seg + 1]! - lens[seg]! || 1;
  const localT = (target - lens[seg]!) / segLen;
  const a = path[seg]!;
  const b = path[seg + 1]!;
  const p = { x: a.x + (b.x - a.x) * localT, z: a.z + (b.z - a.z) * localT };
  const heading = Math.atan2(b.x - a.x, b.z - a.z);
  return { p, heading };
}

function pathLength(path: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < path.length; i++) {
    l += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
  }
  return l;
}

/** Ken-Perlin smootherstep — gentle acceleration in, gentle deceleration out. */
function smootherstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/** Shortest-arc angle lerp so a heading never spins the long way round. */
function lerpAngle(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

/** Frame-rate-independent damping factor: fraction to move toward the target
 *  this frame so the ease reads the same at 30fps or 120fps. `base` is the
 *  fraction of distance REMAINING after one second (smaller = snappier). */
function damp(base: number, delta: number): number {
  return 1 - Math.pow(base, delta);
}

const WALK_SPEED_MPS = 1.45; // an unhurried indoor stroll (scripted seat walk)
const WALK_MIN_MS = 2800; // never so short the entrance→seat arc feels clipped
const ROAM_SPEED = 1.7; // constant roam speed so cross-room taps don't fast-forward
const AVATAR_BODY_R = 0.24; // keep the avatar's own girth clear of obstacles too

// ── Shared-room movers (slice-8 hook) ────────────────────────────────────────
// The demo animates exactly ONE walker today, but the separation pass is wired
// in its predictive {pos, vel} form NOW so slice 8's shared-room remote
// players drop straight in: fill REMOTE_MOVERS with each remote player's live
// position + realised velocity (m/s) and the Walker starts weaving around
// them with zero further plumbing. Hard-capped at MAX_ROOM_MOVERS — the
// separation pass is O(n²) over movers and this surface runs on phones, so a
// busier shared room must cull to the 8 nearest, not grow the pass.
const MAX_ROOM_MOVERS = 8;
/** Personal-space berth between movers — the couple lab crowd's exact value,
 *  so a demo walker and a lab agent give each other the same room. */
const MOVER_MIN_DIST = 0.5;
const REMOTE_MOVERS: readonly (Vec2 & { vel?: AgentVel })[] = [];

/** Degenerate-escape heading for the per-frame re-clamp (a point landing
 *  exactly on a disc centre has no radial to push along) — module-scoped so
 *  the frame loop never allocates it. Same default pushOutOfDiscs ships. */
const CLAMP_PERP: Vec2 = { x: 1, z: 0 };

type WalkState = {
  path: Vec2[];
  /** Obstacles to re-clamp out of every frame (empty for a teleport) — either
   *  plain discs or a pre-hashed ObstacleGrid (the phone-budget fast path). */
  obstacles: ObstacleDisc[] | ObstacleGrid;
  startedAt: number;
  durationMs: number;
  onComplete?: () => void;
};

// Seconds of no look-input before the chase camera eases its facing back to
// the walker's auto-heading (owner: "blend the auto-facing back in ONLY when the
// user hasn't swiped for a few seconds — ease, don't snap").
const LOOK_RELEASE_MS = 2600;

function Walker({
  walk,
  spec,
  name,
  posRef,
  // Renamed locally: `headingRef` below is the Walker's own smoothed-facing ref.
  headingRef: headingOutRef,
  look,
  reducedMotion,
  camSeededRef,
}: {
  walk: WalkState;
  /** The player figure's dressing — same spec the guest wears seated, so
   *  walking to your seat never re-dresses you. */
  spec: FigureSpec;
  name?: string;
  /** Live walker position, shared out so roam taps can path FROM wherever the figure stands. */
  posRef?: React.MutableRefObject<Vec2 | null>;
  /** Live smoothed facing, shared out so the sit clip can start its turn from
   *  the walker's ACTUAL arrival heading (not a re-derived path tangent). */
  headingRef?: React.MutableRefObject<number | null>;
  /** Shared swipe-to-look state (yaw offset + pitch + last-look timestamp). When
   *  absent, the camera behaves exactly as before (pure auto-facing chase). */
  look?: React.MutableRefObject<LookState> | null;
  reducedMotion?: boolean;
  /** Scene-owned "chase cam already framed" flag (slice-2 review fix): the
   *  Walker now unmounts at the sit hand-off, so a LOCAL ref would reset on
   *  the next walk and hard-cut the camera. The scene passes one persistent
   *  ref; consecutive walks ease from wherever the camera is. */
  camSeededRef?: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const firedRef = useRef(false);
  const headingRef = useRef<number | null>(null);
  const bobRef = useRef(0);
  const localCamReady = useRef(false);
  const camReady = camSeededRef ?? localCamReady;
  // Arrived → the figure eases walk → stand (the kit blends presets over ~⅓ s).
  // Without this the gait clock freezes but the pose stays 'walk', holding an
  // arbitrary mid-stride forever — exactly the "frozen mid-stride reads like a
  // glitch" the kit's reduced-motion note warns about. The lab Walker has the
  // same atSeat → 'stand' blend; roam stops between floor taps get it too.
  const [atRest, setAtRest] = useState(false);
  // The user's applied yaw offset, blended toward `look.yawOffset` while they're
  // actively looking and eased back to 0 once they stop — kept separate from the
  // raw ref so the ease-back is smooth regardless of frame rate.
  const appliedYaw = useRef(0);
  const appliedPitch = useRef(0);
  // Last committed (post-clamp) position + the realised velocity it implied —
  // the {pos, vel} the predictive separation pass projects. Realised, not
  // path-tangent: what the figure ACTUALLY did after clamping is the honest
  // motion to predict from (the couple lab crowd records the same thing).
  const prevPosRef = useRef<Vec2 | null>(null);
  const velRef = useRef<AgentVel | undefined>(undefined);
  // The walk object the per-walk state belongs to — FRAME-LOOP-owned (not a
  // passive effect): the useFrame callback swaps at layout-effect time, so a
  // rAF frame can run between the new walk's commit and a [walk] effect's
  // flush. For the velocity history, a passive-effect reset would let that
  // one frame divide a cross-walk position jump (roam tap across the room,
  // reduced-motion teleport) by delta — tens of m/s of phantom velocity for
  // the predictive pass to project a huge dodge from. For the one-shot
  // completion (`firedRef`), the same window cut both ways: a fresh walk
  // could inherit a stale fired=true (completion swallowed for a frame) and a
  // fire landing before the late reset got re-armed (`onComplete` twice for
  // one walk — seen live as "onComplete fires multiple times right after the
  // walk starts" when a starved rAF stream pushed raw to 1 on the first
  // frame). Checking identity inside the loop closes all of it for good.
  const velWalkRef = useRef<WalkState | null>(null);

  useFrame(({ camera }, delta) => {
    // Per-walk state re-arms the first frame a new walk object reaches the
    // loop (see velWalkRef above): each NEW walk (fresh scripted target,
    // every roam floor tap) resets the velocity history, restarts the gait
    // and re-arms the completion one-shot. <Walker> stays mounted across
    // walks (same element position), so none of this may key off the
    // component instance — and none of it may wait on a passive effect.
    if (velWalkRef.current !== walk) {
      velWalkRef.current = walk;
      prevPosRef.current = null;
      velRef.current = undefined;
      firedRef.current = false;
      setAtRest(false);
    }
    const raw = Math.min(1, (performance.now() - walk.startedAt) / walk.durationMs);
    const eased = smootherstep(raw);
    const sample = sampleAlongPath(walk.path, eased);
    // Predictive separation (slice-8 ready): the walker enters the pass in the
    // {pos, vel} form, carrying last frame's realised velocity, so approaching
    // remote players sidestep early instead of shoving on contact. Skipped
    // while REMOTE_MOVERS is empty (today, always) — a 1-agent pass is a
    // guaranteed no-op, so the phone frame doesn't pay its allocations.
    let steered = sample.p;
    if (REMOTE_MOVERS.length > 0) {
      const movers =
        REMOTE_MOVERS.length > MAX_ROOM_MOVERS ? REMOTE_MOVERS.slice(0, MAX_ROOM_MOVERS) : REMOTE_MOVERS;
      const vel = velRef.current;
      // delta rides along so the predictive push is a per-second rate (the
      // same sidestep at 30 Hz and 120 Hz), not a per-frame impulse.
      steered = separateAgents([vel ? { ...sample.p, vel } : sample.p, ...movers], MOVER_MIN_DIST, delta)[0]!;
    }
    // Collision guarantee (LOAD-BEARING — runs LAST, after path sampling AND
    // separation): the interpolated chord between two path waypoints can still
    // dip inside a disc — and a separation sidestep can push into one — so the
    // final position is re-clamped every frame and the avatar rounds the table
    // instead of clipping through it. `inflateR` carries the avatar's body
    // radius so the walker's EDGE (not just its centre) clears — same math as
    // the old pre-inflated disc copy, grid-compatible.
    const p = pushOutOfDiscs(steered, walk.obstacles, CLAMP_PERP, AVATAR_BODY_R);
    // Realised velocity for the NEXT frame's predictive pass — delta-divided
    // (m/s) so a 30 Hz and a 120 Hz frame project identically.
    const dt = Math.max(delta, 1e-4);
    velRef.current = prevPosRef.current
      ? { x: (p.x - prevPosRef.current.x) / dt, z: (p.z - prevPosRef.current.z) / dt }
      : undefined;
    prevPosRef.current = p;
    // Share the live (re-clamped) position so a roam tap paths from here.
    if (posRef) posRef.current = p;

    // Smooth the facing toward the path heading (no snap-turn at each waypoint).
    const targetHeading = sample.heading;
    headingRef.current =
      headingRef.current == null
        ? targetHeading
        : lerpAngle(headingRef.current, targetHeading, damp(0.015, delta));
    const h = headingRef.current;
    // Share the live smoothed facing (same contract as posRef) — read once at
    // walk completion to seed the sit clip's shortest-arc turn.
    if (headingOutRef) headingOutRef.current = h;

    // ── Swipe-to-look: while the user is actively looking, their yaw offset takes
    // priority over the chase camera's auto-facing; once they've been idle for a
    // beat, ease the offset back to 0 so the camera resumes trailing the walk.
    let lookYaw = 0;
    let lookPitch = 0;
    if (look) {
      const l = look.current;
      const idleMs = performance.now() - l.lastLookAt;
      // Follow the raw user input snappily while they're dragging.
      appliedYaw.current += (l.yawOffset - appliedYaw.current) * damp(0.0001, delta);
      appliedPitch.current += (l.pitch - appliedPitch.current) * damp(0.0001, delta);
      if (reducedMotion) {
        // No continuous ease-back animation under reduced motion: hold the
        // user's chosen offset (they can straighten up by dragging back).
        appliedYaw.current = l.yawOffset;
        appliedPitch.current = l.pitch;
      } else if (idleMs > LOOK_RELEASE_MS) {
        // Idle long enough → gently drain both the applied AND the source offset
        // back toward the auto-facing.
        const k = damp(0.35, delta);
        l.yawOffset += (0 - l.yawOffset) * k;
        l.pitch += (0 - l.pitch) * k;
        appliedYaw.current += (0 - appliedYaw.current) * k;
        appliedPitch.current += (0 - appliedPitch.current) * k;
      }
      lookYaw = appliedYaw.current;
      lookPitch = appliedPitch.current;
    }
    const camH = h + lookYaw;

    // The walk-cycle clock, now shared with the kit <Figure> as its gait
    // phase: advances ~9 rad/s while the walk is live and FREEZES on arrival,
    // so the limbs stop swinging exactly when the figure stops translating.
    // The rig's own pelvisY carries the bob these days (walkCyclePose), so the
    // group stays ON the floor — no more whole-body hop. Reduced motion never
    // reads the clock: the kit bakes a neutral stand in that mode, and the
    // figure still relocates so the flow completes.
    bobRef.current += delta * (raw < 1 ? 9 : 0);

    if (groupRef.current) {
      groupRef.current.position.set(p.x, 0, p.z);
      groupRef.current.rotation.y = h; // the avatar always faces its walk heading
    }

    // Third-person chase camera: trails behind + above, looking a little ahead
    // so "walking into the room" reads. The user's look rotates the trailing
    // angle (camH) and lifts/drops the height a touch (pitch). Snap into place on
    // the first frame (else it eases in from the fixed initial pose), then damp.
    const camDist = 3.6;
    const camHeight = 2.5 - lookPitch * 2.0;
    const camTarget = new THREE.Vector3(p.x - Math.sin(camH) * camDist, camHeight, p.z - Math.cos(camH) * camDist);
    if (!camReady.current) {
      camera.position.copy(camTarget);
      camReady.current = true;
    } else {
      camera.position.lerp(camTarget, damp(0.0015, delta));
    }
    camera.lookAt(p.x + Math.sin(camH) * 1.4, 0.9 + lookPitch * 1.6, p.z + Math.cos(camH) * 1.4);

    if (raw >= 1 && !firedRef.current) {
      firedRef.current = true;
      setAtRest(true); // pose eases walk → stand (kit damp blend)
      walk.onComplete?.();
    }
  });

  return (
    <group ref={groupRef}>
      {/* The articulated player figure. `phase` takes the bobRef CLOCK itself
          (a ref — the figure reads .current inside its own useFrame, no React
          re-render per frame), so limbs swing while the group moves and hold
          the instant the clock freezes on arrival. Always quality 'high':
          there is exactly ONE player figure and it owns the camera — the
          crowd, not the player, is the phone budget knob. On arrival the pose
          eases into 'stand' so the figure never holds a frozen stride. */}
      <Figure spec={spec} name={name} pose={atRest ? 'stand' : 'walk'} phase={bobRef} quality="high" />
    </group>
  );
}

export type Plan3DWalkRequest = { guestId: string } | null;
export type Plan3DRoamRequest = { guestId: string } | null;

/** One live sit clip (the scripted walk's hand-off to `<SitController>`).
 *  Locked at walk completion — the controller keys off (tableId, seatIndex). */
type SitState = {
  tableId: string;
  seatIndex: number;
  seat: SeatPose;
  /** Walker's actual smoothed facing on arrival — seeds the turn-to-seat. */
  arriveHeading: number;
  /** Whether the detached seat carried the occupied instance tint. */
  occupied: boolean;
};

export function Plan3DScene({
  tables,
  floor,
  guests,
  sceneObjects = [],
  booths = [],
  signs = [],
  cocktail = null,
  rolePalette,
  receptionDesign,
  venueSetting,
  onGuestClick,
  walkTarget,
  onWalkComplete,
  roam,
  interactive = true,
  quality = 'high',
  cinematic = false,
}: {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  /** Placed venue fixtures — rendered read-only + fed into the walk obstacles
   *  so the walker rounds them. Default empty so old call sites still compile. */
  sceneObjects?: Lab3DSceneObject[];
  booths?: Lab3DBooth[];
  signs?: Lab3DSign[];
  cocktail?: Lab3DCocktail;
  /** When set, the room recolours to the couple's mood board (owner toggle). */
  rolePalette?: RolePalette;
  /** Couple's saved reception treatments (Wave 2b) — drives 3D decor. Gated by
   *  the mood-board toggle at the call site: pass it themed-ON, omit themed-OFF
   *  so decor + palette flip together (a neutral shell shows no treatments). */
  receptionDesign?: ReceptionDesign;
  /** Room archetype (`events.venue_setting`) — swaps the `VenueShell`. Independent
   *  of theming: the archetype room shows even in the neutral view. */
  venueSetting?: string;
  onGuestClick?: (guestId: string) => void;
  walkTarget?: Plan3DWalkRequest;
  onWalkComplete?: () => void;
  /** Free-roam mode: the guest stands in the room and every floor tap steers
   *  them there. Mutually exclusive with `walkTarget` (callers pass one). */
  roam?: Plan3DRoamRequest;
  interactive?: boolean;
  /** Lighting/shadow budget — 'high' for the desktop overlay, 'low' for the
   *  phone walk (1024 shadow map + 128 env map). Defaults to 'high'. */
  quality?: SceneLightingQuality;
  /** Cinematic Tier A (Fable §3.5): the golden-hour lighting grade + string
   *  lights. The phone demo walk passes it (grade + lights work at 'low' —
   *  static instances + light knobs, no per-frame cost); dust motes + the
   *  vignette stay lab-Play concerns, this surface adds neither. */
  cinematic?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const room = useMemo(() => roomSize(floor), [floor]);
  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const entranceWorld = useMemo(() => pctToWorld(entrancePct(floor).xPct, entrancePct(floor).yPct, room), [floor, room]);
  const palette = useMemo(
    () => (rolePalette ? resolvePaletteFromRoles(rolePalette) : NEUTRAL_PALETTE),
    [rolePalette],
  );
  // One FigureSpec per guest, shared by the seated crowd AND the walker so a
  // guest never re-dresses when they get up to walk. `statusColor` keeps the
  // existing side-colour semantics (SIDE_COLOR — now the kit's ring/photo-ring
  // hue instead of the whole token body).
  const figureSpecs = useMemo(() => {
    // TAXONOMY v2: motif colour resolves through the STRICT attire chain
    // (specific role palette key → wedding_party → bride/groom SIDE colour → kit
    // default) — the SAME resolver the couple lab uses. No palette → the chain
    // returns null and the kit wears its own tasteful default cloth per outfit.
    const palette = rolePalette ?? {};
    const m = new Map<string, FigureSpec>();
    for (const g of guests) {
      const outfit = outfitForGuest(g);
      // Neutral silhouettes carry no motif (kept as the unmarked shell).
      const motif =
        outfit === 'neutral'
          ? null
          : resolveAttirePaletteColor(g.role, palette, sideAttireColor(palette, g.side));
      m.set(g.id, {
        id: g.id,
        outfit,
        outfitColor: motif,
        photoUrl: g.photoUrl,
        statusColor: SIDE_COLOR[g.side],
      });
    }
    return m;
  }, [guests, rolePalette]);
  // Wave 2b: room archetype + its floor/background tints. `venueSetting` is
  // independent of the mood-board toggle — the archetype room shows either way.
  const archetype = useMemo(() => archetypeFor(venueSetting), [venueSetting]);
  const floorColor = useMemo(() => archetypeFloorColor(archetype, palette), [archetype, palette]);
  const bgColor = useMemo(() => archetypeBackground(archetype), [archetype]);
  // Cold-spark entrance tunnel (tunnel catalog 2026-07-08): active when the
  // couple's reception design picked it. Its frame (origin + inward approach
  // vector) anchors the walk threading + the per-frame progress projection.
  const coldSpark = receptionDesign ? sel(receptionDesign, 'tunnel', 'style') === 'cold_spark' : false;
  const tunnelFrame = useMemo<ColdSparkFrame | null>(
    () => (coldSpark ? coldSparkFrame(entranceWorld, room) : null),
    [coldSpark, entranceWorld, room],
  );
  // Walker path-t along the tunnel segment, fed every frame by the in-Canvas
  // <ColdSparkWalkFeed> and consumed by the tunnel's fountain sequencing.
  // −1 = nobody walking (idle low shimmer).
  const tunnelProgressRef = useRef(-1);
  // Fixture avoidance discs — merged into every walk/roam obstacle set so the
  // demo walker rounds the buffet / booth / cocktail room like a table. The
  // cold-spark tunnel's 8 machine boxes register here the same way booth
  // chassis discs do (r 0.3 each; the 1.8 m centre channel stays clear).
  const fixtureObstacles = useMemo(
    () => [
      ...sceneObjectObstacles(sceneObjects, room),
      // Template-aware (booth kit 2026-07-08): a templated booth registers
      // its chassis' authored footprint discs; the rest keep the classic disc.
      ...templateBoothObstacles(booths, room),
      ...signObstacles(signs, room),
      ...cocktailObstacles(cocktail, room),
      ...(coldSpark ? coldSparkObstacles(entranceWorld, room) : []),
    ],
    [sceneObjects, booths, signs, cocktail, room, coldSpark, entranceWorld],
  );
  // Full obstacle set for a destination-less roam walk (floor taps, booth
  // walk-to, the roam step-in): TRUE table footprints (a banquet reads as a
  // capsule — corners count) + stage/dance + fixtures. Chair discs are emitted
  // for SERPENTINE tables only: on every other shape each chair disc sits
  // strictly inside its own table's footprint clearance disc (round reach
  // w/2+0.75 vs footprint w/2+0.8, banquet d/2+0.7 vs d/2+0.8, …), and this
  // set keeps every footprint solid — so those ~150 discs could never bind
  // and were pure query/build overhead on the phone clamp. Seated guests stay
  // covered (their chair sits inside the footprint the roamer already can't
  // enter); only the serpentine's chairs ride OUTSIDE its deliberately-tight
  // band clearance and do real work. Spatial-hashed: the roam clamp runs
  // EVERY frame on a PHONE — the grid keeps each query local while
  // pushOutOfDiscs stays bit-identical to the brute-force walk. Everything
  // feeding this is a static prop on this read-only surface, so the grid
  // builds ONCE per scene — there's no per-frame rebuild for the `quality`
  // knob to gate. (Seat-DESTINED walks build their own dest-aware grids
  // instead: those drop footprints, so there every chair IS load-bearing.)
  const roamObstacles = useMemo(
    () =>
      buildObstacleGrid([
        ...floorObstacles(floor, tables, room, []),
        ...tables.filter((t) => t.shape === 'serpentine').flatMap((t) => chairObstacles(t, room)),
        ...fixtureObstacles,
      ]),
    [floor, tables, room, fixtureObstacles],
  );

  // Warm the texture cache for every seated guest's photo up front so the first
  // painted frame shows faces, not tokens. Shared decode with the mounting
  // avatars; failures cache to a fast initials fallback (no retry storm).
  useEffect(() => {
    preloadGuestPhotos(guests.map((g) => g.photoUrl));
  }, [guests]);

  const walkGuest = walkTarget ? guests.find((g) => g.id === walkTarget.guestId) ?? null : null;
  const walkTable = walkGuest ? tablesById.get(walkGuest.tableId) ?? null : null;

  // Seat numbers occupied per table — tints each table's instanced chairs.
  // Clamped to capacity−1 exactly like worldSeatPose / the sit clip's
  // seatIndex (slice-2 review fix): an out-of-range seatNumber must tint the
  // SAME instance the seat math resolves to, or the detach/restore swap
  // flashes a differently-tinted chair.
  const occupiedByTable = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const g of guests) {
      if (g.seatNumber == null) continue;
      const cap = tablesById.get(g.tableId)?.capacity ?? 1;
      let s = m.get(g.tableId);
      if (!s) {
        s = new Set<number>();
        m.set(g.tableId, s);
      }
      s.add(Math.max(0, Math.min(cap - 1, g.seatNumber)));
    }
    return m;
  }, [guests, tablesById]);

  const roamGuest = roam ? guests.find((g) => g.id === roam.guestId) ?? null : null;
  const roamSeat = useMemo(() => {
    if (!roamGuest) return null;
    const t = tablesById.get(roamGuest.tableId);
    return t ? seatWorld(t, roamGuest.seatNumber ?? 0, room) : null;
  }, [roamGuest, tablesById, room]);

  // The seat the scripted walk is heading to — drives the destination beacon.
  const walkSeat = useMemo(
    () => (walkGuest && walkTable ? seatWorld(walkTable, walkGuest.seatNumber ?? 0, room) : null),
    [walkGuest, walkTable, room],
  );

  const [walk, setWalk] = useState<WalkState | null>(null);
  // The live sit clip, mounted when the scripted walk reaches the seat's
  // approach point (or immediately under reduced motion). Mutually exclusive
  // with `walk` — the Walker unmounts and <SitController> owns the figure.
  const [sit, setSit] = useState<SitState | null>(null);
  // True once the sit clip has landed (tuck flush) — `onWalkComplete` has fired.
  const [arrived, setArrived] = useState(false);
  // Emote bubbles (Fable §3.6) — the DEMO slice is deliberately name/seat/side
  // (+attire) only, so bubbles here are side/rsvp-GENERIC: every seated guest
  // rotates confirmed-check ↔ chat dots. No per-guest status beyond what the
  // slice already shows. The mid-walk / roaming guest is skipped exactly like
  // their GuestToken. The ambient crowd is room-wide SEATED (2026-07-08
  // collision pass), so every bubble anchors at seated head height.
  const emoteEmitters = useMemo<EmoteEmitter[]>(() => {
    const glyphs: readonly EmoteGlyph[] = ['check', 'chat'];
    const out: EmoteEmitter[] = [];
    for (const g of guests) {
      if (walkTarget?.guestId === g.id || roam?.guestId === g.id) continue;
      const table = tablesById.get(g.tableId);
      if (!table) continue;
      const p = seatWorld(table, g.seatNumber ?? 0, room);
      out.push({ id: g.id, x: p.x, y: EMOTE_SEATED_Y, z: p.z, glyphs });
    }
    return out;
  }, [guests, tablesById, room, walkTarget?.guestId, roam?.guestId]);

  // ── Instanced seated crowd (2026-07-08) — mirrors the public walk ──────────
  // Collapse the STATIC seated crowd to ONE <InstancedSeatedCrowd> for the whole
  // room (~14 draws + zero per-figure useFrame) instead of 14×N meshes. Gated to
  // the SAME condition that already makes a <Figure> static — quality 'low' OR
  // reduced motion — so at quality 'high' + motion every figure stays individual
  // and keeps its FigureFrameDriver idle sway (the shipped desktop-overlay look
  // is UNTOUCHED). Photo guests (billboard head) and the active walk/sit/roam
  // guest stay individual too; the excluded active guest is drawn by <Walker> /
  // <SitController>. Each instanced guest STILL renders its own bodyless
  // <GuestToken> below for the QR-mint hit/hover cylinder — only the body moves
  // into the batch. Matrices use seatRootMatrix (the DEMO's flat
  // position+heading placement — no table→seat nudge/flip), tint = the SAME
  // resolved attire colour the individual <Figure> wears (spec.outfitColor), ring
  // = spec.statusColor (SIDE_COLOR[side]) — reproducing the figure's status ring.
  const instanceSeatedCrowd = quality === 'low' || reducedMotion;
  const { crowdSeats, instancedIds } = useMemo(() => {
    const seats: SeatedInstance[] = [];
    const ids = new Set<string>();
    if (!instanceSeatedCrowd) return { crowdSeats: seats, instancedIds: ids };
    for (const g of guests) {
      // Same exclusions as the guests.map render below.
      if ((walk || sit) && walkGuest && g.id === walkGuest.id) continue;
      if (roamGuest && g.id === roamGuest.id) continue;
      const table = tablesById.get(g.tableId);
      if (!table) continue;
      const spec = figureSpecs.get(g.id)!;
      if (spec.photoUrl) continue; // billboard head — stays an individual GuestToken
      const pos = seatWorld(table, g.seatNumber ?? 0, room);
      const tableCentre = pctToWorld(table.xPct, table.yPct, room);
      const heading = Math.atan2(tableCentre.x - pos.x, tableCentre.z - pos.z);
      seats.push({
        matrix: seatRootMatrix(pos.x, pos.z, heading),
        color: spec.outfitColor,
        ringColor: spec.statusColor,
        scale: spec.scale,
      });
      ids.add(g.id);
    }
    return { crowdSeats: seats, instancedIds: ids };
  }, [instanceSeatedCrowd, guests, walk, sit, walkGuest, roamGuest, tablesById, figureSpecs, room]);

  // Persistent "chase cam already framed" flag — survives Walker remounts so
  // a second walk eases from the current camera instead of hard-cutting.
  const chaseCamSeeded = useRef(false);
  // Where the figure currently stands — written every frame by <Walker>, read
  // when a roam tap needs a start point (or the seat/entrance before any walk).
  const walkerPosRef = useRef<Vec2 | null>(null);
  // The Walker's live smoothed facing — read once, at scripted-walk completion,
  // as the sit clip's `arriveHeading` so the turn starts from where the figure
  // ACTUALLY faces (not a snap to a re-derived path tangent).
  const walkerHeadingRef = useRef<number | null>(null);

  // Swipe-to-look: a drag on the canvas rotates the chase camera (yaw) + tilts
  // it (clamped pitch) while roaming; a short tap stays "walk here". `handlers`
  // spread onto the <Canvas>; the in-Canvas <Walker> reads `look` every frame.
  const { look, handlers: lookHandlers } = useLookGesture();

  // The booth whose vendor card is open (tap a booth → card). Null = closed.
  const [openBooth, setOpenBooth] = useState<Lab3DBooth | null>(null);

  // Steer the roaming figure to a world point, optionally around obstacles that
  // already include the fixtures. Shared by roam floor taps, the own-seat tap,
  // and the booth "walk to" button so they animate identically.
  const walkToPoint = (dest: Vec2, obstacles: ObstacleDisc[] | ObstacleGrid, speed = ROAM_SPEED) => {
    // A walk tap COMMITS a direction: release the user's yaw offset so the
    // chase camera eases back behind the new walk heading. Without this the
    // retained offset re-applies on top of each new heading, so every
    // tap-while-looking swings the view further round. (Pitch is kept — a
    // chosen tilt shouldn't pop just because you started walking.)
    look.current.yawOffset = 0;
    const from = walkerPosRef.current ?? entranceWorld;
    const path = steerPath(from, dest, obstacles, AVATAR_BODY_R);
    if (reducedMotion) {
      setWalk({ path: [dest], obstacles: [], startedAt: performance.now(), durationMs: 1 });
      return;
    }
    const durationMs = Math.min(6500, Math.max(500, (pathLength(path) / speed) * 1000));
    setWalk({ path, obstacles, startedAt: performance.now(), durationMs });
  };

  useEffect(() => {
    if (roam) {
      // Roam owns the walker — the scripted effect stays out. Any held sit clip
      // unmounts here, and its cleanup restores the instanced chair before the
      // roam step-in walks the figure off the seat.
      setSit(null);
      return;
    }
    if (!walkGuest || !walkTable) {
      setWalk(null);
      setSit(null);
      return;
    }
    setArrived(false); // fresh walk → show the destination beacon again
    setSit(null);
    // Clamp like worldSeatPose does so the sit clip detaches the SAME chair
    // instance the seat math resolves to (a null seatNumber sits at chair 0).
    const seatIndex = Math.max(0, Math.min(walkTable.capacity - 1, walkGuest.seatNumber ?? 0));
    const seat = seatWorld(walkTable, seatIndex, room);
    // Hand-off: the walk delivered the figure to the approach point — mount the
    // sit clip. `onWalkComplete` does NOT fire here: the phone UI's "You're at
    // <table>" line waits for the controller's onSeated (tuck landed).
    const beginSit = (arriveHeading: number) => {
      // Roam entered later paths from the seat, where the figure now sits.
      walkerPosRef.current = { x: seat.x, z: seat.z };
      setWalk(null);
      setSit({
        tableId: walkTable.id,
        seatIndex,
        seat,
        arriveHeading,
        // The DRAWN truth (slice-2 review fix): tint matches whatever the
        // clamped instance actually renders — covers an out-of-range
        // seatNumber AND a null seatNumber landing on another guest's chair 0.
        occupied: occupiedByTable.get(walkTable.id)?.has(seatIndex) ?? false,
      });
    };
    if (reducedMotion) {
      // Respect reduced motion: no animated walk — mount the sit clip straight
      // away; the controller snaps to the seated end-state (never detaching a
      // chair) and still fires onSeated → onWalkComplete, so the flow completes.
      beginSit(seat.faceY); // beginSit also clears any in-flight walk
      return;
    }
    // Route AROUND every table (the destination included — true multi-disc
    // footprints, so a banquet's corners count) AND every chair/seated guest
    // except the destination chair + its approach corridor
    // (chairObstaclesForWalk — the shared filter, so this walk and the couple
    // lab's can never disagree about which chairs block), then step in from
    // outside — a guest walks around their table, never across it, and never
    // through a seat back. Pre-hashed: seatApproachPath's steering samples the
    // set hundreds of times, and the grid keeps each query local (phone
    // budget) without changing a single output point.
    const chairDiscs = chairObstaclesForWalk(tables, room, {
      tableId: walkTable.id,
      seatNumber: seatIndex,
    });
    const obstacles = buildObstacleGrid([
      ...floorObstacles(floor, tables, room, []),
      ...fixtureObstacles,
      ...chairDiscs,
    ]);
    // Cold-spark tunnel threading (catalog § 4): the walk enters the room
    // THROUGH the tunnel — fixed centreline nodes at each bay midpoint plus a
    // lead-out 0.5 m beyond the inner mouth (so the chase cam settles straight
    // before exiting), then the normal seat approach continues from the
    // lead-out. The § 4 lead-IN node is the walk's own start: the demo walk
    // begins AT the entrance mark, which is the tunnel's outer mouth.
    const tunnelNodes = coldSpark ? coldSparkPathNodes(entranceWorld, room) : null;
    const walkStart = tunnelNodes ? tunnelNodes[tunnelNodes.length - 1]! : entranceWorld;
    const path = seatApproachPath(walkStart, walkTable, seatIndex, room, obstacles, AVATAR_BODY_R);
    // path[0] === walkStart (the lead-out) — prepend the mouth + bay nodes so
    // the spline is one continuous entrance → tunnel → aisle → seat walk.
    if (tunnelNodes) path.unshift(entranceWorld, ...tunnelNodes.slice(0, -1));
    // Retarget the final step-in: the walk used to end ON the chair; the sit
    // clip owns the last half-metre, so end at its approach point instead
    // (0.55 m behind the chair along −faceY — where the controller takes over).
    path[path.length - 1] = approachPoint(seat, SIT_TIMING.APPROACH_M);
    // Per-frame clamp discs EXCLUDE the destination table's footprint: its
    // avoidance ring (tableAvoidR = footprint + 0.8 m) contains the approach
    // point, so keeping it would shove the walker off the hand-off spot every
    // frame and the sit clip would start with a visible position snap. The
    // path above still ROUTES around the destination (leg 1 ends outside the
    // ring; leg 2 is a clean radial step-in that can't cross the tabletop), so
    // dropping the clamp only relaxes the chord re-clamp on that one table's
    // final metre. On cramped back-to-back layouts a NEIGHBOURING table's
    // footprint (or a fixture) can reach the hand-off spot too — those
    // specific discs are dropped the same way (dropDiscsContaining; the rest
    // of the neighbour's capsule stays solid), or they'd shove the walker
    // 0.4–0.9 m off the spot every frame near arrival. The chair discs STAY
    // in the clamp — their own dest-chair + corridor exclusions already leave
    // the hand-off strip clear, and they're what keeps that final metre from
    // clipping the neighbouring seat backs.
    const handOff = path[path.length - 1]!;
    const clampObstacles = buildObstacleGrid([
      ...dropDiscsContaining(
        [...floorObstacles(floor, tables, room, [walkTable.id]), ...fixtureObstacles],
        handOff,
        AVATAR_BODY_R,
      ),
      ...chairDiscs,
    ]);
    const durationMs = Math.max(WALK_MIN_MS, (pathLength(path) / WALK_SPEED_MPS) * 1000);
    setWalk({
      path,
      obstacles: clampObstacles,
      startedAt: performance.now(),
      durationMs,
      onComplete: () => beginSit(walkerHeadingRef.current ?? seat.faceY),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkGuest?.id, walkTable?.id, Boolean(roam), coldSpark]);

  // ── ROAM: entering the mode takes a small step-in from wherever the figure
  // is (seat after a finished walk, entrance on a fresh start) so the chase
  // camera settles behind them facing INTO the room, not at a wall.
  useEffect(() => {
    if (!roam) return;
    const start = walkerPosRef.current ?? entranceWorld;
    const toCenter = Math.hypot(start.x, start.z) || 1;
    const nudge = { x: start.x - (start.x / toCenter) * 1.2, z: start.z - (start.z / toCenter) * 1.2 };
    // The full roam grid (footprints + every chair + fixtures): the step-in has
    // no seat destination, so every chair is solid — including the one the
    // figure may be rising from, whose clamp is what walks them clear of it.
    const path = steerPath(start, nudge, roamObstacles, AVATAR_BODY_R);
    setWalk({ path, obstacles: roamObstacles, startedAt: performance.now(), durationMs: reducedMotion ? 1 : 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roam?.guestId]);

  // The sit clip landed (tuck flush, or the reduced-motion snap): only NOW does
  // the caller's onWalkComplete fire — the phone UI's "You're at <table>" line
  // must never precede the figure actually being in the chair.
  const handleSeated = () => {
    setArrived(true);
    // (The room-wide seated default made the old per-guest seatedIds ledger
    // unnecessary — every ambient guest sits now; 2026-07-08 collision pass.)
    onWalkComplete?.();
  };

  // Chair colour for the detached ActiveChair. The instance it replaces is
  // OCCUPIED-tinted (it's the walking guest's own seat): InstancedChairs lerps
  // base → accent by its 0.28 default over a white material, so mirror that
  // exact colour here or the detach/restore swap flashes. A null seatNumber
  // never entered occupiedSeats, so that seat keeps the plain base colour.
  const sitChairColor = useMemo(() => {
    if (!sit?.occupied) return palette.wall;
    return `#${new THREE.Color(palette.wall).lerp(new THREE.Color(palette.accent), 0.28).getHexString()}`;
  }, [sit?.occupied, palette]);

  // A press only counts as a TAP when it barely moved: the gesture layer flags
  // a look-drag via suppressTap, and R3F's e.delta (px between down and up)
  // covers the orbit view where the look handlers aren't attached.
  const TAP_MAX_PX = 8;

  const handleFloorTap = (e: ThreeEvent<MouseEvent>) => {
    if (!roam) return;
    // A swipe that ended over the floor is a LOOK, not a walk — swallow it.
    if (look.current.suppressTap || e.delta > TAP_MAX_PX) return;
    e.stopPropagation();
    // Clamp the tapped point inside the walls with a small margin.
    const margin = 0.4;
    const dest: Vec2 = {
      x: Math.max(-room.w / 2 + margin, Math.min(room.w / 2 - margin, e.point.x)),
      z: Math.max(-room.d / 2 + margin, Math.min(room.d / 2 - margin, e.point.z)),
    };
    walkToPoint(dest, roamObstacles);
  };

  // Tap the guest's own gold-ringed seat → walk there via the same "Where am I
  // seated?" approach (route around the table, step in from outside).
  const handleSeatTap = (e: ThreeEvent<MouseEvent>) => {
    if (!roam || !roamGuest) return;
    if (look.current.suppressTap || e.delta > TAP_MAX_PX) return;
    e.stopPropagation();
    const t = tablesById.get(roamGuest.tableId);
    if (!t) return;
    look.current.yawOffset = 0; // committing to the seat walk releases the look
    const from = walkerPosRef.current ?? entranceWorld;
    if (reducedMotion) {
      setWalk({ path: [seatWorld(t, roamGuest.seatNumber ?? 0, room)], obstacles: [], startedAt: performance.now(), durationMs: 1 });
      return;
    }
    // This walk HAS a seat destination, so the shared roam grid (every chair
    // solid) would both wall off the chair and clamp-shove the figure off it
    // on arrival. Build the dest-aware sets the scripted walk uses instead:
    // own chair + its approach corridor excluded (chairObstaclesForWalk), and
    // the per-frame clamp additionally drops the destination table's footprint
    // (its avoidance ring contains the seat — same hand-off reasoning as the
    // scripted walk above). Per-tap grid builds are fine: ~a few hundred discs,
    // engine-documented as cheap enough to rebuild per FRAME, and taps are rare.
    const seatIndex = Math.max(0, Math.min(t.capacity - 1, roamGuest.seatNumber ?? 0));
    const chairDiscs = chairObstaclesForWalk(tables, room, { tableId: t.id, seatNumber: seatIndex });
    const pathObstacles = buildObstacleGrid([
      ...floorObstacles(floor, tables, room, []),
      ...fixtureObstacles,
      ...chairDiscs,
    ]);
    const path = seatApproachPath(from, t, seatIndex, room, pathObstacles, AVATAR_BODY_R);
    // Same neighbour-footprint relief as the scripted walk: a back-to-back
    // table's capsule disc can contain the chair itself — drop exactly the
    // discs that do, or the clamp shoves the figure off the seat on arrival.
    const arrivePoint = path[path.length - 1]!;
    const clampObstacles = buildObstacleGrid([
      ...dropDiscsContaining(
        [...floorObstacles(floor, tables, room, [t.id]), ...fixtureObstacles],
        arrivePoint,
        AVATAR_BODY_R,
      ),
      ...chairDiscs,
    ]);
    const durationMs = Math.min(6500, Math.max(WALK_MIN_MS, (pathLength(path) / WALK_SPEED_MPS) * 1000));
    setWalk({ path, obstacles: clampObstacles, startedAt: performance.now(), durationMs });
  };

  // Tap a booth → open its vendor card. (Not gated on `roam`: the desktop
  // whole-room overlay can inspect booths too.)
  const handleBoothTap = (booth: Lab3DBooth, e: ThreeEvent<MouseEvent>) => {
    if (look.current.suppressTap || e.delta > TAP_MAX_PX) return;
    e.stopPropagation();
    setOpenBooth(booth);
  };

  // "Walk to this booth": steer to a point just in front of it, facing it.
  const handleWalkToBooth = (booth: Lab3DBooth) => {
    if (!roam) return;
    const { point } = boothApproach(booth, room);
    walkToPoint(point, roamObstacles);
  };

  const roomSpan = Math.max(room.w, room.d);
  const initialCamPos: [number, number, number] = interactive
    ? [0, roomSpan * 0.62, roomSpan * 0.62]
    : [entranceWorld.x, 1.6, entranceWorld.z + 1.5];

  // Swipe-to-look drives the chase camera only while roaming (the whole-room
  // orbit view uses OrbitControls). Spread the look handlers onto the Canvas
  // just in that mode so they never fight OrbitControls' own drag.
  const canvasLookHandlers = roam ? lookHandlers : undefined;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: initialCamPos, fov: 48, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ ...RECOMMENDED_TONEMAP }}
      onPointerMissed={() => {}}
      {...canvasLookHandlers}
    >
      <color attach="background" args={[bgColor]} />
      <SceneLighting
        palette={palette}
        quality={quality}
        room={room}
        grade={cinematic ? 'play' : 'standard'}
      />

      {/* Cinematic Tier A (Fable §3.5): warm string-light strands over the
          room — static instances, one draw, so they ride even 'low' (the
          phone walk). 'low' halves the strand count inside the component.
          Skips when the couple's OWN ceiling decor occupies the hang band
          (fairy lights / chandeliers / lanterns / hanging florals — see
          ceilingDecorOccupied). */}
      {cinematic && !ceilingDecorOccupied(receptionDesign, archetype) ? (
        <StringLights room={room} palette={palette} quality={quality} />
      ) : null}

      {/* Wave 2b: archetype room shell (garden greenery / chapel windows / …). */}
      <VenueShell archetype={archetype} room={room} palette={palette} quality={quality} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={roam ? handleFloorTap : undefined}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial
          color={floorColor}
          roughness={0.9}
          roughnessMap={floorRoughnessMap()}
          map={floorAlbedoMap()}
          bumpMap={floorBumpMap()}
          bumpScale={0.02}
        />
      </mesh>
      <mesh
        position={[pctToWorld(floor.stage.xPct, floor.stage.yPct, room).x, 0.14, pctToWorld(floor.stage.xPct, floor.stage.yPct, room).z]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[Math.max(1.5, (floor.stage.wPct / 100) * room.w), 0.28, Math.max(1, (floor.stage.hPct / 100) * room.d)]}
        />
        <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Dance floor — the mood-board mural (Fable §3.7). This room previously
          had NO dance mesh: `floor.dance` fed the walk obstacles only, so the
          walker dodged an invisible rectangle. Themed view paints the couple's
          palette; the neutral view gets the mural's template triple. raycast is
          off inside the component, so roam floor-taps pass through to the
          floor plane beneath. */}
      <DanceFloorMural floor={floor} room={room} rolePalette={rolePalette ?? null} />

      <EntranceMark position={entranceWorld} palette={palette} />

      {tables.map((t) => (
        <TableMesh key={t.id} table={t} room={room} palette={palette} occupiedSeats={occupiedByTable.get(t.id)} />
      ))}

      {/* Placed venue fixtures — objects · booths · signs · cocktail room.
          Scene quality flows to the booth templates' staff mascots ('low'
          bakes them — the phone budget knob). */}
      <VenueFixtures
        room={room}
        palette={palette}
        objects={sceneObjects}
        booths={booths}
        signs={signs}
        cocktail={cocktail}
        quality={quality}
      />

      {/* Wave 2b: mood-board reception treatments (chandeliers / backdrop /
          centrepieces / entrance arch). Only when the couple's design reached
          us AND the theming toggle is on — the neutral view stays undecorated. */}
      {receptionDesign ? (
        <VenueDecor
          design={receptionDesign}
          floor={floor}
          tables={tables}
          room={room}
          palette={palette}
          quality={quality}
          archetype={archetype}
          tunnelProgressRef={tunnelProgressRef}
        />
      ) : null}

      {/* Cold-spark sequencing feed: projects the walker's live position onto
          the tunnel axis every frame and writes the path-t the fountains ramp
          from (−1 when nobody walks → idle shimmer). Roam walks feed it too —
          wandering back through the tunnel fires the pairs you pass. */}
      {tunnelFrame ? (
        <ColdSparkWalkFeed
          frame={tunnelFrame}
          posRef={walkerPosRef}
          active={Boolean(walk)}
          out={tunnelProgressRef}
        />
      ) : null}

      {/* Invisible per-booth tap targets over the (shared) BoothMesh visuals —
          tapping opens the vendor card. Kept separate from VenueFixtures so the
          shared fixture renderer stays a pure visual (no interaction coupling). */}
      {booths.map((b) => (
        <BoothHitTarget key={b.id} booth={b} room={room} onTap={handleBoothTap} interactive={Boolean(roam) || interactive} />
      ))}

      {guests.map((g) => {
        // The guest currently mid-walk (or roaming) is drawn by the Walker —
        // and mid-/post-sit by the SitController's figure — never both.
        if ((walk || sit) && walkGuest && g.id === walkGuest.id) return null;
        if (roamGuest && g.id === roamGuest.id) return null;
        const table = tablesById.get(g.tableId);
        if (!table) return null;
        const pos = seatWorld(table, g.seatNumber ?? 0, room);
        // Face the figure toward its own table centre — a standing-at-seat
        // crowd all staring the same way reads wrong; heading was meaningless
        // on the old rotationally-symmetric token, so nothing else changes.
        const tableCentre = pctToWorld(table.xPct, table.yPct, room);
        return (
          <GuestToken
            key={g.id}
            position={pos}
            heading={Math.atan2(tableCentre.x - pos.x, tableCentre.z - pos.z)}
            spec={figureSpecs.get(g.id)!}
            name={g.name}
            quality={quality}
            seated
            // This guest's static body is drawn by <InstancedSeatedCrowd>; keep
            // only its hit/hover cylinder so tap-to-open-card still works.
            bodyless={instancedIds.has(g.id)}
            onClick={
              interactive && onGuestClick
                ? (e) => {
                    e.stopPropagation();
                    onGuestClick(g.id);
                  }
                : undefined
            }
          />
        );
      })}

      {/* The static seated crowd, one instanced batch for the whole room (photo
          guests + the active walk/sit/roam guest stay individual above). Only
          mounted when the seated figures would be static (quality 'low' or
          reduced motion); at quality 'high' + motion crowdSeats is empty and
          every figure keeps its individual idle sway. `quality={quality}` so the
          batch's shadow pass matches what the individual figures cast. */}
      {crowdSeats.length > 0 ? <InstancedSeatedCrowd seats={crowdSeats} quality={quality} /> : null}

      {/* Emote bubbles (Fable §3.6): pooled sprites, ≤6, wall-clock rotation —
          side/rsvp-generic glyphs only (the demo slice carries no status). */}
      {emoteEmitters.length > 0 ? <EmoteBubbles emitters={emoteEmitters} /> : null}

      {/* Destination beacon: where the scripted walk is headed, shown until the
          avatar arrives so the guest can see their seat before the figure lands. */}
      {!roam && walk && walkSeat && !arrived ? (
        <SeatDestinationMarker
          position={walkSeat}
          color={walkGuest ? SIDE_COLOR[walkGuest.side] : palette.accent}
        />
      ) : null}

      {/* The roaming guest's own seat, marked in gold — "find my seat" still
          works inside free roam. Now TAPPABLE: tap the ring (or its chair area)
          to walk there via the same seat-approach path, with a gentle pulse +
          hover cursor as the affordance. */}
      {roam && roamSeat ? (
        <OwnSeatMarker position={roamSeat} color={palette.accent} onTap={handleSeatTap} reducedMotion={reducedMotion} />
      ) : null}

      {walk ? (
        <Walker
          walk={walk}
          camSeededRef={chaseCamSeeded}
          // The walking/roaming guest keeps the exact spec they wear seated.
          // A walk state with no matching guest (the roam step-in doesn't
          // structurally require one) falls back to a neutral kit figure in
          // the palette accent — the old `palette.accent` token, re-expressed.
          spec={
            (roamGuest ?? walkGuest ? figureSpecs.get((roamGuest ?? walkGuest)!.id) : undefined) ?? {
              id: 'plan3d-walker',
              outfit: 'neutral',
              outfitColor: null,
              statusColor: palette.accent,
            }
          }
          name={(roamGuest ?? walkGuest)?.name}
          posRef={walkerPosRef}
          headingRef={walkerHeadingRef}
          // Swipe-to-look only steers the roam chase camera; the scripted seat
          // walk keeps its cinematic auto-facing (no look ref passed then).
          look={roam ? look : null}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {/* The sit clip: the Walker delivered the figure to the approach point
          and unmounted; the controller now owns figure + (detached) chair for
          pull-back → turn+sit → tuck. It stays mounted holding the flush
          seated pose while `walkTarget` persists (the crowd has no seated
          render path on this surface yet — unmounting would pop the figure
          back to standing); leaving cleans up + restores the instanced chair.
          Nothing writes the camera during the clip, so it holds its frame. */}
      {sit && walkGuest && !roam ? (
        <SitController
          key={`${sit.tableId}:${sit.seatIndex}`}
          seat={sit.seat}
          tableId={sit.tableId}
          seatIndex={sit.seatIndex}
          arriveHeading={sit.arriveHeading}
          chairColor={sitChairColor}
          onSeated={handleSeated}
        >
          {(pose) => (
            // Same spec as seated/walking — the guest never re-dresses. Always
            // 'high': this is the single player figure (the Walker's own rule).
            <Figure spec={figureSpecs.get(walkGuest.id)!} name={walkGuest.name} pose={pose} quality="high" />
          )}
        </SitController>
      ) : null}

      {interactive && !walk && !sit && !roam ? (
        <OrbitControls
          target={[0, 0.6, 0]}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={roomSpan * 0.25}
          maxDistance={roomSpan * 1.1}
          enablePan={false}
        />
      ) : null}
    </Canvas>

    {/* Booth vendor card (bottom sheet / side drawer). Outside the Canvas — it's
        2D chrome. Backdrop-tap / X / ESC close it via the shared Sheet. */}
    <BoothVendorCard booth={openBooth} onClose={() => setOpenBooth(null)} onWalkTo={handleWalkToBooth} />
    </div>
  );
}

/**
 * An invisible, slightly-oversized box over a booth's footprint that catches the
 * tap and opens the vendor card. Separate from the shared `BoothMesh` visual so
 * the fixture renderer stays interaction-free (the theming branch mounts decor
 * there). Sets a pointer cursor on hover for a desktop affordance.
 */
function BoothHitTarget({
  booth,
  room,
  onTap,
  interactive,
}: {
  booth: Lab3DBooth;
  room: { w: number; d: number };
  onTap: (booth: Lab3DBooth, e: ThreeEvent<MouseEvent>) => void;
  interactive: boolean;
}) {
  const pos = useMemo(() => pctToWorld(booth.xPct, booth.yPct, room), [booth.xPct, booth.yPct, room]);
  // Sized to the resolved chassis (a food truck's cab, a riser's deck and a
  // backdrop's panel all extend past the old fixed 2.3×1.3×1.3 box); generic
  // booths keep the historical box.
  const hit = useMemo(() => boothHitVolume(booth), [booth]);
  // Rotate the tap box by the booth's computed facing so the non-square /
  // front-shifted volume tracks the rotated chassis (no dead tap zones).
  const facingY = useMemo(() => boothFacingY({ xPct: booth.xPct, yPct: booth.yPct }, room), [booth.xPct, booth.yPct, room]);
  const hc = useMemo(() => rotateLocalRad({ x: hit.center[0], z: hit.center[2] }, facingY), [hit, facingY]);
  if (!interactive) return null;
  return (
    <mesh
      position={[pos.x + hc.x, hit.center[1], pos.z + hc.z]}
      rotation={[0, facingY, 0]}
      onClick={(e) => onTap(booth, e)}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {/* A touch larger than the booth's chassis so it's easy to hit; the
          material is invisible (a pure hit volume, never rendered). */}
      <boxGeometry args={[hit.size[0], hit.size[1], hit.size[2]]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/**
 * Feeds the cold-spark tunnel's fountain sequencing: every frame, project the
 * walker's live (post-clamp) position onto the tunnel axis and write the
 * path-t along the tunnel segment into `out` (−1 when no walk is live → the
 * tunnel idles at low shimmer). Render-less; the projection is pure
 * (`coldSparkProgress`) and LATERALLY GATED — a walker off the corridor's
 * centreline strip reads −1, so a roam walk elsewhere in the room never
 * sequences the fountains — and the value is always the walker's CURRENT
 * truth, never an accumulated animation state (the wall-clock law).
 */
function ColdSparkWalkFeed({
  frame,
  posRef,
  active,
  out,
}: {
  frame: ColdSparkFrame;
  posRef: React.MutableRefObject<Vec2 | null>;
  active: boolean;
  out: React.MutableRefObject<number>;
}) {
  useFrame(() => {
    const p = active ? posRef.current : null;
    out.current = p ? coldSparkProgress(p, frame) : -1;
  });
  return null;
}

/**
 * The roaming guest's own seat marker: a gold floor ring + a floating pip, gently
 * pulsing so it reads as "tap me to sit". Tapping walks the figure there.
 */
function OwnSeatMarker({
  position,
  color,
  onTap,
  reducedMotion,
}: {
  position: Vec2;
  color: string;
  onTap: (e: ThreeEvent<MouseEvent>) => void;
  reducedMotion?: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !ring.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.14;
    ring.current.scale.set(pulse, pulse, 1);
  });
  return (
    <group
      position={[position.x, 0, position.z]}
      onClick={onTap}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {/* An invisible tappable disc over the chair area (easier hit than the thin ring). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.26, 0.4, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}


