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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { guestsViewHref } from '@/lib/guests-views';
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
  ROOM_DRAWN_ATTRIBUTES,
} from '@/app/_components/plan3d/venue-decor';
import { sel, primaryOnlyNotice, type ReceptionDesign } from '@/lib/reception-scene';
import type { BookedZoneCandidate } from '@/lib/reception-suggestion-chips';
import { coldSparkFrame, coldSparkObstacles } from '@/app/_components/plan3d/kit/entrance-tunnel';
import { SERPENTINE_TOP_GEO } from '@/app/_components/plan3d/kit/serpentine-top';
import { SEAT_PLAN_SHOW_VIEW_EVENT } from '@/lib/seat-plan-views';
import { RoomViewTools } from './room-view-tools';
import { AccentsSheet } from './accents-sheet';
import { useSeatingLiveRefresh } from '@/app/dashboard/[eventId]/seating/_components/use-seating-live-refresh';
import { usePlan3dRoom, PLAN3D_SHARED_ROOM_ENABLED, type LocalPlayer } from '@/app/_components/plan3d/use-plan3d-room';
import { RemotePlayers, CameraMoveBroadcaster } from '@/app/_components/plan3d/plan3d-remote-players';
import { colorFromId } from '@/lib/plan3d-room';
import type { KeepApartRule, PriorityOrder } from '@/lib/seating';

// Cinematic Tier B (Fable §3.5) — the program's ONLY new dependency
// (postprocessing + @react-three/postprocessing) lives behind THIS dynamic
// import and nowhere else: React.lazy keeps kit/cinematic.tsx (and the dep) in
// its own async chunk, fetched the first time Play mode actually mounts the
// pass. Deliberately NOT imported from the kit barrel (a static barrel export
// would weld the dep onto every kit consumer, phone-walk chunk included).
const CinematicPass = lazy(() =>
  import('@/app/_components/plan3d/kit/cinematic').then((m) => ({ default: m.CinematicPass })),
);

import {
  type Lab3DTable,
  type Lab3DFloor,
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
  pushOutOfDiscs,
  separateAgents,
  walkVector,
  walkSpawnPoint,
  steerPath,
  seatApproachPath,
  resolvePalette,
  DEMO_PALETTES,
  seatStatusOf,
  SIDE_COLOR,
  TENTATIVE_COLOR,
  PLUS_ONE_COLOR,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import type { MoodboardStyleFamily } from '@/lib/moodboard-templates';
import { svgToMonogramTexture } from '@/lib/svg-monogram-texture';
import { resolveRoomPalette } from '@/lib/room-palette';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';
import { GhostBooths } from '@/app/_components/plan3d/ghost-booth';
import { PLAN3D_BOOTH_ADS_ENABLED, type GhostBooth3D } from '@/lib/ghost-booths';
import { boothHitVolume, templateBoothObstacles } from '@/app/_components/plan3d/kit/booth-templates';
import { BoothVendorCard } from '@/app/_components/plan3d/booth-vendor-card';
import { DanceFloorMural } from '@/app/_components/plan3d/dance-floor-mural';
import { formatCount } from '@/lib/format-number';
import { PHONE_3D, canvasDpr } from '@/lib/phone-gpu-budget';
import {
  usePhoneGpu,
  useHasSize,
  useWebglContextLost,
  DemandTail,
  ContextLostNotice,
} from '@/app/_components/plan3d/phone-gpu-budget';

type Props = {
  eventId: string;
  /**
   * 🪑 Drawn inside the Maker's Details › Seat plan, as its 3D view, BESIDE the
   * 2D editor (which stays mounted and holds the same person's editor lock). So
   * here the lock is not released when the 3D view closes — the 2D editor
   * still holds it and releases it itself — and the 2D / List segment returns
   * to Details, never to the standalone page.
   */
  inMaker?: boolean;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  /** Structured role palette from `events.role_palette` — the canonical source for scene materials. */
  rolePalette: RolePalette;
  /** Couple's saved reception treatments (Wave 2b · events.reception_design) —
   *  drives the 3D decor (ceiling / backdrop / centrepieces / entrance arch),
   *  palette-tinted so the material switcher recolours it. */
  receptionDesign: ReceptionDesign;
  /** The couple's own inspiration photos, keyed by design part. Only the five
   *  parts with a matching slot appear; a part with none is simply absent, and
   *  shows no reference rather than an unrelated photo. */
  inspirationByPart?: Record<string, string[]>;
  /** MB15 — the room zones a supplier has AGREED to build, keyed by RECEPTION
   *  part id, resolved on the server through `isPartFinalized`. An entry means
   *  the chips for that zone are frozen and the panel says who agreed and when.
   *  Absent = nothing agreed, which is the common case. */
  finalizedByPart?: Record<string, { vendorName: string | null; agreedAt: string | null }>;
  /** RV2 — booked suppliers whose trade reaches a reception zone (owner ruling
   *  Q9, 2026-09-06). OFFERS, not settings: nothing here has been applied to
   *  `receptionDesign`, and rendering them applies nothing. Resolved on the
   *  server because the trade map reaches `next/headers`. */
  bookedSuggestions?: BookedZoneCandidate[];
  /** RV2 — suggestion keys this couple has already waved away
   *  (`events.dismissed_room_suggestions`). */
  dismissedSuggestions?: string[];
  /** MB15 — `events.moodboard_theme_name`, the couple's own name for this
   *  look. Null when they have not named one; the room then says nothing rather
   *  than inventing a title. */
  themeName?: string | null;
  /** `events.moodboard_style_family` (migration 20271197327520) — which theme
   *  family produced this board, or null when the couple hasn't applied a
   *  template. Passed straight down to ReceptionDesignEditor, which is where
   *  the decor AI-image layer pilot resolves it. */
  styleFamily: MoodboardStyleFamily | null;
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
function outfitVariantFor(attire: Lab3DGuest['attire'], id: string, said?: Lab3DGuest['outfit']): FigureSpec['outfit'] {
  /* 👗 A Wear their role's dress code names is worn as named (owner 2026-10-20, `seatPlanOutfitOf`) — no variety. */
  if (said) return said;
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
    outfit: outfitVariantFor(g.attire, g.id, g.outfit),
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

/* 👁 View-only since 2026-10-30: the rules, groups and the reception editor's inputs (keepApart, priorityOrder, groups,
   inspirationByPart, styleFamily) still ride `Props` from the page, and the room reads none of them — their editors live
   on the 2D plan. */
export default function SeatingLab3D({ eventId, inMaker = false, tables: initialTables, floor: floorProp, guests, rolePalette, receptionDesign, finalizedByPart, bookedSuggestions, dismissedSuggestions, themeName, venueSetting, monogram, animatedMonogram, me, floorExtras, sceneObjects, booths, signs, ghostBooths, ghostBoothsEnabled }: Props) {
  const router = useRouter();
  // 👁 The floor is the server's (the 2D plan edits it); the room only draws it.
  const floor = floorProp;
  // Reception design is LOCAL state — the Accents sheet writes here optimistically so VenueDecor re-renders the room
  // at once (a save never resets the screen); it re-syncs from server truth when the prop changes (loader re-run).
  const [design, setDesign] = useState(receptionDesign);
  useEffect(() => setDesign(receptionDesign), [receptionDesign]);
  // ONE reduced-motion flag threaded to every JS-driven motion (camera ease,
  // walk/swap glide+bob, table slide-lag + pop, orbit momentum). SSR-safe +
  // live-updating. The flow still COMPLETES when reduced — we drop the easing
  // and snap to the same final state, firing the same completion callbacks.
  const reduced = usePrefersReducedMotion();
  // 📱 A phone runs the phone tier (`phone-gpu-budget.tsx`, owner 2026-10-29 — *"When i pressed 3d plan"* → the app
  // crashed): the guest walk's 'low' quality, no Tier B composer, a capped pixel ratio and an on-demand render loop.
  // A computer keeps the desktop tier exactly as it was.
  const phoneGpu = usePhoneGpu();
  const sceneQuality = phoneGpu ? PHONE_3D.quality : 'high';
  const room = useMemo(() => roomSize(floor), [floor]);
  const [mode, setMode] = useState<'build' | 'play'>('build');
  const [paletteKey, setPaletteKey] = useState('mood');
  // MB15 — the couple's board resolved through `resolveRoomPalette`: their five
  // majors AND their palette style. The demo switcher's fixed palettes are
  // unchanged; only the 'mood' entry — the couple's own room — reads the board.
  const palette = useMemo<Lab3DPalette>(() => {
    if (paletteKey === 'mood') return resolveRoomPalette(rolePalette);
    return DEMO_PALETTES.find((p) => p.key === paletteKey)?.palette ?? resolveRoomPalette(rolePalette);
  }, [paletteKey, rolePalette]);
  // 🔑 THE RESOLVED ATTIRE PALETTE IS NOT MEMOIZED HERE, AND THAT IS DELIBERATE.
  // Its only consumer here was the concept illustration in the old Build panel
  // (gone since the room became view-only, 2026-10-30). A second memo here would be a
  // second `deriveBoard` on every mount of the lab, feeding nothing — the first
  // draft of MB15 shipped exactly that, and neither tsc nor eslint said a word
  // about it. `deriveBoard` measures ~11 ms a call on an idle M-series Mac
  // (median of 3 × 60; it reads ~50 ms while the db suite is running, which is
  // contention, not the number).
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
  // surface's quality knob ('high' on a computer; on a phone the lab runs the
  // phone tier and, like the phone guest walk, NEVER loads the chunk) && motion OK (house
  // law: reduced = static grade, no composer) && not perf-degraded. The
  // degrade latch is ONE-WAY for the session — PerformanceMonitor inside the
  // pass fires onDegrade once on sustained decline, we unmount to Tier A and
  // never remount, so there is no incline/decline thrash by construction.
  const [fxDegraded, setFxDegraded] = useState(false);
  const onFxDegrade = useCallback(() => setFxDegraded(true), []);
  const cinematicFx = mode === 'play' && !reduced && !fxDegraded && !phoneGpu;
  // Live world position of the followed walk-in — written by the Walker's
  // frame loop (nulled on unmount), read by the Tier B DepthOfField so focus
  // eases onto whoever is walking to their seat. A ref, never state: the DoF
  // consumes it per-frame without re-rendering React (MASCOT-SMOOTH).
  const walkerPosRef = useRef<THREE.Vector3 | null>(null);

  // 👁 THE ROOM IS VIEW-ONLY (owner 2026-10-30, *"let's make 3d become view only because all are plottend on the 2d"*):
  // it takes no seat-plan lock, holds no edit handler and writes nothing to the plan. Every edit lives on the 2D plan
  // and the List; the room follows them live. Held by `room-is-view-only.test.ts`.
  // Shared room (slice 8): the authed user is the player identity. Inert unless
  // NEXT_PUBLIC_PLAN3D_SHARED_ROOM is on → byte-identical single-player otherwise.
  // Two partners in Play mode see each other's characters walk the room live.
  const roomSelf = useMemo<LocalPlayer | null>(
    () => (PLAN3D_SHARED_ROOM_ENABLED ? { id: me.id, name: me.name, color: colorFromId(me.id) } : null),
    [me.id, me.name],
  );
  const sharedRoom = usePlan3dRoom(eventId, roomSelf);
  // The view-only room follows the editor live (2D, or a co-host's 2D) — always: it holds no drag of its own to clobber.
  useSeatingLiveRefresh(eventId, true);
  // ✨ The Accents sheet — opened from the tools, or from the 2D plan's ⋯ (`&accents=1` on the address).
  const searchParams = useSearchParams();
  const [accentsOpen, setAccentsOpen] = useState(false);
  useEffect(() => {
    if (searchParams?.get('accents') === '1') setAccentsOpen(true);
  }, [searchParams]);
  const closeAccents = useCallback(() => {
    setAccentsOpen(false);
    if (typeof window !== 'undefined' && new URL(window.location.href).searchParams.has('accents')) {
      const u = new URL(window.location.href);
      u.searchParams.delete('accents');
      window.history.replaceState(window.history.state, '', u.pathname + u.search);
    }
  }, []);
  // "Switch to 2D" — in Guests the 2D plan is the same page (a client switch it listens for); standalone, its address.
  const show2d = useCallback(() => {
    if (inMaker) window.dispatchEvent(new CustomEvent(SEAT_PLAN_SHOW_VIEW_EVENT, { detail: '2d' }));
    else router.push(guestsViewHref(eventId, 'seats'));
  }, [inMaker, eventId, router]);

  const [tables, setTables] = useState<LiveTable[]>(initialTables);
  // 👁 The view-only room mirrors server truth on every refresh (it holds no optimistic edit to protect) — so a
  // co-host's move, rotate or delete on the 2D plan reaches it instead of freezing at the mount positions.
  useEffect(() => setTables(initialTables), [initialTables]);

  // The lab surface (fullscreen target + the bubble's positioning container).
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 📱 No GPU context while the room is hidden: R4 keeps this room mounted after its first open (behind `hidden` while
  // 2D or List shows); a 0×0 wrapper unmounts the Canvas, which releases its WebGL context. The room itself — its
  // lock, its mode, its picks — stays mounted.
  const roomOnScreen = useHasSize(wrapperRef);
  // 📱 When the browser takes WebGL away (a phone out of GPU memory), say so and offer the 2D plan — never a dead canvas.
  const webgl = useWebglContextLost();
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


  // Local seat map (starts from the real assignments). The walk demo assigns
  // unseated guests into the first free chair — locally, never persisted.
  const [seats, setSeats] = useState<Map<string, SeatRef>>(() => deriveSeatsFromGuests(guests));
  // Re-derive the seat map from the refreshed guest rows (server truth) — the view-only room mirrors every seat/unseat.
  useEffect(() => setSeats(deriveSeatsFromGuests(guests)), [guests]);





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
  const coldSpark = sel(design, 'tunnel', 'style') === 'cold_spark';
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
      // Play mode: a tap inside the dance floor sends a guest out to dance (a local animation — nothing is saved).
      if (mode === 'play') {
        const rect = danceFloorRect(floor, room);
        if (rect && pointInZone({ x: e.point.x, z: e.point.z }, rect)) sendDancer();
      }
    },
    [mode, room, floor, sendDancer],
  );

  // ── Full screen (owner 2026-07-17 · Lab chrome rules; the phone path 2026-10-30) ──────────────────────────────
  // Explicit control ONLY: the tools' ⤢ + a double-tap on the OUTSIDE area (the dark surround beyond the venue floor).
  //
  // 📱 ON A PHONE IT IS AN IN-PAGE FULL SCREEN, NEVER THE FULLSCREEN API (owner, iPhone app, 2026-10-30: *"3d crashed
  // again. when i tried to press the full screen icon"*). iPhone Safari has no element Fullscreen API at all — the
  // button did nothing there — but the INSTALLED APP's web view has it switched on (Capacitor 8.4.3
  // `CAPBridgeViewController` sets `preferences.isElementFullscreenEnabled = true`), so in the app the press handed the
  // room's wrapper to WebKit's native element full screen: the whole web view lifted into a new full-screen window, the
  // live WebGL canvas resized and re-composited mid-transition, on a phone already near its memory line. The in-page
  // full screen is the SAME element, the SAME Canvas and the SAME WebGL context — only its box grows to the viewport
  // (`fixed inset-0`), so the drawing buffer is re-sized by R3F inside the capped DPR (`canvasDpr`) and nothing is
  // re-created. Held by `lib/phone-gpu-budget.test.ts`. A computer keeps the real Fullscreen API.
  const [inPageFull, setInPageFull] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (phoneGpu) {
      setInPageFull((v) => !v);
      return;
    }
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
  }, [phoneGpu]);
  // The in-page full screen is left with Esc as well as the ⤢ (a phone keyboard, an iPad's).
  useEffect(() => {
    if (!inPageFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInPageFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inPageFull]);
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
  // 📱 Nothing is moving on its own: the overview (not Play), no camera ease, no walk-in, crowd, mover or dancer. On a phone the
  // loop then draws only on demand (`DemandTail` keeps it drawing through each change and its ease); anything that
  // moves on its own puts it back to every frame.
  const sceneSettled =
    mode === 'build' &&
    !camBusy &&
    !walker &&
    !crowd &&
    !walking &&
    movers.length === 0 &&
    dancers.length === 0;

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
      data-room-fullscreen={inPageFull ? 'in-page' : undefined}
      className={
        inPageFull
          ? 'fixed inset-0 z-[120] w-full overflow-hidden bg-[#11131a] pt-[env(safe-area-inset-top)]'
          : `relative w-full overflow-hidden bg-[#11131a] ${inMaker ? 'h-full' : 'h-[82vh] rounded-2xl border border-ink/10'}`
      }
    >
      {webgl.lost ? (
        <ContextLostNotice
          onShow2d={() => {
            const href = guestsViewHref(eventId, 'seats');
            // In Guests the room is a client switch over the 2D plan, so a fresh load is the way out that also frees
            // the memory; standalone, the plan is another page.
            if (inMaker) window.location.assign(href);
            else router.push(href);
          }}
          onRetry={webgl.retry}
        />
      ) : null}
      {roomOnScreen && !webgl.lost ? (
      <Canvas
        key={webgl.attempt}
        shadows
        dpr={canvasDpr(phoneGpu, 1.5)}
        frameloop={phoneGpu && sceneSettled ? 'demand' : 'always'}
        onCreated={webgl.onCreated}
        camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}
        gl={{ antialias: true, powerPreference: phoneGpu ? 'default' : 'high-performance', ...RECOMMENDED_TONEMAP }}
      >
        {phoneGpu ? <DemandTail busy={!sceneSettled} /> : null}
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
          quality={sceneQuality}
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
        <VenueShell archetype={archetype} room={room} palette={palette} quality={sceneQuality} />
        <VenueDecor
          design={design}
          floor={floor}
          tables={tables}
          room={room}
          palette={palette}
          quality={sceneQuality}
          archetype={archetype}
        />

        {/* Cinematic Tier A (Fable §3.5) — Play mode only, Build stays the
            neutral editing studio. String lights are static instances (fine
            under reduced motion) and skip when the couple's OWN ceiling decor
            occupies the hang band (fairy lights / chandeliers / lanterns /
            hanging florals — see ceilingDecorOccupied); the drifting motes
            honour the house law and simply don't mount when motion is
            reduced. */}
        {mode === 'play' && !ceilingDecorOccupied(design, archetype) ? (
          <StringLights room={room} palette={palette} quality={sceneQuality} />
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
            category. */}
        {PLAN3D_BOOTH_ADS_ENABLED && ghostBoothsEnabled ? (
          <GhostBooths
            ghosts={ghostBooths}
            room={room}
            palette={palette}
            interactive
          />
        ) : null}

        {/* Invisible per-booth tap targets (the plan3d-scene precedent) —
            tapping a booth opens its vendor card. Kept off the shared fixture
            renderer so it stays a pure visual (no interaction coupling). Always
            on: the view-only room arms no floor placement for them to swallow. */}
        {booths.map((b) => (
          <LabBoothHitTarget
            key={b.id}
            booth={b}
            room={room}
            onTap={setOpenBooth}
            enabled
          />
        ))}

        {/* Invisible floor catcher — VIEW gestures only (owner 2026-10-30, the room is view-only): in Play a tap on the
            dance floor sends a guest out to dance; a double-tap OUTSIDE the venue rect toggles full screen. No drag, no
            drop, no placement. */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
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
          enabled={!camBusy && !walking}
          enableDamping={!reduced}
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={Math.max(room.d * 3, bounds.span * 1.4)}
          minPolarAngle={mode === 'build' ? 0.05 : 0.18}
          maxPolarAngle={mode === 'build' ? 0.62 : Math.PI / 2 - 0.04}
          target={[0, 0.5, 0]}
        />
      </Canvas>
      ) : null}

      {/* Booth vendor card (bottom sheet / side drawer) — 2D chrome outside the
          Canvas, shared Sheet conventions. Inspect-only in the lab: no walk-to,
          and the marketplace CTA reads "View vendor profile". */}
      <BoothVendorCard booth={openBooth} onClose={() => setOpenBooth(null)} profileCta="view" />

      {/* ✨ Accents (owner 2026-10-30) — a sheet, never a panel on the room: one switch per accent, one style dropdown. */}
      <AccentsSheet
        open={accentsOpen}
        onClose={closeAccents}
        eventId={eventId}
        design={design}
        onChange={setDesign}
        venueSetting={venueSetting}
        finalizedByPart={finalizedByPart}
        bookedSuggestions={bookedSuggestions}
        dismissedSuggestions={dismissedSuggestions}
      />

      {/* Unsaved-2D-changes line (Sync verdict § 5 · GUN C door audit — visible, never silent staleness). */}
      {staleDirty ? (
        <p className="pointer-events-none absolute inset-x-3 top-3 z-20 mx-auto max-w-sm rounded-full bg-black/55 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur-md">
          Unsaved 2D changes aren&rsquo;t shown here yet.
        </p>
      ) : null}
      {notice ? (
        <div className="pointer-events-auto absolute inset-x-3 top-14 z-20 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-black/55 px-4 py-2 text-sm text-amber-100 backdrop-blur-md">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice" className="min-h-11 min-w-11 text-white/60 hover:text-white">
            <span aria-hidden>✕</span>
          </button>
        </div>
      ) : null}

      {/* Cinematic vignette (Fable §3.5 Tier A) — a dep-free screen-space
          radial gradient over the canvas, Play only. Pure CSS on a DOM div:
          zero GPU cost, no postprocessing. pointer-events-none + below the
          tools so it never eats a tap. On Tier B the vignette moves INTO the
          composer (kit/cinematic.tsx), so this div only serves the Tier A
          fallbacks: reduced motion + the perf latch + every phone. */}
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

      {/* Walking (Play): the look pad (right half) and the stick, lifted above the tools row. */}
      {mode === 'play' && walking ? (
        <>
          <LookPad input={walkInput} />
          <WalkStick input={walkInput} />
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 text-center text-[11px] text-white/60">
            Left stick walks · drag right to look · pinch to zoom
          </div>
        </>
      ) : null}

      {/* 👁 THE ROOM'S TOOLS — one row in the thumb zone (the approved Guests prototype's 3D: nothing on the room). */}
      <RoomViewTools
        playing={mode === 'play'}
        onPlay={(on) => {
          setMode(on ? 'play' : 'build');
          if (!on) {
            setWalking(false);
            setCrowd(null);
          }
        }}
        walking={walking}
        onWalk={setWalking}
        crowdActive={!!crowd}
        canWalkEveryone={seatedCount > 0}
        onWalkEveryone={walkEveryone}
        onClearCrowd={() => setCrowd(null)}
        dancingCount={dancers.length}
        onClearFloor={clearFloor}
        sayHi={
          sharedRoom.enabled && sharedRoom.onlineCount > 1 ? (
            /* Shared room "say hi" (slice 8) — only while another partner is here. Waves at the room; the wave plays on
               MY figure on their screen. */
            <button
              type="button"
              onClick={() => sharedRoom.greet(null)}
              className="pointer-events-auto inline-flex h-11 items-center rounded-full border border-white/20 bg-black/45 px-4 text-sm font-medium text-white backdrop-blur-md hover:bg-black/60"
            >
              👋 Say hi · {formatCount(sharedRoom.onlineCount)} here
            </button>
          ) : null
        }
        showCloth={showCloth}
        showAccents={showAccents}
        onShowCloth={setShowCloth}
        onShowAccents={setShowAccents}
        paletteKey={paletteKey}
        palettes={DEMO_PALETTES}
        onPalette={setPaletteKey}
        onAccents={() => setAccentsOpen(true)}
        fullscreen={isFullscreen || inPageFull}
        onFullscreen={toggleFullscreen}
        onShow2d={show2d}
        about={
          <>
            {themeName ? <span className="block font-medium text-ink">{themeName}</span> : null}
            {primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES) ? (
              <span className="block text-ink/70">{primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES)}</span>
            ) : null}
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-ink/70">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SIDE_COLOR.both }} />Confirmed</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TENTATIVE_COLOR }} />Pending / maybe</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PLUS_ONE_COLOR, opacity: 0.5 }} />+1 held</span>
            </span>
            <span className="flex flex-wrap gap-x-3 text-ink/70">
              <a href={`/dashboard/${eventId}/seating/print`} target="_blank" rel="noreferrer" className="underline">Print pack</a>
              <a href={`/dashboard/${eventId}/seating/chart`} target="_blank" rel="noreferrer" className="underline">Entrance seating chart</a>
            </span>
          </>
        }
      />
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
        {/* 🎨 The couple's Stage colour (Palette › Stage, 2026-10-19), else the accent it always wore. */}
        <meshStandardMaterial color={palette.stage ?? palette.accent} roughness={0.5} metalness={0.1} />
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
  showCloth,
  showAccents,
  seated,
  reduced,
  crowdLow,
}: {
  table: LiveTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
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
  // Removed chairs render as faint ghosts (the 2D plan restores them — the room only shows).
  const ghostMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.6, transparent: true, opacity: 0.16 }),
    [palette.wall],
  );
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
    const targetX = home.x;
    const targetZ = home.z;
    if (reduced) {
      // Reduced motion: no slide-lag. Position tracks the saved spot directly, scale pinned to 1, rotation instant.
      g.position.x = targetX;
      g.position.z = targetZ;
      if (g.scale.x !== 1) g.scale.setScalar(1);
      g.rotation.y = (-table.rotationDeg * Math.PI) / 180;
      return;
    }
    const k = Math.min(1, delta * 12);
    g.position.x += (targetX - g.position.x) * k;
    g.position.z += (targetZ - g.position.z) * k;
    if (g.scale.x !== 1) g.scale.setScalar(1);
    g.rotation.y = (-table.rotationDeg * Math.PI) / 180;
  });

  const clothColor = palette.table;

  /* 👁 VIEW-ONLY (owner 2026-10-30): a table takes no pointer — no drag, no select, no chair toggle. The 2D plan edits. */
  return (
    <group ref={ref} position={[home.x, 0, home.z]}>
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
        // The couple's chair colour when they set one (mood board →
        // room_dressing.chairs); otherwise the wall tone this has always used.
        color={palette.chairs ?? palette.wall}
        accent={palette.accent}
      />
      {/* Removed-seat ghosts + seated guests. Confirmed static
          figures are drawn by the <InstancedSeatedCrowd> batch below instead of
          an individual <SeatedAvatar> (their seat index is in instancedSeatIdx). */}
      {chairs.map((c, i) => {
        const ang = c.faceY;
        const tok = seated?.get(i);
        const isRemoved = table.removedSeats.includes(i);
        if (!isRemoved && !tok) return null;
        if (tok && !isRemoved && instancedSeatIdx.has(i)) return null; // body is in the batch
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
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


/* ------------------------------ Floor designer ---------------------------- */


/* ----------------------- Direct zone drag (3D) --------------------------- */



/* -------------------------------- HUD (2D) -------------------------------- */


