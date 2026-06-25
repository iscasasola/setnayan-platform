'use client';

/**
 * Guest-facing 3D venue explorer (Sims-style; owner 2026-06-26). READ-ONLY — a
 * separate, self-contained scene (no editor coupling) fed by the privacy-scoped
 * `public_venue_scene` RPC: room geometry + ANONYMISED occupancy, plus the
 * guest's own seat/tablemates when they opened their personal link. The guest's
 * avatar auto-walks from the entrance to their seat, then TAP-TO-ROAM lets them
 * walk anywhere — pathfinding around tables / objects via the SAME tested
 * primitives (steerPath / floorObstacles / sceneObjectObstacles) the couple's
 * lab + crowd use. All math is unit-tested in lib; the visual FEEL is the part
 * to confirm on a preview.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  roomSize,
  pctToWorld,
  tableDims,
  shapeHintFor,
  chairLocalPositions,
  seatWorld,
  steerPath,
  floorObstacles,
  resolvePalette,
  type Lab3DFloor,
  type Lab3DTable,
  type Lab3DPalette,
  type Vec2,
} from '@/lib/seating-3d';

export type VenueScene = {
  published: boolean;
  floor: {
    venueWidthM: number | null;
    venueLengthM: number | null;
    stage: { xPct: number; yPct: number; wPct: number; hPct: number };
    entrance: { enabled: boolean; xPct: number; yPct: number };
    dance: { enabled: boolean; xPct: number; yPct: number; wPct: number; hPct: number };
  };
  tables: { id: string; type: string; capacity: number; xPct: number; yPct: number; rotationDeg: number; removedSeats: number[] }[];
  objects: { kind: string; xPct: number; yPct: number; rotationDeg: number }[];
  occupancy: { table: string; seats: number[] }[];
  you: { table: string; seatNumber: number; tablemates: { name: string; seatNumber: number }[] } | null;
};

const CHAIR_GEO = new THREE.BoxGeometry(0.42, 0.5, 0.42);
const TOKEN_GEO = new THREE.CylinderGeometry(0.14, 0.16, 0.5, 10);

/** One table: a top + chairs, occupied seats get a token, the guest's own seat glows. */
function GuestTable({
  table,
  room,
  palette,
  occupied,
  yourSeat,
}: {
  table: Lab3DTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  occupied: Set<number> | undefined;
  yourSeat: number | null;
}) {
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  const chairs = useMemo(() => chairLocalPositions(table.shape, table.capacity), [table.shape, table.capacity]);
  const home = useMemo(() => pctToWorld(table.xPct, table.yPct, room), [table.xPct, table.yPct, room]);
  return (
    <group position={[home.x, 0, home.z]} rotation={[0, (-table.rotationDeg * Math.PI) / 180, 0]}>
      {dims.round ? (
        <mesh position={[0, 0.74, 0]}>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.08, 28]} />
          <meshStandardMaterial color={palette.table} roughness={0.5} />
        </mesh>
      ) : (
        <mesh position={[0, 0.74, 0]}>
          <boxGeometry args={[dims.w, 0.08, dims.d]} />
          <meshStandardMaterial color={palette.table} roughness={0.5} />
        </mesh>
      )}
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.72, 10]} />
        <meshStandardMaterial color={palette.wall} roughness={0.7} />
      </mesh>
      {chairs.map((c, i) => {
        const ang = Math.atan2(c.x, c.z);
        const taken = occupied?.has(i);
        const mine = yourSeat === i;
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
            <mesh geometry={CHAIR_GEO} position={[0, 0.25, 0]}>
              <meshStandardMaterial color={palette.wall} roughness={0.75} />
            </mesh>
            {taken ? (
              <mesh geometry={TOKEN_GEO} position={[0, 0.75, -0.04]}>
                <meshStandardMaterial color={mine ? palette.accent : palette.table} roughness={0.5} emissive={mine ? palette.accent : '#000'} emissiveIntensity={mine ? 0.5 : 0} />
              </mesh>
            ) : null}
            {mine ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.32, 0.42, 28]} />
                <meshBasicMaterial color={palette.accent} side={THREE.DoubleSide} transparent opacity={0.95} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/** The guest's own avatar: auto-walks to `target`, re-paths whenever it changes. */
function GuestAvatar({
  entrance,
  target,
  obstacles,
  palette,
}: {
  entrance: Vec2;
  target: Vec2;
  obstacles: { c: Vec2; r: number }[];
  palette: Lab3DPalette;
}) {
  const ref = useRef<THREE.Group>(null);
  const path = useRef<Vec2[]>([]);
  const idx = useRef(0);
  const t = useRef(0);
  const pos = useRef<Vec2>({ x: entrance.x, z: entrance.z });

  useEffect(() => {
    const start = pos.current;
    path.current = steerPath(start, target, obstacles, 0.2);
    idx.current = 0;
  }, [target, obstacles]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const p = path.current;
    if (idx.current < p.length - 1) {
      const next = p[idx.current + 1]!;
      const dx = next.x - g.position.x;
      const dz = next.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      const step = 2.2 * delta;
      if (dist <= step) {
        g.position.x = next.x;
        g.position.z = next.z;
        idx.current += 1;
      } else {
        g.position.x += (dx / dist) * step;
        g.position.z += (dz / dist) * step;
        g.rotation.y = Math.atan2(dx, dz);
      }
      g.position.y = Math.abs(Math.sin(t.current * 9)) * 0.06;
    } else {
      g.position.y += (0 - g.position.y) * Math.min(1, delta * 6);
    }
    pos.current = { x: g.position.x, z: g.position.z };
  });

  return (
    <group ref={ref} position={[entrance.x, 0, entrance.z]}>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.18, 0.5, 6, 12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} emissive={palette.accent} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={0.5} distance={3.5} color={palette.accent} />
    </group>
  );
}

export default function GuestVenue3D({ scene }: { scene: VenueScene }) {
  const floor: Lab3DFloor = useMemo(
    () => ({
      venueWidthM: scene.floor.venueWidthM,
      venueLengthM: scene.floor.venueLengthM,
      stage: scene.floor.stage,
      entrance: scene.floor.entrance,
      dance: scene.floor.dance,
      published: true,
    }),
    [scene],
  );
  const room = useMemo(() => roomSize(floor), [floor]);
  const palette = useMemo(() => resolvePalette([]), []);
  const tables: Lab3DTable[] = useMemo(
    () =>
      scene.tables.map((t) => ({
        id: t.id,
        label: '',
        type: t.type,
        shape: shapeHintFor(t.type),
        capacity: t.capacity,
        removedSeats: t.removedSeats ?? [],
        xPct: t.xPct,
        yPct: t.yPct,
        rotationDeg: t.rotationDeg,
        linkGroupId: null,
      })),
    [scene],
  );
  const occByTable = useMemo(() => new Map(scene.occupancy.map((o) => [o.table, new Set(o.seats)])), [scene]);
  const entrance = useMemo<Vec2>(
    () => (floor.entrance.enabled ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room) : pctToWorld(50, 96, room)),
    [floor, room],
  );
  // Obstacles the avatar steers around: every table except the guest's OWN (so
  // they can reach their chair), plus the stage + dance floor (via floorObstacles).
  // Venue-object discs slot in here once the object render lands.
  const obstacles = useMemo(
    () => floorObstacles(floor, tables, room, [scene.you?.table]),
    [floor, tables, room, scene.you],
  );
  const seatTarget = useMemo<Vec2 | null>(() => {
    if (!scene.you) return null;
    const t = tables.find((x) => x.id === scene.you!.table);
    return t ? seatWorld(t, scene.you.seatNumber, room) : null;
  }, [scene, tables, room]);

  // The avatar's live target: their seat on open, then wherever they tap.
  const [target, setTarget] = useState<Vec2 | null>(seatTarget);
  useEffect(() => setTarget(seatTarget), [seatTarget]);

  const stage = pctToWorld(floor.stage.xPct, floor.stage.yPct, room);
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);

  return (
    <div className="relative h-[82vh] w-full overflow-hidden rounded-2xl bg-[#0c0e14]">
      <Canvas shadows={false} dpr={[1, 1.5]} camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}>
        <color attach="background" args={['#0c0e14']} />
        <fog attach="fog" args={['#0c0e14', room.d * 1.4, room.d * 3.2]} />
        <ambientLight intensity={0.8} color={palette.ambient} />
        <hemisphereLight intensity={0.45} color={palette.ambient} groundColor={palette.floor} />
        <directionalLight position={[room.w * 0.5, room.d + 8, room.d * 0.4]} intensity={1.15} color="#fff6ea" />

        {/* Floor — tap anywhere to walk there (Sims roam). */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            const x = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
            const z = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
            setTarget({ x, z });
          }}
        >
          <planeGeometry args={[room.w, room.d]} />
          <meshStandardMaterial color={palette.floor} roughness={0.95} />
        </mesh>

        {/* Stage */}
        <mesh position={[stage.x, 0.15, stage.z]}>
          <boxGeometry args={[stageW, 0.3, stageD]} />
          <meshStandardMaterial color={palette.table} roughness={0.6} />
        </mesh>

        {tables.map((t) => (
          <GuestTable
            key={t.id}
            table={t}
            room={room}
            palette={palette}
            occupied={occByTable.get(t.id)}
            yourSeat={scene.you?.table === t.id ? scene.you.seatNumber : null}
          />
        ))}

        {target ? <GuestAvatar entrance={entrance} target={target} obstacles={obstacles} palette={palette} /> : null}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={room.d * 3}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-center text-sm text-white backdrop-blur-md">
          {scene.you ? (
            <>
              <p className="font-medium">You&rsquo;re at {scene.you.table}</p>
              {scene.you.tablemates.length > 1 ? (
                <p className="mt-0.5 text-xs text-white/75">
                  With {scene.you.tablemates.map((m) => m.name).slice(0, 6).join(' · ')}
                  {scene.you.tablemates.length > 6 ? ' …' : ''}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-white/55">Tap the floor to walk around · drag to look · pinch to zoom</p>
            </>
          ) : (
            <p className="text-[12px] text-white/75">Open your personal invite link to find your seat · tap the floor to explore</p>
          )}
        </div>
      </div>
    </div>
  );
}
