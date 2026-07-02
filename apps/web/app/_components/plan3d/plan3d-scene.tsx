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
 *     "Where am I seated?", then a scripted entrance→seat walk (`walkActive`)
 *
 * Low-poly on purpose (brief note: "a low-poly room is fine on mobile") —
 * simple primitives, no textures, no monogram, reuses the pure geometry math
 * from `lib/seating-3d.ts` (the couple lab's engine) so table shapes/seat
 * positions match the real product exactly.
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
  tableAvoidR,
  floorObstacles,
  steerPath,
  SIDE_COLOR,
  resolvePalette,
  type Lab3DTable,
  type Lab3DFloor,
  type Vec2,
} from '@/lib/seating-3d';
import type { Plan3DGuest } from '@/app/_actions/plan3d-demo-actions';

const PALETTE = resolvePalette([]); // the lab's neutral default — no mood-board dependency for a demo

/** Sample fallback entrance (mirrors the couple lab's own fallback when the
 *  couple never placed one — `{ xPct: 50, yPct: 96 }` in seating-lab-3d.tsx). */
function entrancePct(floor: Lab3DFloor): { xPct: number; yPct: number } {
  return floor.entrance.enabled ? floor.entrance : { xPct: 50, yPct: 96 };
}

function TableMesh({ table, room }: { table: Lab3DTable; room: { w: number; d: number } }) {
  const pos = pctToWorld(table.xPct, table.yPct, room);
  const dims = tableDims(table.shape, table.capacity);
  const ry = (-table.rotationDeg * Math.PI) / 180;
  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry, 0]}>
      {dims.round ? (
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.06, 24]} />
          <meshStandardMaterial color={PALETTE.table} />
        </mesh>
      ) : (
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.w, 0.06, dims.d || dims.w]} />
          <meshStandardMaterial color={PALETTE.table} />
        </mesh>
      )}
      {/* one leg-post per table, purely for a grounded look at low-poly cost */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.36, 8]} />
        <meshStandardMaterial color="#c9c1b3" />
      </mesh>
    </group>
  );
}

function GuestToken({
  position,
  color,
  label,
  onClick,
}: {
  position: Vec2;
  color: string;
  label?: string;
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
      {label ? (
        <mesh position={[0, 1.08, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ) : null}
    </group>
  );
}

function EntranceMark({ position }: { position: Vec2 }) {
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[-0.55, 0.55, 0]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={PALETTE.accent} />
      </mesh>
      <mesh position={[0.55, 0.55, 0]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color={PALETTE.accent} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[1.3, 0.08, 0.1]} />
        <meshStandardMaterial color={PALETTE.accent} />
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

type WalkState = { path: Vec2[]; startedAt: number; durationMs: number; onComplete?: () => void };

function Walker({ walk, color }: { walk: WalkState; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const firedRef = useRef(false);
  useFrame(({ camera }) => {
    const elapsed = performance.now() - walk.startedAt;
    const t = Math.min(1, elapsed / walk.durationMs);
    const { p, heading } = sampleAlongPath(walk.path, t);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, 0, p.z);
      groupRef.current.rotation.y = heading;
    }
    // Third-person chase camera: trails behind + above the walker, looking
    // slightly ahead so the "walk into the room" motion actually reads.
    const camDist = 3.4;
    const camHeight = 2.4;
    const camX = p.x - Math.sin(heading) * camDist;
    const camZ = p.z - Math.cos(heading) * camDist;
    camera.position.lerp(new THREE.Vector3(camX, camHeight, camZ), 0.12);
    const lookAt = new THREE.Vector3(p.x + Math.sin(heading) * 1.2, 0.9, p.z + Math.cos(heading) * 1.2);
    camera.lookAt(lookAt);
    if (t >= 1 && !firedRef.current) {
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

export function Plan3DScene({
  tables,
  floor,
  guests,
  onGuestClick,
  walkTarget,
  onWalkComplete,
  interactive = true,
}: {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  onGuestClick?: (guestId: string) => void;
  walkTarget?: Plan3DWalkRequest;
  onWalkComplete?: () => void;
  interactive?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const room = useMemo(() => roomSize(floor), [floor]);
  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const entranceWorld = useMemo(() => pctToWorld(entrancePct(floor).xPct, entrancePct(floor).yPct, room), [floor, room]);

  const walkGuest = walkTarget ? guests.find((g) => g.id === walkTarget.guestId) ?? null : null;
  const walkTable = walkGuest ? tablesById.get(walkGuest.tableId) ?? null : null;

  const [walk, setWalk] = useState<WalkState | null>(null);

  useEffect(() => {
    if (!walkGuest || !walkTable) {
      setWalk(null);
      return;
    }
    const dest = seatWorld(walkTable, walkGuest.seatNumber ?? 0, room);
    const obstacles = floorObstacles(floor, tables, room, [walkTable.id]);
    const path = steerPath(entranceWorld, dest, obstacles, tableAvoidR(walkTable) * 0.4);
    if (reducedMotion) {
      // Respect reduced motion: no animated walk, just settle on the seat.
      onWalkComplete?.();
      setWalk(null);
      return;
    }
    setWalk({ path, startedAt: performance.now(), durationMs: 5200, onComplete: onWalkComplete });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkGuest?.id, walkTable?.id]);

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>
      <mesh
        position={[pctToWorld(floor.stage.xPct, floor.stage.yPct, room).x, 0.14, pctToWorld(floor.stage.xPct, floor.stage.yPct, room).z]}
      >
        <boxGeometry
          args={[Math.max(1.5, (floor.stage.wPct / 100) * room.w), 0.28, Math.max(1, (floor.stage.hPct / 100) * room.d)]}
        />
        <meshStandardMaterial color={PALETTE.accent} />
      </mesh>
      <EntranceMark position={entranceWorld} />

      {tables.map((t) => (
        <TableMesh key={t.id} table={t} room={room} />
      ))}

      {guests.map((g) => {
        // The guest currently mid-walk is drawn by the Walker instead — never both.
        if (walk && walkGuest && g.id === walkGuest.id) return null;
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

      {walk ? <Walker walk={walk} color={walkGuest ? SIDE_COLOR[walkGuest.side] : PALETTE.accent} /> : null}

      {interactive && !walk ? (
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
