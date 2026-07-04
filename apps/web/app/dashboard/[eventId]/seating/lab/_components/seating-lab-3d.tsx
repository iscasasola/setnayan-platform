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
 * Performance: DPR capped, lightweight waypoint steering, per-table
 * InstancedChairs (2 draw calls a table — the Wave 2a instancing collapse),
 * real soft shadow maps via the shared SceneLighting rig ('high' quality:
 * 2048 map + procedural Lightformer IBL, no HDRI/network assets).
 * GLTF furniture + NavMesh + post-processing remain the v2 upgrades.
 * Known v1 limit: a FREE board (no venue size) maps 0–100% onto a fixed room,
 * so widely-spread tables (percent > 100) can render off the visible floor —
 * a fit-frame transform (like the 2D editor's) is the documented follow-up.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { GuestPhotoAvatar } from '@/app/_components/plan3d/guest-avatar';
import { SceneLighting, RECOMMENDED_TONEMAP, floorRoughnessMap, floorAlbedoMap, floorBumpMap, fabricBumpMap } from '@/app/_components/plan3d/scene-lighting';
import { InstancedChairs, chairPlacements } from '@/app/_components/plan3d/instanced-chairs';
import {
  VenueShell,
  VenueDecor,
  archetypeFor,
  archetypeFloorColor,
  archetypeBackground,
} from '@/app/_components/plan3d/venue-decor';
import { type ReceptionDesign } from '@/lib/reception-scene';
import { useSeatingLock } from '@/app/dashboard/[eventId]/seating/_components/use-seating-lock';
import { SeatingLockError } from '@/app/dashboard/[eventId]/seating/seating-lock-error';
import {
  assignGuest,
  createTable,
  deleteTable,
  updateTablePosition,
  updateTableRotation,
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
} from '@/app/dashboard/[eventId]/seating/actions';
import { TABLE_TYPE_CATALOG, ROLE_TIER_LABELS, computeAutoLayout } from '@/lib/seating';
import type { KeepApartRule, PriorityOrder, EventTableRow } from '@/lib/seating';

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
  roomSize,
  contentBounds,
  pctToWorld,
  tableDims,
  checkPlacement,
  serpentineBand,
  seatWorld,
  floorObstacles,
  sceneObjectObstacles,
  boothObstacles,
  signObstacles,
  cocktailObstacles,
  firstFreeSeatAtTable,
  pushOutOfDiscs,
  separateAgents,
  walkVector,
  steerPath,
  seatApproachPath,
  resolvePalette,
  resolvePaletteFromRoles,
  DEMO_PALETTES,
  seatStatusOf,
  SIDE_COLOR,
  TENTATIVE_COLOR,
  PLUS_ONE_COLOR,
} from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';
import { svgToMonogramTexture } from '@/lib/svg-monogram-texture';
import { VenueFixtures } from '@/app/_components/plan3d/venue-objects';

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  paletteHexes: string[];
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
};

type LiveTable = Lab3DTable;
type SeatRef = { tableId: string; seatNumber: number };
type WalkerState = { gid: string; name: string; path: Vec2[]; tableId: string } | null;

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
// Real-furniture parts (shared buffers): a seated guest = body + head; a
// centerpiece = vase + bloom.
const TOKEN_BODY_GEO = new THREE.CylinderGeometry(0.13, 0.15, 0.4, 10);
const TOKEN_HEAD_GEO = new THREE.SphereGeometry(0.12, 12, 12);
// Attire silhouettes for seated guests: a gown flares to a wide skirt, a suit is
// a straighter tapered torso. They swap in for the plain body when a guest's
// resolved attire calls for it (motif-coloured via the body material).
const GOWN_GEO = new THREE.CylinderGeometry(0.08, 0.26, 0.56, 16);
const SUIT_GEO = new THREE.CylinderGeometry(0.13, 0.18, 0.5, 12);
const VASE_GEO = new THREE.CylinderGeometry(0.085, 0.12, 0.24, 10);
const BLOOM_GEO = new THREE.IcosahedronGeometry(0.2, 0);

/** Per-seat token treatment computed from a guest's RSVP (see lib seatStatusOf). */
type SeatToken = {
  color: string;
  opacity: number;
  name: string;
  photoUrl?: string | null;
  attire?: 'gown' | 'suit' | 'neutral';
  attireColor?: string | null;
};

/** A guest's token colour/opacity, or null when their seat is freed (declined). */
function guestTokenStyle(g: Lab3DGuest): SeatToken | null {
  const status = seatStatusOf(g.rsvp);
  if (status === 'hidden') return null;
  return {
    color: status === 'confirmed' ? SIDE_COLOR[g.side] : TENTATIVE_COLOR,
    opacity: status === 'confirmed' ? 1 : 0.62,
    name: g.name,
    photoUrl: g.photoUrl,
    attire: g.attire,
    attireColor: g.attireColor,
  };
}

/**
 * A seated guest: a coloured body token, topped by the guest's selfie as a
 * camera-facing disc (ringed in their RSVP colour) when a photo is available,
 * else the plain coloured head. The photo disc + its texture caching now come
 * from the shared `GuestPhotoAvatar` (module-level refcounted texture cache),
 * so a big guest list shares one decode per URL and failures don't retry-storm.
 */
function SeatedAvatar({ tok, bodyMat }: { tok: SeatToken; bodyMat: THREE.Material }) {
  // Attire-driven silhouette: gown / suit / plain token. Gown sits a touch
  // higher so the flared skirt clears the chair seat.
  const bodyGeo = tok.attire === 'gown' ? GOWN_GEO : tok.attire === 'suit' ? SUIT_GEO : TOKEN_BODY_GEO;
  const bodyY = tok.attire === 'gown' ? 0.72 : 0.7;
  return (
    <group position={[0, 0, -0.04]}>
      <mesh geometry={bodyGeo} position={[0, bodyY, 0]} material={bodyMat} castShadow />
      {tok.photoUrl ? (
        // Shared photo disc: billboarded selfie, ringed in the RSVP colour, with
        // an initials fallback baked in if the texture fails to load. The disc
        // must NOT cast a shadow — a billboard would shadow as a floating circle.
        <GuestPhotoAvatar
          photoUrl={tok.photoUrl}
          name={tok.name}
          ringColor={tok.color}
          height={1.04}
          radius={0.15}
          opacity={tok.opacity}
        />
      ) : (
        <mesh geometry={TOKEN_HEAD_GEO} position={[0, 1.0, 0]} material={bodyMat} castShadow />
      )}
    </group>
  );
}

// A guest token animating between seats during a swap / table-swap.
type Mover = { gid: string; color: string; opacity: number; path: Vec2[]; target: SeatRef };

export default function SeatingLab3D({ eventId, tables: initialTables, floor: floorProp, guests, paletteHexes, rolePalette, receptionDesign, venueSetting, monogram, animatedMonogram, me, keepApart: keepApartProp, priorityOrder: priorityOrderProp, groups, floorExtras, sceneObjects, booths, signs }: Props) {
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

  // Single-editor lock — the SAME one the 2D editor uses, so 3D and 2D never
  // write at once. Acquire on mount; canEdit is false (view-only) until granted.
  const lock = useSeatingLock(eventId, me.name, null);
  const canEdit = lock.status === 'editing';
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
  // clobber an in-flight optimistic move/rotation. But when a save just failed
  // (forceResyncRef armed) do a FULL replace: overwrite every row's
  // position/rotation and drop rows the server no longer has, so the failed
  // optimistic change is reverted to server truth. While the lab holds the lock
  // it's the only writer, so add-the-new-row is otherwise sufficient.
  useEffect(() => {
    if (forceResyncRef.current) {
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
  }, [initialTables]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [camBusy, setCamBusy] = useState(false);
  // Game-pad "walk the room" mode (Play only). The on-screen sticks write into
  // walkInput each frame; WalkController reads it to drive the camera.
  const [walking, setWalking] = useState(false);
  const walkInput = useRef<WalkInput>({ moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0, pinch: 0 });
  const [notice, setNotice] = useState<string | null>(null);
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
  // One-shot: after a server bulk op (auto-seat) + router.refresh, re-derive the
  // local seat map from the refreshed guest rows (server truth) — WITHOUT
  // clobbering ordinary optimistic edits, which never arm this ref.
  const seatResyncRef = useRef(false);
  useEffect(() => {
    if (seatResyncRef.current) {
      seatResyncRef.current = false;
      setSeats(deriveSeatsFromGuests(guests));
    }
  }, [guests]);

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
  const fixtureObstacles = useMemo(
    () => [
      ...sceneObjectObstacles(sceneObjects, room),
      ...boothObstacles(booths, room),
      ...signObstacles(signs, room),
      ...cocktailObstacles(cocktail, room),
    ],
    [sceneObjects, booths, signs, cocktail, room],
  );
  // What the walking camera can't pass through (tables + stage + dance +
  // fixture discs).
  const walkObstacles = useMemo(
    () => [...floorObstacles(floor, tables, room, []), ...fixtureObstacles],
    [floor, tables, room, fixtureObstacles],
  );
  // Walk mode only makes sense in Play — drop it whenever we leave.
  useEffect(() => {
    if (mode !== 'play') setWalking(false);
  }, [mode]);
  // Open-canvas framing: the free board lets tables sit far outside the default
  // room, so let the camera zoom out far enough to take the WHOLE layout in
  // (not just the fixed venue rectangle). Drives OrbitControls maxDistance.
  const bounds = useMemo(() => contentBounds(tables, room), [tables, room]);

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
      if (walkingIn.has(gid)) continue; // walking in → drawn by its walker/crowd agent
      const style = guestTokenStyle(g);
      if (!style) continue; // declined → freed seat
      slot(s.tableId).set(s.seatNumber, style);
    }
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      // A walking-in primary also suppresses their hovering +1 ghost — they
      // arrive together, so neither is drawn at rest until the walk settles.
      if (!g || !g.plusOneAllowed || plusOneSeated.has(gid) || walkingIn.has(gid) || seatStatusOf(g.rsvp) === 'hidden') continue;
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
      if (chosen >= 0) occ.set(chosen, { color: PLUS_ONE_COLOR, opacity: 0.4, name: '' });
    }
    return out;
  }, [seats, guestById, tablesById, movingGuests, crowd, walker]);

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
    const xPct = Math.max(lo, Math.min(hi, (d.x / room.w + 0.5) * 100));
    const yPct = Math.max(lo, Math.min(hi, (d.z / room.d + 0.5) * 100));

    // Placement rules (owner 2026-06-26): no overlap · no tables on the dance
    // floor · stage = sweetheart only. If the drop breaks one, revert (skip the
    // commit) — the mesh eases back to its stored spot — and say why.
    const dragged = tablesById.get(d.id);
    if (dragged) {
      const radiusOf = (t: LiveTable) => {
        const dim = tableDims(t.shape, t.capacity);
        return Math.max(dim.w, dim.round ? dim.w : dim.d) / 2;
      };
      const others = tables
        .filter((t) => t.id !== d.id)
        .map((t) => {
          const p = pctToWorld(t.xPct, t.yPct, room);
          return { x: p.x, z: p.z, r: radiusOf(t) };
        });
      const zone = (xP: number, yP: number, wP: number, hP: number, minW: number, minH: number) => {
        const c = pctToWorld(xP, yP, room);
        return { cx: c.x, cz: c.z, hw: Math.max(minW, (wP / 100) * room.w) / 2, hd: Math.max(minH, (hP / 100) * room.d) / 2 };
      };
      const stageZone = zone(floor.stage.xPct, floor.stage.yPct, floor.stage.wPct, floor.stage.hPct, 1.5, 1);
      const danceZone = floor.dance.enabled
        ? zone(floor.dance.xPct, floor.dance.yPct, floor.dance.wPct, floor.dance.hPct, 1.5, 1.5)
        : null;
      const verdict = checkPlacement(
        { x: d.x, z: d.z, r: radiusOf(dragged), isTable: true, isSweetheart: dragged.shape === 'sweetheart' },
        others,
        stageZone,
        danceZone,
      );
      if (!verdict.ok) {
        setNotice(verdict.reason);
        return;
      }
    }

    // Linked unit → translate every member by the same delta (move as one).
    const groupId = dragged?.linkGroupId ?? null;
    if (groupId && dragged) {
      const ddx = xPct - dragged.xPct;
      const ddy = yPct - dragged.yPct;
      const members = tables.filter((t) => t.linkGroupId === groupId);
      setTables((prev) =>
        prev.map((t) => (t.linkGroupId === groupId ? { ...t, xPct: t.xPct + ddx, yPct: t.yPct + ddy } : t)),
      );
      if (canEdit) {
        for (const m of members) {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('lock_id', lock.lockId ?? '');
          fd.set('table_id', m.id);
          fd.set('x_pos', String(m.xPct + ddx));
          fd.set('y_pos', String(m.yPct + ddy));
          void persist(() => updateTablePosition(fd));
        }
      }
      return;
    }

    setTables((prev) => prev.map((t) => (t.id === d.id ? { ...t, xPct, yPct } : t)));
    if (canEdit) {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', d.id);
      fd.set('x_pos', String(xPct));
      fd.set('y_pos', String(yPct));
      void persist(() => updateTablePosition(fd));
    }
  }, [room, floor, canEdit, eventId, lock.lockId, persist, tables, tablesById]);

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
  // Move a floor zone to a tapped point (pct), optimistic + persist.
  const moveZone = useCallback(
    (zone: 'stage' | 'dance' | 'entrance', xPct: number, yPct: number) => {
      const next: Lab3DFloor =
        zone === 'stage'
          ? { ...floor, stage: { ...floor.stage, xPct, yPct } }
          : zone === 'dance'
            ? { ...floor, dance: { ...floor.dance, xPct, yPct } }
            : { ...floor, entrance: { ...floor.entrance, xPct, yPct } };
      setFloor(next);
      saveFloor(next);
    },
    [floor, saveFloor],
  );
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
      if (!dragRef.current) return;
      dragRef.current.x = Math.max(-room.w / 2, Math.min(room.w / 2, e.point.x));
      dragRef.current.z = Math.max(-room.d / 2, Math.min(room.d / 2, e.point.z));
    },
    [room],
  );

  const onFloorClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // R3F fires this native `click` even after a drag (orbit OR table move).
      // `e.delta` is the pointer's pixel travel — ignore anything that moved.
      if (e.delta > 4) return;
      // Floor-edit "move" mode: drop the armed zone at the tapped spot.
      if (placeZone) {
        const xPct = Math.max(2, Math.min(98, (e.point.x / room.w + 0.5) * 100));
        const yPct = Math.max(2, Math.min(98, (e.point.z / room.d + 0.5) * 100));
        moveZone(placeZone, xPct, yPct);
        setPlaceZone(null);
        return;
      }
      if (mode === 'build') setSelectedId(null);
    },
    [mode, placeZone, room, moveZone],
  );

  // Add a table → createTable (lock-gated), then refresh so the new row (with
  // its real id) flows in. It lands at the 2D grid-default spot; drag to place
  // (which persists). Dropping at the exact tapped point needs createTable to
  // accept a position — a documented follow-up, not done here.
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
    void persist(async () => {
      await createTable(fd);
      router.refresh();
    });
  }, [canEdit, eventId, lock.lockId, tables.length, persist, router]);

  const rotateSelected = useCallback(
    (delta: number) => {
      if (!selectedId || !canEdit) return;
      const cur = tablesById.get(selectedId);
      if (!cur) return;
      const next = (((Math.round((cur.rotationDeg + delta) / 15) * 15) % 360) + 360) % 360;
      setTables((prev) => prev.map((t) => (t.id === selectedId ? { ...t, rotationDeg: next } : t)));
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', selectedId);
      fd.set('rotation_deg', String(next));
      void persist(() => updateTableRotation(fd));
    },
    [selectedId, canEdit, tablesById, eventId, lock.lockId, persist],
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
      // Route AROUND every fixed object — other tables, the walker's OWN table,
      // the stage, the dance floor — then step in to the chair from outside, so
      // the walker never cuts across its own tabletop (or anything else).
      const obstacles = [...floorObstacles(floor, tables, room, []), ...fixtureObstacles];
      const path = seatApproachPath(entranceWorld, table, seat.seatNumber, room, obstacles, 0.2);
      setMode('play');
      setArrived(null);
      setCrowd(null); // a single walk-in supersedes any populated crowd
      setWalker({ gid: g.id, name: g.name, path, tableId: seat.tableId });
      return true;
    },
    [seats, tables, tablesById, room, entranceWorld, floor, fixtureObstacles],
  );

  // Populate-Play: send EVERY seated guest walking in from the entrance at once.
  // Each gets a cleared path to their chair + their own obstacle set; the Crowd
  // component resolves overlap ("make way") and object clearance per frame. A
  // small per-guest stagger keeps them from spawning on top of each other.
  const walkEveryone = useCallback(() => {
    const agents: CrowdAgent[] = [];
    let i = 0;
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      if (!g || seatStatusOf(g.rsvp) === 'hidden') continue; // declined seats are freed
      const table = tablesById.get(s.tableId);
      if (!table) continue;
      // The PATH routes around every table (own included) so the walk-in never
      // crosses a tabletop; the per-frame obstacle set still SKIPS the guest's own
      // table so that, once arrived, the seated avatar isn't shoved off its chair.
      const walkAround = [...floorObstacles(floor, tables, room, []), ...fixtureObstacles];
      const obstacles = [...floorObstacles(floor, tables, room, [s.tableId]), ...fixtureObstacles];
      const path = seatApproachPath(entranceWorld, table, s.seatNumber, room, walkAround, 0.2);
      const style = guestTokenStyle(g);
      const color = style?.attireColor ?? style?.color ?? SIDE_COLOR[g.side];
      agents.push({ id: gid, name: g.name, path, color, startDelay: i * 0.16, obstacles });
      i += 1;
    }
    setWalker(null);
    setArrived(null);
    setMode('play');
    setCrowd(agents.length ? agents : null);
  }, [seats, guestById, tablesById, room, floor, tables, entranceWorld, fixtureObstacles]);

  // A single walk-in that has reached its chair settles into the seat: clear the
  // walker so the static SeatedAvatar takes over (the guest is already in `seats`).
  // Only the single walker sets `arrived`; the crowd settles via onAllArrived.
  useEffect(() => {
    if (!arrived || !walker) return;
    const id = window.setTimeout(() => {
      setWalker(null);
      setArrived(null);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [arrived, walker]);

  // Populate-Play: Crowd fires this once everyone has reached their chair (after a
  // short in-component "stand a beat" delay). Clearing the crowd returns the seated
  // view — the avatars "sit down". Synchronous + idempotent, so re-running "Walk
  // everyone in" can't be clobbered by a stale timer. "Clear the room" still skips ahead.
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
      const style = guestTokenStyle(g) ?? { color: SIDE_COLOR[g.side], opacity: 1 };
      setMovers((prev) => [
        ...prev,
        { gid, color: style.color, opacity: style.opacity, path, target: { tableId: toTableId, seatNumber: toSeat } },
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
    [guestById, tablesById, tables, seats, room, eventId, lock.lockId, persist, floor, fixtureObstacles],
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
      // Link mode: first table is armed; tapping a different one links them.
      if (linkArmId) {
        if (linkArmId !== id) doLink(linkArmId, id);
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
      setDraggingId(id);
    },
    [linkArmId, doLink, placingGroupId, seatGroupAt, placingGuestId, guestById, sendGuest, tableSwapArmed, tableSwapFirst, swapTables, mode, canEdit, room, tablesById],
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

  return (
    <div className="relative h-[82vh] w-full overflow-hidden rounded-2xl border border-ink/10 bg-[#11131a]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, room.d * 1.05 + 6, room.d * 0.95 + 6], fov: 42 }}
        gl={{ antialias: true, powerPreference: 'high-performance', ...RECOMMENDED_TONEMAP }}
      >
        <color attach="background" args={[mode === 'play' ? '#0c0e14' : '#13151c']} />
        <fog attach="fog" args={[mode === 'play' ? '#0c0e14' : '#13151c', room.d * 1.4, room.d * 3.2]} />

        {/* Shared rig (Wave 2a): procedural Lightformer IBL + one warm shadow
            key, 2048 map fitted to the room. Replaces the flat ambient +
            hemisphere + bare directional and the fake ContactShadows. */}
        <SceneLighting palette={palette} quality="high" room={room} />

        <RoomShell
          room={room}
          floor={floor}
          palette={palette}
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

        {tables.map((t) => (
          <TableMesh
            key={t.id}
            table={t}
            room={room}
            palette={palette}
            selected={selectedId === t.id}
            dragging={draggingId === t.id}
            dragRef={dragRef}
            interactive={mode === 'build' && canEdit}
            onDown={onTableDown}
            removable={mode === 'build' && canEdit && selectedId === t.id}
            onToggleSeat={(seatNumber) => toggleSeat(t.id, seatNumber)}
            showCloth={showCloth}
            showAccents={showAccents}
            seated={seatedByTable.get(t.id)}
            reduced={reduced}
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

        {walker && !crowd ? (
          <Walker
            walker={walker}
            palette={palette}
            entrance={entranceWorld}
            onArrive={() => setArrived(walker.name)}
            reduced={reduced}
          />
        ) : null}

        {mode === 'play' && crowd ? <Crowd agents={crowd} palette={palette} reduced={reduced} onAllArrived={settleCrowd} /> : null}

        {movers.map((m) => (
          <MoverToken key={m.gid} mover={m} onDone={onMoverDone} reduced={reduced} />
        ))}

        {walking ? (
          <WalkController active={walking} input={walkInput} room={room} obstacles={walkObstacles} />
        ) : (
          <CameraRig mode={mode} room={room} onBusy={setCamBusy} reduced={reduced} />
        )}
        <OrbitControls
          makeDefault
          enabled={!draggingId && !camBusy && !walking}
          enableDamping={!reduced}
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={Math.max(room.d * 3, bounds.span * 1.4)}
          minPolarAngle={mode === 'build' ? 0.05 : 0.18}
          maxPolarAngle={mode === 'build' ? 0.62 : Math.PI / 2 - 0.04}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      <Hud
        mode={mode}
        setMode={setMode}
        canEdit={canEdit}
        lockStatus={lock.status}
        onTakeOver={lock.acquire}
        notice={notice}
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
        linkArmed={linkArmId != null}
        onArmLink={() => {
          setPlacingGroupId(null);
          setPlacingGuestId(null);
          setPlaceZone(null);
          setLinkArmId(selectedId);
        }}
        onBreakApart={breakApart}
        onPublish={publishPlan}
        printHref={`/dashboard/${eventId}/seating/print`}
        tableCount={tables.length}
      />

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
  floorColor,
  buildMode,
  monogram,
  animatedMonogram,
  playSettled,
}: {
  room: { w: number; d: number };
  floor: Lab3DFloor;
  palette: Lab3DPalette;
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
  const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
  const danceD = Math.max(1.5, (floor.dance.hPct / 100) * room.d);

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

      {/* Dance floor */}
      {floor.dance.enabled ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[dance.x, 0.02, dance.z]}>
          <planeGeometry args={[danceW, danceD]} />
          <meshStandardMaterial color={palette.accent} roughness={0.25} metalness={0.2} transparent opacity={0.4} />
        </mesh>
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
  removable,
  onToggleSeat,
  showCloth,
  showAccents,
  seated,
  reduced,
}: {
  table: LiveTable;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  selected: boolean;
  dragging: boolean;
  dragRef: React.MutableRefObject<{ id: string; x: number; z: number } | null>;
  interactive: boolean;
  onDown: (id: string) => void;
  removable: boolean;
  onToggleSeat: (seatNumber: number) => void;
  showCloth: boolean;
  showAccents: boolean;
  seated: Map<number, SeatToken> | undefined;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  // Chair centres + facing — the shared `chairPlacements` (serpentine carries
  // its own per-chair facing; every other shape faces the table-local origin).
  const chairs = useMemo(() => chairPlacements(table.shape, table.capacity), [table.shape, table.capacity]);
  // Occupied seat indices — drives the instanced chairs' per-instance tint.
  const occupiedSeats = useMemo(() => new Set(seated?.keys() ?? []), [seated]);
  // The serpentine table top is a real curved ribbon (104° quarter-donut),
  // extruded from the canonical outline. Built once per shape and laid flat
  // (extrude axis → world +Y), rising from the floor to the tabletop height.
  const serpGeo = useMemo(() => {
    if (table.shape !== 'serpentine') return null;
    const shape = new THREE.Shape();
    serpentineBand().outline.forEach((p, i) => {
      // Shape lives in XY; after rotateX(−90°) it maps (x, −z) → world (x, h, z).
      if (i === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.74, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [table.shape]);
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
    const targetX = dragging && dragRef.current ? dragRef.current.x : home.x;
    const targetZ = dragging && dragRef.current ? dragRef.current.z : home.z;
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
          works; removed seats keep individual GHOST meshes for the restore tap. */}
      <InstancedChairs
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
      {/* Removed-seat ghosts (tap to restore) + seated guests. */}
      {chairs.map((c, i) => {
        const ang = c.faceY;
        const tok = seated?.get(i);
        const isRemoved = table.removedSeats.includes(i);
        if (!isRemoved && !tok) return null;
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
            {tok && !isRemoved ? <SeatedAvatar tok={tok} bodyMat={tokenMat(tok.attireColor ?? tok.color, tok.opacity)} /> : null}
          </group>
        );
      })}

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

function Walker({
  walker,
  palette,
  entrance,
  onArrive,
  reduced,
}: {
  walker: NonNullable<WalkerState>;
  palette: Lab3DPalette;
  entrance: Vec2;
  onArrive: () => void;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const done = useRef(false);
  const t = useRef(0);
  // Mirror into a ref so the useFrame loop reads the live value (no hook in loop).
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    idx.current = 0;
    done.current = false;
    t.current = 0;
    if (ref.current) {
      // Reduced motion: place the avatar AT its final seat immediately (no walk)
      // and complete the flow — fire onArrive so the "found their seat" payoff
      // still resolves. Otherwise spawn at the entrance and walk.
      if (reducedRef.current && walker.path.length > 0) {
        const end = walker.path[walker.path.length - 1]!;
        ref.current.position.set(end.x, 0, end.z);
        idx.current = walker.path.length - 1;
        done.current = true;
        onArrive();
      } else {
        ref.current.position.set(entrance.x, 0, entrance.z);
      }
    }
  }, [walker, entrance, onArrive]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const path = walker.path;
    if (reducedRef.current) {
      // Reduced motion: pin to the final seat, no bob. Ensure onArrive fired
      // (covers a mid-walk flag flip) so the flow always completes.
      if (path.length > 0) {
        const end = path[path.length - 1]!;
        g.position.set(end.x, 0, end.z);
      }
      if (!done.current) {
        done.current = true;
        onArrive();
      }
      return;
    }
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
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.5, 6, 12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} metalness={0.1} emissive={palette.accent} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={0.4} distance={3} color={palette.accent} />
    </group>
  );
}

// One member of the populate-Play crowd: a precomputed path to their chair, a
// motif colour, a stagger delay (so they queue out of the entrance instead of
// piling up), and their OWN obstacle set (every object except their destination
// table, so they can actually reach the chair just inside its avoidance disc).
type CrowdAgent = {
  id: string;
  name: string;
  path: Vec2[];
  color: string;
  startDelay: number;
  obstacles: { c: Vec2; r: number }[];
};

/**
 * Populate-Play: the whole seated guest list walks in at once. Each frame every
 * agent steps toward its next waypoint, then the set is resolved with
 * separateAgents ("make way for each other") and each agent is pushed clear of
 * its objects (pushOutOfDiscs) — so nobody overlaps or crosses a table/stage.
 * O(n²) separation is fine for a wedding's guest count; a spatial grid is the
 * documented v2. Reduced motion snaps everyone to their seat.
 */
function Crowd({
  agents,
  palette,
  reduced,
  onAllArrived,
}: {
  agents: CrowdAgent[];
  palette: Lab3DPalette;
  reduced: boolean;
  onAllArrived: () => void;
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const seg = useRef<number[]>([]);
  const elapsed = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  // Fire onAllArrived exactly once per crowd, a short beat AFTER everyone arrives
  // (lets them stand at the chair before the parent swaps in seated avatars). The
  // beat is tracked in elapsed-time refs owned by this component, so it resets with
  // the crowd — no detached timer that could outlive a re-run. Mirror the (stable)
  // callback into a ref so the frame loop reads it without re-subscribing.
  const firedRef = useRef(false); // onAllArrived already fired for this crowd?
  const settleAtRef = useRef<number | null>(null); // elapsed when everyone first arrived
  const onAllArrivedRef = useRef(onAllArrived);
  useEffect(() => {
    onAllArrivedRef.current = onAllArrived;
  }, [onAllArrived]);

  useEffect(() => {
    seg.current = agents.map(() => 0);
    elapsed.current = 0;
    firedRef.current = false;
    settleAtRef.current = null;
    agents.forEach((a, i) => {
      const g = groups.current[i];
      if (!g) return;
      if (reducedRef.current) {
        const end = a.path[a.path.length - 1] ?? { x: 0, z: 0 };
        g.position.set(end.x, 0, end.z);
        seg.current[i] = a.path.length - 1;
      } else {
        const s = a.path[0] ?? { x: 0, z: 0 };
        g.position.set(s.x, 0, s.z);
      }
    });
    // Reduced motion snaps everyone straight to their seat → settle immediately
    // (no walk, so no "stand a beat").
    if (reducedRef.current && agents.length && !firedRef.current) {
      firedRef.current = true;
      onAllArrivedRef.current();
    }
  }, [agents]);

  useFrame((_, delta) => {
    if (reducedRef.current) return; // snapped to seats in the effect above
    elapsed.current += delta;
    const step = 2.0 * delta; // ~2 m/s walk
    // 1. Each agent steps toward its next waypoint → desired positions.
    const desired: Vec2[] = agents.map((a, i) => {
      const g = groups.current[i];
      if (!g) return { x: 0, z: 0 };
      const cur = { x: g.position.x, z: g.position.z };
      if (elapsed.current < a.startDelay) return cur; // not released yet
      const ci = seg.current[i]!;
      if (ci >= a.path.length - 1) return cur; // arrived
      const next = a.path[ci + 1]!;
      const dx = next.x - cur.x;
      const dz = next.z - cur.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        seg.current[i] = ci + 1;
        return { x: next.x, z: next.z };
      }
      g.rotation.y = Math.atan2(dx, dz);
      return { x: cur.x + (dx / dist) * step, z: cur.z + (dz / dist) * step };
    });
    // 2. Make way for each other.
    const sep = separateAgents(desired, 0.5);
    // 3. Each clears its OWN objects, then commit + bob.
    agents.forEach((a, i) => {
      const g = groups.current[i];
      if (!g) return;
      const p = pushOutOfDiscs(sep[i]!, a.obstacles);
      g.position.x = p.x;
      g.position.z = p.z;
      const moving = elapsed.current >= a.startDelay && seg.current[i]! < a.path.length - 1;
      g.position.y = moving
        ? Math.abs(Math.sin((elapsed.current + i) * 8)) * 0.05
        : g.position.y + (0 - g.position.y) * Math.min(1, delta * 6);
    });
    // 4. Everyone released AND at their final waypoint → settle (once), holding a
    // ~0.6s beat so they stand at the chair before sitting. seg is logical progress
    // (advanced before separation), so a guest nudged off the exact spot by make-way
    // still counts as arrived — no hang.
    if (!firedRef.current && agents.length) {
      let all = true;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]!;
        if (elapsed.current < a.startDelay || seg.current[i]! < a.path.length - 1) {
          all = false;
          break;
        }
      }
      if (!all) {
        settleAtRef.current = null;
      } else {
        if (settleAtRef.current == null) settleAtRef.current = elapsed.current;
        else if (elapsed.current - settleAtRef.current >= 0.6) {
          firedRef.current = true;
          onAllArrivedRef.current();
        }
      }
    }
  });

  return (
    <group>
      {agents.map((a, i) => {
        // Under reduced motion the frame loop never runs, so place the agent AT its
        // seat right here in the JSX — correct at mount regardless of effect/render
        // ordering (no reliance on the imperative snap, no one-frame flash). For
        // normal motion the effect+frame loop own the position (entrance → walk),
        // so we leave it unset to avoid snapping a mid-walk agent back on re-render.
        const seat = a.path[a.path.length - 1] ?? { x: 0, z: 0 };
        const posed: [number, number, number] | undefined = reduced ? [seat.x, 0, seat.z] : undefined;
        return (
        <group
          key={a.id}
          position={posed}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <mesh position={[0, 0.5, 0]} castShadow>
            <capsuleGeometry args={[0.15, 0.4, 5, 9]} />
            <meshStandardMaterial color={a.color} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={palette.table} roughness={0.55} />
          </mesh>
        </group>
        );
      })}
    </group>
  );
}

// A guest token walking between seats during a swap. Colour = the guest's RSVP
// treatment; calls onDone(gid, target) once it reaches the destination chair.
function MoverToken({ mover, onDone, reduced }: { mover: Mover; onDone: (gid: string, target: SeatRef) => void; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const done = useRef(false);
  const t = useRef(0);
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
    g.position.y = Math.abs(Math.sin(t.current * 9)) * 0.07;
  });
  const transparent = mover.opacity < 1;
  return (
    <group ref={ref} position={[start.x, 0, start.z]}>
      <mesh geometry={TOKEN_BODY_GEO} position={[0, 0.62, 0]} castShadow>
        <meshStandardMaterial color={mover.color} roughness={0.5} transparent={transparent} opacity={mover.opacity} emissive={mover.color} emissiveIntensity={0.22} />
      </mesh>
      <mesh geometry={TOKEN_HEAD_GEO} position={[0, 0.92, 0]} castShadow>
        <meshStandardMaterial color={mover.color} roughness={0.5} transparent={transparent} opacity={mover.opacity} />
      </mesh>
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
 * pushOutOfDiscs so you can't walk through tables/stage. Renders nothing — it
 * just drives the existing camera while `active`; CameraRig is unmounted then.
 */
function WalkController({
  active,
  input,
  room,
  obstacles,
}: {
  active: boolean;
  input: React.MutableRefObject<WalkInput>;
  room: { w: number; d: number };
  obstacles: { c: Vec2; r: number }[];
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
      // Drop in at the current camera spot, at eye height, facing the room centre.
      pos.current.set(camera.position.x, 1.6, camera.position.z);
      yaw.current = Math.atan2(-camera.position.x, -camera.position.z);
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

/* -------------------------------- HUD (2D) -------------------------------- */

function Hud({
  mode,
  setMode,
  canEdit,
  lockStatus,
  onTakeOver,
  notice,
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
  linkArmed,
  onArmLink,
  onBreakApart,
  onPublish,
  printHref,
  tableCount,
}: {
  mode: 'build' | 'play';
  setMode: (m: 'build' | 'play') => void;
  canEdit: boolean;
  lockStatus: string;
  onTakeOver: () => void;
  notice: string | null;
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
  linkArmed: boolean;
  onArmLink: () => void;
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
      <div className="absolute bottom-4 left-4 top-20 flex w-64 flex-col gap-3">
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
                {canEdit ? (
                  selectedLinked ? (
                    <button
                      type="button"
                      onClick={onBreakApart}
                      className="mt-1.5 w-full rounded-lg bg-white/10 py-1.5 text-sm text-white transition hover:bg-white/20"
                    >
                      Break apart
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onArmLink}
                      className={`mt-1.5 w-full rounded-lg py-1.5 text-sm transition ${
                        linkArmed ? 'bg-amber-400/30 text-white ring-1 ring-amber-300/60' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {linkArmed ? 'Tap another table to link…' : 'Link to another table'}
                    </button>
                  )
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
