'use client';

/**
 * seating-lab-3d — the flag-gated 3D seating PROTOTYPE (React Three Fiber).
 *
 * What it proves: the couple's REAL plan rendered as a navigable 3D room, with
 * "Sims" build interactions (tap to select, drag to slide with game-feel weight,
 * tap-to-drop a new table) and the walk-to-seat payoff (pick a guest → an avatar
 * walks from the entrance, steering around tables, to their chair and sits).
 * Mood-board palette drives the lighting + materials, with a live switcher.
 *
 * Read-only: nothing here persists. Drags/drops are local React state only.
 * Performance: DPR capped, fake contact shadows (no per-mesh shadow maps),
 * lightweight waypoint steering instead of a NavMesh. Those + true GLTF models +
 * post-processing are the documented v2 upgrades.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import {
  type Lab3DTable,
  type Lab3DFloor,
  type Lab3DGuest,
  type Lab3DPalette,
  type Vec2,
  roomSize,
  pctToWorld,
  tableDims,
  chairLocalPositions,
  seatWorld,
  tableAvoidR,
  steerPath,
  resolvePalette,
  DEMO_PALETTES,
} from '@/lib/seating-3d';

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  paletteHexes: string[];
  coupleNames: string | null;
};

type LiveTable = Lab3DTable & { isNew?: boolean };
type SeatRef = { tableId: string; seatNumber: number };
type WalkerState = { name: string; path: Vec2[]; tableId: string } | null;

let NEW_SEQ = 0;

// Shared GPU buffers reused by every chair across every table (module-level
// constants are never disposed by R3F — safe to share). The big draw-call
// collapse (one InstancedMesh per shape) is the documented v2 upgrade.
const CHAIR_GEO = new THREE.BoxGeometry(0.34, 0.5, 0.34);
const PEDESTAL_GEO = new THREE.CylinderGeometry(0.12, 0.16, 0.72, 12);

export default function SeatingLab3D({ tables: initialTables, floor, guests, paletteHexes }: Props) {
  const room = useMemo(() => roomSize(floor), [floor]);
  const [mode, setMode] = useState<'build' | 'play'>('build');
  const [paletteKey, setPaletteKey] = useState('mood');
  const palette = useMemo<Lab3DPalette>(() => {
    if (paletteKey === 'mood') return resolvePalette(paletteHexes);
    return DEMO_PALETTES.find((p) => p.key === paletteKey)?.palette ?? resolvePalette(paletteHexes);
  }, [paletteKey, paletteHexes]);

  const [tables, setTables] = useState<LiveTable[]>(initialTables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addArmed, setAddArmed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [walker, setWalker] = useState<WalkerState>(null);
  const [arrived, setArrived] = useState<string | null>(null);

  // Local seat map (starts from the real assignments). The walk demo assigns
  // unseated guests into the first free chair — locally, never persisted.
  const [seats, setSeats] = useState<Map<string, SeatRef>>(() => {
    const m = new Map<string, SeatRef>();
    for (const g of guests) {
      if (g.seatedTableId && g.seatNumber != null) m.set(g.id, { tableId: g.seatedTableId, seatNumber: g.seatNumber });
    }
    return m;
  });

  // Live world-space drag target (avoids a React re-render every pointer move).
  const dragRef = useRef<{ id: string; x: number; z: number } | null>(null);

  const entranceWorld = useMemo<Vec2>(() => {
    const e = floor.entrance.enabled ? floor.entrance : { xPct: 50, yPct: 96 };
    return pctToWorld(e.xPct, e.yPct, room);
  }, [floor, room]);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const commitDrag = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!d) return;
    const xPct = Math.max(2, Math.min(98, (d.x / room.w + 0.5) * 100));
    const yPct = Math.max(2, Math.min(98, (d.z / room.d + 0.5) * 100));
    setTables((prev) => prev.map((t) => (t.id === d.id ? { ...t, xPct, yPct } : t)));
  }, [room]);

  useEffect(() => {
    // Commit on pointerup AND on interruptions (pointercancel / window blur):
    // on touch, a system gesture (scroll, back-swipe, app switch) fires
    // pointercancel with no pointerup, which would otherwise leave the table
    // glued to the finger and OrbitControls disabled until reload.
    const up = () => {
      if (dragRef.current) commitDrag();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
  }, [commitDrag]);

  const onTableDown = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (mode !== 'build') return;
      const t = tablesById.get(id);
      if (!t) return;
      const w = pctToWorld(t.xPct, t.yPct, room);
      dragRef.current = { id, x: w.x, z: w.z };
      setDraggingId(id);
    },
    [mode, room, tablesById],
  );

  const onFloorMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragRef.current) return;
      dragRef.current.x = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
      dragRef.current.z = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
    },
    [room],
  );

  const onFloorClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // R3F fires this native `click` even after a drag (orbit OR table move),
      // which would deselect / drop a stray table. `e.delta` is the pointer's
      // pixel travel since pointerdown — ignore anything that actually moved.
      if (e.delta > 4) return;
      if (mode !== 'build' || !addArmed) {
        if (mode === 'build') setSelectedId(null);
        return;
      }
      const xPct = Math.max(2, Math.min(98, (e.point.x / room.w + 0.5) * 100));
      const yPct = Math.max(2, Math.min(98, (e.point.z / room.d + 0.5) * 100));
      NEW_SEQ += 1;
      const id = `new-${NEW_SEQ}`;
      setTables((prev) => [
        ...prev,
        {
          id,
          label: `Table ${prev.length + 1}`,
          type: 'round_10',
          shape: 'round',
          capacity: 10,
          removedSeats: [],
          xPct,
          yPct,
          rotationDeg: 0,
          linkGroupId: null,
          isNew: true,
        },
      ]);
      setSelectedId(id);
      setAddArmed(false);
    },
    [mode, addArmed, room],
  );

  // Pick a guest → walk to their seat (seating them in the first free chair if
  // they have none), steering around the other tables.
  const sendGuest = useCallback(
    (g: Lab3DGuest) => {
      let seat = seats.get(g.id) ?? null;
      const nextSeats = new Map(seats);
      if (!seat) {
        for (const t of tables) {
          // Seed occupancy with the table's DELETED chairs (mirrors the
          // canonical computeAutoSeat) and scan the real capacity index range —
          // otherwise a removed low-index chair is offered as "free".
          const occupied = new Set<number>(
            t.removedSeats.filter((i) => Number.isInteger(i) && i >= 0 && i < t.capacity),
          );
          for (const [, s] of nextSeats) if (s.tableId === t.id) occupied.add(s.seatNumber);
          let free = -1;
          for (let i = 0; i < t.capacity; i++) if (!occupied.has(i)) { free = i; break; }
          if (free >= 0) {
            seat = { tableId: t.id, seatNumber: free };
            nextSeats.set(g.id, seat);
            setSeats(nextSeats);
            break;
          }
        }
      }
      if (!seat) return;
      const table = tablesById.get(seat.tableId);
      if (!table) return;
      const end = seatWorld(table, seat.seatNumber, room);
      const obstacles = tables
        .filter((t) => t.id !== seat!.tableId)
        .map((t) => ({ c: pctToWorld(t.xPct, t.yPct, room), r: tableAvoidR(t) }));
      const path = steerPath(entranceWorld, end, obstacles, 0.2);
      setMode('play');
      setArrived(null);
      setWalker({ name: g.name, path, tableId: seat.tableId });
    },
    [seats, tables, tablesById, room, entranceWorld],
  );

  const seatedCount = useMemo(() => {
    const ids = new Set<string>();
    for (const [gid, s] of seats) if (tablesById.has(s.tableId)) ids.add(gid);
    return ids.size;
  }, [seats, tablesById]);

  return (
    <div className="relative h-[82vh] w-full overflow-hidden rounded-2xl border border-ink/10 bg-[#11131a]">
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[mode === 'play' ? '#0c0e14' : '#13151c']} />
        <fog attach="fog" args={[mode === 'play' ? '#0c0e14' : '#13151c', room.d * 1.4, room.d * 3.2]} />

        <ambientLight intensity={0.75} color={palette.ambient} />
        <hemisphereLight intensity={0.45} color={palette.ambient} groundColor={palette.floor} />
        <directionalLight position={[room.w * 0.5, room.d + 8, room.d * 0.4]} intensity={1.15} color="#fff6ea" />

        <RoomShell room={room} floor={floor} palette={palette} buildMode={mode === 'build'} />

        <ContactShadows
          position={[0, 0.01, 0]}
          scale={Math.max(room.w, room.d) * 1.4}
          opacity={0.34}
          blur={2.4}
          far={6}
          resolution={512}
          color="#000000"
        />

        {tables.map((t) => (
          <TableMesh
            key={t.id}
            table={t}
            room={room}
            palette={palette}
            selected={selectedId === t.id}
            dragging={draggingId === t.id}
            dragRef={dragRef}
            interactive={mode === 'build'}
            onDown={onTableDown}
          />
        ))}

        {/* Invisible floor catcher for drag-move + tap-to-drop + deselect. */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={onFloorMove}
          onClick={onFloorClick}
        >
          <planeGeometry args={[room.w * 3, room.d * 3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {walker ? (
          <Walker
            walker={walker}
            palette={palette}
            entrance={entranceWorld}
            onArrive={() => setArrived(walker.name)}
          />
        ) : null}

        <OrbitControls
          makeDefault
          enabled={!draggingId && !addArmed}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={room.d * 3}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      <Hud
        mode={mode}
        setMode={setMode}
        addArmed={addArmed}
        setAddArmed={setAddArmed}
        paletteKey={paletteKey}
        setPaletteKey={setPaletteKey}
        guests={guests}
        seats={seats}
        seatedCount={seatedCount}
        onSendGuest={sendGuest}
        walker={walker}
        arrived={arrived}
        selectedLabel={selectedId ? tablesById.get(selectedId)?.label ?? null : null}
        tableCount={tables.length}
      />
    </div>
  );
}

/* ----------------------------- Scene meshes ----------------------------- */

function RoomShell({
  room,
  floor,
  palette,
  buildMode,
}: {
  room: { w: number; d: number };
  floor: Lab3DFloor;
  palette: Lab3DPalette;
  buildMode: boolean;
}) {
  const stage = pctToWorld(floor.stage.xPct, floor.stage.yPct, room);
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);
  const entrance = floor.entrance.enabled
    ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room)
    : pctToWorld(50, 96, room);
  const dance = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);
  const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
  const danceD = Math.max(1.5, (floor.dance.hPct / 100) * room.d);
  const wallH = 1.1;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={palette.floor} roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Build grid (brighter while building) */}
      <Grid
        position={[0, 0.012, 0]}
        args={[room.w, room.d]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor={buildMode ? palette.wall : '#2b2e37'}
        sectionSize={2}
        sectionThickness={1}
        sectionColor={buildMode ? palette.accent : '#3a3d47'}
        fadeDistance={room.d * 2.4}
        fadeStrength={buildMode ? 1 : 2.4}
        infiniteGrid={false}
      />

      {/* Perimeter walls (only when the couple set a venue size) */}
      {floor.venueWidthM && floor.venueLengthM ? (
        <group>
          {[
            { p: [0, wallH / 2, -room.d / 2] as const, s: [room.w, wallH, 0.12] as const },
            { p: [0, wallH / 2, room.d / 2] as const, s: [room.w, wallH, 0.12] as const },
            { p: [-room.w / 2, wallH / 2, 0] as const, s: [0.12, wallH, room.d] as const },
            { p: [room.w / 2, wallH / 2, 0] as const, s: [0.12, wallH, room.d] as const },
          ].map((w, i) => (
            <mesh key={i} position={w.p}>
              <boxGeometry args={w.s} />
              <meshStandardMaterial color={palette.wall} roughness={0.95} transparent opacity={0.55} />
            </mesh>
          ))}
        </group>
      ) : null}

      {/* Stage */}
      <mesh position={[stage.x, 0.15, stage.z]}>
        <boxGeometry args={[stageW, 0.3, stageD]} />
        <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Dance floor */}
      {floor.dance.enabled ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[dance.x, 0.02, dance.z]}>
          <planeGeometry args={[danceW, danceD]} />
          <meshStandardMaterial color={palette.accent} roughness={0.25} metalness={0.2} transparent opacity={0.4} />
        </mesh>
      ) : null}

      {/* Entrance marker (the walk spawn point) */}
      <group position={[entrance.x, 0, entrance.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.55, 0.78, 32]} />
          <meshBasicMaterial color={palette.accent} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[1.4, 2.2, 0.12]} />
          <meshStandardMaterial color={palette.accent} roughness={0.6} transparent opacity={0.35} />
        </mesh>
      </group>
    </group>
  );
}

function TableMesh({
  table,
  room,
  palette,
  selected,
  dragging,
  dragRef,
  interactive,
  onDown,
}: {
  table: LiveTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  selected: boolean;
  dragging: boolean;
  dragRef: React.MutableRefObject<{ id: string; x: number; z: number } | null>;
  interactive: boolean;
  onDown: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  const chairs = useMemo(() => chairLocalPositions(table.shape, table.capacity), [table.shape, table.capacity]);
  const home = useMemo(() => pctToWorld(table.xPct, table.yPct, room), [table.xPct, table.yPct, room]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const targetX = dragging && dragRef.current ? dragRef.current.x : home.x;
    const targetZ = dragging && dragRef.current ? dragRef.current.z : home.z;
    const k = Math.min(1, delta * 12);
    g.position.x += (targetX - g.position.x) * k;
    g.position.z += (targetZ - g.position.z) * k;
    const targetScale = dragging ? 1.06 : 1;
    g.scale.x += (targetScale - g.scale.x) * k;
    g.scale.y = g.scale.x;
    g.scale.z = g.scale.x;
    g.rotation.y = (-table.rotationDeg * Math.PI) / 180;
  });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) {
      onDown(table.id);
      return;
    }
    e.stopPropagation();
    onDown(table.id);
  };

  const topColor = selected ? palette.accent : palette.table;

  return (
    <group ref={ref} position={[home.x, 0, home.z]} onPointerDown={handleDown}>
      {/* Tabletop */}
      {dims.round ? (
        <mesh position={[0, 0.74, 0]} castShadow>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.08, 36]} />
          <meshStandardMaterial color={topColor} roughness={0.35} metalness={0.05} />
        </mesh>
      ) : (
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[dims.w, 0.08, dims.d]} />
          <meshStandardMaterial color={topColor} roughness={0.35} metalness={0.05} />
        </mesh>
      )}
      {/* Pedestal (shared geometry) */}
      <mesh position={[0, 0.37, 0]} geometry={PEDESTAL_GEO}>
        <meshStandardMaterial color={palette.wall} roughness={0.6} />
      </mesh>
      {/* Chairs (shared geometry across every chair + table) */}
      {chairs.map((c, i) => (
        <mesh key={i} position={[c.x, 0.26, c.z]} geometry={CHAIR_GEO}>
          <meshStandardMaterial color={palette.wall} roughness={0.7} />
        </mesh>
      ))}
      {/* Selection ring */}
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[dims.round ? dims.w / 2 + 0.7 : Math.max(dims.w, dims.d) / 2 + 0.7, dims.round ? dims.w / 2 + 0.9 : Math.max(dims.w, dims.d) / 2 + 0.9, 40]} />
          <meshBasicMaterial color={palette.accent} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

function Walker({
  walker,
  palette,
  entrance,
  onArrive,
}: {
  walker: NonNullable<WalkerState>;
  palette: Lab3DPalette;
  entrance: Vec2;
  onArrive: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const done = useRef(false);
  const t = useRef(0);

  useEffect(() => {
    idx.current = 0;
    done.current = false;
    t.current = 0;
    if (ref.current) ref.current.position.set(entrance.x, 0, entrance.z);
  }, [walker, entrance]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const path = walker.path;
    if (done.current || idx.current >= path.length - 1) {
      if (!done.current) {
        done.current = true;
        onArrive();
      }
      // settle / sit
      g.position.y += (0.0 - g.position.y) * Math.min(1, delta * 6);
      return;
    }
    const next = path[idx.current + 1]!;
    const dx = next.x - g.position.x;
    const dz = next.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const step = 2.4 * delta; // ~2.4 m/s walk
    if (dist <= step) {
      g.position.x = next.x;
      g.position.z = next.z;
      idx.current += 1;
    } else {
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
    }
    // walk bob
    g.position.y = Math.abs(Math.sin(t.current * 9)) * 0.06;
  });

  return (
    <group ref={ref} position={[entrance.x, 0, entrance.z]}>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.18, 0.5, 6, 12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} metalness={0.1} emissive={palette.accent} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={0.4} distance={3} color={palette.accent} />
    </group>
  );
}

/* -------------------------------- HUD (2D) -------------------------------- */

function Hud({
  mode,
  setMode,
  addArmed,
  setAddArmed,
  paletteKey,
  setPaletteKey,
  guests,
  seats,
  seatedCount,
  onSendGuest,
  walker,
  arrived,
  selectedLabel,
  tableCount,
}: {
  mode: 'build' | 'play';
  setMode: (m: 'build' | 'play') => void;
  addArmed: boolean;
  setAddArmed: (v: boolean) => void;
  paletteKey: string;
  setPaletteKey: (k: string) => void;
  guests: Lab3DGuest[];
  seats: Map<string, SeatRef>;
  seatedCount: number;
  onSendGuest: (g: Lab3DGuest) => void;
  walker: WalkerState;
  arrived: string | null;
  selectedLabel: string | null;
  tableCount: number;
}) {
  const glass =
    'rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md text-white shadow-lg';
  return (
    <>
      {/* Top bar: mode toggle + prototype badge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className={`pointer-events-auto flex items-center gap-1 p-1 ${glass}`}>
          {(['build', 'play'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-medium capitalize transition ${
                mode === m ? 'bg-white text-ink' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {m === 'build' ? 'Build' : 'Play'}
            </button>
          ))}
        </div>
        <div className={`pointer-events-auto px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/80 ${glass}`}>
          Prototype · not saved
        </div>
      </div>

      {/* Left: guest list (Play) or build controls (Build) */}
      <div className="absolute bottom-4 left-4 top-20 flex w-64 flex-col gap-3">
        {mode === 'build' ? (
          <div className={`p-3 ${glass}`}>
            <p className="mb-2 text-sm font-medium">Build</p>
            <button
              type="button"
              onClick={() => setAddArmed(!addArmed)}
              className={`mb-2 w-full rounded-xl px-3 py-2 text-sm font-medium transition ${
                addArmed ? 'bg-white text-ink' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {addArmed ? 'Tap the floor to drop a table' : '+ Add a table'}
            </button>
            <p className="text-xs leading-relaxed text-white/70">
              Drag a table to slide it. {selectedLabel ? `Selected: ${selectedLabel}. ` : ''}Drag empty
              space to orbit · scroll to zoom.
            </p>
            <p className="mt-2 text-[11px] text-white/50">{tableCount} tables</p>
          </div>
        ) : (
          <div className={`flex min-h-0 flex-1 flex-col p-3 ${glass}`}>
            <p className="mb-1 text-sm font-medium">Guests</p>
            <p className="mb-2 text-[11px] text-white/60">{seatedCount} seated · tap to walk them in</p>
            <div className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
              {guests.length === 0 ? (
                <p className="text-xs text-white/55">No guests yet.</p>
              ) : (
                guests.map((g) => {
                  const seated = seats.has(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSendGuest(g)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-white/90 transition hover:bg-white/15"
                    >
                      <span className="truncate">{g.name}</span>
                      <span className={`ml-2 shrink-0 text-[10px] ${seated ? 'text-white/55' : 'text-white/40'}`}>
                        {seated ? 'seated' : 'walk'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-right: palette switcher */}
      <div className={`absolute bottom-4 right-4 p-2 ${glass}`}>
        <p className="px-1 pb-1 text-[11px] text-white/60">Palette</p>
        <div className="flex flex-col gap-1">
          {DEMO_PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPaletteKey(p.key)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                paletteKey === p.key ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <span className="flex gap-0.5">
                <span className="h-3 w-3 rounded-full" style={{ background: p.palette.accent }} />
                <span className="h-3 w-3 rounded-full" style={{ background: p.palette.floor }} />
              </span>
              <span className="text-white/85">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Walk status toast */}
      {walker ? (
        <div className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm ${glass}`}>
          {arrived === walker.name ? `${walker.name} found their seat.` : `${walker.name} is walking in…`}
        </div>
      ) : null}
    </>
  );
}
