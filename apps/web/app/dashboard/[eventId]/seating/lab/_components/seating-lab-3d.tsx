'use client';

/**
 * seating-lab-3d — the flag-gated 3D seating editor (React Three Fiber).
 *
 * The couple's REAL plan rendered as a navigable 3D room with "Sims" build
 * interactions: tap to select, drag to slide with game-feel weight, rotate +
 * delete a selected table, add a table — and a walk-to-seat payoff (pick a
 * guest → an avatar walks from the entrance, around tables, to their chair).
 *
 * EDITS PERSIST: move / rotate / delete / add go through the SAME single-editor
 * lock + server actions as the 2D editor (one data model), so a change in 3D
 * mirrors into 2D and vice-versa. The lab acquires the seating lock on mount
 * and drops to view-only if a 2D editor holds it. A "build camera" snaps the
 * view near top-down while arranging (Sims-style) and frees to a cinematic
 * orbit in Play mode. Mood-board palette drives lighting + materials.
 *
 * Guests render as articulated kit `<Figure>`s (app/_components/plan3d/kit —
 * the owner-locked "Sims-like" direction): seated guests, the single walk-in,
 * the populate-Play crowd AND swap movers all carry the SAME per-guest spec
 * (resolved attire incl. hash-derived barong/filipiniana, mood-board motif
 * colour, selfie head, RSVP status colour), so the person who walks is the
 * person who sits. Walk-ins (single AND crowd) end in the kit's owner-locked
 * sit choreography (kit/sit-controller): the walk delivers the guest to the
 * approach point behind their chair, the chair pulls back, the guest steps in,
 * turns, sits, and the chair tucks — no more teleport onto the seat.
 *
 * Performance: DPR capped, lightweight waypoint steering, per-table
 * InstancedChairs (2 draw calls a table — the Wave 2a instancing collapse),
 * real soft shadow maps via the shared SceneLighting rig ('high' quality:
 * 2048 map + procedural Lightformer IBL, no HDRI/network assets), and a
 * two-part seated-figure budget (total guests > 60 OR table > 8 m from the
 * camera → kit quality 'low', static baked pose — see TableMesh).
 * GLTF furniture + NavMesh + post-processing remain the v2 upgrades.
 * Known v1 limit: a FREE board (no venue size) maps 0–100% onto a fixed room,
 * so widely-spread tables (percent > 100) can render off the visible floor —
 * a fit-frame transform (like the 2D editor's) is the documented follow-up.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Maximize2, Minimize2 } from 'lucide-react';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { SeatingViewSegment } from '@/app/dashboard/[eventId]/seating/_components/seating-frame';
import {
  DropConfirmBubble,
  type DropConfirmState,
} from '@/app/dashboard/[eventId]/seating/_components/drop-confirm-bubble';
import {
  Figure,
  SitController,
  SIT_TIMING,
  EmoteBubbles,
  EMOTE_SEATED_Y,
  StringLights,
  InstancedSeatedCrowd,
  seatedFigureMatrix,
  RUN_CLOCK_RAD_S,
  type EmoteEmitter,
  type EmoteGlyph,
  type FigureSpec,
  type FigureQuality,
  type SeatedInstance,
} from '@/app/_components/plan3d/kit';
import {
  SceneLighting,
  DustMotes,
  playGradeFog,
  RECOMMENDED_TONEMAP,
  floorRoughnessMap,
  floorAlbedoMap,
  floorBumpMap,
  fabricBumpMap,
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
import { coldSparkFrame, coldSparkObstacles } from '@/app/_components/plan3d/kit/entrance-tunnel';
import { SERPENTINE_TOP_GEO } from '@/app/_components/plan3d/kit/serpentine-top';
import { useSeatingLock } from '@/app/dashboard/[eventId]/seating/_components/use-seating-lock';
import { useSeatingLiveRefresh } from '@/app/dashboard/[eventId]/seating/_components/use-seating-live-refresh';
import { usePlan3dRoom, PLAN3D_SHARED_ROOM_ENABLED, type LocalPlayer } from '@/app/_components/plan3d/use-plan3d-room';
import { RemotePlayers, CameraMoveBroadcaster } from '@/app/_components/plan3d/plan3d-remote-players';
import { colorFromId } from '@/lib/plan3d-room';
import { SeatingLockError } from '@/app/dashboard/[eventId]/seating/seating-lock-error';
import {
  assignGuest,
  createTable,
  deleteTable,
  updateTablePosition,
  updateTableRotation,
  commitWeld,
  updateTableType,
  updateTableLabel,
  publishSeating,
  autoSeatGuests,
  seatRoleAtTable,
  unassignGuest,
  buildSeatingDraft,
  lockAndFill,
  addSeatingConstraint,
  removeSeatingConstraint,
  savePriorityOrder,
  setGuestSeatingPriority,
  assignGroup,
  autoArrange,
  linkTables,
  unlinkTable,
  setTableSeat,
  saveFloorPlan,
  swapSeats,
  swapTableOccupants,
  setGhostBoothsEnabled,
  dismissGhostBooth,
} from '@/app/dashboard/[eventId]/seating/actions';
import {
  TABLE_TYPE_CATALOG,
  ROLE_TIER_LABELS,
  computeAutoLayout,
  // The ONE placement oracle (lib/seating.ts · council verdict 2026-07-16). The
  // 3D move/rotate paths validate through these SAME pure helpers as the 2D
  // editor — no 3D-specific geometry. Aliased so they don't collide with the
  // seating-3d disc helpers (which the walk/crowd still use).
  TABLE_FOOTPRINT_M,
  tableGeometry,
  checkPlacement as oracleCheckPlacement,
  layoutViolations as oracleLayoutViolations,
  firstDropViolation,
  zoneDropViolation,
  zoneDisplayName,
  firstFreeRoundSpawnPct,
  stageZone,
  legalJoinPose,
  weldCommitBatch,
} from '@/lib/seating';
import type {
  KeepApartRule,
  PriorityOrder,
  EventTableRow,
  TableType,
  WorldPose as OracleWorldPose,
  OracleZone,
  DropHit,
} from '@/lib/seating';

// Cinematic Tier B (Fable §3.5) — the program's ONLY new dependency
// (postprocessing + @react-three/postprocessing) lives behind THIS dynamic
// import and nowhere else: React.lazy keeps kit/cinematic.tsx (and the dep) in
// its own async chunk, fetched the first time Play mode actually mounts the
// pass. Deliberately NOT imported from the kit barrel (a static barrel export
// would weld the dep onto every kit consumer, phone-walk chunk included).
const CinematicPass = lazy(() =>
  import('@/app/_components/plan3d/kit/cinematic').then((m) => ({ default: m.CinematicPass })),
);

// A server action's lock guard throws SeatingLockError, but the class identity
// is lost across the RSC boundary — match defensively (instanceof → code →
// message), exactly as the 2D editor does, so a peer takeover is detected.
function isLockLost(err: unknown): boolean {
  if (err instanceof SeatingLockError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 'seating_lock_not_held') return true;
  return typeof e.message === 'string' && e.message.includes('locked by someone else on this event');
}
import {
  type Lab3DTable,
  type Lab3DFloor,
  reconcileGrouping,
  type Lab3DGuest,
  type Lab3DGroup,
  type Lab3DFloorExtras,
  type Lab3DPalette,
  type Lab3DMonogram,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
  type Vec2,
  type SeatPose,
  type ObstacleDisc,
  type ObstacleGrid,
  type AgentVel,
  roomSize,
  contentBounds,
  pctToWorld,
  boothFacingY,
  rotateLocalRad,
  tableDims,
  serpentineChainSnapWorld,
  serpentineBand,
  seatWorld,
  approachPoint,
  floorObstacles,
  danceFloorRect,
  pointInZone,
  danceSpots,
  pickDanceGuest,
  chairObstacles,
  chairObstaclesForWalk,
  dropDiscsContaining,
  buildObstacleGrid,
  sceneObjectObstacles,
  signObstacles,
  cocktailObstacles,
  firstFreeSeatAtTable,
  pushOutOfDiscs,
  separateAgents,
  walkVector,
  walkSpawnPoint,
  steerPath,
  seatApproachPath,
  resolvePalette,
  resolvePaletteFromRoles,
  DEMO_PALETTES,
  seatStatusOf,
  SIDE_COLOR,
  TENTATIVE_COLOR,
  PLUS_ONE_COLOR,
  BOOTH_FOOTPRINT_M,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import { svgToMonogramTexture } from '@/lib/svg-monogram-texture';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';
import { GhostBooths } from '@/app/_components/plan3d/ghost-booth';
import { PLAN3D_BOOTH_ADS_ENABLED, type GhostBooth3D } from '@/lib/ghost-booths';
import { boothHitVolume, templateBoothObstacles } from '@/app/_components/plan3d/kit/booth-templates';
import { BoothVendorCard } from '@/app/_components/plan3d/booth-vendor-card';
import { DanceFloorMural } from '@/app/_components/plan3d/dance-floor-mural';

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  /** Structured role palette from `events.role_palette` — the canonical source for scene materials. */
  rolePalette: RolePalette;
  /** Couple's saved reception treatments (Wave 2b · events.reception_design) —
   *  drives the 3D decor (ceiling / backdrop / centrepieces / entrance arch),
   *  palette-tinted so the material switcher recolours it. */
  receptionDesign: ReceptionDesign;
  /** Room archetype (events.venue_setting) — swaps the room shell + floor tone. */
  venueSetting: string;
  /** The couple's canonical mark — rendered as a medallion on the floor centre
   *  (the Play-mode camera's focal point). null → no mark. */
  monogram: Lab3DMonogram;
  /** Couple owns the paid ANIMATED_MONOGRAM → the floor mark blooms in as the
   *  Play-mode camera settles. Free events render the static mark (the seat-plan
   *  tool stays free). */
  animatedMonogram: boolean;
  me: { id: string; name: string };
  /** Smart seat-plan rules — keep-apart pairs + the couple's tier priority order
   * (both feed the server auto-seat solver; the lab lets the couple edit them). */
  keepApart: KeepApartRule[];
  priorityOrder: PriorityOrder;
  roleSetKey: string;
  groups: Lab3DGroup[];
  floorExtras: Lab3DFloorExtras;
  /** Placed venue fixtures — rendered read-only in 3D (edits stay in the 2D
   *  editor + this lab's own table tooling). The cocktail room is derived from
   *  floorExtras, so it isn't a separate prop. */
  sceneObjects: Lab3DSceneObject[];
  booths: Lab3DBooth[];
  signs: Lab3DSign[];
  ghostBooths: GhostBooth3D[];
  ghostBoothsEnabled: boolean;
};

type LiveTable = Lab3DTable;
type SeatRef = { tableId: string; seatNumber: number };
type WalkerState = {
  gid: string;
  name: string;
  /** Steered path ending at the sit APPROACH POINT (0.55 m behind the chair) —
   *  the sit controller owns the final step-in, so the walk itself never
   *  targets the chair (that was the old teleport seam). */
  path: Vec2[];
  tableId: string;
  seatNumber: number;
  /** World seat pose (position + gaze) the arrival sit clip plays against. */
  seat: SeatPose;
} | null;

/** A keep-apart rule is undirected — match a pair in either order. */
function sameKeepApart(r: KeepApartRule, a: string, b: string): boolean {
  return (r.guest_a_id === a && r.guest_b_id === b) || (r.guest_a_id === b && r.guest_b_id === a);
}

/** The local seat map derived from the server's assignments on each guest row. */
function deriveSeatsFromGuests(guests: Lab3DGuest[]): Map<string, SeatRef> {
  const m = new Map<string, SeatRef>();
  for (const g of guests) {
    if (g.seatedTableId && g.seatNumber != null) m.set(g.id, { tableId: g.seatedTableId, seatNumber: g.seatNumber });
  }
  return m;
}

// Shared GPU buffers reused across every table (module-level constants are
// never disposed by R3F — safe to share). Chairs themselves now render through
// the shared per-table `InstancedChairs` (2 draw calls a table — the draw-call
// collapse this comment used to promise as "the documented v2 upgrade"); only
// the removed-seat GHOSTS keep individual meshes (they need per-ghost
// transparency + a tap-to-restore handler, and there are few of them).
const PEDESTAL_GEO = new THREE.CylinderGeometry(0.12, 0.16, 0.72, 12);
const GHOST_SEAT_GEO = new THREE.BoxGeometry(0.42, 0.07, 0.42);
const GHOST_BACK_GEO = new THREE.BoxGeometry(0.42, 0.44, 0.06);
// Real-furniture parts (shared buffers). The old cylinder+sphere guest tokens
// (and their GOWN_GEO/SUIT_GEO attire silhouettes) are retired — guests now
// render as articulated kit `<Figure>`s (the shared plan3d/kit rig). The token
// body/head survive ONLY for the "+1 reserved" ghost, which needs per-mesh
// transparency the kit's shared material caches deliberately don't offer.
// One-piece pass (2026-07-10): reshaped to a CHUNKY blob so the faint
// placeholder reads as a translucent version of the one-piece figures around
// it, not a thin cylinder from the retired token era. A vertical capsule ≈ a
// seated figure's mass, capped by a ball head at the kit's HEAD_R (0.16).
const TOKEN_BODY_GEO = new THREE.CapsuleGeometry(0.17, 0.3, 8, 16);
const TOKEN_HEAD_GEO = new THREE.SphereGeometry(0.16, 20, 14);
const VASE_GEO = new THREE.CylinderGeometry(0.085, 0.12, 0.24, 10);
const BLOOM_GEO = new THREE.IcosahedronGeometry(0.2, 0);

/**
 * FNV-1a 32-bit over the guest id — a local copy of figure-rig's (private)
 * hash. Deliberately independent: the kit reads its own bit windows for
 * skin/hair/face, and hashing here with a separate function decorrelates the
 * OUTFIT variant from the look fields (same-id guests still resolve stably).
 */
function outfitHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Map a guest's resolved attire class onto the kit's outfit vocabulary.
 * The guest schema only stores gown/suit/neutral (`lib/guests.ts` — no schema
 * change here); the Filipino-formalwear variants are CODE-DERIVED inside each
 * class by id hash, so roughly a third of suits arrive as barong and a third
 * of gowns as filipiniana — stable per guest, varied across a crowd.
 */
function outfitVariantFor(attire: Lab3DGuest['attire'], id: string): FigureSpec['outfit'] {
  if (attire === 'suit') return outfitHash(id) % 3 === 0 ? 'barong' : 'suit';
  if (attire === 'gown') return outfitHash(id) % 3 === 0 ? 'filipiniana' : 'gown';
  return 'neutral';
}

/**
 * The kit FigureSpec for one guest — the ONE place the lab translates its
 * guest row into the shared figure vocabulary, so seated figures and every
 * mover (walk-in, crowd, swap) dress identically: outfit from the resolved
 * attire (+ hash-derived barong/filipiniana), motif colour from the
 * mood-board gown/suit chain, selfie through the kit's GuestPhotoAvatar
 * path, RSVP/side semantics as the status colour.
 */
function figureSpecFor(g: Lab3DGuest, statusColor: string): FigureSpec {
  return {
    id: g.id,
    outfit: outfitVariantFor(g.attire, g.id),
    outfitColor: g.attireColor,
    photoUrl: g.photoUrl ?? null,
    statusColor,
  };
}

/** Per-seat token treatment computed from a guest's RSVP (see lib seatStatusOf). */
type SeatToken = {
  color: string;
  opacity: number;
  name: string;
  /** Full kit figure spec for a REAL guest. null = the "+1 reserved" ghost,
   *  which keeps the legacy translucent token (the kit's shared material
   *  caches have no per-figure opacity, and a ghost SHOULD read as a
   *  placeholder, not a person). */
  spec: FigureSpec | null;
};

/** A guest's token colour/opacity + figure spec, or null when their seat is
 *  freed (declined). Tentative RSVPs keep their colour semantic through the
 *  figure's status ring / selfie ring (the old 0.62-opacity body treatment
 *  can't thread through the kit's shared materials). */
function guestTokenStyle(g: Lab3DGuest): SeatToken | null {
  const status = seatStatusOf(g.rsvp);
  if (status === 'hidden') return null;
  const color = status === 'confirmed' ? SIDE_COLOR[g.side] : TENTATIVE_COLOR;
  return {
    color,
    opacity: status === 'confirmed' ? 1 : 0.62,
    name: g.name,
    spec: figureSpecFor(g, color),
  };
}

/**
 * A seated guest — now an articulated kit `<Figure>` carrying the guest's
 * outfit, deterministic look, selfie head (the kit routes photoUrl through
 * the SAME shared GuestPhotoAvatar refcounted texture cache as before) and
 * RSVP status colour. SLICE-3 (2026-07-08): figures now SIT — the promised
 * chair-clearance choreography shipped (kit/sit-controller) and every walk-in
 * ends flush-seated at THIS exact transform (chair point nudged 0.04 m
 * table-ward, facing the table), so the SitController → SeatedAvatar handoff
 * is invisible. Keep the pose 'sit' and the −0.04 nudge in lockstep with
 * SIT_TIMING.FIGURE_NUDGE_M or every walk-in ends on a pop.
 *
 * The "+1 reserved" ghost (spec null) keeps the legacy translucent
 * body+head token: it's a placeholder for a person who doesn't exist yet.
 */
function SeatedAvatar({ tok, bodyMat, quality }: { tok: SeatToken; bodyMat: THREE.Material; quality: FigureQuality }) {
  if (tok.spec) {
    return (
      // Chair-local facing: chairPlacements' faceY points local +Z OUTWARD
      // (away from the table — that's how the backrest offset swings), while
      // the rig's forward is local +Z. The π flip turns the figure to face
      // the table like a guest at their place setting.
      <group position={[0, 0, -0.04]} rotation={[0, Math.PI, 0]}>
        <Figure spec={tok.spec} pose="sit" quality={quality} name={tok.name} />
      </group>
    );
  }
  return (
    <group position={[0, 0, -0.04]}>
      <mesh geometry={TOKEN_BODY_GEO} position={[0, 0.62, 0]} material={bodyMat} castShadow />
      <mesh geometry={TOKEN_HEAD_GEO} position={[0, 1.02, 0]} material={bodyMat} castShadow />
    </group>
  );
}

// A guest figure animating between seats during a swap / table-swap — dressed
// with the same spec as its seated self, so the person who walks IS the
// person who sat.
type Mover = { gid: string; name: string; spec: FigureSpec; path: Vec2[]; target: SeatRef };

// A guest sent out to the DANCE FLOOR (tap-to-dance): walks its path like a
// Mover, then holds its `spot` and loops the dance clip. Unlike a Mover it never
// re-seats — the seat stays theirs, so removing the dancer restores the seated
// figure for free. `faceY` is the heading it settles into while dancing.
type Dancer = { gid: string; name: string; spec: FigureSpec; path: Vec2[]; spot: Vec2; faceY: number };

export default function SeatingLab3D({ eventId, tables: initialTables, floor: floorProp, guests, rolePalette, receptionDesign, venueSetting, monogram, animatedMonogram, me, keepApart: keepApartProp, priorityOrder: priorityOrderProp, groups, floorExtras, sceneObjects, booths, signs, ghostBooths, ghostBoothsEnabled }: Props) {
  const router = useRouter();
  // Floor plan is LOCAL state so the lab can edit it (move/resize the stage +
  // dance floor, toggle entrance/dance) optimistically; it re-syncs from server
  // truth when props change (loader re-run) — EXCEPT while a floor save is still
  // in flight, when a concurrent mutation's router.refresh would otherwise clobber
  // the optimistic edit with stale data (and a later edit would then build on it →
  // lost edit). The counter holds the resync until every in-flight save settles.
  const [floor, setFloor] = useState(floorProp);
  const floorInFlight = useRef(0);
  useEffect(() => {
    if (floorInFlight.current > 0) return;
    setFloor(floorProp);
  }, [floorProp]);
  // ONE reduced-motion flag threaded to every JS-driven motion (camera ease,
  // walk/swap glide+bob, table slide-lag + pop, orbit momentum). SSR-safe +
  // live-updating. The flow still COMPLETES when reduced — we drop the easing
  // and snap to the same final state, firing the same completion callbacks.
  const reduced = usePrefersReducedMotion();
  const room = useMemo(() => roomSize(floor), [floor]);
  const [mode, setMode] = useState<'build' | 'play'>('build');
  const [paletteKey, setPaletteKey] = useState('mood');
  const palette = useMemo<Lab3DPalette>(() => {
    if (paletteKey === 'mood') return resolvePaletteFromRoles(rolePalette);
    return DEMO_PALETTES.find((p) => p.key === paletteKey)?.palette ?? resolvePaletteFromRoles(rolePalette);
  }, [paletteKey, rolePalette]);
  // Wave 2b: room archetype + its floor tint (background stays the lab's dark
  // studio in Play/Build for editing legibility, but garden/beach/rooftop lift
  // it toward their sky so the open-air shells don't float in black).
  const archetype = useMemo(() => archetypeFor(venueSetting), [venueSetting]);
  const archFloorColor = useMemo(() => archetypeFloorColor(archetype, palette), [archetype, palette]);
  // Cinematic Tier A (Fable §3.5) — the dust motes hover in the key light's
  // shaft over the dance floor; a disabled dance floor falls back to the room
  // centre (the Play camera's focal point either way).
  const moteZone = useMemo(() => {
    if (floor.dance.enabled) {
      const c = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);
      return {
        center: { x: c.x, z: c.z },
        size: {
          w: Math.max(3, (floor.dance.wPct / 100) * room.w),
          d: Math.max(3, (floor.dance.hPct / 100) * room.d),
        },
      };
    }
    return { center: { x: 0, z: 0 }, size: { w: room.w * 0.4, d: room.d * 0.4 } };
  }, [floor.dance, room]);
  // Cinematic Tier B (Fable §3.5) — true postprocessing (Bloom + DoF + grain +
  // composer vignette), mounted ONLY when Play needs it: Play mode && this
  // surface's quality knob ('high' — the lab always runs the desktop tier; the
  // phone guest walk runs 'low' and NEVER loads the chunk) && motion OK (house
  // law: reduced = static grade, no composer) && not perf-degraded. The
  // degrade latch is ONE-WAY for the session — PerformanceMonitor inside the
  // pass fires onDegrade once on sustained decline, we unmount to Tier A and
  // never remount, so there is no incline/decline thrash by construction.
  const [fxDegraded, setFxDegraded] = useState(false);
  const onFxDegrade = useCallback(() => setFxDegraded(true), []);
  const cinematicFx = mode === 'play' && !reduced && !fxDegraded;
  // Live world position of the followed walk-in — written by the Walker's
  // frame loop (nulled on unmount), read by the Tier B DepthOfField so focus
  // eases onto whoever is walking to their seat. A ref, never state: the DoF
  // consumes it per-frame without re-rendering React (MASCOT-SMOOTH).
  const walkerPosRef = useRef<THREE.Vector3 | null>(null);

  // Single-editor lock — the SAME one the 2D editor uses, so 3D and 2D never
  // write at once. Acquire on mount; canEdit is false (view-only) until granted.
  const lock = useSeatingLock(eventId, me.name, null);
  const canEdit = lock.status === 'editing';
  // Shared room (slice 8): the authed user is the player identity. Inert unless
  // NEXT_PUBLIC_PLAN3D_SHARED_ROOM is on → byte-identical single-player otherwise.
  // Two partners in Play mode see each other's characters walk the room live.
  const roomSelf = useMemo<LocalPlayer | null>(
    () => (PLAN3D_SHARED_ROOM_ENABLED ? { id: me.id, name: me.name, color: colorFromId(me.id) } : null),
    [me.id, me.name],
  );
  const sharedRoom = usePlan3dRoom(eventId, roomSelf);
  // View-only surface follows the editor live (2D or another 3D viewer) — the
  // EDITING surface never auto-refreshes (it can't clobber its own drag).
  useSeatingLiveRefresh(eventId, !canEdit);
  const acquireLock = lock.acquire;
  const notifyLost = lock.notifyLost;
  useEffect(() => {
    acquireLock();
  }, [acquireLock]);

  const [tables, setTables] = useState<LiveTable[]>(initialTables);
  // When a save FAILS, the optimistic `tables` has already diverged from the DB
  // (a move/rotate that the server rejected, or a delete the server kept). The
  // merge-only reconcile below can't heal that — it never overwrites an existing
  // row's position/rotation nor drops a server-absent row. So a failure arms a
  // one-shot FULL re-hydration: the next `initialTables` snapshot blind-replaces
  // local state (positions, rotations, AND membership) from the server truth.
  const forceResyncRef = useRef(false);
  // Reconcile with the server snapshot. NORMALLY merge new rows in (not a blind
  // replace) — so a router.refresh (from add, or a lost-lock recovery) can't
  // clobber an in-flight optimistic move/rotation. But do a FULL replace —
  // overwrite every row's position/rotation and drop rows the server no longer
  // has — in the two cases where local state must mirror server truth exactly:
  //   • forceResyncRef: a save just failed, so the optimistic `tables` diverged.
  //   • !canEdit: this is a VIEW-ONLY live-sync surface (a peer holds the lock).
  //     It holds no optimistic drag to protect, and the merge-only path below
  //     would silently DROP a peer's move / rotate / delete (it only patches
  //     link-grouping + appends new rows) — so a live viewer would freeze at the
  //     positions it mounted with. The "lab is the only writer" assumption that
  //     justified merge-only no longer holds once the viewer subscribes to live
  //     updates (useSeatingLiveRefresh above).
  useEffect(() => {
    if (forceResyncRef.current || !canEdit) {
      forceResyncRef.current = false;
      setTables(initialTables);
      return;
    }
    setTables((prev) => {
      // Patch link-grouping from server truth onto known rows (link/unlink only
      // mutates linkGroupId/label on existing rows; the add-only merge below
      // would otherwise never reflect it), then add any brand-new tables.
      const reconciled = reconcileGrouping(prev, initialTables);
      const known = new Set(reconciled.map((t) => t.id));
      const added = initialTables.filter((t) => !known.has(t.id));
      return added.length ? [...reconciled, ...added] : reconciled;
    });
  }, [initialTables, canEdit]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Direct-drag for the floor zones (owner 2026-07-17 · universal draggability):
  // stage / dance floor / entrance drag on a ground-plane raycast like tables. A
  // live preview ring follows the pointer (read in useFrame → zero React churn);
  // the zone jumps to the confirmed spot on release. Precision buttons remain.
  const [draggingZone, setDraggingZone] = useState<'stage' | 'dance' | 'entrance' | null>(null);
  const zoneDragRef = useRef<{ zone: 'stage' | 'dance' | 'entrance'; x: number; z: number } | null>(null);
  const zoneDragValidRef = useRef(true);
  // The universal confirm-on-drop bubble (owner 2026-07-17). Shared component,
  // both projections. `dropConfirm` positions it; `pendingDropRef` holds the
  // commit (✓) + revert (✗) closures out of render so the bubble stays light.
  const [dropConfirm, setDropConfirm] = useState<DropConfirmState | null>(null);
  const pendingDropRef = useRef<{ commit: () => void; revert: () => void } | null>(null);
  // Last pointer client position — the confirm bubble anchors at the drop point.
  const lastPointerRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
  // The lab surface (fullscreen target + the bubble's positioning container).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  // Game-pad "walk the room" mode (Play only). The on-screen sticks write into
  // walkInput each frame; WalkController reads it to drive the camera.
  const [walking, setWalking] = useState(false);
  const walkInput = useRef<WalkInput>({ moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0, pinch: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  // Unsaved-2D-changes marker (Sync verdict 2026-07-16 · § 5 · GUN C · door
  // audit). The 2D editor stamps `seating-dirty:{eventId}` in localStorage while
  // it holds unsaved layout changes; if a co-host arrives here via the SPA-nav /
  // hub-tile / direct-URL door, the 3D lab makes that staleness VISIBLE (never
  // silent) with a non-blocking banner. Cleared automatically when the editor
  // saves (the marker vanishes → live-refresh repaints). Re-checked on focus so
  // a save in the other tab clears the banner promptly.
  const [staleDirty, setStaleDirty] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setStaleDirty(!!localStorage.getItem(`seating-dirty:${eventId}`));
      } catch {
        setStaleDirty(false);
      }
    };
    check();
    window.addEventListener('focus', check);
    window.addEventListener('storage', check);
    const id = setInterval(check, 2000);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', check);
      clearInterval(id);
    };
  }, [eventId]);
  // Tapped booth → its vendor card (booth-kit slice 4). Booths stay read-only
  // fixtures in the lab; the card is inspect-only here ("View vendor profile"
  // CTA — the couple already booked them — and no walk-to button).
  const [openBooth, setOpenBooth] = useState<Lab3DBooth | null>(null);
  const [walker, setWalker] = useState<WalkerState>(null);
  // Populate-Play: when set, the whole seated list walks in at once (mutually
  // exclusive with the single `walker`).
  const [crowd, setCrowd] = useState<CrowdAgent[] | null>(null);
  // Precise placement: an unseated guest "picked up" from the roster, waiting
  // for the couple to tap the table they should sit at (vs auto-first-free).
  const [placingGuestId, setPlacingGuestId] = useState<string | null>(null);
  // "Seat a whole group" — armed group id; the next table tap seats its members.
  const [placingGroupId, setPlacingGroupId] = useState<string | null>(null);
  // Link mode — armed table id; the next OTHER table tap links the two as a unit.
  const [linkArmId, setLinkArmId] = useState<string | null>(null);
  // Floor-edit "move" mode — armed zone; the next floor tap drops it there.
  const [placeZone, setPlaceZone] = useState<'stage' | 'dance' | 'entrance' | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const [showCloth, setShowCloth] = useState(true);
  const [showAccents, setShowAccents] = useState(true);
  // Swap state: in-flight movers, the selected guest awaiting a swap partner,
  // and (table-swap) the first picked table.
  const [movers, setMovers] = useState<Mover[]>([]);
  const movingGuests = useMemo(() => new Set(movers.map((m) => m.gid)), [movers]);
  // Tap-to-dance: guests currently out on the dance floor. Excluded from the
  // seated crowd (their chair shows empty) exactly like movers/walk-ins.
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const dancingGuests = useMemo(() => new Set(dancers.map((d) => d.gid)), [dancers]);
  const [swapSelId, setSwapSelId] = useState<string | null>(null);
  const [tableSwapArmed, setTableSwapArmed] = useState(false);
  const [tableSwapFirst, setTableSwapFirst] = useState<string | null>(null);

  // Run a write action. A lost lock (peer took over) drops us to view-only at
  // once (notifyLost); any OTHER error is surfaced without a misleading "lost
  // access" re-acquire. EITHER failure leaves the optimistic `tables` diverged
  // from the DB (the move/rotate/delete that the server rejected is still shown
  // locally), so both paths arm a one-shot FULL re-hydration and refresh the
  // server snapshot — reverting the failed change to server truth (a bare
  // router.refresh wouldn't, because the snapshot effect is merge-only).
  const persist = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        forceResyncRef.current = true;
        if (isLockLost(err)) {
          notifyLost();
          setNotice('Editing was taken over — your last change wasn’t saved.');
        } else {
          setNotice('Couldn’t save that change — please try again.');
        }
        router.refresh();
      }
    },
    [notifyLost, router],
  );

  // Local seat map (starts from the real assignments). The walk demo assigns
  // unseated guests into the first free chair — locally, never persisted.
  const [seats, setSeats] = useState<Map<string, SeatRef>>(() => deriveSeatsFromGuests(guests));
  // Re-derive the local seat map from the refreshed guest rows (server truth) in
  // two cases — otherwise the map stays frozen at the value it mounted with:
  //   • seatResyncRef: one-shot after a self-initiated server bulk op (auto-seat).
  //   • !canEdit: a VIEW-ONLY live-sync surface must reflect a peer's seat/unseat.
  //     A viewer holds no optimistic seat map to protect, so mirror server truth
  //     on every guests refresh. (An editor keeps the merge-guarded one-shot so
  //     its optimistic seat edits aren't clobbered.)
  const seatResyncRef = useRef(false);
  useEffect(() => {
    if (seatResyncRef.current || !canEdit) {
      seatResyncRef.current = false;
      setSeats(deriveSeatsFromGuests(guests));
    }
  }, [guests, canEdit]);

  // Smart seat-plan rules (the "custom auto-seat rules" — keep-apart pairs + the
  // couple's tier priority order). Both feed the SERVER solver; the lab just
  // edits them. DB-only, so optimistic local state + a fire-and-forget persist.
  const [keepApart, setKeepApart] = useState<KeepApartRule[]>(keepApartProp);
  const [priorityOrder, setPriorityOrder] = useState<PriorityOrder>(priorityOrderProp);
  // Re-sync rules from server truth whenever the props change (any router.refresh
  // re-runs the loader). Without this the panel + dedup check go stale after a
  // refresh; the lab is the sole writer so re-applying server truth is safe.
  useEffect(() => {
    setKeepApart(keepApartProp);
    setPriorityOrder(priorityOrderProp);
  }, [keepApartProp, priorityOrderProp]);
  // Optimistic per-guest priority overlay — the chip cycles instantly without a
  // router.refresh (which would otherwise churn the page). Cleared whenever fresh
  // guest rows arrive (server truth then carries the persisted priority).
  const [priorityOverride, setPriorityOverride] = useState<Map<string, number | null>>(() => new Map());
  useEffect(() => {
    setPriorityOverride((prev) => (prev.size ? new Map() : prev));
  }, [guests]);

  // Live world-space drag target (avoids a React re-render every pointer move).
  const dragRef = useRef<{ id: string; x: number; z: number } | null>(null);
  // Live legality of the current drag pose — read INSIDE the dragged TableMesh's
  // useFrame to tint its ground ring (gold = valid, warm-red = invalid) with
  // zero React churn, exactly like dragRef itself.
  const dragValidRef = useRef(true);
  // SNAP-BACK DROP RULE (owner 2026-07-17 · "undroppable when overlap"). The
  // in-drag table follows the finger FREELY (dragRef); the warm-red ring is the
  // per-frame warning; enforcement lives at COMMIT. On release, `commitDrag`
  // validates the drop through the shared `dropAccepted` oracle — valid persists,
  // invalid is NO drop: we simply don't setTables, so the mesh's useFrame lerp
  // eases it straight back to `home` (the drag-START pose still in React state) =
  // the animated snap-back, instant under reduced motion. This REPLACES the
  // monotone-escape drag baseline + settle-to-last-valid release guard entirely
  // (owner 2026-07-17 · "supersedes settle-to-last-valid"), so no `dragBaselineRef`
  // / `lastValidPctRef` are kept — there is no intermediate settle spot anymore.
  // (Sync verdict 2026-07-16 · § 5 · GUN C: the drag-snap no longer auto-links —
  // `commitWeld` persists the pose, linking is the explicit affordance only — so
  // the old `doLinkRef` forward-reference bridge for snap-link is retired.)

  // ── Placement-oracle bridge (directive 2026-07-16 · "manipulation parity") ──
  // 3D move + rotate validate through the SAME pure oracle as the 2D editor
  // (checkPlacement / penetrationDepth in lib/seating.ts). The oracle is scale-
  // homogeneous, so running it in METRES here yields a valid/invalid verdict
  // identical to the 2D editor's pixel-space verdict (every length there is this
  // one × pxPerMeter, and the oracle only compares lengths) — parity by
  // construction, no forked geometry. Only a sized (walled) room runs it; the
  // free auto-grow board is place-anywhere in both projections.
  const venueScaled = !!(
    floor.venueWidthM &&
    floor.venueLengthM &&
    floor.venueWidthM > 0 &&
    floor.venueLengthM > 0
  );
  // Default walkway = the 2D editor's default aisle (0.6 m). aisleM is 2D
  // session-state (unpersisted); the lab keeps the same default so the two agree.
  const WALKWAY_M = 0.6;
  // Metre-space pose builder — mirrors the 2D editor's poseAt/scaleOf, with
  // pxPerMeter folded out to 1 (metres). tableGeometry owns the local geometry.
  const scaleOfTable = useCallback((t: LiveTable): number => {
    const footM = TABLE_FOOTPRINT_M[t.type as TableType] ?? TABLE_FOOTPRINT_M.round_10;
    const geo = tableGeometry(t.shape, Math.max(1, t.capacity));
    return footM / geo.box.w;
  }, []);
  const oraclePose = useCallback(
    (t: LiveTable, xPct: number, yPct: number): OracleWorldPose => ({
      tableId: t.id,
      shape: t.shape,
      capacity: t.capacity,
      x: (xPct / 100) * room.w,
      y: (yPct / 100) * room.d,
      rot: t.rotationDeg,
      scale: scaleOfTable(t),
      linkGroupId: t.linkGroupId,
    }),
    [room, scaleOfTable],
  );
  // No-go zones — stage (sweetheart-exempt) + dance floor + cocktail room +
  // vendor booths, exactly the set the 2D editor's zonesFor collects. The STAGE
  // is a CONDITIONAL obstacle: only the couple's sweetheart table may sit on it,
  // every other table reads as a collision — the retired 3D-only sweetheart-stage
  // rule, now SHARED in the oracle (owner 2026-07-16). Centre-anchored, metres.
  const oracleZones = useCallback((): OracleZone[] => {
    const out: OracleZone[] = [];
    const toX = (p: number) => (p / 100) * room.w;
    const toY = (p: number) => (p / 100) * room.d;
    // Sized room only (parity with the 2D editor's zonesFor + the oracle bridge's
    // venueScaled gate) — the free auto-grow board is place-anywhere.
    if (venueScaled)
      out.push(
        stageZone(
          { stage_x: floor.stage.xPct, stage_y: floor.stage.yPct, stage_w: floor.stage.wPct, stage_h: floor.stage.hPct },
          { width: room.w, height: room.d },
        ),
      );
    if (floor.dance.enabled)
      out.push({ id: 'dance', x: toX(floor.dance.xPct), y: toY(floor.dance.yPct), w: toX(floor.dance.wPct), h: toY(floor.dance.hPct) });
    if (floorExtras.cocktailEnabled)
      out.push({ id: 'cocktail', x: toX(floorExtras.cocktailX), y: toY(floorExtras.cocktailY), w: toX(floorExtras.cocktailW), h: toY(floorExtras.cocktailH) });
    for (let i = 0; i < booths.length; i++) {
      const b = booths[i]!;
      out.push({ id: `booth${i}`, x: toX(b.xPct), y: toY(b.yPct), w: BOOTH_FOOTPRINT_M.w, h: BOOTH_FOOTPRINT_M.d });
    }
    return out;
  }, [room, venueScaled, floor.stage, floor.dance, floorExtras, booths]);
  // World px ↔ percent for the ground-plane raycast (centre-origin, matches
  // pctToWorld). Kept local so the drag maths reads cleanly.
  const worldToPct = useCallback(
    (wx: number, wz: number) => ({ x: (wx / room.w + 0.5) * 100, y: (wz / room.d + 0.5) * 100 }),
    [room],
  );
  // Would rotating `t` (at its stored spot) to `deg` collide with a non-groupmate
  // or a zone? The 2D editor's rotationBlocked, same oracle. Same-link_group_id
  // members are exempt inside checkPlacement (the weld model), so a chain member
  // never trips on its own siblings.
  const rotationBlocked = useCallback(
    (t: LiveTable, deg: number): boolean => {
      const world = {
        others: tables.filter((o) => o.id !== t.id).map((o) => oraclePose(o, o.xPct, o.yPct)),
        zones: oracleZones(),
      };
      const pose: OracleWorldPose = { ...oraclePose(t, t.xPct, t.yPct), rot: deg };
      return !oracleCheckPlacement(pose, world, { gapPx: WALKWAY_M }).valid;
    },
    [tables, oraclePose, oracleZones],
  );

  // READ-ONLY legacy-overlap flag (owner 2026-07-17 · 3D round-collision audit).
  // Saved anchors are NEVER force-moved on load, so a room persisted before the
  // shared oracle (e.g. a pre-#3307 round-vs-round "kiss") can sit body-deep in
  // an overlap that the CURRENT create + drag paths would refuse. The 2D editor
  // already surfaces these via its mount audit (`layoutViolations`); this is the
  // 3D twin — the SAME pure audit over the SAME chair-inclusive poses + zones +
  // walkway, so both projections flag the identical set. Pure `useMemo` (no
  // setState → no update-depth churn); recomputes only when the tables/room/zones
  // change, never per frame. The flagged tables render a warm-red ground ring
  // (see `TableMesh`), and the monotone-escape drag (§ MONOTONE ESCAPE above) lets
  // the user drag the overlapped table APART to heal it. Build mode only — Play is
  // a cinematic walkthrough with no editing affordance.
  const violatingIds = useMemo<Set<string>>(() => {
    if (!venueScaled || mode !== 'build') return new Set();
    const poses = tables.map((t) => oraclePose(t, t.xPct, t.yPct));
    const rows = oracleLayoutViolations(poses, oracleZones(), WALKWAY_M);
    return new Set(rows.map((r) => r.tableId));
  }, [venueScaled, mode, tables, oraclePose, oracleZones]);

  const entranceWorld = useMemo<Vec2>(() => {
    const e = floor.entrance.enabled ? floor.entrance : { xPct: 50, yPct: 96 };
    return pctToWorld(e.xPct, e.yPct, room);
  }, [floor, room]);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const guestById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  // The cocktail room (derived from the floorExtras the lab must round-trip on
  // save) — rendered as a second-room shell + treated as a solid perimeter.
  const cocktail = useMemo<Lab3DCocktail>(
    () =>
      floorExtras.cocktailEnabled
        ? {
            xPct: floorExtras.cocktailX,
            yPct: floorExtras.cocktailY,
            wPct: floorExtras.cocktailW,
            hPct: floorExtras.cocktailH,
            label: floorExtras.cocktailLabel,
          }
        : null,
    [floorExtras],
  );
  // Avoidance discs for the placed venue fixtures (objects + booths + sign posts
  // + cocktail walls) — merged into every walk/crowd obstacle set so the roam
  // avatar rounds the buffet / photo booth / cocktail room just like a table.
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
      ...(coldSpark ? coldSparkObstacles(entranceWorld, room) : []),
    ],
    [sceneObjects, booths, signs, cocktail, room, coldSpark, entranceWorld],
  );
  // What the walking camera can't pass through: TRUE table footprints (a
  // banquet reads as a capsule, a serpentine as its band — corners included) +
  // stage/dance + fixture discs. Chair discs are emitted for SERPENTINE
  // tables only: every other shape's chair discs sit strictly inside their
  // table's footprint clearance disc (round reach w/2+0.75 vs footprint
  // w/2+0.8, banquet d/2+0.7 vs d/2+0.8, …), and this set keeps every
  // footprint solid — those ~150 discs could never bind and were pure
  // query/build overhead. Seated guests stay covered by the footprint the
  // roaming couple already can't enter; only the serpentine's chairs ride
  // OUTSIDE its deliberately-tight band clearance and do real work.
  // Spatial-hashed: the roam clamp runs EVERY frame — the grid keeps that
  // query local while pushOutOfDiscs stays bit-identical to the brute-force
  // walk (the parity test's contract).
  const walkObstacles = useMemo(
    () =>
      buildObstacleGrid([
        ...floorObstacles(floor, tables, room, []),
        ...tables.filter((t) => t.shape === 'serpentine').flatMap((t) => chairObstacles(t, room)),
        ...fixtureObstacles,
      ]),
    [floor, tables, room, fixtureObstacles],
  );
  // Entrance for the walk camera's SPAWN (walkSpawnPoint) — strictly null when
  // the doorway is disabled, unlike entranceWorld's walk-in fallback: with no
  // door there's nothing to step in through, so the spawn clamps in instead.
  const walkEntrance = useMemo<Vec2 | null>(
    () => (floor.entrance.enabled ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room) : null),
    [floor, room],
  );
  // Walk mode only makes sense in Play — drop it whenever we leave.
  useEffect(() => {
    if (mode !== 'play') setWalking(false);
  }, [mode]);
  // Open-canvas framing: the free board lets tables sit far outside the default
  // room, so let the camera zoom out far enough to take the WHOLE layout in
  // (not just the fixed venue rectangle). Drives OrbitControls maxDistance.
  const bounds = useMemo(() => contentBounds(tables, room), [tables, room]);

  // One SeatToken (colour + FigureSpec) per guest, memoised on the guest rows
  // ONLY — walker/crowd/mover/seat state changes must NOT mint fresh spec
  // identities, or every seated <Figure>'s React.memo (and any future
  // equality-based skip) is defeated exactly when an animation starts. Every
  // consumer below (seated map, walk-in, crowd, movers) reads from this map.
  const tokenByGuest = useMemo(() => {
    const m = new Map<string, SeatToken | null>();
    for (const g of guests) m.set(g.id, guestTokenStyle(g));
    return m;
  }, [guests]);

  // Per-table, per-seat token treatment from each seated guest's RSVP, plus a
  // ghost "+1 reserved" seat beside any guest the couple allowed a +1 whose +1
  // isn't already a seated row. Declined guests aren't rendered (seat freed).
  const seatedByTable = useMemo(() => {
    const out = new Map<string, Map<number, SeatToken>>();
    const slot = (tid: string) => {
      let m = out.get(tid);
      if (!m) {
        m = new Map();
        out.set(tid, m);
      }
      return m;
    };
    // Guests currently walking IN — the single walk-in OR the populate-Play crowd
    // — are drawn by their walking avatar, never also as a static seated token.
    // Without this they'd render twice: a ghost glued to the chair while the real
    // one walks in (owner: "the person on the seat never left"). Same rule as the
    // mid-swap exclusion below; the seated token reappears once they settle.
    const walkingIn = new Set<string>();
    if (crowd) for (const a of crowd) walkingIn.add(a.id);
    if (walker) walkingIn.add(walker.gid);
    const plusOneSeated = new Set<string>(); // primaries whose +1 is already seated
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      if (!g) continue;
      if (g.plusOneOfGuestId) plusOneSeated.add(g.plusOneOfGuestId);
      if (movingGuests.has(gid)) continue; // mid-swap → drawn by its mover instead
      if (dancingGuests.has(gid)) continue; // out dancing → drawn by its Dancer, chair empty
      if (walkingIn.has(gid)) continue; // walking in → drawn by its walker/crowd agent
      const style = tokenByGuest.get(gid);
      if (!style) continue; // declined → freed seat
      slot(s.tableId).set(s.seatNumber, style);
    }
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      // A walking-in primary also suppresses their hovering +1 ghost — they
      // arrive together, so neither is drawn at rest until the walk settles.
      if (!g || !g.plusOneAllowed || plusOneSeated.has(gid) || walkingIn.has(gid) || dancingGuests.has(gid) || seatStatusOf(g.rsvp) === 'hidden') continue;
      const t = tablesById.get(s.tableId);
      if (!t) continue;
      const occ = slot(s.tableId);
      const removed = new Set(t.removedSeats);
      let chosen = -1;
      for (let d = 1; d <= t.capacity && chosen < 0; d++) {
        for (const cand of [s.seatNumber + d, s.seatNumber - d]) {
          if (cand >= 0 && cand < t.capacity && !removed.has(cand) && !occ.has(cand)) {
            chosen = cand;
            break;
          }
        }
      }
      if (chosen >= 0) occ.set(chosen, { color: PLUS_ONE_COLOR, opacity: 0.4, name: '', spec: null });
    }
    return out;
  }, [seats, guestById, tablesById, movingGuests, dancingGuests, crowd, walker, tokenByGuest]);

  // Emote-bubble emitters (Fable §3.6) — REAL data, Play mode only (Build stays
  // clean for editing; the memo is empty there so the pool renders nothing).
  // One emitter per seated guest at their seat's world anchor: RSVP drives the
  // base glyph (attending ✓ · pending ? · maybe ~) and a chosen meal adds the
  // plate to that guest's rotation (once per rotation, per the pure schedule).
  // Guests mid-walk (single walk-in, populate-Play crowd, swap movers) are
  // excluded exactly like seatedByTable — a bubble over an empty chair while
  // its guest is still crossing the room reads as a ghost. +1 ghosts have no
  // person, so no bubble.
  const emoteEmitters = useMemo<EmoteEmitter[]>(() => {
    if (mode !== 'play') return [];
    const walkingIn = new Set<string>();
    if (crowd) for (const a of crowd) walkingIn.add(a.id);
    if (walker) walkingIn.add(walker.gid);
    const out: EmoteEmitter[] = [];
    for (const [gid, s] of seats) {
      if (movingGuests.has(gid) || dancingGuests.has(gid) || walkingIn.has(gid)) continue;
      const g = guestById.get(gid);
      if (!g || seatStatusOf(g.rsvp) === 'hidden') continue; // declined → freed seat
      const t = tablesById.get(s.tableId);
      if (!t) continue;
      const p = seatWorld(t, s.seatNumber, room);
      const glyphs: EmoteGlyph[] = [g.rsvp === 'attending' ? 'check' : g.rsvp === 'maybe' ? 'maybe' : 'pending'];
      if (g.mealChosen) glyphs.push('meal');
      out.push({ id: gid, x: p.x, y: EMOTE_SEATED_Y, z: p.z, glyphs });
    }
    return out;
  }, [mode, seats, guestById, tablesById, room, movingGuests, dancingGuests, crowd, walker]);

  // ── Confirm-on-drop bubble helpers (owner 2026-07-17) ────────────────────────
  // The bubble anchors at the drop point in wrapper-relative coords; it flips
  // toward the interior near the right / top edges so it never clips or occludes.
  const bubbleAnchor = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const { cx, cy } = lastPointerRef.current;
    if (!rect) return { x: cx, y: cy, flipX: false, flipY: false };
    const x = cx - rect.left;
    const y = cy - rect.top;
    return { x, y, flipX: x > rect.width - 260, flipY: y < 150 };
  }, []);
  // A VALID drop asks "Drop here?" — the element is already placed optimistically,
  // so ✓ persists (commit) and ✗ / Esc reverts (the snap-back). One gate for
  // tables AND zones.
  const askConfirmDrop = useCallback(
    (commit: () => void, revert: () => void) => {
      pendingDropRef.current = { commit, revert };
      setDropConfirm({ kind: 'confirm', ...bubbleAnchor() });
    },
    [bubbleAnchor],
  );
  // An INVALID drop names what it hit (the element already snapped back). The
  // silent snap-back is superseded by this named refusal (directive 2026-07-17).
  const showRejectDrop = useCallback(
    (hit: DropHit) => {
      pendingDropRef.current = null;
      const name = hit.otherId
        ? tablesById.get(hit.otherId)?.label ?? 'another table'
        : hit.zoneId
          ? zoneDisplayName(hit.zoneId)
          : 'another element';
      const message =
        hit.kind === 'tight'
          ? `Too close to ${name} — needs ${WALKWAY_M} m clear.`
          : `This area intersects with ${name} — please choose a different area.`;
      setDropConfirm({ kind: 'reject', message, ...bubbleAnchor() });
    },
    [bubbleAnchor, tablesById],
  );
  const onDropConfirm = useCallback(() => {
    const p = pendingDropRef.current;
    pendingDropRef.current = null;
    setDropConfirm(null);
    p?.commit();
  }, []);
  const onDropCancel = useCallback(() => {
    const p = pendingDropRef.current;
    pendingDropRef.current = null;
    setDropConfirm(null);
    p?.revert();
  }, []);

  const commitDrag = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!d) return;
    // Venue-sized rooms store 0–100% (clamp to the walls); the free auto-grow
    // board legitimately exceeds 0–100, so don't collapse it into the box.
    const freeBoard = !(floor.venueWidthM && floor.venueLengthM);
    const lo = freeBoard ? -200 : 2;
    const hi = freeBoard ? 600 : 98;
    const clampPct = (v: number) => Math.max(lo, Math.min(hi, v));
    const dragged = tablesById.get(d.id);

    // Serpentine end-to-end AUTO-SNAP (owner 2026-07-10: "put the ends of the
    // serpentine next to each other to create that auto connect snap between
    // tables"). On drop near another serpentine's tip, click into the chained
    // placement — position AND rotation — the 3D twin of the 2D editor's snap.
    // A snapped chain is an INTENTIONAL touch, so it skips the overlap guard
    // below (the guard's coarse bounding circles would otherwise reject it).
    let dropX = d.x;
    let dropZ = d.z;
    let snappedRotDeg: number | null = null;
    let snapNeighbourId: string | null = null;
    if (dragged && dragged.shape === 'serpentine' && !dragged.linkGroupId) {
      const neighbours = tables
        .filter((t) => t.id !== d.id && t.shape === 'serpentine')
        .map((t) => {
          const p = pctToWorld(t.xPct, t.yPct, room);
          return { x: p.x, z: p.z, rotDeg: t.rotationDeg, id: t.id };
        });
      const serpW = tableDims('serpentine', dragged.capacity).w;
      const snap = serpentineChainSnapWorld({ x: d.x, z: d.z }, neighbours, Math.max(0.6, serpW * 0.4));
      if (snap) {
        dropX = snap.x;
        dropZ = snap.z;
        snappedRotDeg = snap.rotDeg;
        snapNeighbourId = snap.neighbourId;
      }
    }

    const xPct = clampPct((dropX / room.w + 0.5) * 100);
    const yPct = clampPct((dropZ / room.d + 0.5) * 100);

    // SNAP-BACK DROP RULE (owner 2026-07-17 · "undroppable when overlap"). An
    // invalid release is NO drop: the shared `dropAccepted` oracle decides, and
    // on refusal we persist NOTHING and don't setTables — the dragged table's (or
    // the whole unit's) mesh eases back to `home`, its drag-START pose still held
    // in React state, which IS the animated snap-back (instant under reduced
    // motion). A SNAPPED serpentine is a sanctioned join (valid by construction,
    // links on drop) and is exempt. Free board is place-anywhere (no metric aisle).

    // Linked unit → translate every member by the same delta (move as one).
    const groupId = dragged?.linkGroupId ?? null;
    if (groupId && dragged) {
      const members = tables.filter((t) => t.linkGroupId === groupId);
      // Keep the whole unit ON-BOARD without distorting it: clamp the SHARED
      // delta by the group's bounding extent. Clamping each member's position
      // independently (as the single-table path does) would pull the chain apart
      // at a wall — the dragged member stops while a sibling keeps going.
      const xs = members.map((m) => m.xPct);
      const ys = members.map((m) => m.yPct);
      const ddx = Math.max(lo - Math.min(...xs), Math.min(hi - Math.max(...xs), xPct - dragged.xPct));
      const ddy = Math.max(lo - Math.min(...ys), Math.min(hi - Math.max(...ys), yPct - dragged.yPct));
      // A tap (no real drag) → not a move: don't prompt, leave the unit put.
      if (Math.abs(ddx) < 0.25 && Math.abs(ddy) < 0.25) return;
      // One commit rule, shared helper (directive 2026-07-17): the unit is accepted
      // only if every member clears the oracle at the shared delta. Members are
      // exempt from each other via their legal joints (checkPlacement's
      // atLegalJoint), so only collisions with NON-members / zones / the walkway
      // block the drop. Sized room only; the free board is place-anywhere. Invalid
      // → snap back + name what it hit; valid → place optimistically + confirm.
      const memberIds = new Set(members.map((m) => m.id));
      if (venueScaled) {
        const others = tables.filter((t) => !memberIds.has(t.id)).map((t) => oraclePose(t, t.xPct, t.yPct));
        const movedPoses = members.map((m) => oraclePose(m, m.xPct + ddx, m.yPct + ddy));
        const hit = firstDropViolation(movedPoses, others, oracleZones(), { gapPx: WALKWAY_M });
        if (hit) {
          showRejectDrop(hit); // no setTables → the whole unit eases back to start
          return;
        }
      }
      const startSnap = new Map(members.map((m) => [m.id, { xPct: m.xPct, yPct: m.yPct }] as const));
      setTables((prev) =>
        prev.map((t) => (memberIds.has(t.id) ? { ...t, xPct: t.xPct + ddx, yPct: t.yPct + ddy } : t)),
      );
      askConfirmDrop(
        () => {
          if (!canEdit) return;
          for (const m of members) {
            const fd = new FormData();
            fd.set('event_id', eventId);
            fd.set('lock_id', lock.lockId ?? '');
            fd.set('table_id', m.id);
            fd.set('x_pos', String(m.xPct + ddx));
            fd.set('y_pos', String(m.yPct + ddy));
            void persist(() => updateTablePosition(fd));
          }
        },
        () =>
          setTables((prev) =>
            prev.map((t) => {
              const s = startSnap.get(t.id);
              return s ? { ...t, xPct: s.xPct, yPct: s.yPct } : t;
            }),
          ),
      );
      return;
    }

    // A tap (no real drag) with no snap → not a move: skip the confirm entirely
    // (mirrors the 2D editor's `d.moved` guard, so a select-tap never prompts).
    if (
      snappedRotDeg === null &&
      dragged &&
      Math.abs(xPct - dragged.xPct) < 0.25 &&
      Math.abs(yPct - dragged.yPct) < 0.25
    ) {
      return;
    }

    // Single table → validate the exact release pose. A snapped serpentine is a
    // sanctioned join (valid by construction, links on drop) → it commits directly,
    // no confirm gate; every other drop asks "Drop here?" or names its refusal.
    if (venueScaled && dragged && snappedRotDeg === null) {
      const others = tables.filter((t) => t.id !== d.id).map((t) => oraclePose(t, t.xPct, t.yPct));
      const hit = firstDropViolation([oraclePose(dragged, xPct, yPct)], others, oracleZones(), { gapPx: WALKWAY_M });
      if (hit) {
        showRejectDrop(hit);
        return; // NO drop → state keeps the start pose → the mesh eases back home.
      }
    }

    const persistSingle = () => {
      if (!canEdit) return;
      const anchor = snapNeighbourId ? tablesById.get(snapNeighbourId) : undefined;
      if (snappedRotDeg !== null && anchor) {
        // ATOMIC WELD (Sync verdict 2026-07-16 · § 5 · GUN C). The snap changed
        // this table's position AND rotation; persist BOTH — plus the anchor's
        // pose — in ONE round trip via `commitWeld`, so the DB never holds a
        // half-applied weld. commitWeld does NOT write link_group_id.
        const batch = weldCommitBatch(
          { tableId: d.id, xPct, yPct, rotationDeg: snappedRotDeg },
          { tableId: anchor.id, xPct: anchor.xPct, yPct: anchor.yPct, rotationDeg: anchor.rotationDeg },
        );
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('lock_id', lock.lockId ?? '');
        fd.set('poses', JSON.stringify(batch));
        void persist(() => commitWeld(fd));
      } else {
        // Plain move — position only (rotation unchanged), the deferred-free path.
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('lock_id', lock.lockId ?? '');
        fd.set('table_id', d.id);
        fd.set('x_pos', String(xPct));
        fd.set('y_pos', String(yPct));
        void persist(() => updateTablePosition(fd));
      }
    };

    // Place optimistically so the mesh holds at the drop pose while we ask.
    const startX = dragged?.xPct;
    const startY = dragged?.yPct;
    const startRot = dragged?.rotationDeg;
    setTables((prev) =>
      prev.map((t) =>
        t.id === d.id
          ? { ...t, xPct, yPct, ...(snappedRotDeg !== null ? { rotationDeg: snappedRotDeg } : {}) }
          : t,
      ),
    );
    if (snappedRotDeg !== null) {
      persistSingle(); // sanctioned join → commit directly (no confirm gate)
      return;
    }
    askConfirmDrop(persistSingle, () =>
      setTables((prev) =>
        prev.map((t) =>
          t.id === d.id && startX != null && startY != null
            ? { ...t, xPct: startX, yPct: startY, ...(startRot != null ? { rotationDeg: startRot } : {}) }
            : t,
        ),
      ),
    );
  }, [
    room,
    floor,
    canEdit,
    eventId,
    lock.lockId,
    persist,
    tables,
    tablesById,
    venueScaled,
    oraclePose,
    oracleZones,
    askConfirmDrop,
    showRejectDrop,
  ]);

  // Clear any selection when leaving Build so it doesn't linger into Play.
  useEffect(() => {
    if (mode === 'play') setSelectedId(null);
  }, [mode]);

  // 2D-parity floor designer: persist the WHOLE floor row. The lab only edits
  // stage/dance/entrance/venue, so it round-trips the untouched service-door +
  // cocktail-room fields (floorExtras) — saveFloorPlan upserts the whole row, and
  // omitting them would wipe what the 2D editor set.
  const saveFloor = useCallback(
    (f: Lab3DFloor) => {
      if (!canEdit) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('stage_x', String(f.stage.xPct));
      fd.set('stage_y', String(f.stage.yPct));
      fd.set('stage_w', String(f.stage.wPct));
      fd.set('stage_h', String(f.stage.hPct));
      fd.set('entrance_enabled', f.entrance.enabled ? 'true' : 'false');
      fd.set('entrance_x', String(f.entrance.xPct));
      fd.set('entrance_y', String(f.entrance.yPct));
      // CRITICAL — saveFloorPlan upserts the WHOLE row, so a 3D-lab save that
      // omitted the entrance kind/depth would reset any Walk-through the 2D
      // editor set back to 'door' (whole-row data loss). Round-trip them like
      // the service-door / cocktail fields below.
      fd.set('entrance_kind', f.entrance.kind);
      fd.set('entrance_depth_m', String(f.entrance.depthM));
      fd.set('dance_enabled', f.dance.enabled ? 'true' : 'false');
      fd.set('dance_x', String(f.dance.xPct));
      fd.set('dance_y', String(f.dance.yPct));
      fd.set('dance_w', String(f.dance.wPct));
      fd.set('dance_h', String(f.dance.hPct));
      if (f.venueWidthM != null) fd.set('venue_width_m', String(f.venueWidthM));
      if (f.venueLengthM != null) fd.set('venue_length_m', String(f.venueLengthM));
      // Preserve (else the whole-row upsert wipes them):
      fd.set('service_entrance_enabled', floorExtras.serviceEntranceEnabled ? 'true' : 'false');
      fd.set('service_entrance_x', String(floorExtras.serviceEntranceX));
      fd.set('service_entrance_y', String(floorExtras.serviceEntranceY));
      fd.set('cocktail_enabled', floorExtras.cocktailEnabled ? 'true' : 'false');
      fd.set('cocktail_x', String(floorExtras.cocktailX));
      fd.set('cocktail_y', String(floorExtras.cocktailY));
      fd.set('cocktail_w', String(floorExtras.cocktailW));
      fd.set('cocktail_h', String(floorExtras.cocktailH));
      if (floorExtras.cocktailLabel) fd.set('cocktail_label', floorExtras.cocktailLabel);
      fd.set('cocktail_vendor_edit', floorExtras.cocktailVendorEdit ? 'true' : 'false');
      fd.set('cocktail_linked', floorExtras.cocktailLinked ? 'true' : 'false');
      floorInFlight.current += 1;
      void persist(async () => {
        try {
          await saveFloorPlan(fd);
        } finally {
          floorInFlight.current -= 1;
        }
      });
    },
    [canEdit, eventId, lock.lockId, persist, floorExtras],
  );
  // The next floor with a zone recentred (pure — no state/persist).
  const moveZoneFloor = useCallback(
    (zone: 'stage' | 'dance' | 'entrance', xPct: number, yPct: number): Lab3DFloor =>
      zone === 'stage'
        ? { ...floor, stage: { ...floor.stage, xPct, yPct } }
        : zone === 'dance'
          ? { ...floor, dance: { ...floor.dance, xPct, yPct } }
          : { ...floor, entrance: { ...floor.entrance, xPct, yPct } },
    [floor],
  );
  // A moved zone's oracle footprint at a new pct centre (stage keeps its
  // sweetheart-exempt flag via stageZone; dance is a plain no-go rect).
  const zoneFootprintAt = useCallback(
    (zone: 'stage' | 'dance', xPct: number, yPct: number): OracleZone =>
      zone === 'stage'
        ? stageZone(
            { stage_x: xPct, stage_y: yPct, stage_w: floor.stage.wPct, stage_h: floor.stage.hPct },
            { width: room.w, height: room.d },
          )
        : {
            id: 'dance',
            x: (xPct / 100) * room.w,
            y: (yPct / 100) * room.d,
            w: (floor.dance.wPct / 100) * room.w,
            h: (floor.dance.hPct / 100) * room.d,
          },
    [floor.stage, floor.dance, room],
  );
  // THE ZONE DROP RULE (owner 2026-07-17 · universal draggability): the stage /
  // dance footprint must clear every table (a sweetheart may sit on the stage) and
  // every OTHER zone at the walkway gap — the mirror of the table drop rule, one
  // shared helper (`zoneDropViolation`). The entrance carries no footprint (no
  // existing collision semantics) → place-anywhere, but it still confirms-on-drop.
  const zoneDropHit = useCallback(
    (zone: 'stage' | 'dance' | 'entrance', xPct: number, yPct: number): DropHit | null => {
      if (!venueScaled || zone === 'entrance') return null;
      const mz = zoneFootprintAt(zone, xPct, yPct);
      const tablePoses = tables.map((t) => oraclePose(t, t.xPct, t.yPct));
      const otherZones = oracleZones().filter((z) => z.id !== mz.id);
      return zoneDropViolation(mz, tablePoses, otherZones, { gapPx: WALKWAY_M });
    },
    [venueScaled, zoneFootprintAt, tables, oraclePose, oracleZones],
  );
  // Place a zone at a pct spot — the SHARED path for both the direct drag and the
  // "Move stage/dance/entrance" tap-to-place button. Invalid → named refusal
  // (nothing moves). Valid → move optimistically + confirm-on-drop (✓ persists,
  // ✗ reverts to the start floor). Routes stage/dance/entrance through the SAME
  // `dropAccepted`-class rule the tables use — the bypass #3362 left open.
  const placeZoneAt = useCallback(
    (zone: 'stage' | 'dance' | 'entrance', xPct: number, yPct: number) => {
      if (!canEdit) return;
      const hit = zoneDropHit(zone, xPct, yPct);
      if (hit) {
        showRejectDrop(hit);
        return;
      }
      const startFloor = floor;
      const next = moveZoneFloor(zone, xPct, yPct);
      setFloor(next);
      askConfirmDrop(
        () => saveFloor(next),
        () => setFloor(startFloor),
      );
    },
    [canEdit, zoneDropHit, floor, moveZoneFloor, askConfirmDrop, showRejectDrop, saveFloor],
  );
  // Release of a direct zone drag → clamp to the walls, then the shared placeZoneAt.
  const commitZoneDrag = useCallback(() => {
    const zd = zoneDragRef.current;
    zoneDragRef.current = null;
    setDraggingZone(null);
    if (!zd) return;
    const clampPct = (v: number) => Math.max(2, Math.min(98, v));
    const xPct = clampPct((zd.x / room.w + 0.5) * 100);
    const yPct = clampPct((zd.z / room.d + 0.5) * 100);
    // A tap on the grip (no real drag) → not a move: don't prompt.
    const cur = zd.zone === 'stage' ? floor.stage : zd.zone === 'dance' ? floor.dance : floor.entrance;
    if (Math.abs(xPct - cur.xPct) < 0.25 && Math.abs(yPct - cur.yPct) < 0.25) return;
    placeZoneAt(zd.zone, xPct, yPct);
  }, [room, floor, placeZoneAt]);

  useEffect(() => {
    // Commit on pointerup AND on interruptions (pointercancel / window blur):
    // on touch, a system gesture (scroll, back-swipe, app switch) fires
    // pointercancel with no pointerup, which would otherwise leave the element
    // glued to the finger and OrbitControls disabled until reload. Captures the
    // pointer's client position so the confirm bubble anchors at the drop point.
    const up = (e: Event) => {
      const pe = e as PointerEvent;
      if (typeof pe.clientX === 'number' && typeof pe.clientY === 'number') {
        lastPointerRef.current = { cx: pe.clientX, cy: pe.clientY };
      }
      if (zoneDragRef.current) commitZoneDrag();
      else if (dragRef.current) commitDrag();
    };
    const track = (e: PointerEvent) => {
      lastPointerRef.current = { cx: e.clientX, cy: e.clientY };
    };
    window.addEventListener('pointermove', track);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
  }, [commitDrag, commitZoneDrag]);
  // Resize the stage / dance floor (percent of room), clamped 2–100.
  const resizeZone = useCallback(
    (zone: 'stage' | 'dance', dW: number, dD: number) => {
      const cl = (v: number) => Math.max(2, Math.min(100, Math.round(v)));
      const next: Lab3DFloor =
        zone === 'stage'
          ? { ...floor, stage: { ...floor.stage, wPct: cl(floor.stage.wPct + dW), hPct: cl(floor.stage.hPct + dD) } }
          : { ...floor, dance: { ...floor.dance, wPct: cl(floor.dance.wPct + dW), hPct: cl(floor.dance.hPct + dD) } };
      setFloor(next);
      saveFloor(next);
    },
    [floor, saveFloor],
  );
  const toggleDance = useCallback(() => {
    const next: Lab3DFloor = { ...floor, dance: { ...floor.dance, enabled: !floor.dance.enabled } };
    setFloor(next);
    saveFloor(next);
  }, [floor, saveFloor]);
  const toggleEntrance = useCallback(() => {
    const next: Lab3DFloor = { ...floor, entrance: { ...floor.entrance, enabled: !floor.entrance.enabled } };
    setFloor(next);
    saveFloor(next);
  }, [floor, saveFloor]);

  const onFloorMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Direct zone drag (owner 2026-07-17) — the stage / dance / entrance follows
      // the pointer via a preview ring (read in useFrame → zero churn); the same
      // per-frame gold/red validity as tables, resolved at COMMIT through the
      // shared zone-drop rule. Takes precedence over the table drag branch.
      const zd = zoneDragRef.current;
      if (zd) {
        const zx = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
        const zz = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
        zd.x = zx;
        zd.z = zz;
        const p = worldToPct(zx, zz);
        zoneDragValidRef.current = zoneDropHit(zd.zone, p.x, p.y) === null;
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const rawX = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
      const rawZ = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
      const dragged = tablesById.get(d.id);
      // Free board OR a rigid linked unit → follow the finger 1:1 (the 2D
      // editor's free path; the unit's shared-delta clamp + any snap resolve at
      // commit). A missing table can't be validated either — follow raw.
      if (!venueScaled || !dragged || dragged.linkGroupId) {
        d.x = rawX;
        d.z = rawZ;
        dragValidRef.current = true;
        return;
      }
      // Serpentine tip-snap pre-check — a tip-to-tip join is a SANCTIONED touch
      // (it links into one chain on drop), so it's allowed to reach the joint the
      // walkway oracle would otherwise hold it out of. Mirrors the 2D editor's
      // weld-first ordering: snap wins, else the monotone escape governs.
      if (dragged.shape === 'serpentine') {
        const neighbours = tables
          .filter((t) => t.id !== d.id && t.shape === 'serpentine')
          .map((t) => {
            const p = pctToWorld(t.xPct, t.yPct, room);
            return { x: p.x, z: p.z, rotDeg: t.rotationDeg, id: t.id };
          });
        const serpW = tableDims('serpentine', dragged.capacity).w;
        const snap = serpentineChainSnapWorld({ x: rawX, z: rawZ }, neighbours, Math.max(0.6, serpW * 0.4));
        if (snap) {
          d.x = snap.x;
          d.z = snap.z;
          dragValidRef.current = true;
          return;
        }
      }
      // FREE FOLLOW + per-frame warning (owner 2026-07-17 · snap-back drop rule).
      // The dragged table follows the pointer 1:1 — no escape constraint holds it
      // out of an overlap mid-drag. Validity is per-frame FEEDBACK only: gold ring
      // when the current pose clears the shared oracle, warm-red while it doesn't,
      // so refusal is legible BEFORE release. Enforcement moved to COMMIT — an
      // invalid release is NO drop (commitDrag snaps it back to the start pose).
      // This replaces the monotone-escape resolver (dragEscapeBaseline /
      // resolveDragStep), which is retired from the pipeline.
      const world = {
        others: tables.filter((t) => t.id !== d.id).map((t) => oraclePose(t, t.xPct, t.yPct)),
        zones: oracleZones(),
      };
      const params = { gapPx: WALKWAY_M };
      d.x = rawX;
      d.z = rawZ;
      const p = worldToPct(rawX, rawZ);
      dragValidRef.current = oracleCheckPlacement(oraclePose(dragged, p.x, p.y), world, params).valid;
    },
    [room, venueScaled, tablesById, tables, oraclePose, oracleZones, worldToPct, zoneDropHit],
  );

  // Tap-the-dance-floor (Play): send the nearest seated guest out to dance. They
  // stand up, walk to the next free dance spot (the dance-floor avoidance disc is
  // DROPPED via skipDanceFloor so the walk can reach it), and loop the dance clip.
  // Tapping again sends another → a dance party, up to the floor's spot capacity;
  // at the cap it's a no-op. Candidates exclude anyone already dancing / mid-swap
  // / walking in, and +1 ghosts (no figure) — mirrors the seated-crowd exclusion.
  const sendDancer = useCallback(() => {
    const rect = danceFloorRect(floor, room);
    if (!rect) return;
    const spots = danceSpots(rect);
    // Take the next FREE spot in centre-first order, not spots[dancers.length]:
    // `dancers` shrinks the instant a non-last dancer is sent home (returnDancer
    // removes it immediately, handing off to a Mover), so indexing by length
    // would reuse a spot a surviving dancer still stands on → two figures on one
    // point. Exclude every current dancer's held spot (matched by coordinate —
    // both come from the same deterministic danceSpots(rect)); no free spot left
    // means the floor is full (the old length-cap, now overlap-safe).
    const occupied = new Set(dancers.map((d) => `${d.spot.x},${d.spot.z}`));
    const spot = spots.find((s) => !occupied.has(`${s.x},${s.z}`));
    if (!spot) return; // floor full → no-op
    const taken = new Set<string>([...dancingGuests, ...movingGuests]);
    if (crowd) for (const a of crowd) taken.add(a.id);
    if (walker) taken.add(walker.gid);
    const candidates: { gid: string; world: Vec2 }[] = [];
    for (const [gid, s] of seats) {
      if (taken.has(gid)) continue;
      if (!tokenByGuest.get(gid)?.spec) continue; // declined / no figure → skip
      const t = tablesById.get(s.tableId);
      if (!t) continue;
      const w = seatWorld(t, s.seatNumber, room);
      candidates.push({ gid, world: { x: w.x, z: w.z } });
    }
    const gid = pickDanceGuest(candidates, spot);
    if (!gid) return; // no one left to send
    const s = seats.get(gid)!;
    const t = tablesById.get(s.tableId)!;
    const from = seatWorld(t, s.seatNumber, room);
    const g = guestById.get(gid);
    const spec = tokenByGuest.get(gid)?.spec ?? (g ? figureSpecFor(g, SIDE_COLOR[g.side]) : null);
    if (!spec) return;
    const obstacles = [
      ...floorObstacles(floor, tables, room, [s.tableId], { skipDanceFloor: true }),
      ...fixtureObstacles,
    ];
    const path = steerPath({ x: from.x, z: from.z }, spot, obstacles, 0.2);
    // Settle facing the floor centre (rig forward is local +Z → atan2(dx,dz));
    // the exact-centre dancer gets atan2(0,0)=0 and simply faces +Z.
    const faceY = Math.atan2(rect.cx - spot.x, rect.cz - spot.z);
    setDancers((prev) => [...prev, { gid, name: g?.name ?? '', spec, path, spot, faceY }]);
  }, [floor, room, dancers, dancingGuests, movingGuests, crowd, walker, seats, tokenByGuest, tablesById, guestById, tables, fixtureObstacles]);

  // End a dancer: it walks home from the floor to its (never-mutated) seat as a
  // plain Mover — the dance disc is dropped so the walk can leave the floor, and
  // onMoverDone re-commits the same seat (a no-op) + retires the mover, at which
  // point the static SeatedAvatar takes back over. Seats were never touched for a
  // dancer, so if the seat/table vanished we just drop it and the chair is freed.
  const returnDancer = useCallback(
    (gid: string) => {
      const d = dancers.find((x) => x.gid === gid);
      const s = seats.get(gid);
      const t = s ? tablesById.get(s.tableId) : undefined;
      if (!d || !s || !t) {
        setDancers((prev) => prev.filter((x) => x.gid !== gid));
        return;
      }
      const end = seatWorld(t, s.seatNumber, room);
      const obstacles = [
        ...floorObstacles(floor, tables, room, [s.tableId], { skipDanceFloor: true }),
        ...fixtureObstacles,
      ];
      const path = steerPath(d.spot, { x: end.x, z: end.z }, obstacles, 0.2);
      setDancers((prev) => prev.filter((x) => x.gid !== gid));
      setMovers((prev) => [
        ...prev,
        { gid, name: d.name, spec: d.spec, path, target: { tableId: s.tableId, seatNumber: s.seatNumber } },
      ]);
    },
    [dancers, seats, tablesById, room, floor, tables, fixtureObstacles],
  );

  // Sit everyone down — walk every dancer home at once.
  const clearFloor = useCallback(() => {
    for (const d of dancers) returnDancer(d.gid);
  }, [dancers, returnDancer]);

  const onFloorClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // R3F fires this native `click` even after a drag (orbit OR table move).
      // `e.delta` is the pointer's pixel travel — ignore anything that moved.
      if (e.delta > 4) return;
      // Floor-edit "move" mode: drop the armed zone at the tapped spot — through
      // the SHARED placeZoneAt (validate → named refusal or confirm-on-drop).
      if (placeZone) {
        const xPct = Math.max(2, Math.min(98, (e.point.x / room.w + 0.5) * 100));
        const yPct = Math.max(2, Math.min(98, (e.point.z / room.d + 0.5) * 100));
        placeZoneAt(placeZone, xPct, yPct);
        setPlaceZone(null);
        return;
      }
      // Play mode: a tap inside the dance floor sends a guest out to dance.
      if (mode === 'play') {
        const rect = danceFloorRect(floor, room);
        if (rect && pointInZone({ x: e.point.x, z: e.point.z }, rect)) {
          sendDancer();
          return;
        }
      }
      if (mode === 'build') setSelectedId(null);
    },
    [mode, placeZone, room, placeZoneAt, floor, sendDancer],
  );

  // ── Fullscreen (owner 2026-07-17 · Lab chrome rules) ─────────────────────────
  // Explicit control ONLY: the bottom-right button + a double-tap on the OUTSIDE
  // area (the dark surround beyond the venue floor). No gesture inside the room
  // fullscreens — a stray double-tap on the room is swallowed (the accidental-
  // fullscreen guard, since the lab has no other requestFullscreen path).
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => void;
    };
    const active = document.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (active) (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      else if (el) (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    } catch {
      /* blocked / unsupported — no-op */
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(!!(document.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);
  // Double-tap on the OUTSIDE area (raycast on the catcher plane, but beyond the
  // venue rectangle → the dark surround) toggles fullscreen. Inside the room a
  // double-tap does nothing.
  const onOutsideDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      const outside = Math.abs(e.point.x) > room.w / 2 || Math.abs(e.point.z) > room.d / 2;
      if (outside) {
        e.stopPropagation();
        toggleFullscreen();
      }
    },
    [room, toggleFullscreen],
  );

  // Oracle-valid spawn for a NEW table (sized room): spiral out from room centre
  // until the SHARED oracle clears every existing table + zone (stage / dance /
  // booths), mirroring the 2D editor's nearestFree. Persisted via createTable so
  // the 2D view reads the identical coordinates — CREATE parity (owner
  // 2026-07-16). Free board → null (place-anywhere; the client grid resolves it).
  const spawnRoundPct = useCallback((): { x: number; y: number } | null => {
    if (!venueScaled) return null;
    // Shared pure spiral (lib/seating.firstFreeRoundSpawnPct) — chair-inclusive
    // round_10 footprint, gated on the SAME oracle as the drag path, so a new
    // table can never spawn into a round-vs-round overlap (CREATE parity).
    const others = tables.map((o) => oraclePose(o, o.xPct, o.yPct));
    return firstFreeRoundSpawnPct(others, oracleZones(), room, WALKWAY_M);
  }, [venueScaled, tables, oraclePose, oracleZones, room]);

  // Add a table → createTable (lock-gated) at an oracle-valid spawn, then refresh
  // so the new row (with its real id) flows in. The persisted position means the
  // 2D projection reads the identical spot — same shared action, same oracle.
  const addTable = useCallback(() => {
    if (!canEdit) {
      setNotice('You don’t have edit access — a 2D editor may be open.');
      return;
    }
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_label', `Table ${tables.length + 1}`);
    fd.set('table_type', 'round_10');
    fd.set('capacity', '10');
    const spawn = spawnRoundPct();
    if (spawn) {
      fd.set('x_pos', String(spawn.x));
      fd.set('y_pos', String(spawn.y));
    }
    void persist(async () => {
      await createTable(fd);
      router.refresh();
    });
  }, [canEdit, eventId, lock.lockId, tables.length, spawnRoundPct, persist, router]);

  const rotateSelected = useCallback(
    (delta: number) => {
      if (!selectedId || !canEdit) return;
      const cur = tablesById.get(selectedId);
      if (!cur) return;
      const next = (((Math.round((cur.rotationDeg + delta) / 15) * 15) % 360) + 360) % 360;
      // Rotate validates through the SAME oracle (preview → check → commit): a
      // twist that would drive the table into a non-groupmate or a zone is refused
      // (parity with the 2D editor's commitRotation). Sized room only.
      if (venueScaled && rotationBlocked(cur, next)) {
        setNotice('No room to rotate that table there — move it to more open space first.');
        return;
      }
      setTables((prev) => prev.map((t) => (t.id === selectedId ? { ...t, rotationDeg: next } : t)));
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', selectedId);
      fd.set('rotation_deg', String(next));
      void persist(() => updateTableRotation(fd));
    },
    [selectedId, canEdit, tablesById, eventId, lock.lockId, persist, venueScaled, rotationBlocked],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId || !canEdit) return;
    const id = selectedId;
    setTables((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', id);
    void persist(() => deleteTable(fd));
  }, [selectedId, canEdit, eventId, lock.lockId, persist]);

  // 2D-parity: change the selected table's type (server recomputes capacity +
  // drops surplus assignments). Refresh so the merge effect re-renders the new
  // shape/seats, exactly like add-a-table.
  const changeTableType = useCallback(
    (newType: string) => {
      if (!selectedId || !canEdit) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', selectedId);
      fd.set('table_type', newType);
      void persist(async () => {
        await updateTableType(fd);
        router.refresh();
      });
    },
    [selectedId, canEdit, eventId, lock.lockId, persist, router],
  );

  // 2D-parity: publish the plan (stamps table QR sheets for the print pack).
  const publishPlan = useCallback(() => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    void persist(async () => {
      const res = await publishSeating(fd);
      setNotice(`Published — ${res.published} table QR sheet${res.published === 1 ? '' : 's'} ready to print.`);
    });
  }, [canEdit, eventId, lock.lockId, persist]);

  // 2D-parity: auto-seat every unseated guest. Runs the SAME canonical solver
  // server-side (autoSeatGuests → computeAutoSeat), then arms the one-shot resync
  // so the lab re-derives its seat map from the refreshed server truth (no client
  // solver, no drift). The couple can then "Walk everyone in" to animate it.
  const autoSeatAll = useCallback(() => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    void persist(async () => {
      await autoSeatGuests(fd);
      seatResyncRef.current = true;
      router.refresh();
      setNotice('Auto-seated your guests — tap “Walk everyone in” to watch them arrive.');
    });
  }, [canEdit, eventId, lock.lockId, persist, router]);

  // 2D-parity: rename the selected table (optimistic; server syncs the label
  // across a linked unit). Mirrors the 2D editor — trim, cap 64, skip no-ops.
  const renameTable = useCallback(
    (raw: string) => {
      if (!selectedId || !canEdit) return;
      const label = raw.trim().slice(0, 64);
      const current = tablesById.get(selectedId)?.label ?? '';
      if (!label || label === current) return;
      // The server syncs the label across a linked unit, so optimistically apply
      // it to every sibling sharing this table's link group (the merge effect is
      // add-only and won't reconcile existing rows' labels).
      const linkGroupId = tablesById.get(selectedId)?.linkGroupId ?? null;
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedId || (linkGroupId && t.linkGroupId === linkGroupId) ? { ...t, label } : t,
        ),
      );
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', selectedId);
      fd.set('table_label', label);
      void persist(() => updateTableLabel(fd));
    },
    [selectedId, canEdit, tablesById, eventId, lock.lockId, persist],
  );

  // 2D-parity: fill the selected table with the next unseated guests of one role
  // tier (server picks them via the same tier logic), then resync from truth.
  const seatTier = useCallback(
    (tier: 1 | 2 | 3 | 4) => {
      if (!selectedId || !canEdit) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', selectedId);
      fd.set('tier', String(tier));
      void persist(async () => {
        const res = await seatRoleAtTable(fd);
        seatResyncRef.current = true;
        router.refresh();
        if (res && res.overflow > 0) {
          setNotice(`Seated ${res.seated} — ${res.overflow} more ${ROLE_TIER_LABELS[tier]} need another table.`);
        }
      });
    },
    [selectedId, canEdit, eventId, lock.lockId, persist, router],
  );

  // 2D-parity: unseat a guest (free their chair). Optimistic delete; the key is
  // simply gone, so no resync is needed.
  const unseatGuest = useCallback(
    (guestId: string) => {
      if (!canEdit) return;
      setSeats((prev) => {
        if (!prev.has(guestId)) return prev;
        const next = new Map(prev);
        next.delete(guestId);
        return next;
      });
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('guest_id', guestId);
      fd.set('lock_id', lock.lockId ?? '');
      void persist(() => unassignGuest(fd));
    },
    [canEdit, eventId, lock.lockId, persist],
  );

  // 2D-parity: on an empty floor, lay out a starter table set AND seat the
  // confirmed guests in one tap (server recommends + seats; refresh paints both).
  const buildDraft = useCallback(() => {
    if (!canEdit || tables.length > 0) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    void persist(async () => {
      const res = await buildSeatingDraft(fd);
      seatResyncRef.current = true;
      router.refresh();
      setNotice(
        res.tables === 0
          ? 'Add your guests first — then “Start my seating” lays out the whole floor for you.'
          : `Laid out ${res.tables} tables and seated ${res.seated} guests.`,
      );
    });
  }, [canEdit, tables.length, eventId, lock.lockId, persist, router]);

  // 2D-parity: keep hand-placed (locked) seats, clear the rest, and re-solve
  // around them honoring keep-apart rules. Resync from the refreshed truth.
  const fillAroundLocked = useCallback(() => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    void persist(async () => {
      await lockAndFill(fd);
      seatResyncRef.current = true;
      router.refresh();
      setNotice('Filled the open seats around your locked ones.');
    });
  }, [canEdit, eventId, lock.lockId, persist, router]);

  // 2D-parity: auto-arrange — tidy EVERY table into a stage-out grid AND seat the
  // guests, in one tap. Layout via the SAME pure solver the 2D editor uses
  // (computeAutoLayout, fed the lab's live table footprints), painted optimistically;
  // the server persists positions + assignments, then we resync seats from truth.
  const autoArrangeAll = useCallback(() => {
    if (!canEdit || tables.length === 0) return;
    const layout = computeAutoLayout({
      tables: tables.map((t) => ({ table_id: t.id, table_type: t.type })) as unknown as EventTableRow[],
      floorPlan: {
        stage_x: floor.stage.xPct,
        stage_y: floor.stage.yPct,
        stage_w: floor.stage.wPct,
        stage_h: floor.stage.hPct,
        entrance_enabled: floor.entrance.enabled,
        entrance_x: floor.entrance.xPct,
        entrance_y: floor.entrance.yPct,
        service_entrance_enabled: false,
        service_entrance_x: 0,
        service_entrance_y: 0,
        dance_enabled: floor.dance.enabled,
        dance_x: floor.dance.xPct,
        dance_y: floor.dance.yPct,
        dance_w: floor.dance.wPct,
        dance_h: floor.dance.hPct,
        cocktail_enabled: false,
        cocktail_x: 0,
        cocktail_y: 0,
        cocktail_w: 0,
        cocktail_h: 0,
      },
      rect: { width: room.w, height: room.d },
      footprintOf: (et) => {
        const lt = tablesById.get(et.table_id);
        if (!lt) return { w: 1, h: 1 };
        const dim = tableDims(lt.shape, lt.capacity);
        return { w: dim.w, h: dim.round ? dim.w : dim.d };
      },
    });
    setTables((prev) => prev.map((t) => (layout[t.id] ? { ...t, xPct: layout[t.id]!.x, yPct: layout[t.id]!.y } : t)));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('positions', JSON.stringify(layout));
    fd.set('booths', '[]');
    void persist(async () => {
      await autoArrange(fd);
      seatResyncRef.current = true;
      router.refresh();
      setNotice('Tidied every table and seated your guests.');
    });
  }, [canEdit, tables, floor, room, tablesById, eventId, lock.lockId, persist, router]);

  // 2D-parity rules: keep two guests apart (auto-seat never seats them together).
  const addKeepApart = useCallback(
    (aId: string, bId: string) => {
      if (!canEdit || !aId || !bId || aId === bId) return;
      if (keepApart.some((r) => sameKeepApart(r, aId, bId))) return;
      setKeepApart((prev) => [...prev, { guest_a_id: aId, guest_b_id: bId }]);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('guest_a_id', aId);
      fd.set('guest_b_id', bId);
      void persist(() => addSeatingConstraint(fd));
    },
    [canEdit, keepApart, eventId, lock.lockId, persist],
  );
  const removeKeepApart = useCallback(
    (rule: KeepApartRule) => {
      if (!canEdit) return;
      setKeepApart((prev) => prev.filter((r) => !sameKeepApart(r, rule.guest_a_id, rule.guest_b_id)));
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('guest_a_id', rule.guest_a_id);
      fd.set('guest_b_id', rule.guest_b_id);
      void persist(() => removeSeatingConstraint(fd));
    },
    [canEdit, eventId, lock.lockId, persist],
  );
  // 2D-parity rules: reorder the tier priority the solver fills seats in.
  const reorderPriority = useCallback(
    (from: number, to: number) => {
      const n = priorityOrder.length;
      if (!canEdit || from < 0 || from >= n || to < 0 || to >= n || from === to) return;
      const next = priorityOrder.slice();
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      setPriorityOrder(next);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('priority_order', JSON.stringify(next));
      void persist(() => savePriorityOrder(fd));
    },
    [canEdit, priorityOrder, eventId, lock.lockId, persist],
  );
  // 2D-parity rules: cycle a guest's explicit priority (null→1→2→3→4→null).
  // Optimistic via the local overlay — NO router.refresh (priority is display +
  // solver-input only; a refresh would needlessly churn seats/tables).
  const cycleGuestPriority = useCallback(
    (guestId: string, current: number | null) => {
      if (!canEdit) return;
      const next = current === null ? 1 : current >= 4 ? null : current + 1;
      setPriorityOverride((prev) => {
        const m = new Map(prev);
        m.set(guestId, next);
        return m;
      });
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('guest_id', guestId);
      fd.set('priority', next === null ? '' : String(next));
      void persist(() => setGuestSeatingPriority(fd));
    },
    [canEdit, eventId, lock.lockId, persist],
  );

  // 2D-parity: seat a whole custom group at one table (server fills in order,
  // overflow surfaces a notice), then resync the seats from server truth.
  const seatGroupAt = useCallback(
    (tableId: string, groupId: string) => {
      if (!canEdit) return;
      const memberIds = guests
        .filter((g) => g.groupId === groupId && seatStatusOf(g.rsvp) !== 'hidden')
        .map((g) => g.id);
      if (memberIds.length === 0) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', tableId);
      fd.set('guest_ids', JSON.stringify(memberIds));
      void persist(async () => {
        const res = await assignGroup(fd);
        seatResyncRef.current = true;
        router.refresh();
        if (res && res.overflow > 0) {
          setNotice(`Seated ${res.seated} — ${res.overflow} group member${res.overflow === 1 ? '' : 's'} need another table.`);
        }
      });
    },
    [canEdit, guests, eventId, lock.lockId, persist, router],
  );

  // 2D-parity: link two tables into one unit (one QR + one name, moves together).
  // Optimistic: stamp a shared temp group id + combined label on both, then the
  // server assigns the real group and reconcileGrouping picks it up on refresh.
  const doLink = useCallback(
    (aId: string, bId: string) => {
      if (!canEdit || aId === bId) return;
      const a = tablesById.get(aId);
      const b = tablesById.get(bId);
      if (!a || !b) return;
      const tempGroup = a.linkGroupId ?? `tmp-${aId}`;
      const groupLabel = `${a.label} & ${b.label}`;
      const groupMembers = new Set<string>([aId, bId]);
      if (a.linkGroupId) tables.forEach((t) => t.linkGroupId === a.linkGroupId && groupMembers.add(t.id));
      if (b.linkGroupId) tables.forEach((t) => t.linkGroupId === b.linkGroupId && groupMembers.add(t.id));
      setTables((prev) =>
        prev.map((t) => (groupMembers.has(t.id) ? { ...t, linkGroupId: tempGroup, label: groupLabel } : t)),
      );
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id_a', aId);
      fd.set('table_id_b', bId);
      void persist(async () => {
        await linkTables(fd);
        router.refresh();
      });
      setNotice(`Linked — “${a.label}” and “${b.label}” move together with one printed QR.`);
    },
    [canEdit, tablesById, tables, eventId, lock.lockId, persist, router],
  );

  // Manual arm-link (tap A then tap B) — 2D-parity "pull-to-join": the mover (B)
  // ANIMATES to the nearest oracle-valid legal joint on the anchor (A) via the
  // SHARED legalJoinPose, is oracle-checked vs every third party, its snapped
  // pose is PERSISTED, and only THEN is the link committed (through the same
  // server linkTables, which re-validates). Same-family + geometric-joint gate,
  // identical to the 2D editor (owner 2026-07-16 · full authoring parity). The
  // drag-snap path keeps using doLink directly (B is already at the joint).
  const weldLink = useCallback(
    (anchorId: string, moverId: string) => {
      if (!canEdit || anchorId === moverId) return;
      const a = tablesById.get(anchorId);
      const b = tablesById.get(moverId);
      if (!a || !b) return;
      const alreadyGrouped = a.linkGroupId != null && a.linkGroupId === b.linkGroupId;
      const canWeld =
        venueScaled && a.shape === b.shape && a.shape !== 'sweetheart' && !alreadyGrouped;
      if (!canWeld) {
        // Free board / sweetheart / re-link within a unit → identity link (server
        // is the gate; on a sized room a cross-family link is refused there).
        doLink(anchorId, moverId);
        return;
      }
      const anchorPose = oraclePose(a, a.xPct, a.yPct);
      const moverPose = oraclePose(b, b.xPct, b.yPct);
      const cand = legalJoinPose(anchorPose, moverPose, Math.max(room.w, room.d));
      if (!cand) {
        setNotice(`No open end on “${a.label}” to join “${b.label}” — try the other table.`);
        return;
      }
      const ghost: OracleWorldPose = { ...moverPose, x: cand.x, y: cand.y, rot: cand.rot };
      const thirdParties = tables
        .filter((t) => t.id !== anchorId && t.id !== moverId)
        .map((t) => oraclePose(t, t.xPct, t.yPct));
      if (!oracleCheckPlacement(ghost, { others: thirdParties, zones: oracleZones() }, { gapPx: WALKWAY_M }).valid) {
        setNotice(`No room at that end — move “${b.label}” closer to “${a.label}” first.`);
        return;
      }
      const xPct = (cand.x / room.w) * 100;
      const yPct = (cand.y / room.d) * 100;
      // Optimistic: snap B onto the joint + stamp the shared temp group on the
      // whole would-be unit (mirrors doLink's optimistic grouping).
      const tempGroup = a.linkGroupId ?? `tmp-${anchorId}`;
      const groupLabel = `${a.label} & ${b.label}`;
      const groupMembers = new Set<string>([anchorId, moverId]);
      if (a.linkGroupId) tables.forEach((t) => t.linkGroupId === a.linkGroupId && groupMembers.add(t.id));
      if (b.linkGroupId) tables.forEach((t) => t.linkGroupId === b.linkGroupId && groupMembers.add(t.id));
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === moverId) return { ...t, xPct, yPct, rotationDeg: cand.rot, linkGroupId: tempGroup, label: groupLabel };
          if (groupMembers.has(t.id)) return { ...t, linkGroupId: tempGroup, label: groupLabel };
          return t;
        }),
      );
      void persist(async () => {
        const fp = new FormData();
        fp.set('event_id', eventId);
        fp.set('lock_id', lock.lockId ?? '');
        fp.set('table_id', moverId);
        fp.set('x_pos', String(xPct));
        fp.set('y_pos', String(yPct));
        await updateTablePosition(fp);
        const fr = new FormData();
        fr.set('event_id', eventId);
        fr.set('lock_id', lock.lockId ?? '');
        fr.set('table_id', moverId);
        fr.set('rotation_deg', String(cand.rot));
        await updateTableRotation(fr);
        const fl = new FormData();
        fl.set('event_id', eventId);
        fl.set('lock_id', lock.lockId ?? '');
        fl.set('table_id_a', anchorId);
        fl.set('table_id_b', moverId);
        await linkTables(fl);
        router.refresh();
      });
      setNotice(`Linked — “${a.label}” and “${b.label}” move together with one printed QR.`);
    },
    [canEdit, tablesById, venueScaled, oraclePose, oracleZones, room, tables, eventId, lock.lockId, persist, router, doLink],
  );
  // 2D-parity: remove/restore an individual chair (tap a chair on the selected
  // table). Server rejects removing an OCCUPIED seat, so guard it client-side.
  const toggleSeat = useCallback(
    (tableId: string, seatNumber: number) => {
      if (!canEdit) return;
      const t = tablesById.get(tableId);
      if (!t) return;
      const currentlyRemoved = t.removedSeats.includes(seatNumber);
      if (!currentlyRemoved) {
        const occupied = Array.from(seats.values()).some((s) => s.tableId === tableId && s.seatNumber === seatNumber);
        if (occupied) {
          setNotice('Unseat the guest before removing this chair.');
          return;
        }
      }
      const nextRemoved = currentlyRemoved
        ? t.removedSeats.filter((s) => s !== seatNumber)
        : [...t.removedSeats, seatNumber];
      setTables((prev) => prev.map((x) => (x.id === tableId ? { ...x, removedSeats: nextRemoved } : x)));
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', tableId);
      fd.set('seat_number', String(seatNumber));
      fd.set('removed', currentlyRemoved ? 'false' : 'true');
      void persist(() => setTableSeat(fd));
    },
    [canEdit, tablesById, seats, eventId, lock.lockId, persist],
  );

  // 2D-parity: break a linked unit back into independent tables.
  const breakApart = useCallback(() => {
    if (!canEdit || !selectedId) return;
    const t = tablesById.get(selectedId);
    if (!t?.linkGroupId) return;
    const groupId = t.linkGroupId;
    setTables((prev) => prev.map((x) => (x.linkGroupId === groupId ? { ...x, linkGroupId: null } : x)));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('lock_id', lock.lockId ?? '');
    fd.set('table_id', selectedId);
    void persist(async () => {
      await unlinkTable(fd);
      router.refresh();
    });
    setNotice('Broken apart — each table is independent again, with its own name + QR.');
  }, [canEdit, selectedId, tablesById, eventId, lock.lockId, persist, router]);

  // Pick a guest → walk to their seat (seating them in the first free chair if
  // they have none), steering around the other tables.
  // Seat a guest + walk them in. `preferredTableId` (from tap-to-place) restricts
  // the search to that one table; otherwise it auto-fills the first free seat
  // anywhere. Returns false when no seat is available (e.g. the tapped table is
  // full) so the caller can keep the guest "picked up" and flag it.
  const sendGuest = useCallback(
    (g: Lab3DGuest, preferredTableId?: string): boolean => {
      let seat = seats.get(g.id) ?? null;
      const nextSeats = new Map(seats);
      if (!seat) {
        const candidates = preferredTableId ? tables.filter((t) => t.id === preferredTableId) : tables;
        for (const t of candidates) {
          const occupied: number[] = [];
          for (const [, s] of nextSeats) if (s.tableId === t.id) occupied.push(s.seatNumber);
          const free = firstFreeSeatAtTable(t.capacity, t.removedSeats, occupied);
          if (free >= 0) {
            seat = { tableId: t.id, seatNumber: free };
            nextSeats.set(g.id, seat);
            setSeats(nextSeats);
            break;
          }
        }
      }
      if (!seat) return false;
      const table = tablesById.get(seat.tableId);
      if (!table) return false;
      // Route AROUND every fixed object — other tables (true multi-disc
      // footprints, so banquet corners count), the walker's OWN table, the
      // stage, the dance floor — AND every chair/seated guest, with the
      // walker's own destination chair + its approach corridor excluded so the
      // final step-in stays reachable (chairObstaclesForWalk). Spatial-hashed:
      // seatApproachPath's steering samples the set hundreds of times and the
      // grid keeps each query local without changing a single output point.
      const pose = seatWorld(table, seat.seatNumber, room);
      const obstacles = buildObstacleGrid([
        ...floorObstacles(floor, tables, room, []),
        ...fixtureObstacles,
        ...chairObstaclesForWalk(tables, room, { tableId: seat.tableId, seatNumber: seat.seatNumber }),
      ]);
      const path = seatApproachPath(entranceWorld, table, seat.seatNumber, room, obstacles, 0.2);
      // Retarget the path's final chair waypoint to the SIT APPROACH POINT
      // (0.55 m behind the chair along −gaze) — the walk delivers the guest
      // there and the SitController owns the rest (pull back, step in, sit,
      // tuck). Both points sit on the same outward radial (the gaze aims at
      // the table), so the retarget never re-enters the table footprint.
      path[path.length - 1] = approachPoint(pose, SIT_TIMING.APPROACH_M);
      setMode('play');
      setArrived(null);
      setCrowd(null); // a single walk-in supersedes any populated crowd
      setWalker({ gid: g.id, name: g.name, path, tableId: seat.tableId, seatNumber: seat.seatNumber, seat: pose });
      return true;
    },
    [seats, tables, tablesById, room, entranceWorld, floor, fixtureObstacles],
  );

  // Populate-Play: send EVERY seated guest walking in from the entrance at once.
  // Each gets a cleared path to their chair + their own spatial-hashed obstacle
  // set; the Crowd component resolves overlap (predictive "make way") and
  // object clearance per frame. A small per-guest stagger keeps them from
  // spawning on top of each other, and Crowd's MAX_CONCURRENT_WALKERS cap
  // queues the rest at the entrance so a big room never reads as a stampede.
  const walkEveryone = useCallback(() => {
    const agents: CrowdAgent[] = [];
    // Shared obstacle bases, hoisted OUT of the per-guest loop (they were
    // rebuilt 150× each, ~300 near-identical footprint recomputations per
    // populate tap): the full-footprint array is identical for every agent,
    // and the skip-own-table variant only varies per destination TABLE, so
    // guests sharing a table share it too.
    const floorAll = floorObstacles(floor, tables, room, []);
    const floorSkipByTable = new Map<string, ObstacleDisc[]>();
    let i = 0;
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      if (!g || seatStatusOf(g.rsvp) === 'hidden') continue; // declined seats are freed
      const table = tablesById.get(s.tableId);
      if (!table) continue;
      // Chairs are solid for this agent too — every table's chairs (occupied
      // or not) EXCEPT their own destination chair + its approach corridor
      // (chairObstaclesForWalk), so they can weave between tables without
      // clipping a seat back yet still reach their own hand-off spot.
      const chairDiscs = chairObstaclesForWalk(tables, room, { tableId: s.tableId, seatNumber: s.seatNumber });
      // Same retarget as the single walk-in: the crowd walk ends at the sit
      // approach point, and each agent's own sit clip plays the final step-in.
      const pose = seatWorld(table, s.seatNumber, room);
      const handOff = approachPoint(pose, SIT_TIMING.APPROACH_M);
      // The PATH routes around every table (own included — true multi-disc
      // footprints, so banquet corners count) so the walk-in never crosses a
      // tabletop; the per-frame obstacle set still SKIPS the guest's own
      // table so that, once arrived, the seated avatar isn't shoved off its
      // chair — and, on cramped back-to-back layouts, additionally drops any
      // NEIGHBOURING footprint/fixture disc that reaches the hand-off point
      // (dropDiscsContaining), or the clamp would shove the agent off the
      // spot every frame and its sit clip would start with a visible snap.
      // Both sets are spatial-hashed per agent: the path steer samples them
      // hundreds of times NOW, and the Crowd re-clamp queries `obstacles`
      // every frame — the grid keeps each lookup local while staying
      // bit-identical to the brute-force walk.
      let floorSkip = floorSkipByTable.get(s.tableId);
      if (!floorSkip) {
        floorSkip = floorObstacles(floor, tables, room, [s.tableId]);
        floorSkipByTable.set(s.tableId, floorSkip);
      }
      const walkAround = buildObstacleGrid([...floorAll, ...fixtureObstacles, ...chairDiscs]);
      const obstacles = buildObstacleGrid([
        ...dropDiscsContaining([...floorSkip, ...fixtureObstacles], handOff),
        ...chairDiscs,
      ]);
      const path = seatApproachPath(entranceWorld, table, s.seatNumber, room, walkAround, 0.2);
      path[path.length - 1] = handOff;
      // The crowd agent walks in AS the guest — same outfit / selfie / status
      // spec (same OBJECT — tokenByGuest) as their seated figure.
      const style = tokenByGuest.get(gid);
      if (!style?.spec) continue; // hidden is already skipped above; defensive
      agents.push({
        id: gid,
        name: g.name,
        path,
        spec: style.spec,
        startDelay: i * 0.16,
        obstacles,
        tableId: s.tableId,
        seatIndex: s.seatNumber,
        seat: pose,
      });
      i += 1;
    }
    setWalker(null);
    setArrived(null);
    setMode('play');
    setCrowd(agents.length ? agents : null);
  }, [seats, guestById, tablesById, room, floor, tables, entranceWorld, fixtureObstacles, tokenByGuest]);

  // A single walk-in that has finished its SIT CLIP (arrived now means
  // flush-seated — Walker's onArrive fires from the SitController's onSeated)
  // holds the toast beat, then clears the walker: the controller unmounts (its
  // cleanup restores the instanced chair) and the static SeatedAvatar takes
  // over at the identical transform + sit pose (the guest is already in
  // `seats`). Only the single walker sets `arrived`; the crowd settles via
  // onAllArrived.
  useEffect(() => {
    if (!arrived || !walker) return;
    const id = window.setTimeout(() => {
      setWalker(null);
      setArrived(null);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [arrived, walker]);

  // Populate-Play: Crowd fires this once every agent has finished its SIT CLIP
  // (each walk-in now ends in the chair pull-back sit, staggered + capped —
  // see Crowd). Clearing the crowd swaps its already-seated figures for the
  // per-seat SeatedAvatars at identical transforms — invisible. Synchronous +
  // idempotent, so re-running "Walk everyone in" can't be clobbered by a stale
  // timer. "Clear the room" still skips ahead.
  const settleCrowd = useCallback(() => setCrowd(null), []);

  // --- swap-with-animation: reassign seats (persist) + animate the change ----
  const seatWorldOf = useCallback(
    (gid: string): { world: Vec2; seat: SeatRef } | null => {
      const s = seats.get(gid);
      if (!s) return null;
      const t = tablesById.get(s.tableId);
      if (!t) return null;
      return { world: seatWorld(t, s.seatNumber, room), seat: s };
    },
    [seats, tablesById, room],
  );

  // A mover finished its walk → commit the new seat locally (the DB write
  // already fired at swap-start) and retire the mover.
  const onMoverDone = useCallback((gid: string, target: SeatRef) => {
    setSeats((prev) => {
      const n = new Map(prev);
      n.set(gid, target);
      return n;
    });
    setMovers((prev) => prev.filter((m) => m.gid !== gid));
  }, []);

  // Reassign guest `gid` to (toTableId, toSeat): fly a token from its current
  // seat to the new one, and (by default) persist that single move. The swap
  // flows below pass persist=false so they can animate BOTH movers while the
  // exchange is persisted ATOMICALLY via one swap RPC (not two independent
  // writes — see swapGuests/swapTables).
  const moveGuestTo = useCallback(
    (gid: string, fromWorld: Vec2, toTableId: string, toSeat: number, doPersist = true) => {
      const g = guestById.get(gid);
      const t = tablesById.get(toTableId);
      if (!g || !t) return;
      const end = seatWorld(t, toSeat, room);
      const fromTableId = seats.get(gid)?.tableId;
      const obstacles = [...floorObstacles(floor, tables, room, [toTableId, fromTableId]), ...fixtureObstacles];
      const path = steerPath(fromWorld, end, obstacles, 0.2);
      // Movers carry the guest's full figure spec (attire + selfie + status),
      // so the swap animation moves the same dressed person, not a bare token.
      const spec = tokenByGuest.get(gid)?.spec ?? figureSpecFor(g, SIDE_COLOR[g.side]);
      setMovers((prev) => [
        ...prev,
        { gid, name: g.name, spec, path, target: { tableId: toTableId, seatNumber: toSeat } },
      ]);
      if (!doPersist) return;
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', toTableId);
      fd.set('guest_id', gid);
      fd.set('seat_number', String(toSeat));
      void persist(() => assignGuest(fd));
    },
    [guestById, tablesById, tables, seats, room, eventId, lock.lockId, persist, floor, fixtureObstacles, tokenByGuest],
  );

  const swapGuests = useCallback(
    (a: string, b: string) => {
      if (!canEdit) {
        setNotice('You don’t have edit access — a 2D editor may be open.');
        return;
      }
      if (a === b || movingGuests.has(a) || movingGuests.has(b)) return;
      const A = seatWorldOf(a);
      const B = seatWorldOf(b);
      if (!A || !B) return;
      setMode('play');
      // Animate both tokens locally (persist=false), then persist the exchange
      // ATOMICALLY in one RPC. If it fails, persist() arms a full server resync
      // (router.refresh) that reverts the optimistic move.
      moveGuestTo(a, A.world, B.seat.tableId, B.seat.seatNumber, false);
      moveGuestTo(b, B.world, A.seat.tableId, A.seat.seatNumber, false);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('guest_a_id', a);
      fd.set('guest_b_id', b);
      void persist(() => swapSeats(fd));
    },
    [canEdit, movingGuests, seatWorldOf, moveGuestTo, eventId, lock.lockId, persist],
  );

  const swapTables = useCallback(
    (t1: string, t2: string) => {
      if (!canEdit) {
        setNotice('You don’t have edit access — a 2D editor may be open.');
        return;
      }
      if (t1 === t2 || !tablesById.get(t1) || !tablesById.get(t2)) return;
      const occ = (tid: string) => {
        const m = new Map<number, string>();
        for (const [gid, s] of seats) if (s.tableId === tid && !movingGuests.has(gid)) m.set(s.seatNumber, gid);
        return m;
      };
      const o1 = occ(t1);
      const o2 = occ(t2);
      const maxc = Math.max(tablesById.get(t1)!.capacity, tablesById.get(t2)!.capacity);
      setMode('play');
      // Animate every occupant to the mirror table locally (persist=false), then
      // persist the whole table exchange ATOMICALLY in one RPC (seat numbers
      // travel with each guest). Failure arms a server resync that reverts.
      for (let i = 0; i < maxc; i++) {
        const g1 = o1.get(i);
        const g2 = o2.get(i);
        if (g1) {
          const w = seatWorldOf(g1);
          if (w) moveGuestTo(g1, w.world, t2, i, false);
        }
        if (g2) {
          const w = seatWorldOf(g2);
          if (w) moveGuestTo(g2, w.world, t1, i, false);
        }
      }
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id_a', t1);
      fd.set('table_id_b', t2);
      void persist(() => swapTableOccupants(fd));
    },
    [canEdit, tablesById, seats, movingGuests, seatWorldOf, moveGuestTo, eventId, lock.lockId, persist],
  );

  const onTableDown = useCallback(
    (id: string) => {
      // A table tap cancels any armed "move a floor element" mode (the tap was
      // meant for a table, not the floor) so the zone-move never dangles.
      setPlaceZone(null);
      // Link mode: first table is armed; tapping a different one welds + links
      // them (2D-parity pull-to-join — B snaps to A's legal joint, oracle-checked).
      if (linkArmId) {
        if (linkArmId !== id) weldLink(linkArmId, id);
        setLinkArmId(null);
        return;
      }
      // Seat a whole picked group at the tapped table.
      if (placingGroupId) {
        seatGroupAt(id, placingGroupId);
        setPlacingGroupId(null);
        return;
      }
      // Precise placement: a picked-up guest takes a seat at the tapped table.
      if (placingGuestId) {
        const g = guestById.get(placingGuestId);
        if (g && sendGuest(g, id)) setPlacingGuestId(null);
        else setNotice('That table is full — pick another.');
        return;
      }
      // Table-swap pick mode (Play): first tap arms a table, second swaps them.
      if (tableSwapArmed) {
        if (!tableSwapFirst) {
          setTableSwapFirst(id);
          return;
        }
        if (tableSwapFirst !== id) swapTables(tableSwapFirst, id);
        setTableSwapFirst(null);
        setTableSwapArmed(false);
        return;
      }
      if (mode !== 'build') return; // no selection in Play (avoids a ghost carry-over)
      setSelectedId(id);
      if (!canEdit) return; // view-only: select to inspect, but don't drag
      const t = tablesById.get(id);
      if (!t) return;
      const w = pctToWorld(t.xPct, t.yPct, room);
      dragRef.current = { id, x: w.x, z: w.z };
      // The drag-START pose is simply the table's persisted pose in React state
      // (`t.xPct/yPct`) — untouched during the drag — so an invalid release just
      // eases the mesh back to `home`. Nothing to capture at pointer-down.
      setDraggingId(id);
    },
    [linkArmId, weldLink, placingGroupId, seatGroupAt, placingGuestId, guestById, sendGuest, tableSwapArmed, tableSwapFirst, swapTables, mode, canEdit, room, tablesById],
  );

  // Pointer-down on a zone grip → start a direct zone drag (owner 2026-07-17).
  // The drag-START pose is the zone's persisted spot (unchanged during drag) so
  // an invalid or cancelled release just returns it. onFloorMove drives it;
  // commitZoneDrag validates + confirms on release.
  const onZoneGripDown = useCallback(
    (zone: 'stage' | 'dance' | 'entrance') => {
      if (!canEdit || mode !== 'build') return;
      setSelectedId(null);
      setPlaceZone(null);
      const src = zone === 'stage' ? floor.stage : zone === 'dance' ? floor.dance : floor.entrance;
      const w = pctToWorld(src.xPct, src.yPct, room);
      zoneDragRef.current = { zone, x: w.x, z: w.z };
      zoneDragValidRef.current = true;
      setDraggingZone(zone);
    },
    [canEdit, mode, floor, room],
  );

  // A guest-list tap: an UNSEATED guest walks in; a SEATED guest enters or
  // completes a swap selection.
  const onGuestTap = useCallback(
    (g: Lab3DGuest) => {
      if (!seats.has(g.id)) {
        // Pick the guest UP for precise placement — the next table tap seats
        // them there. Tapping the same guest again puts them back down.
        setMode('play');
        setSwapSelId(null);
        setPlaceZone(null);
        setPlacingGroupId(null);
        setLinkArmId(null);
        setPlacingGuestId((cur) => (cur === g.id ? null : g.id));
        return;
      }
      if (swapSelId === g.id) {
        setSwapSelId(null);
        return;
      }
      if (swapSelId) {
        swapGuests(swapSelId, g.id);
        setSwapSelId(null);
        return;
      }
      setSwapSelId(g.id);
    },
    [seats, swapSelId, swapGuests],
  );

  const seatedCount = useMemo(() => {
    const ids = new Set<string>();
    for (const [gid, s] of seats) if (tablesById.has(s.tableId)) ids.add(gid);
    return ids.size;
  }, [seats, tablesById]);

  // PERF — the seated-crowd budget's GLOBAL half: past 60 guests, EVERY seated
  // figure drops to kit quality 'low' (one baked pose, zero per-frame joint
  // writes) regardless of camera distance — 60 idle-swaying articulated rigs is
  // where per-frame pose blending starts eating a mid-range phone's frame
  // budget. Under 60, the per-table camera-distance check inside TableMesh
  // still demotes far-away tables. Documented at the TableMesh useFrame.
  const crowdLow = guests.length > 60;

  // The single walk-in carries the SAME dressed figure as its seated self —
  // the same spec OBJECT (tokenByGuest is the one spec source per guest), so
  // seated/walking/mover looks can never diverge.
  const walkerSpec = useMemo<FigureSpec | null>(() => {
    if (!walker) return null;
    return tokenByGuest.get(walker.gid)?.spec ?? null;
  }, [walker, tokenByGuest]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-[82vh] w-full overflow-hidden rounded-2xl border border-ink/10 bg-[#11131a]"
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}
        gl={{ antialias: true, powerPreference: 'high-performance', ...RECOMMENDED_TONEMAP }}
      >
        <color attach="background" args={[mode === 'play' ? '#0c0e14' : '#13151c']} />
        {/* Play's fog is the golden-hour tune (warmed toward the key, far
            plane pulled in a touch); Build keeps the studio's neutral haze. */}
        <fog
          attach="fog"
          args={
            mode === 'play'
              ? playGradeFog('#0c0e14', palette, room.d)
              : ['#13151c', room.d * 1.4, room.d * 3.2]
          }
        />

        {/* Shared rig (Wave 2a): procedural Lightformer IBL + one warm shadow
            key, 2048 map fitted to the room. Replaces the flat ambient +
            hemisphere + bare directional and the fake ContactShadows. Play
            flips the cinematic golden-hour grade (Fable §3.5 Tier A). */}
        <SceneLighting
          palette={palette}
          quality="high"
          room={room}
          grade={mode === 'play' ? 'play' : 'standard'}
        />

        <RoomShell
          room={room}
          floor={floor}
          palette={palette}
          rolePalette={rolePalette}
          floorColor={archFloorColor}
          buildMode={mode === 'build'}
          monogram={monogram}
          animatedMonogram={animatedMonogram}
          playSettled={mode === 'play' && !camBusy}
        />

        {/* Wave 2b: archetype room shell (garden greenery / chapel windows /
            barn trusses / beach horizon / rooftop parapet) + the mood-board
            reception treatments. Both recolour with the active palette. */}
        <VenueShell archetype={archetype} room={room} palette={palette} quality="high" />
        <VenueDecor
          design={receptionDesign}
          floor={floor}
          tables={tables}
          room={room}
          palette={palette}
          quality="high"
          archetype={archetype}
        />

        {/* Cinematic Tier A (Fable §3.5) — Play mode only, Build stays the
            neutral editing studio. String lights are static instances (fine
            under reduced motion) and skip when the couple's OWN ceiling decor
            occupies the hang band (fairy lights / chandeliers / lanterns /
            hanging florals — see ceilingDecorOccupied); the drifting motes
            honour the house law and simply don't mount when motion is
            reduced. */}
        {mode === 'play' && !ceilingDecorOccupied(receptionDesign, archetype) ? (
          <StringLights room={room} palette={palette} quality="high" />
        ) : null}
        {mode === 'play' && !reduced ? (
          <DustMotes center={moteZone.center} size={moteZone.size} palette={palette} />
        ) : null}

        {/* Cinematic Tier B (Fable §3.5) — the dynamically-imported composer
            (Bloom on the emissive stars, subtle DoF onto the walk-in, grain,
            vignette). Suspense fallback null = Tier A carries the look while
            the async chunk streams in; unmount (Build, reduced motion, or the
            perf-degrade latch) restores the renderer's own tone mapping →
            bit-identical Tier A pipeline.
            ⚠ UPSTREAM COST OF EACH MOUNT/UNMOUNT (r-p-p@3.0.4, verified in
            dist): the wrapper never calls composer.dispose(), so each unmount
            abandons the canvas-res MSAA-4 HalfFloat in/out buffers to GC
            (tens of MB GPU on big canvases, freed on GC timing, not
            deterministically), and each mount/unmount flips gl.toneMapping
            (ACES ↔ NoToneMapping) → a one-time scene-wide toneMapped-material
            program-variant switch on top of the Environment key's PMREM
            re-bake. Toggling `enabled` instead of unmounting is NOT a safe
            mitigation (enabled=false stops rendering but leaves gl.toneMapping
            forced to NoToneMapping). Deps are exact-pinned in package.json —
            re-verify this note on any postprocessing/r-p-p bump. */}
        {cinematicFx ? (
          <Suspense fallback={null}>
            <CinematicPass room={room} focusRef={walkerPosRef} onDegrade={onFxDegrade} />
          </Suspense>
        ) : null}

        {tables.map((t) => (
          <TableMesh
            key={t.id}
            table={t}
            room={room}
            palette={palette}
            selected={selectedId === t.id}
            dragging={draggingId === t.id}
            violating={violatingIds.has(t.id)}
            dragRef={dragRef}
            dragValidRef={dragValidRef}
            interactive={mode === 'build' && canEdit}
            onDown={onTableDown}
            removable={mode === 'build' && canEdit && selectedId === t.id}
            onToggleSeat={(seatNumber) => toggleSeat(t.id, seatNumber)}
            showCloth={showCloth}
            showAccents={showAccents}
            seated={seatedByTable.get(t.id)}
            reduced={reduced}
            crowdLow={crowdLow}
          />
        ))}

        {/* Placed venue fixtures — read-only in 3D (edits stay in the 2D editor
            + this lab's own table tooling). Recolours with the palette. */}
        <VenueFixtures
          room={room}
          palette={palette}
          objects={sceneObjects}
          booths={booths}
          signs={signs}
          cocktail={cocktail}
        />

        {/* 3D Booth Ads Part A (flag-gated, couple-lab only): dashed ghost
            booths for unbooked vendor categories → tap opens the marketplace
            category. Non-interactive while a build placement is armed. */}
        {PLAN3D_BOOTH_ADS_ENABLED && ghostBoothsEnabled ? (
          <GhostBooths
            ghosts={ghostBooths}
            room={room}
            palette={palette}
            interactive={mode === 'play' || (!placeZone && !selectedId && !draggingId && !draggingZone)}
          />
        ) : null}

        {/* Invisible per-booth tap targets (the plan3d-scene precedent) —
            tapping a booth opens its vendor card. Kept off the shared fixture
            renderer so it stays a pure visual (no interaction coupling).
            DISABLED while a build-mode floor interaction is armed (zone
            placement, a selected/dragged table) — the oversized hit box would
            otherwise swallow the floor catcher's tap-to-drop / deselect tap
            and open the vendor sheet mid-placement (the plan3d-scene
            `interactive` gate, adapted to this lab's edit states). */}
        {booths.map((b) => (
          <LabBoothHitTarget
            key={b.id}
            booth={b}
            room={room}
            onTap={setOpenBooth}
            enabled={mode === 'play' || (!placeZone && !selectedId && !draggingId && !draggingZone)}
          />
        ))}

        {/* Direct-drag grips for the floor zones (owner 2026-07-17 · universal
            draggability). Invisible pads over the stage / dance / entrance; a
            pointer-down starts the drag (the catcher's onFloorMove drives it), the
            preview ring shows valid/invalid, release confirms-on-drop. Build +
            editable only, and not while a table placement / zone-move is armed. */}
        {mode === 'build' && canEdit && !placeZone && !selectedId && !draggingId ? (
          <ZoneDragGrips
            floor={floor}
            room={room}
            onGripDown={onZoneGripDown}
            activeZone={draggingZone}
          />
        ) : null}
        {draggingZone ? (
          <ZoneDragPreview posRef={zoneDragRef} validRef={zoneDragValidRef} />
        ) : null}

        {/* Invisible floor catcher for drag-move + tap-to-drop + deselect.
            Double-tap on the OUTSIDE area (beyond the venue rect) → fullscreen. */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={onFloorMove}
          onClick={onFloorClick}
          onDoubleClick={onOutsideDoubleClick}
        >
          <planeGeometry args={[room.w * 3, room.d * 3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {walker && !crowd ? (
          <Walker
            walker={walker}
            spec={walkerSpec}
            palette={palette}
            entrance={entranceWorld}
            onArrive={() => setArrived(walker.name)}
            reduced={reduced}
            posRef={walkerPosRef}
          />
        ) : null}

        {mode === 'play' && crowd ? (
          <Crowd agents={crowd} reduced={reduced} chairColor={palette.wall} onAllArrived={settleCrowd} />
        ) : null}

        {/* Emote bubbles (Fable §3.6) — Play mode only (the emitters memo is
            empty in Build, but the gate also keeps the pool's frame loop out
            of the edit surface entirely). Pooled sprites, ≤6, wall-clock
            rotation; real RSVP + meal data from the couple-scoped slice. */}
        {mode === 'play' && emoteEmitters.length > 0 ? <EmoteBubbles emitters={emoteEmitters} /> : null}

        {movers.map((m) => (
          <MoverToken key={m.gid} mover={m} onDone={onMoverDone} reduced={reduced} />
        ))}

        {/* Tap-to-dance: guests out on the dance floor. Each walks to its spot
            then loops the dance clip; tap one to send it home. Ungated by mode
            (like movers) so a dancer left when toggling to Build stays drawn —
            its chair is excluded from the seated crowd either way. */}
        {dancers.map((d) => (
          <DancerToken key={d.gid} dancer={d} reduced={reduced} onReturn={returnDancer} />
        ))}

        {/* Shared room (slice 8): draw the OTHER online people's characters (Play
            mode), and broadcast MY camera position while I first-person-walk.
            Both render nothing / no-op when the flag is off or I'm alone. */}
        {sharedRoom.enabled && mode === 'play' ? <RemotePlayers remotes={sharedRoom.remotes} quality="low" /> : null}
        {sharedRoom.enabled && walking ? <CameraMoveBroadcaster sendMove={sharedRoom.sendMove} /> : null}

        {walking ? (
          <WalkController
            active={walking}
            input={walkInput}
            room={room}
            entrance={walkEntrance}
            obstacles={walkObstacles}
          />
        ) : (
          <CameraRig mode={mode} room={room} onBusy={setCamBusy} reduced={reduced} />
        )}
        <OrbitControls
          makeDefault
          enabled={!draggingId && !draggingZone && !camBusy && !walking}
          enableDamping={!reduced}
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={Math.max(room.d * 3, bounds.span * 1.4)}
          minPolarAngle={mode === 'build' ? 0.05 : 0.18}
          maxPolarAngle={mode === 'build' ? 0.62 : Math.PI / 2 - 0.04}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* Explicit fullscreen control (owner 2026-07-17 · Lab chrome rules) —
          bottom-right, ≥44px, kit glass; motion respects reduced-motion (a plain
          color transition only). The double-tap-outside gesture mirrors it. */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
        title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        className="pointer-events-auto absolute bottom-4 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
      >
        {isFullscreen ? (
          <Minimize2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Maximize2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {/* Universal confirm-on-drop bubble (owner 2026-07-17) — anchored at the
          drop point over the live canvas. Shared component with the 2D editor. */}
      <DropConfirmBubble state={dropConfirm} onConfirm={onDropConfirm} onCancel={onDropCancel} />

      {/* Booth vendor card (bottom sheet / side drawer) — 2D chrome outside the
          Canvas, shared Sheet conventions. Inspect-only in the lab: no walk-to,
          and the marketplace CTA reads "View vendor profile". */}
      <BoothVendorCard booth={openBooth} onClose={() => setOpenBooth(null)} profileCta="view" />

      {/* 3D Booth Ads Part A (flag-gated): the "still to book" panel — the master
          toggle + per-category dismiss for the dashed ghost booths. Server-action
          forms (progressive-enhancement, no client state). */}
      {PLAN3D_BOOTH_ADS_ENABLED ? (
        <div className="pointer-events-auto absolute bottom-4 left-4 z-30 max-w-[min(78vw,320px)]">
          {ghostBoothsEnabled ? (
            ghostBooths.length > 0 ? (
              <div className="rounded-2xl border border-white/15 bg-black/45 p-3 text-white backdrop-blur-md">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/80">Still to book</span>
                  <form action={setGhostBoothsEnabled}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="enabled" value="false" />
                    <button type="submit" className="text-[11px] text-white/55 hover:text-white/90">
                      Hide
                    </button>
                  </form>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ghostBooths.map((g) => (
                    <span
                      key={g.category}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs"
                    >
                      {g.label}
                      <form action={dismissGhostBooth} className="inline leading-none">
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="category" value={g.category} />
                        <button
                          type="submit"
                          aria-label={`Dismiss ${g.label} suggestion`}
                          className="text-white/50 hover:text-white"
                        >
                          ×
                        </button>
                      </form>
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-white/50">Tap a dashed booth in the room to find vendors.</p>
              </div>
            ) : null
          ) : (
            <form action={setGhostBoothsEnabled}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="enabled" value="true" />
              <button
                type="submit"
                className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition hover:text-white"
              >
                Show vendor suggestions
              </button>
            </form>
          )}
        </div>
      ) : null}

      <Hud
        viewSegment={
          <SeatingViewSegment
            active="3d"
            onSelect={(target) => {
              if (target === '2d') router.push(`/dashboard/${eventId}/seating`);
              else if (target === 'list') router.push(`/dashboard/${eventId}/seating?view=list`);
            }}
          />
        }
        mode={mode}
        setMode={setMode}
        canEdit={canEdit}
        lockStatus={lock.status}
        onTakeOver={lock.acquire}
        notice={notice}
        staleDirty={staleDirty}
        onDismissNotice={() => setNotice(null)}
        onAddTable={addTable}
        onAutoSeat={autoSeatAll}
        onBuildDraft={buildDraft}
        onFillLocked={fillAroundLocked}
        onAutoArrange={autoArrangeAll}
        danceEnabled={floor.dance.enabled}
        entranceEnabled={floor.entrance.enabled}
        placeZone={placeZone}
        onMoveZone={(z) => {
          setPlacingGuestId(null);
          setPlacingGroupId(null);
          setLinkArmId(null);
          setPlaceZone((cur) => (cur === z ? null : z));
        }}
        onResizeZone={resizeZone}
        onToggleDance={toggleDance}
        onToggleEntrance={toggleEntrance}
        onRotate={rotateSelected}
        onDelete={deleteSelected}
        onRenameTable={renameTable}
        onSeatTier={seatTier}
        onUnseat={unseatGuest}
        keepApart={keepApart}
        priorityOrder={priorityOrder}
        onAddKeepApart={addKeepApart}
        onRemoveKeepApart={removeKeepApart}
        onReorderPriority={reorderPriority}
        onCyclePriority={cycleGuestPriority}
        priorityOverride={priorityOverride}
        groups={groups}
        placingGroupId={placingGroupId}
        onPickGroup={(gid) => {
          setPlacingGuestId(null);
          setLinkArmId(null);
          setPlaceZone(null);
          setPlacingGroupId((cur) => (cur === gid ? null : gid));
        }}
        onCancelGroup={() => setPlacingGroupId(null)}
        showCloth={showCloth}
        setShowCloth={setShowCloth}
        showAccents={showAccents}
        setShowAccents={setShowAccents}
        paletteKey={paletteKey}
        setPaletteKey={setPaletteKey}
        guests={guests}
        seats={seats}
        seatedCount={seatedCount}
        onGuestTap={onGuestTap}
        crowdActive={!!crowd}
        onWalkEveryone={walkEveryone}
        onClearCrowd={() => setCrowd(null)}
        dancingCount={dancers.length}
        onClearFloor={clearFloor}
        placingGuestName={placingGuestId ? guestById.get(placingGuestId)?.name ?? null : null}
        placingGuestId={placingGuestId}
        onSeatAnywhere={() => {
          const g = placingGuestId ? guestById.get(placingGuestId) : null;
          setPlacingGuestId(null);
          if (g) sendGuest(g);
        }}
        onCancelPlacing={() => setPlacingGuestId(null)}
        swapSelId={swapSelId}
        tableSwapArmed={tableSwapArmed}
        onToggleTableSwap={() => {
          setTableSwapFirst(null);
          setTableSwapArmed((v) => !v);
        }}
        walker={walker}
        arrived={arrived}
        selectedId={selectedId}
        selectedLabel={selectedId ? tablesById.get(selectedId)?.label ?? null : null}
        selectedType={selectedId ? tablesById.get(selectedId)?.type ?? null : null}
        onChangeType={changeTableType}
        selectedLinked={selectedId ? Boolean(tablesById.get(selectedId)?.linkGroupId) : false}
        onBreakApart={breakApart}
        onPublish={publishPlan}
        printHref={`/dashboard/${eventId}/seating/print`}
        tableCount={tables.length}
      />

      {/* Cinematic vignette (Fable §3.5 Tier A) — a dep-free screen-space
          radial gradient over the canvas, Play only. Pure CSS on a DOM div:
          zero GPU cost, no postprocessing. pointer-events-none + below the
          z-20/z-30 walk controls so it never eats a tap. On Tier B the
          vignette moves INTO the composer (kit/cinematic.tsx), so this div
          only serves the Tier A fallbacks: reduced motion + the perf latch. */}
      {mode === 'play' && !cinematicFx ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 45%, transparent 58%, rgba(6,7,12,0.3) 100%)',
          }}
        />
      ) : null}

      {/* Game-pad walk controls (Play): toggle + on-screen sticks. */}
      {mode === 'play' ? (
        <>
          <button
            type="button"
            onClick={() => setWalking((w) => !w)}
            className="absolute right-4 top-4 z-30 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
          >
            {walking ? 'Exit walk' : '🚶 Walk around'}
          </button>
          {/* Shared room "say hi" (slice 8) — only while another partner is here.
              Waves at the room; the wave plays on MY figure on their screen. */}
          {sharedRoom.enabled && sharedRoom.onlineCount > 1 ? (
            <button
              type="button"
              onClick={() => sharedRoom.greet(null)}
              className="absolute right-4 top-16 z-30 rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/25"
            >
              👋 Say hi · {sharedRoom.onlineCount} here
            </button>
          ) : null}
          {walking ? (
            <>
              <LookPad input={walkInput} />
              <WalkStick input={walkInput} />
              <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-[11px] text-white/55">
                Left stick walks · drag right to look · pinch to zoom
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------- Booth tap target ---------------------------- */

// An invisible, slightly-oversized box over a booth's footprint that catches
// the tap and opens the vendor card (the plan3d-scene / guest-venue-3d
// precedent, with this lab's own drag-vs-tap threshold). Pointer cursor on
// hover as the desktop affordance.
function LabBoothHitTarget({
  booth,
  room,
  onTap,
  enabled,
}: {
  booth: Lab3DBooth;
  room: { w: number; d: number };
  onTap: (booth: Lab3DBooth) => void;
  /** False while a build-mode floor interaction is armed — the hit box must
   *  not occlude the floor catcher's tap-to-drop / deselect raycast. */
  enabled: boolean;
}) {
  const pos = useMemo(() => pctToWorld(booth.xPct, booth.yPct, room), [booth.xPct, booth.yPct, room]);
  // Sized to the resolved chassis (truck cab / riser deck / backdrop panel
  // extend past the old fixed 2.3×1.3×1.3 box); generic booths keep the
  // historical box.
  const hit = useMemo(() => boothHitVolume(booth), [booth]);
  // Rotate the tap box by the booth's computed facing so the non-square /
  // front-shifted volume tracks the rotated chassis (no dead tap zones).
  const facingY = useMemo(() => boothFacingY({ xPct: booth.xPct, yPct: booth.yPct }, room), [booth.xPct, booth.yPct, room]);
  const hc = useMemo(() => rotateLocalRad({ x: hit.center[0], z: hit.center[2] }, facingY), [hit, facingY]);
  if (!enabled) return null;
  return (
    <mesh
      position={[pos.x + hc.x, hit.center[1], pos.z + hc.z]}
      rotation={[0, facingY, 0]}
      onClick={(e) => {
        // `e.delta` is the pointer's pixel travel — ignore drags (orbit/pan).
        if (e.delta > 4) return;
        e.stopPropagation();
        onTap(booth);
      }}
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

/* --------------------------- Sims build camera --------------------------- */

// Build mode eases the camera to a near-top-down angle (precise placement,
// Sims-style); Play mode eases to a lower cinematic orbit. While easing,
// `onBusy(true)` parks OrbitControls so the user input and the tween don't
// fight; the per-mode polar clamps on OrbitControls keep the user within range.
function CameraRig({
  mode,
  room,
  onBusy,
  reduced,
}: {
  mode: 'build' | 'play';
  room: { w: number; d: number };
  onBusy: (b: boolean) => void;
  reduced: boolean;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const easing = useRef(false);
  // Mirror the reduced flag into a ref so the useFrame loop reads it live
  // (a hook can't be called inside useFrame).
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  useEffect(() => {
    if (mode === 'build') target.current.set(0, room.d * 1.9, room.d * 0.3);
    else target.current.set(0, room.d * 1.05 + 6, room.d * 0.95 + 6);
    if (reducedRef.current) {
      // Reduced motion: SNAP to the final composition (no fly-through), but
      // still complete the flow — settle the camera and release OrbitControls.
      camera.position.copy(target.current);
      camera.lookAt(0, 0.5, 0);
      easing.current = false;
      onBusy(false);
      return;
    }
    easing.current = true;
    onBusy(true);
  }, [mode, room, onBusy, camera]);
  useFrame((_, dt) => {
    if (!easing.current) return;
    if (reducedRef.current) {
      // Flag flipped mid-ease → snap to target and finish.
      camera.position.copy(target.current);
      camera.lookAt(0, 0.5, 0);
      easing.current = false;
      onBusy(false);
      return;
    }
    camera.position.lerp(target.current, Math.min(1, dt * 3.2));
    camera.lookAt(0, 0.5, 0);
    if (camera.position.distanceTo(target.current) < 0.06) {
      camera.position.copy(target.current); // deterministic final composition
      camera.lookAt(0, 0.5, 0);
      easing.current = false;
      onBusy(false);
    }
  });
  return null;
}

/* ----------------------------- Scene meshes ----------------------------- */

/**
 * MonogramPlane — the couple's mark medallion on a scene plane (the floor centre
 * = dance-floor decal, and the stage backdrop = altar sign — the two iconic
 * wedding-monogram spots). STATIC for free events; for paid ANIMATED_MONOGRAM
 * owners it BLOOMS in (opacity 0.25→1 + scale 0.9→1, ease-out cubic, ~0.6s) each
 * time the Play-mode camera finishes its ease — the `playSettled` rising edge —
 * i.e. the cinematic reveal beat. The texture is built once upstream (never
 * re-rasterized per frame; we only tween the material opacity + mesh scale).
 * Unlit + toneMapped:false so the mark reads true (projected-light, not lit
 * vinyl); raycast off so it never steals the drag/deselect pointer. Honors
 * prefers-reduced-motion (stays full, no tween). The static floor medallion
 * shipped #1998; the bloom #2065; the stage backdrop is this PR.
 */
const FLOOR_BLOOM_MS = 600;
function MonogramPlane({
  tex,
  size,
  position,
  rotation,
  animate,
  playSettled,
}: {
  tex: THREE.CanvasTexture;
  size: number;
  position: [number, number, number];
  rotation: [number, number, number];
  animate: boolean;
  playSettled: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  // Bloom progress: >=1 = idle/full (also the static free-event state); [0,1) =
  // animating in. Starts idle so the mark is present immediately in build mode.
  const t = useRef(1);
  const prevSettled = useRef(false);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  // Rising-edge detection + seed live INSIDE useFrame (not a passive effect) so
  // the seed and the tween share one rAF timeline — no effect-vs-frame race that
  // could flash a full-bright frame before the bloom starts.
  useFrame((_, dt) => {
    const m = matRef.current;
    const mesh = meshRef.current;
    if (!m || !mesh) return;
    // playSettled false→true (owners, motion allowed) → begin a bloom.
    if (playSettled !== prevSettled.current) {
      prevSettled.current = playSettled;
      if (animate && playSettled && !reduced.current) {
        t.current = 0;
        m.opacity = 0.25;
        mesh.scale.setScalar(0.9);
      }
    }
    if (t.current >= 1) {
      if (m.opacity !== 1) m.opacity = 1;
      if (mesh.scale.x !== 1) mesh.scale.setScalar(1);
      return;
    }
    t.current = Math.min(1, t.current + (dt * 1000) / FLOOR_BLOOM_MS);
    const e = 1 - Math.pow(1 - t.current, 3); // ease-out cubic
    m.opacity = 0.25 + 0.75 * e;
    mesh.scale.setScalar(0.9 + 0.1 * e);
  });
  return (
    <mesh ref={meshRef} rotation={rotation} position={position} raycast={() => null}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        transparent
        alphaTest={0.01}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function RoomShell({
  room,
  floor,
  palette,
  rolePalette,
  floorColor,
  buildMode,
  monogram,
  animatedMonogram,
  playSettled,
}: {
  room: { w: number; d: number };
  floor: Lab3DFloor;
  palette: Lab3DPalette;
  /** Couple's mood board — drives the dance-floor mural (Fable §3.7). Kept
   *  separate from the DEMO-switchable `palette`: the mural is THEIR floor,
   *  so the material switcher recolours walls/linen but never repaints it. */
  rolePalette: RolePalette;
  /** Archetype-tinted floor colour (Wave 2b) — sand for beach, timber for barn,
   *  etc. Falls back to the palette floor for banquet/chapel. */
  floorColor: string;
  buildMode: boolean;
  monogram: Lab3DMonogram;
  animatedMonogram: boolean;
  playSettled: boolean;
}) {
  const stage = pctToWorld(floor.stage.xPct, floor.stage.yPct, room);
  const stageW = Math.max(1.5, (floor.stage.wPct / 100) * room.w);
  const stageD = Math.max(1, (floor.stage.hPct / 100) * room.d);
  const entrance = floor.entrance.enabled
    ? pctToWorld(floor.entrance.xPct, floor.entrance.yPct, room)
    : pctToWorld(50, 96, room);
  const dance = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);

  // The couple's mark on the floor centre (the Play-mode camera's focal point —
  // CameraRig lookAt 0,0.5,0). Rasterized once from the canonical SVG mark; the
  // manually-created CanvasTexture is NOT auto-disposed by R3F, so we dispose it
  // on unmount / source change, and a `live` flag drops a late async resolve.
  // Keyed on `monogram` ONLY (not palette) — the mark carries its own contrast,
  // so the palette switcher never re-rasterizes or orphans a texture.
  const [monoTex, setMonoTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!monogram) {
      setMonoTex(null);
      return;
    }
    let live = true;
    let made: THREE.CanvasTexture | null = null;
    svgToMonogramTexture(monogram).then((tex) => {
      if (live) {
        made = tex;
        setMonoTex(tex);
      } else {
        tex?.dispose();
      }
    });
    return () => {
      live = false;
      made?.dispose();
    };
  }, [monogram]);
  // The texture PLANE is min(room.w, room.d) * 0.42 (~5 m at the default 18×12),
  // but the overlay badge fills only its centre ~27% — so the VISIBLE medallion
  // is ~1.35 m; the rest of the plane is transparent (alphaTest discards it, so
  // it never occludes tables or the floor). Centred on world origin = the floor
  // centre AND the Play-mode camera's focal point, on ANY board (free or venue-
  // sized) — so it lands ON a centred dance floor when one is enabled (the
  // intended "monogram on the dance floor" look).
  const medSize = Math.min(room.w, room.d) * 0.42;

  return (
    <group>
      {/* Floor — receives the room's real shadows; the shared procedural
          roughness map breaks up the uniform sheen (Wave 2a materials pass). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={floorColor} roughness={0.92} metalness={0.02} roughnessMap={floorRoughnessMap()} map={floorAlbedoMap()} bumpMap={floorBumpMap()} bumpScale={0.02} />
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

      {/* Perimeter walls now come from the shared archetype `VenueShell` (Wave 2b)
          — banquet/chapel/barn get full-height walls, garden/beach/rooftop stay
          open — so RoomShell no longer draws its own low perimeter box. */}

      {/* Stage */}
      <mesh position={[stage.x, 0.15, stage.z]} castShadow receiveShadow>
        <boxGeometry args={[stageW, 0.3, stageD]} />
        <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Dance floor — the mood-board MURAL (Fable §3.7) replaces the old flat
          accent plane. The couple's STATIC mark is baked into the mural only
          when the dance floor sits AWAY from the room centre (else the origin
          medallion below already lands on it — one mark on the floor, never
          two). The paid ANIMATED_MONOGRAM bloom stays on MonogramPlane,
          untouched. y 0.02 keeps it under the 0.022 medallion. */}
      {floor.dance.enabled ? (
        <DanceFloorMural
          floor={floor}
          room={room}
          rolePalette={rolePalette}
          monogram={Math.hypot(dance.x, dance.z) > medSize * 0.35 ? monogram : null}
          y={0.02}
        />
      ) : null}

      {/* Couple's monogram on the two iconic wedding spots — the floor centre
          (dance-floor decal · the Play-mode camera's focal point) AND the stage
          backdrop (altar sign, a vertical plane just behind the stage, facing the
          room/camera). Both BLOOM in together when the couple owns the paid
          ANIMATED_MONOGRAM as the Play camera settles; otherwise static. The
          backdrop reuses the same texture. See MonogramPlane. */}
      {monoTex ? (
        <>
          <MonogramPlane
            tex={monoTex}
            size={medSize}
            position={[0, 0.022, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            animate={animatedMonogram}
            playSettled={playSettled}
          />
          <MonogramPlane
            tex={monoTex}
            size={Math.min(stageW, 2.2)}
            position={[
              stage.x,
              0.4 + Math.min(stageW, 2.2) / 2,
              Math.max(stage.z - stageD / 2 - 0.05, -room.d / 2 + 0.1),
            ]}
            rotation={[0, 0, 0]}
            animate={animatedMonogram}
            playSettled={playSettled}
          />
        </>
      ) : null}

      {/* Entrance marker (the walk spawn point). A 'door' keeps the shallow
          doorway frame; a 'tunnel' (UI: Walk-through) renders two side walls +
          a lintel running INWARD from the wall by the couple's depth (clamped by
          coldSparkFrame so it never pushes through the far wall), open inward. */}
      {floor.entrance.enabled && floor.entrance.kind === 'tunnel'
        ? (() => {
            const frame = coldSparkFrame(entrance, room);
            // Honour the couple's depth, but never exceed the frame's clamped
            // inward run (already fitted to the room's depth).
            const len = Math.max(1, Math.min(floor.entrance.depthM, frame.len));
            const yaw = Math.atan2(frame.dir.x, frame.dir.z);
            const HALF_W = 0.7; // interior clear half-width (door mouth is 1.4)
            const WALL_T = 0.12;
            const H = 2.2;
            return (
              <group position={[entrance.x, 0, entrance.z]} rotation={[0, yaw, 0]}>
                {/* mouth ring on the floor at the outer opening */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                  <ringGeometry args={[0.55, 0.78, 32]} />
                  <meshBasicMaterial color={palette.accent} transparent opacity={0.85} side={THREE.DoubleSide} />
                </mesh>
                {/* two side walls running inward (local +z) */}
                {[-1, 1].map((side) => (
                  <mesh key={side} position={[HALF_W * side, H / 2, len / 2]} castShadow>
                    <boxGeometry args={[WALL_T, H, len]} />
                    <meshStandardMaterial color={palette.accent} roughness={0.6} transparent opacity={0.35} />
                  </mesh>
                ))}
                {/* lintel across the top of the run */}
                <mesh position={[0, H, len / 2]}>
                  <boxGeometry args={[HALF_W * 2 + WALL_T, WALL_T, len]} />
                  <meshStandardMaterial color={palette.accent} roughness={0.6} transparent opacity={0.35} />
                </mesh>
              </group>
            );
          })()
        : (
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
        )}
    </group>
  );
}

function TableMesh({
  table,
  room,
  palette,
  selected,
  dragging,
  violating,
  dragRef,
  dragValidRef,
  interactive,
  onDown,
  removable,
  onToggleSeat,
  showCloth,
  showAccents,
  seated,
  reduced,
  crowdLow,
}: {
  table: LiveTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  selected: boolean;
  dragging: boolean;
  /** CURRENT saved pose fails the shared oracle (legacy persisted overlap / too
   *  tight) — draws a static read-only warm-red ground ring so a pre-oracle
   *  round-vs-round overlap is VISIBLE. Suppressed while dragging (the live drag
   *  ring supersedes). Same audit the 2D editor's mount pill uses. */
  violating: boolean;
  dragRef: React.MutableRefObject<{ id: string; x: number; z: number } | null>;
  /** Live legality of the current drag (gold ✓ / warm-red ✗ ground ring). */
  dragValidRef: React.MutableRefObject<boolean>;
  interactive: boolean;
  onDown: (id: string) => void;
  removable: boolean;
  onToggleSeat: (seatNumber: number) => void;
  showCloth: boolean;
  showAccents: boolean;
  seated: Map<number, SeatToken> | undefined;
  reduced: boolean;
  /** Event-wide seated-figure budget flag (guests > 60) — see the parent. */
  crowdLow: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  // PERF — the seated-crowd budget's PER-TABLE half: a table >8 m from the
  // camera renders its seated figures at kit quality 'low' (static baked
  // pose — no idle sway, no per-frame joint writes), because at that range
  // the limb motion is subpixel anyway. Checked at ~4 Hz (not every frame)
  // with ±0.75 m hysteresis around the 8 m line so orbiting the room doesn't
  // thrash React state right at the threshold. Combined with the event-wide
  // `crowdLow` flag (total guests > 60 → everyone static), this keeps a full
  // ballroom's seated crowd nearly free while close-up tables stay alive.
  const [far, setFar] = useState(false);
  const farClock = useRef(0);
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  // Chair centres + facing — the shared `chairPlacements` (serpentine carries
  // its own per-chair facing; every other shape faces the table-local origin).
  // Linked serpentines get uniform (even) chair spacing so a chain reads as one
  // banquet with no seam pile-up (2026-07-10). Every other shape ignores it.
  const chairs = useMemo(
    () => chairPlacements(table.shape, table.capacity, table.linkGroupId != null),
    [table.shape, table.capacity, table.linkGroupId],
  );
  // Occupied seat indices — drives the instanced chairs' per-instance tint.
  const occupiedSeats = useMemo(() => new Set(seated?.keys() ?? []), [seated]);

  // ── Instanced seated crowd (2026-07-08) — mirrors the public walk + demo ────
  // The STATIC seated figures at this table collapse into ONE
  // <InstancedSeatedCrowd> mounted INSIDE this table's animated group (below), so
  // they ride the drag slide-lag / scale-pop / rotation exactly like the
  // individual <SeatedAvatar> did — the batch's InstancedMeshes are children of
  // the same <group ref>, so the parent matrix applies to both paths identically.
  // Gated to the SAME condition that makes a <Figure> static — crowdLow || far ||
  // reduced — so a close-up table under motion keeps its per-figure idle sway and
  // the shipped look is UNTOUCHED. Only CONFIRMED (opacity 1), non-photo real
  // guests join the batch; tentative guests (translucent-ring semantics), photo
  // seats (billboard head), and the "+1 reserved" ghost (spec null) stay
  // individual. Matrices are TABLE-LOCAL — seatedFigureMatrix with an identity
  // table composes exactly the seat group × the −0.04 nudge / π flip that
  // <SeatedAvatar> renders — so batch-instance × parent-group reproduces the
  // individual figure's world transform bit-for-bit (proven in
  // figure-sit-bake.test.ts). This keeps the walk-in → sit → done → settle chain
  // seamless: CrowdField's 'done' end-state is already transform-identical to
  // <SeatedAvatar>, and this batch reproduces <SeatedAvatar>, so the settle
  // handoff (Crowd unmounts → steady seated) lands on the identical transform.
  const instanceSeated = crowdLow || far || reduced;
  const { seatedInstances, instancedSeatIdx } = useMemo(() => {
    const out: SeatedInstance[] = [];
    const idx = new Set<number>();
    if (!instanceSeated || !seated) return { seatedInstances: out, instancedSeatIdx: idx };
    for (let i = 0; i < chairs.length; i++) {
      const tok = seated.get(i);
      if (!tok || !tok.spec) continue; // empty seat or "+1 reserved" ghost → individual
      if (tok.spec.photoUrl) continue; // selfie billboard head → individual
      if (tok.opacity !== 1) continue; // tentative RSVP (translucent semantics) → individual
      if (table.removedSeats.includes(i)) continue;
      const c = chairs[i]!;
      out.push({
        matrix: seatedFigureMatrix({
          homeX: 0,
          homeZ: 0,
          tableFaceY: 0,
          seatX: c.x,
          seatZ: c.z,
          seatFaceY: c.faceY,
        }),
        color: tok.spec.outfitColor,
        ringColor: tok.spec.statusColor,
        scale: tok.spec.scale,
      });
      idx.add(i);
    }
    return { seatedInstances: out, instancedSeatIdx: idx };
  }, [instanceSeated, seated, chairs, table.removedSeats]);
  // The serpentine table top is a real curved ribbon (104° quarter-donut),
  // laid flat from the floor to the tabletop height — now the shared
  // SERPENTINE_TOP_GEO so the lab, homepage demo, and guest walk render one
  // identical ribbon (the demo + walk previously fell back to a rectangle).
  const serpGeo = table.shape === 'serpentine' ? SERPENTINE_TOP_GEO : null;
  const home = useMemo(() => pctToWorld(table.xPct, table.yPct, room), [table.xPct, table.yPct, room]);
  // Share materials by reference (one per table, not one per token). Chairs
  // themselves are instanced now (see InstancedChairs below); the pedestal
  // still borrows this wood-grade material.
  const chairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.6 }),
    [palette.wall],
  );
  // Removed chairs render as faint ghosts (tap to restore).
  const ghostMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.6, transparent: true, opacity: 0.16 }),
    [palette.wall],
  );
  // Drag-feedback ground ring (owner 2026-07-17 · snap-back drop rule): a subtle
  // GOLD ring while the pose is oracle-valid, a warm-RED ring while it's INVALID
  // (over an overlap / walkway breach) — the per-frame warning that this release
  // would be refused. Colour is driven from dragValidRef inside useFrame so
  // there's zero React churn per frame.
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringColors = useMemo(
    () => ({ ok: new THREE.Color('#d8b45a'), bad: new THREE.Color('#d9534f') }),
    [],
  );
  const ringR = (dims.round ? dims.w / 2 : Math.max(dims.w, dims.d) / 2) + 0.18;
  const tokenMats = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const tokenMat = (color: string, opacity: number) => {
    const key = `${color}|${opacity}`;
    let m = tokenMats.current.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: opacity < 1, opacity });
      tokenMats.current.set(key, m);
    }
    return m;
  };

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    // Throttled camera-distance check for the seated-figure quality knob (see
    // the comment on `far` above). Runs before the reduced-motion early
    // return — the budget applies either way.
    farClock.current += delta;
    if (farClock.current >= 0.25) {
      farClock.current = 0;
      const d = camera.position.distanceTo(g.position);
      if (far ? d < 7.25 : d > 8.75) setFar(!far);
    }
    const targetX = dragging && dragRef.current ? dragRef.current.x : home.x;
    const targetZ = dragging && dragRef.current ? dragRef.current.z : home.z;
    // Tint the drag ring live (both motion branches) — gold when the oracle says
    // the pose is legal, warm-red while it's invalid (the release would snap back).
    if (dragging && ringMatRef.current) {
      ringMatRef.current.color.copy(dragValidRef.current ? ringColors.ok : ringColors.bad);
    }
    if (reduced) {
      // Reduced motion: no slide-lag, no scale pop. Position tracks the target
      // directly (drag still works — it just follows the finger 1:1), scale
      // pinned to 1. Rotation is instantaneous as before.
      g.position.x = targetX;
      g.position.z = targetZ;
      if (g.scale.x !== 1) g.scale.setScalar(1);
      g.rotation.y = (-table.rotationDeg * Math.PI) / 180;
      return;
    }
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

  const clothColor = selected ? palette.accent : palette.table;
  const halfW = dims.round ? dims.w / 2 : dims.w / 2;
  const halfD = dims.round ? dims.w / 2 : dims.d / 2;

  return (
    <group ref={ref} position={[home.x, 0, home.z]} onPointerDown={handleDown}>
      {/* Drag-feedback ground ring — gold (valid) / warm-red (invalid → snaps
          back on release). Only while this table is being dragged; never raycasts
          (drags pass through to the floor plane). */}
      {dragging ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} raycast={() => null}>
          <ringGeometry args={[Math.max(0.05, ringR - 0.07), ringR, 56]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color="#d8b45a"
            transparent
            opacity={0.9}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {/* Legacy-overlap flag — a static, read-only warm-red ground ring on a
          table whose CURRENT saved pose fails the shared oracle (a pre-oracle
          round-vs-round overlap that survived because saved anchors are never
          force-moved). Purely a marker; no movement, never raycasts. The drag
          ring supersedes it (a violating table being dragged shows the live
          gold/red drag feedback instead). Same set the 2D mount audit flags. */}
      {violating && !dragging ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]} raycast={() => null}>
          <ringGeometry args={[Math.max(0.05, ringR - 0.12), ringR + 0.05, 56]} />
          <meshBasicMaterial
            color="#d9534f"
            transparent
            opacity={0.85}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {/* Table: a draped tablecloth (skirt to the floor + top) when cloth is on,
          else a bare top + pedestal. Serpentine renders its curved ribbon. */}
      {serpGeo ? (
        <mesh geometry={serpGeo} castShadow>
          <meshStandardMaterial
            color={clothColor}
            roughness={showCloth ? 0.85 : 0.4}
            metalness={showCloth ? 0 : 0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : showCloth ? (
        dims.round ? (
          <group>
            {/* Linen drape — high roughness so it reads soft under the IBL. */}
            <mesh position={[0, 0.37, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[dims.w / 2, dims.w / 2 + 0.04, 0.74, 32]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.008} />
            </mesh>
            <mesh position={[0, 0.745, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.04, 32]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.008} />
            </mesh>
          </group>
        ) : (
          <group>
            <mesh position={[0, 0.37, 0]} castShadow receiveShadow>
              <boxGeometry args={[dims.w, 0.74, dims.d]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.008} />
            </mesh>
            <mesh position={[0, 0.745, 0]} castShadow receiveShadow>
              <boxGeometry args={[dims.w + 0.04, 0.04, dims.d + 0.04]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} bumpMap={fabricBumpMap()} bumpScale={0.008} />
            </mesh>
          </group>
        )
      ) : (
        <group>
          <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
            {dims.round ? (
              <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.08, 36]} />
            ) : (
              <boxGeometry args={[dims.w, 0.08, dims.d]} />
            )}
            <meshStandardMaterial color={clothColor} roughness={0.35} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.37, 0]} geometry={PEDESTAL_GEO} material={chairMat} />
        </group>
      )}

      {/* Centerpiece accent (toggle) — skipped for serpentine, whose visual
          centre falls in the concave gap off the ribbon itself. */}
      {showAccents && table.shape !== 'serpentine' ? (
        <group position={[0, 0.78, 0]}>
          <mesh geometry={VASE_GEO} position={[0, 0.12, 0]}>
            <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.12} />
          </mesh>
          <mesh geometry={BLOOM_GEO} position={[0, 0.34, 0]}>
            <meshStandardMaterial color="#6f9b6a" roughness={0.7} />
          </mesh>
        </group>
      ) : null}

      {/* Chairs — 2 instanced draw calls per table (Wave 2a collapse), occupied
          seats tinted via instanceColor, removed seats zero-scaled out. Taps
          resolve the chair index from `instanceId` so remove-a-chair still
          works; removed seats keep individual GHOST meshes for the restore tap.
          `tableId` opts into the detach-one-chair registry so the walk-in sit
          clips (Walker / Crowd → SitController) can pull THIS table's chairs. */}
      <InstancedChairs
        tableId={table.id}
        chairs={chairs}
        removedSeats={table.removedSeats}
        occupiedSeats={occupiedSeats}
        color={palette.wall}
        accent={palette.accent}
        onSeatDown={
          removable
            ? (i, e) => {
                e.stopPropagation();
                onToggleSeat(i);
              }
            : undefined
        }
      />
      {/* Removed-seat ghosts (tap to restore) + seated guests. Confirmed static
          figures are drawn by the <InstancedSeatedCrowd> batch below instead of
          an individual <SeatedAvatar> (their seat index is in instancedSeatIdx). */}
      {chairs.map((c, i) => {
        const ang = c.faceY;
        const tok = seated?.get(i);
        const isRemoved = table.removedSeats.includes(i);
        if (!isRemoved && !tok) return null;
        if (tok && !isRemoved && instancedSeatIdx.has(i)) return null; // body is in the batch
        return (
          <group
            key={i}
            position={[c.x, 0, c.z]}
            rotation={[0, ang, 0]}
            onPointerDown={
              removable && isRemoved
                ? (e) => {
                    e.stopPropagation();
                    onToggleSeat(i);
                  }
                : undefined
            }
          >
            {isRemoved ? (
              <>
                <mesh geometry={GHOST_SEAT_GEO} position={[0, 0.46, 0]} material={ghostMat} />
                <mesh geometry={GHOST_BACK_GEO} position={[0, 0.69, 0.19]} material={ghostMat} />
              </>
            ) : null}
            {tok && !isRemoved ? (
              <SeatedAvatar tok={tok} bodyMat={tokenMat(tok.color, tok.opacity)} quality={crowdLow || far ? 'low' : 'high'} />
            ) : null}
          </group>
        );
      })}

      {/* The table's static seated crowd as one instanced batch (child of this
          animated group, so it drags / scales / rotates with the table). Empty
          — and unmounted — whenever the seated figures are individual (close-up
          table under motion), so those keep their idle sway. `quality` mirrors
          the individual SeatedAvatar so the batch's shadow pass matches (a
          reduced-motion figure at quality 'high' still casts, so the batch does
          too). */}
      {seatedInstances.length > 0 ? (
        <InstancedSeatedCrowd seats={seatedInstances} quality={crowdLow || far ? 'low' : 'high'} />
      ) : null}

      {/* Selection ring */}
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[Math.max(halfW, halfD) + 0.7, Math.max(halfW, halfD) + 0.9, 40]} />
          <meshBasicMaterial color={palette.accent} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * The single walk-in — an articulated kit `<Figure>` DRESSED AS THE GUEST
 * (same spec as their seated figure: outfit, selfie head, status colour).
 * This group owns position + heading for the WALK leg only (the kit contract:
 * parents move, figures dress); the RUN-cycle gait (this walker jogs at
 * ~2.4 m/s) is driven by the motion clock at RUN_CLOCK_RAD_S, fed through a
 * phase ref so the gait advances without re-rendering React each frame.
 *
 * ARRIVAL — the old teleport seam, now the sit choreography: the path ends at
 * the sit APPROACH POINT (0.55 m behind the chair — retargeted in sendGuest),
 * and on the final waypoint this component hands the figure to
 * `<SitController>`: the chair pulls back, the guest steps into the gap,
 * turns, sits, and the chair tucks in. `onArrive` therefore fires from the
 * controller's `onSeated` — when the guest is FLUSH-SEATED — and the parent's
 * 1.2 s toast hold keeps the controller mounted in its 'seated' phase until
 * the static SeatedAvatar takes over transform-identically (the controller's
 * unmount cleanup restores the instanced chair).
 *
 * Reduced motion skips the walk entirely and mounts the controller at once:
 * it snaps to the seated end-state and STILL fires `onSeated`, so the
 * "found their seat" payoff always resolves.
 */
function Walker({
  walker,
  spec,
  palette,
  entrance,
  onArrive,
  reduced,
  posRef,
}: {
  walker: NonNullable<WalkerState>;
  /** The guest's figure spec (null only if the guest row vanished mid-walk —
   *  then a neutral stand-in keeps the choreography intact). */
  spec: FigureSpec | null;
  palette: Lab3DPalette;
  entrance: Vec2;
  onArrive: () => void;
  reduced: boolean;
  /** Live world position sink for the Tier B DepthOfField follow-focus —
   *  written per frame while walking (the sit leg holds the approach point,
   *  which sits right next to the chair), nulled on unmount so the DoF eases
   *  back to the room centre. */
  posRef?: { current: THREE.Vector3 | null };
}) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const t = useRef(0);
  // Gait phase for the kit figure — the walk clock above, in radians.
  const phase = useRef(0);
  // Walk heading at the approach point — the sit clip's shortest-arc turn
  // starts from the REAL arrival direction, not an assumed straight walk-in.
  const arriveHeading = useRef<number | undefined>(undefined);
  // Arrived → the SitController owns the figure for the rest of the clip.
  // State (it swaps the render) mirrored into a ref for the frame loop.
  const [sitting, setSitting] = useState(false);
  const sittingRef = useRef(false);
  const beginSit = useCallback((): void => {
    if (sittingRef.current) return;
    sittingRef.current = true;
    setSitting(true);
  }, []);
  // Mirror into a ref so the useFrame loop reads the live value (no hook in loop).
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    idx.current = 0;
    t.current = 0;
    phase.current = 0;
    arriveHeading.current = undefined;
    sittingRef.current = false;
    setSitting(false);
    if (reducedRef.current) {
      // Reduced motion: no walk — straight to the sit controller, which snaps
      // to the seated end-state and fires onSeated (the flow always completes).
      beginSit();
    } else {
      ref.current?.position.set(entrance.x, 0, entrance.z);
    }
  }, [walker, entrance, beginSit]);

  useFrame((_, delta) => {
    if (sittingRef.current) return; // the SitController owns the figure now
    if (reducedRef.current) {
      // Mid-walk reduced-motion flip: hand off immediately — the controller's
      // snap still seats the guest and completes the flow.
      beginSit();
      return;
    }
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const path = walker.path;
    if (idx.current >= path.length - 1) {
      // At the approach point — capture the live heading and start the sit.
      arriveHeading.current = g.rotation.y;
      beginSit();
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
    // Same clock, new consumer: the RUN cadence (this walker jogs at ~2.4 m/s;
    // the scurry cycle keeps the feet planted — ChameleonMovement port,
    // 2026-07-09) advances the rig's run cycle (frame-rate independent — t
    // integrates real delta).
    phase.current = t.current * RUN_CLOCK_RAD_S;
    // Tier B follow-focus: publish the live root position (a ref write per
    // frame, zero React work; the DoF reads it in ITS frame loop).
    if (posRef) (posRef.current ??= new THREE.Vector3()).copy(g.position);
  });

  // The follow-focus sink dies with the walker — the DoF eases back home.
  useEffect(() => {
    return () => {
      if (posRef) posRef.current = null;
    };
  }, [posRef]);

  const figSpec =
    spec ?? { id: walker.gid, outfit: 'neutral' as const, outfitColor: null, statusColor: palette.accent };

  if (sitting) {
    return (
      // Keyed by the seat identity: a NEW walker while `sitting` is still true
      // (e.g. under reduced motion, where it never flips back) must remount the
      // controller — its rest pose + phase clock are locked per clip.
      <SitController
        key={`${walker.gid}:${walker.tableId}:${walker.seatNumber}`}
        seat={walker.seat}
        tableId={walker.tableId}
        seatIndex={walker.seatNumber}
        chairColor={palette.wall}
        arriveHeading={arriveHeading.current}
        arrivePose="run"
        arrivePhase={phase.current}
        onSeated={onArrive}
      >
        {(pose, ph) => (
          <>
            {/* `ph` = the walker's frozen run stride — the controller starts
                the takeover figure there and eases run → stand through the
                kit's generic blend (arrival-blend fix 2026-07-09). */}
            <Figure spec={figSpec} pose={pose} phase={ph} name={walker.name} />
            {/* The follow light rides the figure root through the sit, same as the walk. */}
            <pointLight position={[0, 1.2, 0]} intensity={0.4} distance={3} color={palette.accent} />
          </>
        )}
      </SitController>
    );
  }

  return (
    <group ref={ref} position={[entrance.x, 0, entrance.z]}>
      {/* 'run' — this walker jogs at ~2.4 m/s. On arrival the root swaps
          <group> → <SitController>, remounting the figure; the controller's
          arrivePose/arrivePhase (passed above) start the takeover figure from
          this exact frozen stride and ease it down — the old one-frame snap
          to 'stand' is gone (arrival-blend fix 2026-07-09). */}
      <Figure spec={figSpec} pose="run" phase={phase} name={walker.name} />
      {/* The follow light keeps the walk-in readable in the darker Play room. */}
      <pointLight position={[0, 1.2, 0]} intensity={0.4} distance={3} color={palette.accent} />
    </group>
  );
}

// One member of the populate-Play crowd: a precomputed path to the sit
// APPROACH POINT behind their chair, the guest's full figure spec (attire +
// selfie + status — the same spec as their seated figure, so the walk-in
// matches who sits down), a stagger delay (so they queue out of the entrance
// instead of piling up), their OWN obstacle set (every table footprint except
// their destination's, every chair except their own + its corridor, fixtures —
// pre-hashed into an ObstacleGrid so the per-frame re-clamp queries locally),
// and the seat identity (table + index + world pose) their arrival sit clip
// detaches and animates.
type CrowdAgent = {
  id: string;
  name: string;
  path: Vec2[];
  spec: FigureSpec;
  startDelay: number;
  obstacles: ObstacleDisc[] | ObstacleGrid;
  tableId: string;
  seatIndex: number;
  seat: SeatPose;
};

/** Where a crowd agent is in its arrival lifecycle: walking its path → running
 *  its sit clip (a mounted SitController + detached chair) → seated (a plain
 *  sit-pose figure holding the chair until the whole crowd settles). */
type CrowdStage = 'walk' | 'sit' | 'done';

// Concurrency budget for the arrival sits: every active sit detaches one
// instanced chair and mounts a real ActiveChair + a per-frame controller, so
// cap how many clips run at once and space the starts a beat apart. A queued
// guest simply keeps standing at their approach point (frozen gait ≈ a stand),
// which reads as natural pre-seating milling, not a stall.
const MAX_ACTIVE_SITS = 8;
const SIT_START_GAP_S = 0.25;

// Concurrency budget for the WALK itself: at most this many agents are
// mid-walk (released, not yet at their approach point) at once. A 150-guest
// room walking in as one mass read as a stampede — and 150 simultaneous
// movers is also the worst case for the O(n²) separation pass. Later agents
// simply aren't released yet (they hold at the entrance exactly like the
// startDelay hold), and slots free up FIFO as walkers arrive — which reads as
// a natural entrance queue. Sits have their own tighter budget above.
const MAX_CONCURRENT_WALKERS = 24;

// Walk-arrival tolerances (review fix — walk-slot starvation): seg only
// advances when the agent closes within ONE STRIDE (2·delta m) of a waypoint,
// but the separation push off a PINNED neighbour (an earlier arrival holding
// its approach point) can exceed a stride and hold the walker at a
// push-vs-step equilibrium forever — permanently occupying one of the
// MAX_CONCURRENT_WALKERS slots and starving the entrance queue. Two escapes:
// arrival at the APPROACH POINT is accepted within a radius (not one stride),
// and a released walker that makes no waypoint progress for WALK_STALL_S
// force-advances one waypoint (the per-frame clamp still keeps it out of
// every obstacle, so a skipped waypoint can't cut through a table).
const WALK_ARRIVE_M = 0.3;
const WALK_STALL_S = 2.5;

/**
 * Populate-Play: the whole seated guest list walks in at once — capped at
 * MAX_CONCURRENT_WALKERS mid-walk (the rest queue at the entrance). Each frame
 * every WALKING agent steps toward its next waypoint, then the set is resolved
 * with separateAgents ("make way for each other") — now PREDICTIVELY: each
 * agent carries the velocity its last committed frame realised (m/s, divided
 * by delta, so the projection is frame-rate independent) and approaching pairs
 * sidestep early, pass-on-the-right, instead of shoving on contact — and each
 * agent is pushed clear of its objects (pushOutOfDiscs against its pre-hashed
 * ObstacleGrid: true table footprints + chairs + fixtures) — so nobody
 * overlaps or crosses a table/chair/stage.
 *
 * ARRIVALS end in the sit choreography, per agent: reaching the approach point
 * enqueues the agent for a sit slot; the frame loop drains that queue under the
 * MAX_ACTIVE_SITS cap with SIT_START_GAP_S between starts, so sits stagger
 * naturally (guests arrive at different times anyway) and simultaneous
 * arrivals sit one after another instead of eight chairs scraping back in the
 * same frame. A finished sit swaps to a plain seated figure at the
 * controller's exact end transform (its unmount restores the instanced chair —
 * invisible), and once EVERY agent is seated `onAllArrived` fires so the
 * parent clears the crowd for the per-seat SeatedAvatars (same transform +
 * pose — invisible again).
 *
 * Reduced motion renders every agent straight in the seated end-state (no
 * walk, no sit clips, nothing detached) and still fires `onAllArrived` — the
 * flow always completes.
 */
function Crowd({
  agents,
  reduced,
  chairColor,
  onAllArrived,
}: {
  agents: CrowdAgent[];
  reduced: boolean;
  /** MUST be the same `palette.wall` the tables' InstancedChairs get, or the
   *  detached-chair swap flashes a differently-tinted chair. */
  chairColor: string;
  onAllArrived: () => void;
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const seg = useRef<number[]>([]);
  const elapsed = useRef(0);
  // Per-agent gait phase refs, one plain {current} record per agent so each
  // kit figure reads its own clock without a React render per frame. Rebuilt
  // (all zeros) whenever a new crowd mounts — the agents effect resets the
  // choreography anyway. Phase 0 ≈ a near-neutral stride, so agents queued
  // at the entrance (pre-startDelay) hold something close to a stand.
  const phases = useMemo<{ current: number }[]>(() => agents.map(() => ({ current: 0 })), [agents]);
  // PERF — crowd half of the >60-guest budget: a big crowd walks in at kit
  // quality 'low' (one baked stride sample, no per-frame joint writes); the
  // parent groups still glide them along their paths, so the choreography —
  // stagger, make-way, arrival timing — is IDENTICAL, just cheaper limbs.
  const crowdQuality: FigureQuality = agents.length > 60 ? 'low' : 'high';
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  // Fire onAllArrived exactly once per crowd — now once every agent's SIT CLIP
  // has finished (or immediately under reduced motion). Mirror the (stable)
  // callback into a ref so the frame loop + effects read it without re-arming.
  const firedRef = useRef(false); // onAllArrived already fired for this crowd?
  const onAllArrivedRef = useRef(onAllArrived);
  useEffect(() => {
    onAllArrivedRef.current = onAllArrived;
  }, [onAllArrived]);

  // Arrival-sit choreography state. `stage` is React state — flipping an entry
  // mounts/unmounts that agent's SitController — everything else is frame-loop
  // bookkeeping in refs (the loop is the only writer).
  const [stage, setStage] = useState<CrowdStage[]>(() => agents.map(() => 'walk'));
  const sitQueue = useRef<number[]>([]); // arrived agents awaiting a sit slot (FIFO)
  const enqueued = useRef<Set<number>>(new Set()); // ever-enqueued guard, per agent index
  const activeSits = useRef<Set<number>>(new Set()); // agent indices with a live sit clip
  const lastSitStart = useRef(-Infinity); // elapsed at the most recent sit start
  const headings = useRef<number[]>([]); // walk heading captured at each arrival
  // Walk-slot bookkeeping: agents granted one of the MAX_CONCURRENT_WALKERS
  // slots (an agent stays "mid-walk" until it reaches its approach point —
  // `enqueued` marks that arrival, freeing the slot for the next in line).
  const releasedWalk = useRef<Set<number>>(new Set());
  // Last committed frame's realised velocity per agent (m/s) — what the
  // predictive separation pass projects ahead. undefined = no history yet /
  // pinned / sitting, which separateAgents treats as reactive-only. Entries
  // are mutated in place once created (no per-frame object churn).
  const agentVel = useRef<(AgentVel | undefined)[]>([]);
  // Per-frame SCRATCH buffers, allocated once per crowd and mutated in place
  // (review fix): the loop used to mint 4–5 fresh O(n) arrays + wrapper
  // objects every frame — ~40–50k short-lived allocations/s on a 150-guest
  // room, pure GC pressure for identical values.
  const scratchCur = useRef<Vec2[]>([]);
  const scratchDes = useRef<(Vec2 & { vel?: AgentVel })[]>([]);
  // elapsed at each agent's last waypoint advance (or release) — drives the
  // WALK_STALL_S liveness escape.
  const lastAdvance = useRef<number[]>([]);

  useEffect(() => {
    seg.current = agents.map(() => 0);
    elapsed.current = 0;
    firedRef.current = false;
    sitQueue.current = [];
    enqueued.current = new Set();
    activeSits.current = new Set();
    lastSitStart.current = -Infinity;
    releasedWalk.current = new Set();
    agentVel.current = agents.map(() => undefined);
    scratchCur.current = agents.map(() => ({ x: 0, z: 0 }));
    scratchDes.current = agents.map(() => ({ x: 0, z: 0, vel: undefined }));
    lastAdvance.current = agents.map(() => 0);
    headings.current = agents.map((a) => a.seat.faceY);
    setStage(agents.map(() => 'walk'));
    agents.forEach((a, i) => {
      const g = groups.current[i];
      if (!g) return;
      const s = a.path[0] ?? { x: 0, z: 0 };
      g.position.set(s.x, 0, s.z);
    });
    // Reduced motion renders everyone straight in the seated end-state (see the
    // JSX below — no walking groups, no sit clips) → settle immediately, and
    // the completion callback still fires.
    if (reducedRef.current && agents.length && !firedRef.current) {
      firedRef.current = true;
      onAllArrivedRef.current();
    }
  }, [agents]);

  // Reduced motion flipped ON mid-walk (slice-2 review fix): the frame loop
  // stops and the JSX renders everyone straight into seats — the completion
  // contract must STILL fire ("the flow always completes"). The single Walker
  // handles this case; without this effect the crowd's stage entries stay
  // 'walk' forever and onAllArrived never runs.
  useEffect(() => {
    if (!reduced || firedRef.current || !agents.length) return;
    firedRef.current = true;
    setStage(agents.map(() => 'done'));
    onAllArrivedRef.current();
  }, [reduced, agents]);

  // An agent's sit clip reached flush-seated: free its concurrency slot and
  // swap it to the plain seated figure. The controller unmounts on the stage
  // flip and its cleanup restores the instanced chair at the identical
  // transform — an invisible swap.
  const onAgentSeated = useCallback((i: number): void => {
    activeSits.current.delete(i);
    setStage((prev) => {
      if (prev[i] !== 'sit') return prev;
      const next = prev.slice();
      next[i] = 'done';
      return next;
    });
  }, []);

  // Every agent seated → hand the room back to the parent (which clears the
  // crowd for the per-seat SeatedAvatars). Effect, not frame loop: 'done' only
  // changes via setStage, so this runs exactly when it can newly become true.
  useEffect(() => {
    if (firedRef.current || !agents.length) return;
    if (stage.length === agents.length && stage.every((s) => s === 'done')) {
      firedRef.current = true;
      onAllArrivedRef.current();
    }
  }, [stage, agents]);

  useFrame((_, delta) => {
    if (reducedRef.current) return; // rendered straight into seats (JSX below)
    // A new agents array commits at layout time but the bookkeeping (seg,
    // scratch buffers, velocities) resets in a PASSIVE effect — a rAF frame
    // can land in between and index stale, wrong-length arrays. Sit that one
    // frame out; the choreography starts on the next.
    if (seg.current.length !== agents.length || scratchCur.current.length !== agents.length) return;
    elapsed.current += delta;
    const step = 2.0 * delta; // ~2 m/s walk
    // 0. Walk-slot release: grant entrance slots FIFO under the concurrency
    //    cap. An agent is mid-walk from release until it reaches its approach
    //    point (`enqueued`). startDelay ascends with index, so the first
    //    not-yet-due agent ends the scan.
    let midWalk = 0;
    for (const i of releasedWalk.current) if (!enqueued.current.has(i)) midWalk += 1;
    for (let i = 0; i < agents.length && midWalk < MAX_CONCURRENT_WALKERS; i++) {
      if (releasedWalk.current.has(i) || enqueued.current.has(i)) continue;
      if (elapsed.current < agents[i]!.startDelay) break;
      releasedWalk.current.add(i);
      lastAdvance.current[i] = elapsed.current; // the stall clock starts at release
      midWalk += 1;
    }
    // 1. Each WALKING agent steps toward its next waypoint → desired positions.
    //    Sitting/seated agents pin their seat position so walkers still give
    //    them a berth in the separation pass, but their transforms belong to
    //    the sit controller (or the static seated group) — never committed here.
    //    `curs` (frame-start positions) doubles as the base the committed
    //    velocity is measured against below. Both buffers are the persistent
    //    scratch arrays, written in place — the frame allocates nothing here.
    const curs = scratchCur.current;
    const desired = scratchDes.current;
    agents.forEach((a, i) => {
      const cur = curs[i]!;
      const des = desired[i]!;
      des.vel = undefined;
      if (stage[i] !== 'walk') {
        cur.x = a.seat.x;
        cur.z = a.seat.z;
        des.x = cur.x;
        des.z = cur.z;
        return;
      }
      const g = groups.current[i];
      const start = a.path[0] ?? { x: 0, z: 0 };
      cur.x = g ? g.position.x : start.x;
      cur.z = g ? g.position.z : start.z;
      des.x = cur.x;
      des.z = cur.z;
      des.vel = agentVel.current[i];
      if (!g || !releasedWalk.current.has(i)) return; // queued at the entrance
      const ci = seg.current[i]!;
      if (ci >= a.path.length - 1) return; // at the approach point
      const next = a.path[ci + 1]!;
      const dx = next.x - cur.x;
      const dz = next.z - cur.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        seg.current[i] = ci + 1;
        lastAdvance.current[i] = elapsed.current;
        des.x = next.x;
        des.z = next.z;
        return;
      }
      g.rotation.y = Math.atan2(dx, dz);
      des.x = cur.x + (dx / dist) * step;
      des.z = cur.z + (dz / dist) * step;
    });
    // 2. Make way for each other — predictively: each agent carries the
    //    velocity its LAST committed frame realised, so separateAgents can
    //    project the pair ahead and sidestep before contact. Agents with no
    //    history (first frame, pinned, sitting) go velocity-less → reactive-
    //    only, exactly the v1 behaviour. Past ~32 agents the engine culls
    //    candidate pairs through its own uniform grid (only nearby pairs are
    //    resolved — identical output, no full O(n²) sweep over a crowd where
    //    at most MAX_CONCURRENT_WALKERS agents actually move), and `delta`
    //    rides along so the predictive push is a per-second rate, not a
    //    per-frame impulse that quadruples at 120 Hz.
    const sep = separateAgents(desired, 0.5, delta);
    // 3. Each WALKING agent clears its OWN objects, then commit + advance the
    // gait. The old parent-group y-bob is retired — the kit rig's walkCyclePose
    // carries its own pelvis bob. The per-agent `+ i` offset (from the old bob)
    // survives in the phase so strides stay desynchronised across the crowd; a
    // stopped agent's phase simply freezes ("freeze on arrival", per the kit
    // contract) — which is also what a QUEUED agent holds while it waits for a
    // sit slot. Arrival at the approach point enqueues the agent exactly once.
    agents.forEach((a, i) => {
      if (stage[i] !== 'walk') {
        agentVel.current[i] = undefined; // sitting/seated → no projection
        return;
      }
      const g = groups.current[i];
      if (!g) return;
      // QUEUED agents are PINNED (slice-2 review fix): once enqueued they hold
      // the canonical approach point and skip the separation commit — in a
      // saturated queue (100+ guests, 8 sit slots) the make-way pass otherwise
      // shoves waiters off their spot, and the SitController's mount teleports
      // them back. They still occupy their pinned position in `desired`, so
      // walkers keep giving them a berth.
      if (enqueued.current.has(i)) {
        agentVel.current[i] = undefined; // pinned → stationary for prediction
        return;
      }
      const p = pushOutOfDiscs(sep[i]!, a.obstacles);
      // Record the velocity this commit realises (post-separation, post-clamp
      // — the agent's TRUE motion) for the next frame's predictive pass. m/s:
      // divided by delta, so a 30 Hz and a 120 Hz frame project identically.
      // The entry object is reused across frames (no per-frame allocation).
      const dt = Math.max(delta, 1e-4);
      const v = agentVel.current[i];
      if (v) {
        v.x = (p.x - curs[i]!.x) / dt;
        v.z = (p.z - curs[i]!.z) / dt;
      } else {
        agentVel.current[i] = { x: (p.x - curs[i]!.x) / dt, z: (p.z - curs[i]!.z) / dt };
      }
      g.position.x = p.x;
      g.position.z = p.z;
      const released = releasedWalk.current.has(i);
      const moving = released && seg.current[i]! < a.path.length - 1;
      if (moving && phases[i]) phases[i]!.current = (elapsed.current + i) * 8;
      // Liveness escapes (see WALK_ARRIVE_M / WALK_STALL_S): accept arrival
      // within a radius of the approach point, and force one waypoint of
      // progress past a push-vs-step equilibrium — a stalled walker must
      // never hold a MAX_CONCURRENT_WALKERS slot forever.
      if (moving) {
        const end = a.path[a.path.length - 1]!;
        if (Math.hypot(p.x - end.x, p.z - end.z) <= WALK_ARRIVE_M) {
          seg.current[i] = a.path.length - 1;
          lastAdvance.current[i] = elapsed.current;
        } else if (elapsed.current - (lastAdvance.current[i] ?? 0) > WALK_STALL_S) {
          seg.current[i] = seg.current[i]! + 1;
          lastAdvance.current[i] = elapsed.current;
        }
      }
      // seg is logical progress (advanced before separation), so a guest nudged
      // off the exact spot by make-way still counts as arrived — no hang. The
      // sit clip re-anchors at the canonical approach point anyway.
      if (released && seg.current[i]! >= a.path.length - 1 && !enqueued.current.has(i)) {
        enqueued.current.add(i);
        headings.current[i] = g.rotation.y;
        sitQueue.current.push(i);
        // Settle exactly onto the approach point at enqueue time — the last
        // step landed within one stride of it, so this reads as stopping, and
        // the later SitController mount starts from the identical transform.
        const end = a.path[a.path.length - 1];
        if (end) g.position.set(end.x, 0, end.z);
      }
    });
    // 4. Drain the sit queue under the concurrency budget: at most
    // MAX_ACTIVE_SITS clips live at once (each detaches a chair + mounts an
    // ActiveChair), starts spaced SIT_START_GAP_S apart. One start per frame at
    // most — the gap check re-arms only after lastSitStart moves.
    if (
      sitQueue.current.length > 0 &&
      activeSits.current.size < MAX_ACTIVE_SITS &&
      elapsed.current - lastSitStart.current >= SIT_START_GAP_S
    ) {
      const i = sitQueue.current.shift()!;
      activeSits.current.add(i);
      lastSitStart.current = elapsed.current;
      setStage((prev) => {
        if (prev[i] !== 'walk') return prev;
        const next = prev.slice();
        next[i] = 'sit';
        return next;
      });
    }
  });

  return (
    <group>
      {agents.map((a, i) => {
        const st: CrowdStage = stage[i] ?? 'walk';
        // Seated end-state — reduced motion renders it OUTRIGHT (snap, no sit
        // clip, callbacks fired in the reset effect above); a finished sit
        // holds it until the whole crowd settles. Transform-identical to both
        // the sit controller's flush handoff AND the per-seat SeatedAvatar
        // (chair point nudged FIGURE_NUDGE_M table-ward, facing the gaze), so
        // every swap along the chain is invisible.
        if (reduced || st === 'done') {
          const nx = a.seat.x + Math.sin(a.seat.faceY) * SIT_TIMING.FIGURE_NUDGE_M;
          const nz = a.seat.z + Math.cos(a.seat.faceY) * SIT_TIMING.FIGURE_NUDGE_M;
          return (
            <group key={a.id} position={[nx, 0, nz]} rotation={[0, a.seat.faceY, 0]}>
              <Figure spec={a.spec} pose="sit" quality={crowdQuality} name={a.name} />
            </group>
          );
        }
        // Live sit clip — the controller owns the figure + the detached chair.
        // The turn starts from the REAL walk-in heading captured at arrival.
        if (st === 'sit') {
          return (
            <SitController
              key={a.id}
              seat={a.seat}
              tableId={a.tableId}
              seatIndex={a.seatIndex}
              chairColor={chairColor}
              arriveHeading={headings.current[i]}
              {...(crowdQuality === 'high'
                ? // Arrival blend only at quality 'high': a 'low' figure never
                  // mounts the frame driver, so nothing eases — passing the
                  // frozen stride there would STATIC-BAKE an arbitrary sample
                  // the walk leg never painted (the walking 'low' crowd holds
                  // stride 0) and pop TWICE instead of once (review 2026-07-09).
                  { arrivePose: 'walk' as const, arrivePhase: phases[i]?.current ?? 0 }
                : {})}
              onSeated={() => onAgentSeated(i)}
            >
              {(pose, ph) => (
                <Figure spec={a.spec} pose={pose} phase={ph} quality={crowdQuality} name={a.name} />
              )}
            </SitController>
          );
        }
        return (
          <group
            key={a.id}
            ref={(el) => {
              groups.current[i] = el;
            }}
          >
            {/* The agent IS the guest — kit figure with their outfit / selfie /
                status spec, gait driven by this agent's own phase ref. */}
            <Figure spec={a.spec} pose="walk" phase={phases[i] ?? 0} quality={crowdQuality} name={a.name} />
          </group>
        );
      })}
    </group>
  );
}

// A guest walking between seats during a swap — a kit figure dressed with the
// guest's own spec (attire + selfie + status), so the swap animation moves the
// same person the seat showed. Calls onDone(gid, target) once it reaches the
// destination chair (the mover retires immediately, so no arrival stand pose
// is needed — the seated figure takes over on the next render).
function MoverToken({ mover, onDone, reduced }: { mover: Mover; onDone: (gid: string, target: SeatRef) => void; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const done = useRef(false);
  const t = useRef(0);
  // Gait phase — the mover's motion clock (the RUN cadence: this mover darts
  // at 2.6 m/s) feeds the rig's run cycle via a ref (no re-renders).
  const phase = useRef(0);
  const start = mover.path[0] ?? { x: 0, z: 0 };
  // Mirror into a ref so the useFrame loop reads the live value (no hook in loop).
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const path = mover.path;
    if (reducedRef.current) {
      // Reduced motion: jump straight to the destination seat (no glide/bob)
      // and complete the flow — onDone commits the new seat + retires the mover.
      if (path.length > 0) {
        const end = path[path.length - 1]!;
        g.position.set(end.x, 0, end.z);
      }
      if (!done.current) {
        done.current = true;
        onDone(mover.gid, mover.target);
      }
      return;
    }
    if (done.current || idx.current >= path.length - 1) {
      if (!done.current) {
        done.current = true;
        onDone(mover.gid, mover.target);
      }
      return;
    }
    const next = path[idx.current + 1]!;
    const dx = next.x - g.position.x;
    const dz = next.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const step = 2.6 * delta;
    if (dist <= step) {
      g.position.x = next.x;
      g.position.z = next.z;
      idx.current += 1;
    } else {
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
    }
    // The old parent-group y-bob is retired — runCyclePose bobs the pelvis.
    phase.current = t.current * RUN_CLOCK_RAD_S;
  });
  return (
    <group ref={ref} position={[start.x, 0, start.z]}>
      <Figure spec={mover.spec} pose="run" phase={phase} name={mover.name} />
    </group>
  );
}

// A guest out on the dance floor. Walks its path exactly like a MoverToken, then
// on arrival SWITCHES to the looping dance clip and holds `spot` + `faceY`
// forever (unlike a Mover it never re-seats — its seat is untouched, so removing
// it from `dancers` restores the static SeatedAvatar for free). Tap it to send
// it home (onReturn). The walk→dance pose switch eases through <Figure>'s generic
// preset blend; the dance clip is wall-clock driven inside <Figure>. Reduced
// motion: snap to the spot, then hold the STATIC dance pose (<Figure> bakes
// dancePose t=0) — the figure still walked onto the floor, so the flow completes.
function DancerToken({ dancer, reduced, onReturn }: { dancer: Dancer; reduced: boolean; onReturn: (gid: string) => void }) {
  const ref = useRef<THREE.Group | null>(null);
  const inited = useRef(false);
  const idx = useRef(0);
  const t = useRef(0);
  const phase = useRef(0);
  const [dancing, setDancing] = useState(false);
  const dancingRef = useRef(false);
  const start = dancer.path[0] ?? dancer.spot;
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  // Position is driven IMPERATIVELY (mount-init here, then useFrame / arrive) —
  // NOT via a declarative `position` prop. This component re-renders every time
  // a sibling dancer is added (the panel isn't memoised), and a per-render
  // position array would re-apply and teleport a mid-walk dancer back to its
  // path start. A stable ref callback (start is per-dancer constant) sets the
  // spawn point exactly once. Mirrors MoverToken's imperative motion.
  const attach = useCallback(
    (g: THREE.Group | null) => {
      ref.current = g;
      if (g && !inited.current) {
        inited.current = true;
        g.position.set(start.x, 0, start.z);
      }
    },
    [start.x, start.z],
  );
  // Reach the floor: snap to the spot, face the floor centre, flip to the dance
  // clip. Latched so it fires once even as re-renders remount the frame loop.
  const arrive = useCallback(() => {
    if (dancingRef.current) return;
    dancingRef.current = true;
    const g = ref.current;
    if (g) {
      g.position.set(dancer.spot.x, 0, dancer.spot.z);
      g.rotation.y = dancer.faceY;
    }
    setDancing(true);
  }, [dancer.spot.x, dancer.spot.z, dancer.faceY]);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g || dancingRef.current) return; // arrived → <Figure> owns the dance motion
    t.current += delta;
    const path = dancer.path;
    // Reduced motion: jump straight to the spot and start dancing (the static
    // dance pose bakes inside <Figure>) — the flow completes without the glide.
    if (reducedRef.current) {
      arrive();
      return;
    }
    if (idx.current >= path.length - 1) {
      arrive();
      return;
    }
    const next = path[idx.current + 1]!;
    const dx = next.x - g.position.x;
    const dz = next.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const step = 2.6 * delta;
    if (dist <= step) {
      g.position.x = next.x;
      g.position.z = next.z;
      idx.current += 1;
    } else {
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
    }
    // RUN cadence — the dancer darts to the floor at 2.6 m/s (this clock was
    // still the pre-kit ×9; retuned with the ChameleonMovement port 2026-07-09).
    phase.current = t.current * RUN_CLOCK_RAD_S;
  });
  return (
    <group
      ref={attach}
      onClick={(e) => {
        if (e.delta > 4) return; // drag, not a tap
        e.stopPropagation(); // don't let the floor catcher also send a NEW dancer
        onReturn(dancer.gid);
      }}
    >
      <Figure spec={dancer.spec} pose={dancing ? 'dance' : 'run'} phase={phase} name={dancer.name} />
    </group>
  );
}

/* ---------------------- Game-pad walk controls (Play) -------------------- */

type WalkInput = { moveX: number; moveZ: number; lookDX: number; lookDY: number; pinch: number };

/**
 * First-person "walk the room" camera, driven by the on-screen sticks (owner
 * 2026-06-26: "left circle walks, right sets the camera angle, pinch zooms").
 * Reads the shared `input` ref each frame: left stick → move (relative to look
 * via the unit-tested walkVector), right pad → yaw/pitch, pinch → FOV. Reuses
 * pushOutOfDiscs — against the pre-hashed ObstacleGrid of true table
 * footprints + chairs + fixtures — so you can't walk through tables, chairs,
 * seated guests, or a banquet's corner. Renders nothing — it just drives the
 * existing camera while `active`; CameraRig is unmounted then.
 */
function WalkController({
  active,
  input,
  room,
  entrance,
  obstacles,
}: {
  active: boolean;
  input: React.MutableRefObject<WalkInput>;
  room: { w: number; d: number };
  /** Entrance point (world m) — null when the couple disabled the doorway. */
  entrance: Vec2 | null;
  obstacles: ObstacleDisc[] | ObstacleGrid;
}) {
  const { camera } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(-0.06);
  const pos = useRef(new THREE.Vector3());
  const inited = useRef(false);

  useEffect(() => {
    if (!active) inited.current = false;
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const cam = camera as THREE.PerspectiveCamera;
    if (!inited.current) {
      // Drop in INSIDE the room (walkSpawnPoint): keep the camera's spot when
      // it's already in the rectangle, otherwise step in just inside the
      // entrance (or clamp in) — the orbit camera can be 15–30 m out at max
      // zoom, and spawning there put the walker in the black void. Eye
      // height, facing the room centre from wherever the spawn landed.
      const spawn = walkSpawnPoint(
        { x: camera.position.x, z: camera.position.z },
        room,
        entrance,
        obstacles,
      );
      pos.current.set(spawn.x, 1.6, spawn.z);
      yaw.current = Math.atan2(-spawn.x, -spawn.z);
      pitch.current = -0.06;
      inited.current = true;
    }
    // Right pad → look. Deltas are consumed (zeroed) each frame.
    yaw.current -= input.current.lookDX * 0.004;
    pitch.current = Math.max(-1.25, Math.min(0.5, pitch.current - input.current.lookDY * 0.004));
    input.current.lookDX = 0;
    input.current.lookDY = 0;
    // Pinch → FOV zoom.
    if (input.current.pinch !== 0) {
      cam.fov = Math.max(28, Math.min(72, cam.fov - input.current.pinch * 0.04));
      cam.updateProjectionMatrix();
      input.current.pinch = 0;
    }
    // Left stick → walk, relative to look; clear tables/stage; stay near the room.
    const speed = 3.4 * delta;
    const v = walkVector(yaw.current, input.current.moveX, -input.current.moveZ);
    const cleared = pushOutOfDiscs({ x: pos.current.x + v.dx * speed, z: pos.current.z + v.dz * speed }, obstacles);
    const lim = Math.max(room.w, room.d) * 1.6;
    pos.current.x = Math.max(-lim, Math.min(lim, cleared.x));
    pos.current.z = Math.max(-lim, Math.min(lim, cleared.z));
    pos.current.y = 1.6;
    camera.position.copy(pos.current);
    const cp = Math.cos(pitch.current);
    camera.lookAt(
      pos.current.x + Math.sin(yaw.current) * cp,
      pos.current.y + Math.sin(pitch.current),
      pos.current.z + Math.cos(yaw.current) * cp,
    );
  });

  return null;
}

/** Left on-screen joystick → input.moveX / moveZ (−1..1), springs back on release. */
function WalkStick({ input }: { input: React.MutableRefObject<WalkInput> }) {
  const base = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const [nub, setNub] = useState({ x: 0, y: 0 });
  const R = 46;
  const track = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId || !base.current) return;
    const b = base.current.getBoundingClientRect();
    let dx = e.clientX - (b.left + b.width / 2);
    let dy = e.clientY - (b.top + b.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setNub({ x: dx, y: dy });
    input.current.moveX = dx / R;
    input.current.moveZ = dy / R;
  };
  const release = () => {
    id.current = null;
    setNub({ x: 0, y: 0 });
    input.current.moveX = 0;
    input.current.moveZ = 0;
  };
  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        id.current = e.pointerId;
        (e.target as Element).setPointerCapture(e.pointerId);
        track(e);
      }}
      onPointerMove={track}
      onPointerUp={release}
      onPointerCancel={release}
      className="absolute bottom-6 left-6 z-20 flex h-28 w-28 touch-none items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md"
      aria-label="Walk joystick"
    >
      <div className="h-12 w-12 rounded-full bg-white/45" style={{ transform: `translate(${nub.x}px, ${nub.y}px)` }} />
    </div>
  );
}

/** Right-half drag → input.lookDX / lookDY (camera angle). */
function LookPad({ input }: { input: React.MutableRefObject<WalkInput> }) {
  const id = useRef<number | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinchLast = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId || !last.current) return;
    input.current.lookDX += e.clientX - last.current.x;
    input.current.lookDY += e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const release = () => {
    id.current = null;
    last.current = null;
  };
  // Two-finger pinch → input.pinch (WalkController turns it into FOV zoom).
  // Look is suspended while pinching so a stray finger doesn't yank the camera.
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
      if (pinchLast.current != null) input.current.pinch += d - pinchLast.current;
      pinchLast.current = d;
      last.current = null;
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchLast.current = null;
  };
  return (
    <div
      onPointerDown={(e) => {
        id.current = e.pointerId;
        last.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="absolute inset-y-0 right-0 z-10 w-1/2 touch-none"
      aria-label="Look around"
    />
  );
}

/* ------------------------------ Seating rules ----------------------------- */

/** The "custom auto-seat rules" panel — keep-apart pairs + the tier order the
 *  solver fills in. Collapsible; both edits persist server-side (DB-only). */
function RulesPanel({
  keepApart,
  priorityOrder,
  guests,
  canEdit,
  onAddKeepApart,
  onRemoveKeepApart,
  onReorderPriority,
}: {
  keepApart: KeepApartRule[];
  priorityOrder: PriorityOrder;
  guests: Lab3DGuest[];
  canEdit: boolean;
  onAddKeepApart: (aId: string, bId: string) => void;
  onRemoveKeepApart: (rule: KeepApartRule) => void;
  onReorderPriority: (from: number, to: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const nameById = useMemo(() => new Map(guests.map((g) => [g.id, g.name])), [guests]);
  const selectCls =
    'min-w-0 flex-1 rounded-lg border border-white/15 bg-ink/50 px-1.5 py-1 text-xs text-white disabled:opacity-40';
  return (
    <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-medium text-white/85"
      >
        <span>Seating rules</span>
        <span className="text-white/50">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-white/50">Keep apart</p>
            <div className="flex gap-1.5">
              <select value={a} disabled={!canEdit} onChange={(e) => setA(e.target.value)} aria-label="Keep-apart guest one" className={selectCls}>
                <option value="" className="text-ink">Guest…</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id} className="text-ink">{g.name}</option>
                ))}
              </select>
              <select value={b} disabled={!canEdit} onChange={(e) => setB(e.target.value)} aria-label="Keep-apart guest two" className={selectCls}>
                <option value="" className="text-ink">Guest…</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id} className="text-ink">{g.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!canEdit || !a || !b || a === b}
                onClick={() => {
                  onAddKeepApart(a, b);
                  setA('');
                  setB('');
                }}
                className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <ul className="mt-1.5 space-y-1">
              {keepApart.length === 0 ? (
                <li className="text-[11px] text-white/45">No rules yet — auto-seat won’t separate anyone.</li>
              ) : (
                keepApart.map((r, i) => (
                  <li key={`${r.guest_a_id}-${r.guest_b_id}-${i}`} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/80">
                    <span className="truncate">{nameById.get(r.guest_a_id) ?? '—'} ⇹ {nameById.get(r.guest_b_id) ?? '—'}</span>
                    {canEdit ? (
                      <button type="button" onClick={() => onRemoveKeepApart(r)} aria-label="Remove keep-apart rule" className="shrink-0 px-1 text-white/50 hover:text-white">✕</button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-white/50">Seat in this order</p>
            <ul className="space-y-1">
              {priorityOrder.map((t, i) => (
                <li key={t.tier} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/80">
                  <span className="truncate">{i + 1}. {t.label}</span>
                  {canEdit ? (
                    <span className="flex shrink-0 gap-0.5">
                      <button type="button" disabled={i === 0} onClick={() => onReorderPriority(i, i - 1)} aria-label="Move up" className="px-1 text-white/50 hover:text-white disabled:opacity-30">↑</button>
                      <button type="button" disabled={i === priorityOrder.length - 1} onClick={() => onReorderPriority(i, i + 1)} aria-label="Move down" className="px-1 text-white/50 hover:text-white disabled:opacity-30">↓</button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Floor designer ---------------------------- */

/** The "make full use of the venue" panel — move + resize the stage and dance
 *  floor, toggle the dance floor + entrance. "Move" arms a tap-to-place: the
 *  next floor tap drops that element. Collapsible; all edits persist. */
function FloorPanel({
  danceEnabled,
  entranceEnabled,
  placeZone,
  canEdit,
  onMoveZone,
  onResizeZone,
  onToggleDance,
  onToggleEntrance,
}: {
  danceEnabled: boolean;
  entranceEnabled: boolean;
  placeZone: 'stage' | 'dance' | 'entrance' | null;
  canEdit: boolean;
  onMoveZone: (zone: 'stage' | 'dance' | 'entrance') => void;
  onResizeZone: (zone: 'stage' | 'dance', dW: number, dD: number) => void;
  onToggleDance: () => void;
  onToggleEntrance: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  const moveBtn = (zone: 'stage' | 'dance' | 'entrance', label: string) => (
    <button
      type="button"
      onClick={() => onMoveZone(zone)}
      className={`rounded-lg px-2 py-1 text-xs transition ${
        placeZone === zone ? 'bg-amber-400/30 text-white ring-1 ring-amber-300/60' : 'bg-white/10 text-white/85 hover:bg-white/20'
      }`}
    >
      {placeZone === zone ? 'Tap the floor…' : label}
    </button>
  );
  const sizeRow = (zone: 'stage' | 'dance') => (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-white/60">
      <span className="w-8">W</span>
      <button type="button" onClick={() => onResizeZone(zone, -3, 0)} className="rounded bg-white/10 px-1.5 text-white hover:bg-white/20">−</button>
      <button type="button" onClick={() => onResizeZone(zone, 3, 0)} className="rounded bg-white/10 px-1.5 text-white hover:bg-white/20">+</button>
      <span className="ml-2 w-8">D</span>
      <button type="button" onClick={() => onResizeZone(zone, 0, -3)} className="rounded bg-white/10 px-1.5 text-white hover:bg-white/20">−</button>
      <button type="button" onClick={() => onResizeZone(zone, 0, 3)} className="rounded bg-white/10 px-1.5 text-white hover:bg-white/20">+</button>
    </div>
  );
  return (
    <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-xs font-medium text-white/85">
        <span>Floor &amp; stage</span>
        <span className="text-white/50">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-white/50">Stage</p>
            {moveBtn('stage', 'Move stage')}
            {sizeRow('stage')}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-white/50">Dance floor</span>
              <button type="button" onClick={onToggleDance} className={`rounded-lg px-2 py-0.5 text-[11px] transition ${danceEnabled ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                {danceEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {danceEnabled ? (
              <>
                {moveBtn('dance', 'Move dance floor')}
                {sizeRow('dance')}
              </>
            ) : null}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-white/50">Entrance</span>
              <button type="button" onClick={onToggleEntrance} className={`rounded-lg px-2 py-0.5 text-[11px] transition ${entranceEnabled ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                {entranceEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {entranceEnabled ? moveBtn('entrance', 'Move entrance') : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------- Direct zone drag (3D) --------------------------- */

// Invisible drag grips over the stage / dance floor / entrance (owner 2026-07-17
// · universal draggability). A pointer-down starts the direct zone drag; the
// floor catcher's onFloorMove then drives it and release confirms-on-drop. The
// pads float just above the floor so the ray reaches them before the ground
// catcher. Only mounted in Build + editable (the parent gates that).
function ZoneDragGrips({
  floor,
  room,
  onGripDown,
  activeZone,
}: {
  floor: Lab3DFloor;
  room: { w: number; d: number };
  onGripDown: (zone: 'stage' | 'dance' | 'entrance') => void;
  activeZone: 'stage' | 'dance' | 'entrance' | null;
}) {
  const zones: Array<{ key: 'stage' | 'dance' | 'entrance'; xPct: number; yPct: number; wPct: number; hPct: number }> = [
    { key: 'stage', xPct: floor.stage.xPct, yPct: floor.stage.yPct, wPct: floor.stage.wPct, hPct: floor.stage.hPct },
  ];
  if (floor.dance.enabled)
    zones.push({ key: 'dance', xPct: floor.dance.xPct, yPct: floor.dance.yPct, wPct: floor.dance.wPct, hPct: floor.dance.hPct });
  if (floor.entrance.enabled)
    zones.push({ key: 'entrance', xPct: floor.entrance.xPct, yPct: floor.entrance.yPct, wPct: 8, hPct: 8 });
  return (
    <>
      {zones.map((z) => {
        const c = pctToWorld(z.xPct, z.yPct, room);
        const w = Math.max(0.9, (z.wPct / 100) * room.w);
        const d = Math.max(0.9, (z.hPct / 100) * room.d);
        return (
          <mesh
            key={z.key}
            position={[c.x, 0.5, c.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onGripDown(z.key);
            }}
          >
            <planeGeometry args={[w, d]} />
            {/* Near-zero opacity so the pad is invisible but still ray-picked. */}
            <meshBasicMaterial transparent opacity={activeZone === z.key ? 0 : 0.001} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

// The live preview ring for a zone drag — follows the drag position (read from a
// ref in useFrame → zero React churn), GOLD when the release would be valid,
// warm-RED while it would be refused. The zone itself jumps to the confirmed
// spot on release (the tables' per-frame ring, applied to zones).
function ZoneDragPreview({
  posRef,
  validRef,
}: {
  posRef: React.MutableRefObject<{ zone: 'stage' | 'dance' | 'entrance'; x: number; z: number } | null>;
  validRef: React.MutableRefObject<boolean>;
}) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const colors = useMemo(() => ({ ok: new THREE.Color('#d8b45a'), bad: new THREE.Color('#d9534f') }), []);
  useFrame(() => {
    const g = ref.current;
    const p = posRef.current;
    if (!g || !p) return;
    g.position.set(p.x, 0.08, p.z);
    if (matRef.current) matRef.current.color.copy(validRef.current ? colors.ok : colors.bad);
  });
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.95, 40]} />
        <meshBasicMaterial ref={matRef} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------- HUD (2D) -------------------------------- */

function Hud({
  viewSegment,
  mode,
  setMode,
  canEdit,
  lockStatus,
  onTakeOver,
  notice,
  staleDirty,
  onDismissNotice,
  onAddTable,
  onAutoSeat,
  onBuildDraft,
  onFillLocked,
  onAutoArrange,
  danceEnabled,
  entranceEnabled,
  placeZone,
  onMoveZone,
  onResizeZone,
  onToggleDance,
  onToggleEntrance,
  onRotate,
  onDelete,
  onRenameTable,
  onSeatTier,
  onUnseat,
  keepApart,
  priorityOrder,
  onAddKeepApart,
  onRemoveKeepApart,
  onReorderPriority,
  onCyclePriority,
  priorityOverride,
  groups,
  placingGroupId,
  onPickGroup,
  onCancelGroup,
  showCloth,
  setShowCloth,
  showAccents,
  setShowAccents,
  paletteKey,
  setPaletteKey,
  guests,
  seats,
  seatedCount,
  onGuestTap,
  crowdActive,
  onWalkEveryone,
  onClearCrowd,
  dancingCount,
  onClearFloor,
  placingGuestName,
  placingGuestId,
  onSeatAnywhere,
  onCancelPlacing,
  swapSelId,
  tableSwapArmed,
  onToggleTableSwap,
  walker,
  arrived,
  selectedId,
  selectedLabel,
  selectedType,
  onChangeType,
  selectedLinked,
  onBreakApart,
  onPublish,
  printHref,
  tableCount,
}: {
  viewSegment: ReactNode;
  mode: 'build' | 'play';
  setMode: (m: 'build' | 'play') => void;
  canEdit: boolean;
  lockStatus: string;
  onTakeOver: () => void;
  notice: string | null;
  staleDirty: boolean;
  onDismissNotice: () => void;
  onAddTable: () => void;
  onAutoSeat: () => void;
  onBuildDraft: () => void;
  onFillLocked: () => void;
  onAutoArrange: () => void;
  danceEnabled: boolean;
  entranceEnabled: boolean;
  placeZone: 'stage' | 'dance' | 'entrance' | null;
  onMoveZone: (zone: 'stage' | 'dance' | 'entrance') => void;
  onResizeZone: (zone: 'stage' | 'dance', dW: number, dD: number) => void;
  onToggleDance: () => void;
  onToggleEntrance: () => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  onRenameTable: (label: string) => void;
  onSeatTier: (tier: 1 | 2 | 3 | 4) => void;
  onUnseat: (guestId: string) => void;
  keepApart: KeepApartRule[];
  priorityOrder: PriorityOrder;
  onAddKeepApart: (aId: string, bId: string) => void;
  onRemoveKeepApart: (rule: KeepApartRule) => void;
  onReorderPriority: (from: number, to: number) => void;
  onCyclePriority: (guestId: string, current: number | null) => void;
  priorityOverride: Map<string, number | null>;
  groups: Lab3DGroup[];
  placingGroupId: string | null;
  onPickGroup: (groupId: string) => void;
  onCancelGroup: () => void;
  showCloth: boolean;
  setShowCloth: (v: boolean) => void;
  showAccents: boolean;
  setShowAccents: (v: boolean) => void;
  paletteKey: string;
  setPaletteKey: (k: string) => void;
  guests: Lab3DGuest[];
  seats: Map<string, SeatRef>;
  seatedCount: number;
  onGuestTap: (g: Lab3DGuest) => void;
  crowdActive: boolean;
  onWalkEveryone: () => void;
  onClearCrowd: () => void;
  dancingCount: number;
  onClearFloor: () => void;
  placingGuestName: string | null;
  placingGuestId: string | null;
  onSeatAnywhere: () => void;
  onCancelPlacing: () => void;
  swapSelId: string | null;
  tableSwapArmed: boolean;
  onToggleTableSwap: () => void;
  walker: WalkerState;
  arrived: string | null;
  selectedId: string | null;
  selectedLabel: string | null;
  selectedType: string | null;
  onChangeType: (newType: string) => void;
  selectedLinked: boolean;
  onBreakApart: () => void;
  onPublish: () => void;
  printHref: string;
  tableCount: number;
}) {
  const glass =
    'rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md text-white shadow-lg';
  // Two-tap confirm for the destructive auto-arrange (re-tidies every table).
  const [confirmArrange, setConfirmArrange] = useState(false);
  return (
    <>
      {/* Top bar: the LIST | 2D | 3D view segment STACKED above the mode toggle
          (owner 2026-07-17 · chrome overlap fix) so they never crowd each other,
          + the prototype badge on the right. The left column below starts at
          top-28 to clear this two-row stack at every viewport size. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-none flex flex-col items-start gap-2">
          {viewSegment ? <div className="pointer-events-auto">{viewSegment}</div> : null}
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
        </div>
        <div className={`pointer-events-auto px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider ${glass} ${canEdit ? 'text-white/80' : 'text-amber-200'}`}>
          {canEdit ? 'Editing · saves to 2D' : lockStatus === 'acquiring' ? 'Connecting…' : 'View only'}
        </div>
      </div>

      {/* Decor toggles — apply tablecloths + centerpieces "if requested" */}
      <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 gap-1.5">
        <button
          type="button"
          onClick={() => setShowCloth(!showCloth)}
          className={`rounded-xl border border-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-md transition ${showCloth ? 'bg-white text-ink' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}
        >
          Tablecloths
        </button>
        <button
          type="button"
          onClick={() => setShowAccents(!showAccents)}
          className={`rounded-xl border border-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur-md transition ${showAccents ? 'bg-white text-ink' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}
        >
          Centerpieces
        </button>
      </div>

      {/* Unsaved-2D-changes banner (Sync verdict § 5 · GUN C door audit —
          visible, never silent staleness at every door into the lab) */}
      {staleDirty ? (
        <div className={`pointer-events-none absolute left-1/2 top-28 flex -translate-x-1/2 items-center gap-3 px-4 py-2 text-sm text-amber-100 ${glass}`}>
          <span>Unsaved 2D changes aren&rsquo;t shown here — return to the editor to save.</span>
        </div>
      ) : null}

      {/* Save-error / view-only notice */}
      {notice ? (
        <div className={`pointer-events-auto absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-3 px-4 py-2 text-sm text-amber-100 ${glass}`}>
          <span>{notice}</span>
          <button type="button" onClick={onDismissNotice} aria-label="Dismiss notice" className="text-white/60 hover:text-white"><span aria-hidden>✕</span></button>
        </div>
      ) : null}

      {/* RSVP seat legend (hidden while a walker toast is showing) */}
      {!walker ? (
        <div className={`pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 px-3 py-2 text-[11px] text-white/85 ${glass}`}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.both }} />Confirmed</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TENTATIVE_COLOR }} />Pending / maybe</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PLUS_ONE_COLOR, opacity: 0.5 }} />+1 held</span>
        </div>
      ) : null}

      {/* Left: guest list (Play) or build controls (Build) */}
      <div className="absolute bottom-4 left-4 top-28 flex w-64 flex-col gap-3">
        {mode === 'build' ? (
          <div className={`p-3 ${glass}`}>
            <p className="mb-2 text-sm font-medium">Build</p>
            {!canEdit ? (
              <div className="mb-2 rounded-xl bg-amber-400/15 p-2.5 text-xs leading-relaxed text-amber-100">
                {lockStatus === 'acquiring' ? 'Connecting…' : 'Viewing only — another editor may be open.'}
                {lockStatus !== 'acquiring' ? (
                  <button type="button" onClick={onTakeOver} className="mt-1.5 block w-full rounded-lg bg-white/90 px-2 py-1.5 font-medium text-ink hover:bg-white">
                    {lockStatus === 'stale_takeover_available' ? 'Take over editing' : 'Start editing'}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                {tableCount === 0 ? (
                  <button
                    type="button"
                    onClick={onBuildDraft}
                    className="mb-2 w-full rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-ink transition hover:bg-white"
                  >
                    Start my seating
                  </button>
                ) : null}
                <div className="mb-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={onAddTable}
                    className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    + Add a table
                  </button>
                  <button
                    type="button"
                    onClick={onAutoSeat}
                    className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    Auto-seat
                  </button>
                </div>
                {tableCount > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={onFillLocked}
                      className="mb-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                    >
                      Fill around locked seats
                    </button>
                    {confirmArrange ? (
                      <div className="mb-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmArrange(false);
                            onAutoArrange();
                          }}
                          className="flex-1 rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-ink transition hover:bg-white"
                        >
                          Re-tidy all · confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmArrange(false)}
                          className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmArrange(true)}
                        className="mb-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                      >
                        Auto-arrange tables
                      </button>
                    )}
                  </>
                ) : null}
              </>
            )}
            {canEdit && groups.length > 0 ? (
              <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
                <p className="mb-1.5 text-xs font-medium text-white/85">
                  {placingGroupId ? 'Tap a table to seat the group' : 'Seat a group'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((gr) => {
                    const picked = placingGroupId === gr.id;
                    return (
                      <button
                        key={gr.id}
                        type="button"
                        onClick={() => onPickGroup(gr.id)}
                        className={`rounded-lg px-2 py-1 text-xs transition ${
                          picked
                            ? 'bg-amber-400/30 text-white ring-1 ring-amber-300/60'
                            : 'bg-white/10 text-white/85 hover:bg-white/20'
                        }`}
                      >
                        {gr.label} · {gr.memberCount}
                      </button>
                    );
                  })}
                  {placingGroupId ? (
                    <button type="button" onClick={onCancelGroup} className="rounded-lg px-2 py-1 text-xs text-white/55 hover:text-white">
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedLabel ? (
              <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
                <input
                  key={selectedId}
                  defaultValue={selectedLabel}
                  disabled={!canEdit}
                  maxLength={64}
                  aria-label="Table name"
                  onBlur={(e) => onRenameTable(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="mb-1.5 w-full truncate rounded-lg bg-transparent px-1 py-0.5 text-xs font-medium text-white/85 outline-none focus:bg-white/10 disabled:opacity-60"
                />
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={!canEdit} onClick={() => onRotate(-15)} aria-label="Rotate left" className="flex-1 rounded-lg bg-white/10 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-40">⟲</button>
                  <button type="button" disabled={!canEdit} onClick={() => onRotate(15)} aria-label="Rotate right" className="flex-1 rounded-lg bg-white/10 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-40">⟳</button>
                  <button type="button" disabled={!canEdit} onClick={onDelete} className="flex-1 rounded-lg bg-danger-500/30 py-1.5 text-sm text-white hover:bg-danger-500/50 disabled:opacity-40">Delete</button>
                </div>
                <select
                  value={selectedType ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => onChangeType(e.target.value)}
                  aria-label="Table type"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink/50 px-2 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  {TABLE_TYPE_CATALOG.map((t) => (
                    <option key={t.type} value={t.type} className="text-ink">
                      {t.label}
                    </option>
                  ))}
                </select>
                {/* §4 — seated-guard copy (parity with the 2D shape picker): a
                    shape change resets capacity, and guests in chairs the new
                    shape lacks return to the unseated pool. */}
                <p className="mt-1 text-[10px] leading-snug text-white/45">
                  Changing shape resets seats — anyone in a chair the new shape doesn&apos;t have goes back to unseated.
                </p>
                <select
                  value=""
                  disabled={!canEdit}
                  onChange={(e) => {
                    const tier = Number(e.target.value);
                    if (tier >= 1 && tier <= 4) onSeatTier(tier as 1 | 2 | 3 | 4);
                    e.target.value = '';
                  }}
                  aria-label="Seat a role tier at this table"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink/50 px-2 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  <option value="" className="text-ink">Seat a tier here…</option>
                  {([1, 2, 3, 4] as const).map((tier) => (
                    <option key={tier} value={tier} className="text-ink">
                      {ROLE_TIER_LABELS[tier]}
                    </option>
                  ))}
                </select>
                {/* §6.1 — "Link to another table" (creator UI for a removed
                    feature, owner 2026-07-16) is DELETED. Break apart stays for
                    legacy groups; the linkTables action is untouched. */}
                {canEdit && selectedLinked ? (
                  <button
                    type="button"
                    onClick={onBreakApart}
                    className="mt-1.5 w-full rounded-lg bg-white/10 py-1.5 text-sm text-white transition hover:bg-white/20"
                  >
                    Break apart
                  </button>
                ) : null}
                {canEdit ? (
                  <p className="mt-1.5 text-[10px] leading-snug text-white/45">Tap a chair to remove or restore it.</p>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-white/70">
              {canEdit ? 'Tap a table to select · drag to slide it. ' : ''}Drag empty space to orbit ·
              scroll to zoom.
            </p>
            <FloorPanel
              danceEnabled={danceEnabled}
              entranceEnabled={entranceEnabled}
              placeZone={placeZone}
              canEdit={canEdit}
              onMoveZone={onMoveZone}
              onResizeZone={onResizeZone}
              onToggleDance={onToggleDance}
              onToggleEntrance={onToggleEntrance}
            />
            <RulesPanel
              keepApart={keepApart}
              priorityOrder={priorityOrder}
              guests={guests}
              canEdit={canEdit}
              onAddKeepApart={onAddKeepApart}
              onRemoveKeepApart={onRemoveKeepApart}
              onReorderPriority={onReorderPriority}
            />
            <p className="mt-2 text-[11px] text-white/50">{tableCount} tables</p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                disabled={!canEdit}
                onClick={onPublish}
                className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                Publish
              </button>
              <a
                href={printHref}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-center text-sm font-medium text-white transition hover:bg-white/20"
              >
                Print pack
              </a>
            </div>
          </div>
        ) : (
          <div className={`flex min-h-0 flex-1 flex-col p-3 ${glass}`}>
            <p className="mb-1 text-sm font-medium">Guests</p>
            {placingGuestName ? (
              <div className="mb-2 rounded-xl bg-amber-400/15 p-2.5 text-xs leading-relaxed text-amber-100">
                <p className="font-medium">Placing {placingGuestName}</p>
                <p className="mt-0.5 text-amber-100/80">Tap a table to seat them there.</p>
                <div className="mt-1.5 flex gap-1.5">
                  <button type="button" onClick={onSeatAnywhere} className="flex-1 rounded-lg bg-white/90 px-2 py-1 font-medium text-ink hover:bg-white">
                    Seat anywhere
                  </button>
                  <button type="button" onClick={onCancelPlacing} className="flex-1 rounded-lg bg-white/10 px-2 py-1 font-medium text-white hover:bg-white/20">
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            <p className="mb-2 text-[11px] text-white/60">
              {placingGuestName
                ? `Tap a table to seat ${placingGuestName}`
                : swapSelId
                  ? 'Tap another seated guest to swap'
                  : `${seatedCount} seated · tap an empty guest to pick them up, then a table · tap two seated to swap`}
            </p>
            <button
              type="button"
              onClick={onToggleTableSwap}
              className={`mb-2 w-full rounded-xl border border-white/15 px-3 py-1.5 text-sm font-medium transition ${
                tableSwapArmed ? 'bg-white text-ink' : 'bg-white/10 text-white/85 hover:bg-white/20'
              }`}
            >
              {tableSwapArmed ? 'Tap two tables to swap…' : 'Swap two tables'}
            </button>
            <button
              type="button"
              onClick={crowdActive ? onClearCrowd : onWalkEveryone}
              disabled={seatedCount === 0}
              className={`mb-2 w-full rounded-xl border border-white/15 px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                crowdActive ? 'bg-white text-ink' : 'bg-white/10 text-white/85 hover:bg-white/20'
              }`}
            >
              {crowdActive ? 'Clear the room' : 'Walk everyone in'}
            </button>
            {dancingCount > 0 ? (
              <button
                type="button"
                onClick={onClearFloor}
                className="mb-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/85 transition hover:bg-white/20"
              >
                Sit everyone down · {dancingCount} dancing
              </button>
            ) : danceEnabled ? (
              <p className="mb-2 text-[11px] text-white/50">Tap the dance floor to send a guest out to dance.</p>
            ) : null}
            <div className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
              {guests.length === 0 ? (
                <p className="text-xs text-white/55">No guests yet.</p>
              ) : (
                guests.map((g) => {
                  const seated = seats.has(g.id);
                  const selected = swapSelId === g.id;
                  const placing = placingGuestId === g.id;
                  // Effective priority = optimistic overlay (if any) else server truth.
                  const pr = priorityOverride.has(g.id) ? priorityOverride.get(g.id) ?? null : g.seatingPriority;
                  return (
                    <div
                      key={g.id}
                      className={`flex w-full items-center justify-between rounded-lg pr-1 text-left text-sm text-white/90 transition ${
                        placing
                          ? 'bg-amber-400/25 ring-1 ring-amber-300/60'
                          : selected
                            ? 'bg-white/25 ring-1 ring-white/50'
                            : 'hover:bg-white/15'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onGuestTap(g)}
                        className="flex min-w-0 flex-1 items-center px-2.5 py-1.5 text-left"
                      >
                        <span className="truncate">{g.name}</span>
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => onCyclePriority(g.id, pr)}
                          aria-label={`Seat-first priority for ${g.name}`}
                          title="Tap to set how early auto-seat places this guest"
                          className={`mr-1 shrink-0 rounded px-1 py-0.5 text-[10px] transition ${
                            pr ? 'bg-white/20 text-white' : 'text-white/35 hover:text-white/70'
                          }`}
                        >
                          {pr ? `P${pr}` : '·'}
                        </button>
                      ) : null}
                      {seated && canEdit ? (
                        <button
                          type="button"
                          onClick={() => onUnseat(g.id)}
                          aria-label={`Unseat ${g.name}`}
                          className="shrink-0 rounded px-1.5 py-1 text-[10px] text-white/55 transition hover:bg-white/15 hover:text-white"
                        >
                          unseat
                        </button>
                      ) : (
                        <span className={`ml-2 shrink-0 pr-1 text-[10px] ${seated ? 'text-white/55' : 'text-white/40'}`}>
                          {placing ? 'placing…' : selected ? 'swap?' : seated ? 'seated' : 'place'}
                        </span>
                      )}
                    </div>
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
