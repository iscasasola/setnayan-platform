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
 *
 * Kit consolidation (Fable slice 7): this walk renders through the SHARED
 * figure kit (`plan3d/kit` <Figure>/<SeatedFigure>) — the same articulated
 * "Sims-like" human the couple lab and homepage demo use — instead of its old
 * self-contained cylinder+sphere tokens + capsule avatar. Seated occupants are
 * NEUTRAL untinted mannequins (anonymised strangers; privacy lock 2026-06-26 —
 * no per-guest attire/hair, no names beyond the RPC contract); the viewer's own
 * figure is accent-tinted (self semantics). Cinematic Tier A (palette-warm grade
 * + string lights) runs at quality 'low' to match the phone demo walk — Tier A
 * only (no Tier B postprocessing, no dust motes on the public surface). The RPC
 * payload is UNCHANGED — this is pure consolidation onto the shared kit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  roomSize,
  pctToWorld,
  boothFacingY,
  rotateLocalRad,
  tableDims,
  shapeHintFor,
  seatWorld,
  steerPath,
  seatApproachPath,
  floorObstacles,
  sceneObjectObstacles,
  signObstacles,
  cocktailObstacles,
  boothApproach,
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
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';
import { DanceFloorMural } from '@/app/_components/plan3d/dance-floor-mural';
import { boothHitVolume, templateBoothObstacles } from '@/app/_components/plan3d/kit/booth-templates';
import {
  Figure,
  SeatedFigure,
  StringLights,
  EmoteBubbles,
  EMOTE_TABLE_Y,
  EMOTE_DANCE_Y,
  InstancedSeatedCrowd,
  seatedFigureMatrix,
  type EmoteEmitter,
  type FigureSpec,
  type SeatedInstance,
} from '@/app/_components/plan3d/kit';
import { BoothVendorCard } from '@/app/_components/plan3d/booth-vendor-card';
import { preloadGuestPhotos } from '@/app/_components/plan3d/guest-avatar';
import { SceneLighting, RECOMMENDED_TONEMAP, floorRoughnessMap, floorAlbedoMap, floorBumpMap } from '@/app/_components/plan3d/scene-lighting';
import { InstancedChairs, chairPlacements } from '@/app/_components/plan3d/instanced-chairs';
import {
  VenueShell,
  VenueDecor,
  archetypeFor,
  archetypeFloorColor,
  archetypeBackground,
  ceilingDecorOccupied,
} from '@/app/_components/plan3d/venue-decor';
import { sanitizeReceptionDesign, sel } from '@/lib/reception-scene';
import { coldSparkObstacles } from '@/app/_components/plan3d/kit/entrance-tunnel';

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
  /** Vendor booths (v2 payload; absent on an old cached payload → treated as []).
   *  v4 adds `offerings` + a PUBLIC booth-vendor block for the booth card (both
   *  optional so an older cached payload still parses). `logoUrl` is the SERVER-
   *  RESOLVED display URL (the page rewrites the raw stored ref). `slug` is the
   *  vendor's PUBLIC marketplace profile (/v/[slug]) — the page joins it in
   *  (visibility-gated) for the booth card's "Book this vendor" CTA. */
  booths?: {
    id: string;
    kind: string;
    label: string;
    xPct: number;
    yPct: number;
    offerings?: string | null;
    vendor?: { name: string; category: string; logoUrl: string | null; slug?: string | null } | null;
  }[];
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
  /** Couple's reception treatments (v4 payload · raw JSONB, sanitized client-side
   *  against RECEPTION_PARTS). Drives the Wave-2b decor. Absent on an old cached
   *  payload → no treatments. */
  receptionDesign?: unknown;
  /** Room archetype (v4 payload · events.venue_setting) — swaps the room shell.
   *  Absent on an old cached payload → 'banquet_hall'. */
  venueSetting?: string;
};

/** One table: a top + chairs, occupied seats get the shared kit figure, the
 *  guest's own seat glows. Anonymous occupants are NEUTRAL untinted mannequins
 *  (the anonymised-stranger default, privacy lock 2026-06-26); the viewer's own
 *  seat is accent-tinted (self semantics). When the host enabled photos AND this
 *  viewer is a token holder, a seat with a resolved photo wears the shared
 *  `GuestPhotoAvatar` disc as the figure's head (routed through the ONE figure
 *  kit — same billboard the pre-kit token used). `photoBySeat` maps a seat number
 *  → resolved display URL; `nameBySeat` supplies the initials-fallback name where
 *  we know it (own tablemates) — both keyed by chair index (= seat #). */
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
  // Shared placements (seat + facing) — feeds the 2-draw-call InstancedChairs
  // (Wave 2a; same silhouette as the couple lab, replacing the plain cube).
  const chairs = useMemo(() => chairPlacements(table.shape, table.capacity), [table.shape, table.capacity]);
  const home = useMemo(() => pctToWorld(table.xPct, table.yPct, room), [table.xPct, table.yPct, room]);
  return (
    <group position={[home.x, 0, home.z]} rotation={[0, (-table.rotationDeg * Math.PI) / 180, 0]}>
      {dims.round ? (
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.08, 28]} />
          <meshStandardMaterial color={palette.table} roughness={0.85} />
        </mesh>
      ) : (
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.w, 0.08, dims.d]} />
          <meshStandardMaterial color={palette.table} roughness={0.85} />
        </mesh>
      )}
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.72, 10]} />
        <meshStandardMaterial color={palette.wall} roughness={0.6} />
      </mesh>
      <InstancedChairs
        chairs={chairs}
        removedSeats={table.removedSeats}
        occupiedSeats={occupied}
        color={palette.wall}
        accent={palette.accent}
      />
      {chairs.map((c, i) => {
        const ang = c.faceY;
        const taken = occupied?.has(i);
        const mine = yourSeat === i;
        if (!taken && !mine) return null;
        // Host-opt-in selfie (token holder + venue_photo_visibility): a resolved
        // photo becomes the figure's head (the SAME GuestPhotoAvatar disc as
        // before, now via the ONE figure kit). No photo → a neutral untinted
        // mannequin for anonymous strangers; the viewer's own seat is
        // accent-tinted (self semantics). A floor status ring shows only under a
        // photo seat (mirrors the old disc ringColor); the own seat's gold ring
        // is drawn separately below. NO per-guest attire/hair variety here —
        // strangers stay neutral (privacy lock; Q5 unanswered).
        const photoUrl = taken ? photoBySeat?.get(i) ?? null : null;
        // Neutral, ringless strangers render through the room-level
        // <InstancedSeatedCrowd> (one batch for the whole walk). Only the
        // viewer's own seat (accent + gold ring) and per-guest photo seats
        // (billboard head) stay individual here.
        if (!mine && !photoUrl) return null;
        const ringColor = mine ? palette.accent : palette.table;
        const spec: FigureSpec = {
          id: `${table.id}:${i}`,
          outfit: 'neutral',
          outfitColor: mine ? palette.accent : null,
          photoUrl,
          statusColor: photoUrl ? ringColor : '',
        };
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
            {/* chairPlacements' faceY points local +Z OUTWARD (away from the
                table); the rig faces local +Z, so the π flip + the −0.04 nudge
                seat the figure facing the table — the couple lab's exact
                SeatedAvatar convention (FIGURE_NUDGE_M parity). Quality 'low'
                bakes the seated pose (phone crowd budget). */}
            <group position={[0, 0, -0.04]} rotation={[0, Math.PI, 0]}>
              <SeatedFigure spec={spec} quality="low" name={nameBySeat?.get(i) ?? ''} />
            </group>
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
  const pos = useRef<Vec2>({ x: entrance.x, z: entrance.z });
  const arrivedRef = useRef(false);
  // Gait phase clock for the kit figure — advances ~9 rad/s (the shared
  // figure-kit gait rate) while translating and FREEZES on arrival, so the
  // limbs stop swinging exactly when the figure stops. The rig carries its own
  // pelvis bob (walkCyclePose), so the GROUP no longer hops.
  const phaseRef = useRef(0);
  // Walk → stand blend on arrival (the kit eases presets over ~⅓ s); a frozen
  // mid-stride reads as a glitch otherwise. Reset when a new destination starts.
  const [atRest, setAtRest] = useState(false);
  const restedRef = useRef(false);

  // The viewer's own figure — accent-tinted mannequin (self semantics; the
  // pre-kit avatar was the accent capsule), never a photo. Neutral stays
  // reserved for the anonymous seated crowd. statusColor is EMPTY (the kit's
  // "no ring" sentinel): the pre-kit capsule avatar had no floor status ring,
  // and the moving avatar drawing one would slide an accent disc across the
  // floor tracking the viewer. "You" is marked by the accent pointLight glow
  // (kept below) + the separate gold seat ring GuestTable draws — not a ring
  // on the walking figure.
  const selfSpec = useMemo<FigureSpec>(
    () => ({ id: 'guest-self', outfit: 'neutral', outfitColor: palette.accent, statusColor: '' }),
    [palette.accent],
  );

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
    restedRef.current = false;
    setAtRest(false);
  }, [target, isSeatTarget, seat, room, seatObstacles, roamObstacles]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
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
      // Advance the gait while translating; the rig's own pelvis bob keeps the
      // group grounded (no whole-body hop).
      phaseRef.current += delta * 9;
    } else {
      // Reached the path end — freeze the gait, ease walk → stand, and (seat
      // walks only) retire the destination beacon.
      if (!restedRef.current) {
        restedRef.current = true;
        setAtRest(true);
      }
      if (isSeatTarget && !arrivedRef.current) {
        arrivedRef.current = true;
        onArrive?.();
      }
    }
    pos.current = { x: g.position.x, z: g.position.z };
  });

  return (
    <group ref={ref} position={[entrance.x, 0, entrance.z]}>
      {/* The shared articulated kit figure — the ONE human implementation, now
          on the public walk too. `phase` takes the gait CLOCK ref (read inside
          the figure's own useFrame, no per-frame React re-render); the pose
          eases walk → stand on arrival. Always quality 'high': this is the
          single viewer figure that owns the camera, not the 'low'-tier crowd. */}
      <Figure spec={selfSpec} pose={atRest ? 'stand' : 'walk'} phase={phaseRef} quality="high" />
      {/* Keep the soft accent glow that has always marked "you". */}
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
  // Wave 2b: the couple's reception treatments + venue archetype reach the guest
  // walk (v4 payload). `receptionDesign` is sanitized against RECEPTION_PARTS; the
  // archetype swaps the room shell + floor tone + sky background.
  const receptionDesign = useMemo(() => sanitizeReceptionDesign(scene.receptionDesign), [scene.receptionDesign]);
  const archetype = useMemo(() => archetypeFor(scene.venueSetting), [scene.venueSetting]);
  const archFloorColor = useMemo(() => archetypeFloorColor(archetype, palette), [archetype, palette]);
  const bgColor = useMemo(() => archetypeBackground(archetype), [archetype]);
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
    () =>
      (scene.booths ?? []).map((b) => ({
        id: b.id,
        kind: b.kind,
        label: b.label,
        xPct: b.xPct,
        yPct: b.yPct,
        offerings: b.offerings ?? null,
        vendor: b.vendor ?? null,
      })),
    [scene.booths],
  );
  const signs = useMemo<Lab3DSign[]>(
    () => (scene.signs ?? []).map((s) => ({ id: s.id, label: s.label, xPct: s.xPct, yPct: s.yPct, rotationDeg: s.rotationDeg })),
    [scene.signs],
  );
  const cocktail = useMemo<Lab3DCocktail>(() => scene.cocktail ?? null, [scene.cocktail]);
  // Fixture avoidance discs — merged into BOTH walk sets so the auto-walk and
  // every roam tap round the buffet / booth / cocktail room just like a table.
  const entrance = useMemo<Vec2>(
    () => (floor.entrance.enabled ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room) : pctToWorld(50, 96, room)),
    [floor, room],
  );
  const coldSpark = sel(receptionDesign, 'tunnel', 'style') === 'cold_spark';
  const fixtureObstacles = useMemo(
    () => [
      ...sceneObjectObstacles(sceneObjects, room),
      // Template-aware (booth kit 2026-07-08): a templated booth registers
      // its chassis' authored footprint discs; the rest keep the classic disc.
      ...templateBoothObstacles(booths, room),
      ...signObstacles(signs, room),
      ...cocktailObstacles(cocktail, room),
      // Cold-spark entrance tunnel (tunnel catalog 2026-07-08): its 8 machine
      // boxes register like booth chassis discs (r 0.3; centre channel clear).
      ...(coldSpark ? coldSparkObstacles(entrance, room) : []),
    ],
    [sceneObjects, booths, signs, cocktail, room, coldSpark, entrance],
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

  // The anonymous seated crowd — every occupied seat that ISN'T the viewer's own
  // (accent + gold ring) and ISN'T a photo seat (billboard head) — collapsed to
  // ONE <InstancedSeatedCrowd> for the whole room (~14 draws + zero per-figure
  // useFrame, vs. 14×N meshes + N no-op subscribers). Strangers are neutral +
  // ringless (statusColor was always '' here), so no ring batch is drawn. Each
  // world matrix reproduces the exact table→seat→nudge nesting the individual
  // <SeatedFigure> used (proven in figure-sit-bake.test.ts).
  const crowdSeats = useMemo<SeatedInstance[]>(() => {
    const out: SeatedInstance[] = [];
    for (const t of tables) {
      const occupied = occByTable.get(t.id);
      if (!occupied || occupied.size === 0) continue;
      const chairs = chairPlacements(t.shape, t.capacity);
      const home = pctToWorld(t.xPct, t.yPct, room);
      const tableFaceY = (-t.rotationDeg * Math.PI) / 180;
      const yourSeat = scene.you?.table === t.id ? scene.you.seatNumber : null;
      const photoBySeat = photoByTable.get(t.id);
      for (let i = 0; i < chairs.length; i++) {
        if (!occupied.has(i) || yourSeat === i || photoBySeat?.get(i)) continue;
        const c = chairs[i]!;
        out.push({
          matrix: seatedFigureMatrix({
            homeX: home.x,
            homeZ: home.z,
            tableFaceY,
            seatX: c.x,
            seatZ: c.z,
            seatFaceY: c.faceY,
          }),
          color: null, // neutral stranger — white mannequin
        });
      }
    }
    return out;
  }, [tables, occByTable, photoByTable, room, scene.you]);

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
  // Emote bubbles (Fable §3.6) — AMBIENT ONLY on this anonymized surface:
  // music notes over the dance floor + chat dots over tables that have people
  // (table-level occupancy is already public via the tinted chairs, so a chat
  // bubble leaks nothing new). NEVER per-guest status here — the RA 10173
  // posture: the public walk shows a room, not anyone's RSVP.
  const emoteEmitters = useMemo<EmoteEmitter[]>(() => {
    const out: EmoteEmitter[] = [];
    if (floor.dance.enabled) {
      const d = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);
      const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
      out.push({ id: 'ambient-music-a', x: d.x - danceW * 0.22, y: EMOTE_DANCE_Y, z: d.z, glyphs: ['music'] });
      out.push({ id: 'ambient-music-b', x: d.x + danceW * 0.22, y: EMOTE_DANCE_Y, z: d.z, glyphs: ['music'] });
    }
    for (const t of tables) {
      if (!occByTable.get(t.id)?.size) continue; // empty table, no chatter
      const c = pctToWorld(t.xPct, t.yPct, room);
      out.push({ id: `ambient-chat-${t.id}`, x: c.x, y: EMOTE_TABLE_Y, z: c.z, glyphs: ['chat'] });
    }
    return out;
  }, [floor, room, tables, occByTable]);

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

  // The booth whose vendor card is open (tap a booth → card). Null = closed.
  const [openBooth, setOpenBooth] = useState<Lab3DBooth | null>(null);

  // "Walk to this booth" (from the card): steer to a point just in front of the
  // booth, facing it — a plain roam target, so the avatar rounds obstacles the
  // same way a floor tap does.
  const walkToBooth = (booth: Lab3DBooth) => {
    setOpenBooth(null);
    setTarget(boothApproach(booth, room).point);
  };

  // Tap-vs-drag discrimination: OrbitControls owns the drag (that IS this
  // surface's drag-to-look), so a floor/booth/seat CLICK only counts when the
  // pointer barely moved between down and up. R3F's e.delta is that movement
  // in CSS px.
  const TAP_MAX_PX = 8;

  const stage = pctToWorld(floor.stage.xPct, floor.stage.yPct, room);
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);

  return (
    <div className="relative h-[82vh] w-full overflow-hidden rounded-2xl bg-[#0c0e14]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}
        gl={{ ...RECOMMENDED_TONEMAP }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, room.d * 1.4, room.d * 3.2]} />
        {/* Shared rig (Wave 2a) at 'low' — guests explore on phones, so the
            1024 shadow map + 128 env map budget. Cinematic Tier A (Fable §3.5):
            the palette-warm golden-hour grade, exactly what the phone demo walk
            (plan3d-guest-view.tsx) already runs. Tier A only — NO Tier B
            postprocessing, NO dust motes on the public walk ('low' = Tier A). */}
        <SceneLighting palette={palette} quality="low" room={room} grade="play" />

        {/* Tier A string lights — warm emissive strands, one static InstancedMesh
            ('low' halves the strand count inside the component), so they ride the
            phone walk at no per-frame cost. Skipped when the couple's OWN ceiling
            decor occupies the hang band (fairy lights / chandeliers / lanterns /
            hanging florals) — the same ceilingDecorOccupied gate the demo uses. */}
        {!ceilingDecorOccupied(receptionDesign, archetype) ? (
          <StringLights room={room} palette={palette} quality="low" />
        ) : null}

        {/* Wave 2b: archetype room shell (garden / chapel / barn / …), reduced
            decor set at 'low' quality for phones. */}
        <VenueShell archetype={archetype} room={room} palette={palette} quality="low" />

        {/* Floor — tap anywhere to walk there (Sims roam). Click, not
            pointer-down: an orbit DRAG that starts on the floor must not also
            send the avatar walking — only a short press with barely any
            movement (e.delta ≤ threshold) counts as "walk here". */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (e.delta > TAP_MAX_PX) return; // that was a look-drag, not a tap
            const x = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
            const z = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
            setTarget({ x, z });
          }}
        >
          <planeGeometry args={[room.w, room.d]} />
          <meshStandardMaterial
            color={archFloorColor}
            roughness={0.95}
            roughnessMap={floorRoughnessMap()}
            map={floorAlbedoMap()}
            bumpMap={floorBumpMap()}
            bumpScale={0.02}
          />
        </mesh>

        {/* Stage — unified stage material (Fable slice 7): the couple lab
            (seating-lab-3d) and the homepage demo (plan3d-scene) both render the
            stage in `palette.accent` at roughness 0.5 / metalness 0.1; this walk
            used to diverge on `palette.table`. Canonical = the lab/demo accent
            slab, so the same stage reads across all three surfaces. */}
        <mesh position={[stage.x, 0.15, stage.z]} castShadow receiveShadow>
          <boxGeometry args={[stageW, 0.3, stageD]} />
          <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.1} />
        </mesh>

        {/* Dance floor — the mood-board mural (Fable §3.7). This walk had NO
            dance mesh: `floor.dance` fed floorObstacles only, so guests dodged
            an invisible rectangle. Palette-only here (the anonymised public
            payload carries no monogram source); raycast is off inside the
            component so tap-to-roam passes through to the floor beneath. */}
        <DanceFloorMural floor={floor} room={room} rolePalette={scene.rolePalette ?? null} />

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

        {/* The anonymous seated crowd, one instanced batch for the whole room
            (in the same world space as the tables above). Photo seats + the
            viewer's own seat stay individual inside each GuestTable. */}
        <InstancedSeatedCrowd seats={crowdSeats} quality="low" />

        {/* Placed venue fixtures — objects · booths · signs · cocktail room.
            quality 'low' (this surface is the phone walk) bakes every booth
            template's staff mascots to their held clip pose — a 10-booth
            catalog-complete room otherwise animates ~16+ figures per frame. */}
        <VenueFixtures
          room={room}
          palette={palette}
          objects={sceneObjects}
          booths={booths}
          signs={signs}
          cocktail={cocktail}
          quality="low"
        />

        {/* Ambient emote bubbles (Fable §3.6): music near the dance floor,
            chatter at occupied tables — pooled sprites, ≤6, never per-guest. */}
        {emoteEmitters.length > 0 ? <EmoteBubbles emitters={emoteEmitters} /> : null}

        {/* Wave 2b: the couple's reception treatments (reduced set on phones). */}
        <VenueDecor
          design={receptionDesign}
          floor={floor}
          tables={tables}
          room={room}
          palette={palette}
          quality="low"
          archetype={archetype}
        />

        {/* Invisible per-booth tap targets over the (shared) BoothMesh visuals —
            tapping opens the vendor card. Kept separate from VenueFixtures so
            the shared fixture renderer stays a pure visual. */}
        {booths.map((b) => {
          const p = pctToWorld(b.xPct, b.yPct, room);
          // Sized to the resolved chassis (truck cab / riser deck / backdrop
          // panel extend past the old fixed 2.3×1.3×1.3 box); generic booths
          // keep the historical box.
          const hit = boothHitVolume(b);
          // Rotate the tap box by the booth's computed facing so the non-square
          // / front-shifted volume tracks the rotated chassis (no dead taps).
          const facingY = boothFacingY(b, room);
          const hc = rotateLocalRad({ x: hit.center[0], z: hit.center[2] }, facingY);
          return (
            <mesh
              key={`hit-${b.id}`}
              position={[p.x + hc.x, hit.center[1], p.z + hc.z]}
              rotation={[0, facingY, 0]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                if (e.delta > TAP_MAX_PX) return;
                e.stopPropagation();
                setOpenBooth(b);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = '';
              }}
            >
              <boxGeometry args={[hit.size[0], hit.size[1], hit.size[2]]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        })}

        {/* The guest's own seat is TAPPABLE in roam: a soft pulsing halo as the
            affordance (plus a hover cursor on desktop); tapping walks the avatar
            back via the same around-the-table seat approach. */}
        {seatTarget ? (
          <OwnSeatTapTarget
            position={seatTarget}
            color={palette.accent}
            onTap={() => {
              setTarget(seatTarget);
              setSeatReached(false);
            }}
            tapMaxPx={TAP_MAX_PX}
          />
        ) : null}

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
              <p className="mt-1 text-xs text-white/75">
                Tap the floor to walk · tap your gold seat to sit · tap a booth to see who&rsquo;s there · drag to look
              </p>
            </>
          ) : (
            <p className="text-[12px] text-white/75">Open your personal invite link to find your seat · tap the floor to explore</p>
          )}
        </div>
      </div>

      {/* Booth vendor card (bottom sheet / side drawer) — shared overlay chrome. */}
      <BoothVendorCard booth={openBooth} onClose={() => setOpenBooth(null)} onWalkTo={walkToBooth} />
    </div>
  );
}

/**
 * The guest's own-seat tap affordance: an invisible tap disc over the chair plus
 * a soft pulsing halo ring (outside the static "your seat" ring GuestTable draws)
 * so the seat reads as tappable. Desktop gets a pointer cursor on hover.
 */
function OwnSeatTapTarget({
  position,
  color,
  onTap,
  tapMaxPx,
}: {
  position: Vec2;
  color: string;
  onTap: () => void;
  tapMaxPx: number;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const reducedMotion = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    if (reducedMotion || !halo.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.12;
    halo.current.scale.set(pulse, pulse, 1);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(clock.elapsedTime * 2.2) * 0.12;
  });
  return (
    <group
      position={[position.x, 0, position.z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > tapMaxPx) return;
        e.stopPropagation();
        onTap();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {/* Invisible hit disc — a generous target over the chair + avatar area. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Soft pulsing halo just outside GuestTable's static ring. */}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.46, 0.56, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
