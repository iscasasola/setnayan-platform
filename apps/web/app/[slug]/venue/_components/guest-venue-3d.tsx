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
  seatApproachPath,
  floorObstacles,
  sceneObjectObstacles,
  boothObstacles,
  signObstacles,
  cocktailObstacles,
  VENUE_OBJECT_CATALOG,
  resolvePalette,
  resolvePaletteFromRoles,
  type Lab3DFloor,
  type Lab3DTable,
  type Lab3DPalette,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
  type VenueObjectKind,
  type Vec2,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';
import { GuestPhotoAvatar, preloadGuestPhotos } from '@/app/_components/plan3d/guest-avatar';

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
  /** Vendor booths (v2 payload; absent on an old cached payload → treated as []). */
  booths?: { id: string; kind: string; label: string; xPct: number; yPct: number }[];
  /** Wayfinding signs (v2 payload). */
  signs?: { id: string; label: string; xPct: number; yPct: number; rotationDeg: number }[];
  /** Cocktail / waiting room (v2 payload) — null/absent when the couple didn't enable one. */
  cocktail?: { xPct: number; yPct: number; wPct: number; hPct: number; label: string | null } | null;
  occupancy: { table: string; seats: number[] }[];
  you: { table: string; seatNumber: number; tablemates: { name: string; seatNumber: number }[] } | null;
  /**
   * Host's guest-photo visibility choice (venue_photo_visibility): 'none' | 'table'
   * | 'all'. Echoed from the RPC so the client knows the couple's intent even
   * when `photos` is empty. Optional/absent on an old cached payload → 'none'.
   */
  photoVisibility?: 'none' | 'table' | 'all';
  /**
   * Per-seat guest photos, keyed by table public_id + seat number. Present ONLY
   * for a valid token holder and only per the host setting (see the RPC): 'table'
   * → own tablemates only · 'all' → every seated face · 'none'/tokenless → absent.
   * `photoUrl` is the SERVER-RESOLVED display URL (the page rewrites the raw
   * stored ref via `displayUrlForStoredAsset`) — or null when resolution failed.
   */
  photos?: { table: string; seatNumber: number; photoUrl: string | null }[] | null;
  /** The couple's mood-board role palette — drives 3D scene materials. Optional for backwards compat. */
  rolePalette?: RolePalette;
};

const CHAIR_GEO = new THREE.BoxGeometry(0.42, 0.5, 0.42);
const TOKEN_GEO = new THREE.CylinderGeometry(0.14, 0.16, 0.5, 10);

/** One table: a top + chairs, occupied seats get a token, the guest's own seat glows.
 *  When the host enabled photos AND this viewer is a token holder, a seat with a
 *  resolved photo wears the shared `GuestPhotoAvatar` (billboard disc) instead of
 *  the anonymous token; everything else stays a plain token. `photoBySeat` maps a
 *  seat number → resolved display URL; `nameBySeat` supplies the initials-fallback
 *  name where we know it (own tablemates) — both keyed by chair index (= seat #). */
function GuestTable({
  table,
  room,
  palette,
  occupied,
  yourSeat,
  photoBySeat,
  nameBySeat,
}: {
  table: Lab3DTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  occupied: Set<number> | undefined;
  yourSeat: number | null;
  photoBySeat: Map<number, string> | undefined;
  nameBySeat: Map<number, string> | undefined;
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
        // Host enabled photos + this seat has a resolved face → wear the shared
        // photo avatar. Ring colour follows the token convention (own seat =
        // accent, others = table). No photo → the plain token, unchanged.
        const photoUrl = taken ? photoBySeat?.get(i) ?? null : null;
        const ringColor = mine ? palette.accent : palette.table;
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
            <mesh geometry={CHAIR_GEO} position={[0, 0.25, 0]}>
              <meshStandardMaterial color={palette.wall} roughness={0.75} />
            </mesh>
            {taken && photoUrl ? (
              <GuestPhotoAvatar
                photoUrl={photoUrl}
                name={nameBySeat?.get(i) ?? ''}
                ringColor={ringColor}
                radius={0.16}
                height={0.92}
              />
            ) : taken ? (
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
  seat,
  isSeatTarget,
  room,
  seatObstacles,
  roamObstacles,
  onArrive,
  palette,
}: {
  entrance: Vec2;
  target: Vec2;
  /** The guest's own table + seat, so the seat walk can route around it. */
  seat: { table: Lab3DTable; seatNumber: number } | null;
  /** True when `target` is the guest's seat (walk-to-seat), false for a roam tap. */
  isSeatTarget: boolean;
  room: { w: number; d: number };
  /** Full obstacle set (destination table INCLUDED) for the seat walk. */
  seatObstacles: { c: Vec2; r: number }[];
  /** Obstacle set with the guest's own table skipped, for free-roam taps. */
  roamObstacles: { c: Vec2; r: number }[];
  /** Fired once when a walk-to-seat reaches the chair — hides the beacon. */
  onArrive?: () => void;
  palette: Lab3DPalette;
}) {
  const ref = useRef<THREE.Group>(null);
  const path = useRef<Vec2[]>([]);
  const idx = useRef(0);
  const t = useRef(0);
  const pos = useRef<Vec2>({ x: entrance.x, z: entrance.z });
  const arrivedRef = useRef(false);

  useEffect(() => {
    const start = pos.current;
    // Walking to my seat: route AROUND my own table and step in from outside.
    // Free-roam tap: steer straight to the tapped point (own table skipped so I
    // can stand right by my chair).
    path.current =
      isSeatTarget && seat
        ? seatApproachPath(start, seat.table, seat.seatNumber, room, seatObstacles, 0.2)
        : steerPath(start, target, roamObstacles, 0.2);
    idx.current = 0;
    arrivedRef.current = false; // a new destination → not there yet
  }, [target, isSeatTarget, seat, room, seatObstacles, roamObstacles]);

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
      // Reached the end of the path — if it was a seat walk, retire the beacon.
      if (isSeatTarget && !arrivedRef.current) {
        arrivedRef.current = true;
        onArrive?.();
      }
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

/**
 * A pulsing gold floor ring on the target chair, shown while the guest's avatar
 * walks to it so they can SEE their seat before it arrives. Sized as an outer
 * halo around the static "your seat" ring so the two read as one growing mark.
 */
function SeatDestinationMarker({ position, color }: { position: Vec2; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 2.0) * 0.18;
    if (ring.current) ring.current.scale.set(s, s, 1);
  });
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.54, 0.74, 40]} />
        <meshBasicMaterial color={color} transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
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
  const palette = useMemo(
    () => (scene.rolePalette ? resolvePaletteFromRoles(scene.rolePalette) : resolvePalette([])),
    [scene.rolePalette],
  );
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
  // Placed venue fixtures (v2 payload). Scene-object kinds are guarded against
  // the canonical catalog so a stray kind never breaks the union; unknown kinds
  // drop out of both the render and the obstacle set.
  const knownKinds = useMemo(() => new Set<string>(VENUE_OBJECT_CATALOG.map((o) => o.kind)), []);
  const sceneObjects = useMemo<Lab3DSceneObject[]>(
    () =>
      scene.objects
        .filter((o) => knownKinds.has(o.kind))
        .map((o, i) => ({
          id: `obj-${i}`,
          kind: o.kind as VenueObjectKind,
          label: null,
          xPct: o.xPct,
          yPct: o.yPct,
          rotationDeg: o.rotationDeg,
        })),
    [scene.objects, knownKinds],
  );
  const booths = useMemo<Lab3DBooth[]>(
    () => (scene.booths ?? []).map((b) => ({ id: b.id, kind: b.kind, label: b.label, xPct: b.xPct, yPct: b.yPct })),
    [scene.booths],
  );
  const signs = useMemo<Lab3DSign[]>(
    () => (scene.signs ?? []).map((s) => ({ id: s.id, label: s.label, xPct: s.xPct, yPct: s.yPct, rotationDeg: s.rotationDeg })),
    [scene.signs],
  );
  const cocktail = useMemo<Lab3DCocktail>(() => scene.cocktail ?? null, [scene.cocktail]);
  // Fixture avoidance discs — merged into BOTH walk sets so the auto-walk and
  // every roam tap round the buffet / booth / cocktail room just like a table.
  const fixtureObstacles = useMemo(
    () => [
      ...sceneObjectObstacles(sceneObjects, room),
      ...boothObstacles(booths, room),
      ...signObstacles(signs, room),
      ...cocktailObstacles(cocktail, room),
    ],
    [sceneObjects, booths, signs, cocktail, room],
  );

  const occByTable = useMemo(() => new Map(scene.occupancy.map((o) => [o.table, new Set(o.seats)])), [scene]);

  // Resolved guest photos, indexed table → (seat number → display URL). Only
  // populated for a token holder + a host setting that returns photos ('table' /
  // 'all'); null/failed refs are skipped so a seat with a broken photo falls back
  // to its plain token. Seat numbers ARE the chair indices (same key occupancy
  // uses), so GuestTable can look each chair up directly.
  const photoByTable = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    for (const p of scene.photos ?? []) {
      if (!p.photoUrl) continue;
      let seats = m.get(p.table);
      if (!seats) {
        seats = new Map<number, string>();
        m.set(p.table, seats);
      }
      seats.set(p.seatNumber, p.photoUrl);
    }
    return m;
  }, [scene.photos]);
  // Names we can pair to a photo's initials fallback: only the token holder's own
  // tablemates carry names ('all' widens faces, never names), so this map is scoped
  // to the guest's own table by seat number. Purely a fallback aid — the initials
  // only surface if a photo texture fails to load.
  const nameByTable = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    if (scene.you) {
      const seats = new Map<number, string>();
      for (const tm of scene.you.tablemates) seats.set(tm.seatNumber, tm.name);
      m.set(scene.you.table, seats);
    }
    return m;
  }, [scene.you]);
  // Warm the texture cache once so the first frame paints faces, not tokens.
  useEffect(() => {
    preloadGuestPhotos((scene.photos ?? []).map((p) => p.photoUrl));
  }, [scene.photos]);

  const entrance = useMemo<Vec2>(
    () => (floor.entrance.enabled ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room) : pctToWorld(50, 96, room)),
    [floor, room],
  );
  // Two obstacle sets, both including the stage + dance floor (via floorObstacles;
  // venue-object discs slot in once the object render lands):
  //  · seatObstacles = EVERY table, so the walk-to-seat routes around the guest's
  //    own table and steps in from outside (no more cutting across the tabletop).
  //  · roamObstacles skips the guest's own table so a free-roam tap can land them
  //    right at their chair.
  const seatObstacles = useMemo(
    () => [...floorObstacles(floor, tables, room, []), ...fixtureObstacles],
    [floor, tables, room, fixtureObstacles],
  );
  const roamObstacles = useMemo(
    () => [...floorObstacles(floor, tables, room, [scene.you?.table]), ...fixtureObstacles],
    [floor, tables, room, scene.you, fixtureObstacles],
  );
  const youTable = useMemo<Lab3DTable | null>(
    () => (scene.you ? tables.find((x) => x.id === scene.you!.table) ?? null : null),
    [scene.you, tables],
  );
  const seatTarget = useMemo<Vec2 | null>(
    () => (scene.you && youTable ? seatWorld(youTable, scene.you.seatNumber, room) : null),
    [scene.you, youTable, room],
  );
  // Stable seat descriptor so the avatar's pathing effect only re-runs when the
  // guest's actual table/seat changes (not on every unrelated parent re-render).
  const youSeat = useMemo(
    () => (youTable && scene.you ? { table: youTable, seatNumber: scene.you.seatNumber } : null),
    [youTable, scene.you],
  );

  // The avatar's live target: their seat on open, then wherever they tap.
  const [target, setTarget] = useState<Vec2 | null>(seatTarget);
  // Whether the avatar has reached its seat — hides the destination beacon once
  // it's standing there. Reset whenever the seat walk (re)starts.
  const [seatReached, setSeatReached] = useState(false);
  useEffect(() => {
    setTarget(seatTarget);
    setSeatReached(false);
  }, [seatTarget]);
  const isSeatTarget = target === seatTarget;

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
            photoBySeat={photoByTable.get(t.id)}
            nameBySeat={nameByTable.get(t.id)}
          />
        ))}

        {/* Placed venue fixtures — objects · booths · signs · cocktail room. */}
        <VenueFixtures
          room={room}
          palette={palette}
          objects={sceneObjects}
          booths={booths}
          signs={signs}
          cocktail={cocktail}
        />

        {/* Destination beacon: where the avatar is walking, shown until it sits. */}
        {seatTarget && isSeatTarget && !seatReached ? (
          <SeatDestinationMarker position={seatTarget} color={palette.accent} />
        ) : null}

        {target ? (
          <GuestAvatar
            entrance={entrance}
            target={target}
            seat={youSeat}
            isSeatTarget={isSeatTarget}
            room={room}
            seatObstacles={seatObstacles}
            roamObstacles={roamObstacles}
            onArrive={() => setSeatReached(true)}
            palette={palette}
          />
        ) : null}

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
              <p className="mt-1 text-xs text-white/75">Tap the floor to walk around · drag to look · pinch to zoom</p>
            </>
          ) : (
            <p className="text-[12px] text-white/75">Open your personal invite link to find your seat · tap the floor to explore</p>
          )}
        </div>
      </div>
    </div>
  );
}
