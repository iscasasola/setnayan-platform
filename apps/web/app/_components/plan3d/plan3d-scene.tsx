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
 * simple primitives, no textures, no monogram, reuses the pure geometry math
 * from `lib/seating-3d.ts` (the couple lab's engine) so table shapes/seat
 * positions match the real product exactly.
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
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  roomSize,
  pctToWorld,
  seatWorld,
  tableDims,
  floorObstacles,
  pushOutOfDiscs,
  steerPath,
  seatApproachPath,
  resolvePalette,
  resolvePaletteFromRoles,
  SIDE_COLOR,
  type Lab3DTable,
  type Lab3DFloor,
  type Lab3DPalette,
  type Vec2,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import type { Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';

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
}: {
  table: Lab3DTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
}) {
  const pos = pctToWorld(table.xPct, table.yPct, room);
  const dims = tableDims(table.shape, table.capacity);
  const ry = (-table.rotationDeg * Math.PI) / 180;
  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry, 0]}>
      {dims.round ? (
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.06, 24]} />
          <meshStandardMaterial color={palette.table} />
        </mesh>
      ) : (
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.w, 0.06, dims.d || dims.w]} />
          <meshStandardMaterial color={palette.table} />
        </mesh>
      )}
      {/* one leg-post per table, purely for a grounded look at low-poly cost */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.36, 8]} />
        <meshStandardMaterial color={palette.wall} />
      </mesh>
    </group>
  );
}

function GuestToken({
  position,
  color,
  onClick,
}: {
  position: Vec2;
  color: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={[position.x, 0, position.z]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (onClick) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.19, 0.5, 10]} />
        <meshStandardMaterial color={color} emissive={hovered ? color : '#000000'} emissiveIntensity={hovered ? 0.35 : 0} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color={color} emissive={hovered ? color : '#000000'} emissiveIntensity={hovered ? 0.35 : 0} />
      </mesh>
    </group>
  );
}

function EntranceMark({ position, palette }: { position: Vec2; palette: Lab3DPalette }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[-0.55, 0.55, 0]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={palette.accent} />
      </mesh>
      <mesh position={[0.55, 0.55, 0]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={palette.accent} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[1.3, 0.08, 0.1]} />
        <meshStandardMaterial color={palette.accent} />
      </mesh>
    </group>
  );
}

/**
 * A pulsing "you're headed here" beacon planted on the target chair while the
 * guest walks to it — so they can SEE their destination before the avatar
 * arrives. Reuses the roam seat's gold ring + floating dot vocabulary, animated,
 * and topped with a downward pin + a faint light column legible across the room.
 */
function SeatDestinationMarker({ position, color }: { position: Vec2; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  const pin = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 3.2) * 0.16;
    if (ring.current) ring.current.scale.set(pulse, pulse, 1);
    if (pin.current) pin.current.position.y = 1.55 + Math.sin(t * 3.2) * 0.12;
  });
  return (
    <group position={[position.x, 0, position.z]}>
      {/* pulsing floor ring on the chair */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.32, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* faint light column so the destination reads from across the room */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.9, 8, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.13} side={THREE.DoubleSide} />
      </mesh>
      {/* bobbing downward pin marking the exact seat */}
      <group ref={pin} position={[0, 1.55, 0]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.15, 0.34, 4]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
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

type WalkState = {
  path: Vec2[];
  /** Obstacle discs to re-clamp out of every frame (empty for a teleport). */
  obstacles: { c: Vec2; r: number }[];
  startedAt: number;
  durationMs: number;
  onComplete?: () => void;
};

function Walker({
  walk,
  color,
  posRef,
}: {
  walk: WalkState;
  color: string;
  /** Live walker position, shared out so roam taps can path FROM wherever the figure stands. */
  posRef?: React.MutableRefObject<Vec2 | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const firedRef = useRef(false);
  const headingRef = useRef<number | null>(null);
  const bobRef = useRef(0);
  const camReady = useRef(false);

  // Re-clamp discs carry the avatar's body radius on top of each obstacle's
  // own clearance, so the *edge* of the walker (not just its centre) clears.
  const clampDiscs = useMemo(
    () => walk.obstacles.map((d) => ({ c: d.c, r: d.r + AVATAR_BODY_R })),
    [walk.obstacles],
  );

  useFrame(({ camera }, delta) => {
    const raw = Math.min(1, (performance.now() - walk.startedAt) / walk.durationMs);
    const eased = smootherstep(raw);
    const sample = sampleAlongPath(walk.path, eased);
    // Collision guarantee: the interpolated chord between two path waypoints can
    // still dip inside a disc — re-clamp every frame so the avatar rounds the
    // table instead of clipping through it.
    const p = pushOutOfDiscs(sample.p, clampDiscs);
    // Share the live (re-clamped) position so a roam tap paths from here.
    if (posRef) posRef.current = p;

    // Smooth the facing toward the path heading (no snap-turn at each waypoint).
    const targetHeading = sample.heading;
    headingRef.current =
      headingRef.current == null
        ? targetHeading
        : lerpAngle(headingRef.current, targetHeading, damp(0.015, delta));
    const h = headingRef.current;

    // Subtle walk bob while moving; settles to the floor on arrival.
    bobRef.current += delta * (raw < 1 ? 9 : 0);
    const bob = raw < 1 ? Math.abs(Math.sin(bobRef.current)) * 0.045 : 0;

    if (groupRef.current) {
      groupRef.current.position.set(p.x, bob, p.z);
      groupRef.current.rotation.y = h;
    }

    // Third-person chase camera: trails behind + above, looking a little ahead
    // so "walking into the room" reads. Snap into place on the first frame
    // (else it eases in from the fixed initial pose), then damp thereafter.
    const camDist = 3.6;
    const camHeight = 2.5;
    const camTarget = new THREE.Vector3(p.x - Math.sin(h) * camDist, camHeight, p.z - Math.cos(h) * camDist);
    if (!camReady.current) {
      camera.position.copy(camTarget);
      camReady.current = true;
    } else {
      camera.position.lerp(camTarget, damp(0.0015, delta));
    }
    camera.lookAt(p.x + Math.sin(h) * 1.4, 0.9, p.z + Math.cos(h) * 1.4);

    if (raw >= 1 && !firedRef.current) {
      firedRef.current = true;
      walk.onComplete?.();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.19, 0.5, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export type Plan3DWalkRequest = { guestId: string } | null;
export type Plan3DRoamRequest = { guestId: string } | null;

export function Plan3DScene({
  tables,
  floor,
  guests,
  rolePalette,
  onGuestClick,
  walkTarget,
  onWalkComplete,
  roam,
  interactive = true,
}: {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  /** When set, the room recolours to the couple's mood board (owner toggle). */
  rolePalette?: RolePalette;
  onGuestClick?: (guestId: string) => void;
  walkTarget?: Plan3DWalkRequest;
  onWalkComplete?: () => void;
  /** Free-roam mode: the guest stands in the room and every floor tap steers
   *  them there. Mutually exclusive with `walkTarget` (callers pass one). */
  roam?: Plan3DRoamRequest;
  interactive?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const room = useMemo(() => roomSize(floor), [floor]);
  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const entranceWorld = useMemo(() => pctToWorld(entrancePct(floor).xPct, entrancePct(floor).yPct, room), [floor, room]);
  const palette = useMemo(
    () => (rolePalette ? resolvePaletteFromRoles(rolePalette) : NEUTRAL_PALETTE),
    [rolePalette],
  );

  const walkGuest = walkTarget ? guests.find((g) => g.id === walkTarget.guestId) ?? null : null;
  const walkTable = walkGuest ? tablesById.get(walkGuest.tableId) ?? null : null;

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
  // True once the scripted walk has reached the chair — hides the destination
  // beacon (the avatar now stands there) while the walk state itself persists.
  const [arrived, setArrived] = useState(false);
  // Where the figure currently stands — written every frame by <Walker>, read
  // when a roam tap needs a start point (or the seat/entrance before any walk).
  const walkerPosRef = useRef<Vec2 | null>(null);

  useEffect(() => {
    if (roam) return; // roam owns the walker — the scripted effect stays out
    if (!walkGuest || !walkTable) {
      setWalk(null);
      return;
    }
    setArrived(false); // fresh walk → show the destination beacon again
    const dest = seatWorld(walkTable, walkGuest.seatNumber ?? 0, room);
    // Route AROUND every table (the destination included) and step in to the
    // chair from outside — a guest walks around their table, never across it.
    const obstacles = floorObstacles(floor, tables, room, []);
    const path = seatApproachPath(entranceWorld, walkTable, walkGuest.seatNumber ?? 0, room, obstacles, AVATAR_BODY_R);
    const markArrived = () => {
      setArrived(true);
      onWalkComplete?.();
    };
    if (reducedMotion) {
      // Respect reduced motion: no animated walk, just settle on the seat.
      walkerPosRef.current = dest;
      markArrived();
      setWalk(null);
      return;
    }
    const durationMs = Math.max(WALK_MIN_MS, (pathLength(path) / WALK_SPEED_MPS) * 1000);
    setWalk({ path, obstacles, startedAt: performance.now(), durationMs, onComplete: markArrived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkGuest?.id, walkTable?.id, Boolean(roam)]);

  // ── ROAM: entering the mode takes a small step-in from wherever the figure
  // is (seat after a finished walk, entrance on a fresh start) so the chase
  // camera settles behind them facing INTO the room, not at a wall.
  useEffect(() => {
    if (!roam) return;
    const start = walkerPosRef.current ?? entranceWorld;
    const toCenter = Math.hypot(start.x, start.z) || 1;
    const nudge = { x: start.x - (start.x / toCenter) * 1.2, z: start.z - (start.z / toCenter) * 1.2 };
    const obstacles = floorObstacles(floor, tables, room, []);
    const path = steerPath(start, nudge, obstacles, AVATAR_BODY_R);
    setWalk({ path, obstacles, startedAt: performance.now(), durationMs: reducedMotion ? 1 : 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roam?.guestId]);

  const handleFloorTap = (e: ThreeEvent<MouseEvent>) => {
    if (!roam) return;
    e.stopPropagation();
    // Clamp the tapped point inside the walls with a small margin.
    const margin = 0.4;
    const dest: Vec2 = {
      x: Math.max(-room.w / 2 + margin, Math.min(room.w / 2 - margin, e.point.x)),
      z: Math.max(-room.d / 2 + margin, Math.min(room.d / 2 - margin, e.point.z)),
    };
    const from = walkerPosRef.current ?? entranceWorld;
    const obstacles = floorObstacles(floor, tables, room, []);
    const path = steerPath(from, dest, obstacles, AVATAR_BODY_R);
    if (reducedMotion) {
      setWalk({ path: [dest], obstacles: [], startedAt: performance.now(), durationMs: 1 });
      return;
    }
    const durationMs = Math.min(6500, Math.max(500, (pathLength(path) / ROAM_SPEED) * 1000));
    setWalk({ path, obstacles, startedAt: performance.now(), durationMs });
  };

  const roomSpan = Math.max(room.w, room.d);
  const initialCamPos: [number, number, number] = interactive
    ? [0, roomSpan * 0.62, roomSpan * 0.62]
    : [entranceWorld.x, 1.6, entranceWorld.z + 1.5];

  return (
    <Canvas
      shadows
      camera={{ position: initialCamPos, fov: 48, near: 0.1, far: 200 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      onPointerMissed={() => {}}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[room.w * 0.4, 10, room.d * 0.3]} intensity={1.05} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={roam ? handleFloorTap : undefined}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={palette.floor} />
      </mesh>
      <mesh
        position={[pctToWorld(floor.stage.xPct, floor.stage.yPct, room).x, 0.14, pctToWorld(floor.stage.xPct, floor.stage.yPct, room).z]}
      >
        <boxGeometry
          args={[Math.max(1.5, (floor.stage.wPct / 100) * room.w), 0.28, Math.max(1, (floor.stage.hPct / 100) * room.d)]}
        />
        <meshStandardMaterial color={palette.accent} />
      </mesh>
      <EntranceMark position={entranceWorld} palette={palette} />

      {tables.map((t) => (
        <TableMesh key={t.id} table={t} room={room} palette={palette} />
      ))}

      {guests.map((g) => {
        // The guest currently mid-walk (or roaming) is drawn by the Walker instead — never both.
        if (walk && walkGuest && g.id === walkGuest.id) return null;
        if (roamGuest && g.id === roamGuest.id) return null;
        const table = tablesById.get(g.tableId);
        if (!table) return null;
        const pos = seatWorld(table, g.seatNumber ?? 0, room);
        return (
          <GuestToken
            key={g.id}
            position={pos}
            color={SIDE_COLOR[g.side]}
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

      {/* Destination beacon: where the scripted walk is headed, shown until the
          avatar arrives so the guest can see their seat before the figure lands. */}
      {!roam && walk && walkSeat && !arrived ? (
        <SeatDestinationMarker
          position={walkSeat}
          color={walkGuest ? SIDE_COLOR[walkGuest.side] : palette.accent}
        />
      ) : null}

      {/* The roaming guest's own seat, marked in gold — "find my seat" still
          works inside free roam by just walking to the ring. */}
      {roam && roamSeat ? (
        <group position={[roamSeat.x, 0, roamSeat.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.26, 0.4, 24]} />
            <meshBasicMaterial color={palette.accent} />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshBasicMaterial color={palette.accent} />
          </mesh>
        </group>
      ) : null}

      {walk ? (
        <Walker
          walk={walk}
          color={roamGuest ? SIDE_COLOR[roamGuest.side] : walkGuest ? SIDE_COLOR[walkGuest.side] : palette.accent}
          posRef={walkerPosRef}
        />
      ) : null}

      {interactive && !walk && !roam ? (
        <OrbitControls
          target={[0, 0.6, 0]}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={roomSpan * 0.25}
          maxDistance={roomSpan * 1.1}
          enablePan={false}
        />
      ) : null}
    </Canvas>
  );
}
