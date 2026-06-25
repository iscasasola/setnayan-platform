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
 * Performance: DPR capped, fake contact shadows, lightweight waypoint steering.
 * GLTF furniture + NavMesh + instancing + post-processing are the v2 upgrades.
 * Known v1 limit: a FREE board (no venue size) maps 0–100% onto a fixed room,
 * so widely-spread tables (percent > 100) can render off the visible floor —
 * a fit-frame transform (like the 2D editor's) is the documented follow-up.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { useSeatingLock } from '@/app/dashboard/[eventId]/seating/_components/use-seating-lock';
import { SeatingLockError } from '@/app/dashboard/[eventId]/seating/seating-lock-error';
import {
  assignGuest,
  createTable,
  deleteTable,
  updateTablePosition,
  updateTableRotation,
} from '@/app/dashboard/[eventId]/seating/actions';

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
  type Lab3DGuest,
  type Lab3DPalette,
  type Lab3DMonogram,
  type Vec2,
  roomSize,
  contentBounds,
  pctToWorld,
  tableDims,
  checkPlacement,
  chairLocalPositions,
  serpentineBand,
  serpentineChairs,
  seatWorld,
  floorObstacles,
  firstFreeSeatAtTable,
  pushOutOfDiscs,
  separateAgents,
  steerPath,
  resolvePalette,
  DEMO_PALETTES,
  seatStatusOf,
  SIDE_COLOR,
  TENTATIVE_COLOR,
  PLUS_ONE_COLOR,
} from '@/lib/seating-3d';
import { svgToMonogramTexture } from '@/lib/svg-monogram-texture';

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  paletteHexes: string[];
  /** The couple's canonical mark — rendered as a medallion on the floor centre
   *  (the Play-mode camera's focal point). null → no mark. */
  monogram: Lab3DMonogram;
  /** Couple owns the paid ANIMATED_MONOGRAM → the floor mark blooms in as the
   *  Play-mode camera settles. Free events render the static mark (the seat-plan
   *  tool stays free). */
  animatedMonogram: boolean;
  me: { id: string; name: string };
};

type LiveTable = Lab3DTable;
type SeatRef = { tableId: string; seatNumber: number };
type WalkerState = { name: string; path: Vec2[]; tableId: string } | null;

// Shared GPU buffers reused by every chair across every table (module-level
// constants are never disposed by R3F — safe to share). The big draw-call
// collapse (one InstancedMesh per shape) is the documented v2 upgrade.
const PEDESTAL_GEO = new THREE.CylinderGeometry(0.12, 0.16, 0.72, 12);
// Real-furniture parts (shared buffers): a chair = seat + backrest; a seated
// guest = body + head; a centerpiece = vase + bloom. Instancing is the v2 win.
const CHAIR_SEAT_GEO = new THREE.BoxGeometry(0.42, 0.07, 0.42);
const CHAIR_BACK_GEO = new THREE.BoxGeometry(0.42, 0.44, 0.06);
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
    photoUrl: g.photoUrl,
    attire: g.attire,
    attireColor: g.attireColor,
  };
}

/**
 * Lazily load a remote image into a texture. Manual (not drei's suspending
 * useTexture) so a failed/forbidden load degrades to null — the avatar falls
 * back to its coloured head rather than suspending or erroring the whole scene.
 * Cross-origin is requested so R2-served selfies can paint a WebGL texture
 * (needs the bucket to send CORS headers; if it doesn't, onError → fallback).
 */
function useImageTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (t) => {
        if (!alive) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      () => {
        if (alive) setTex(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return tex;
}

/**
 * A seated guest: a coloured body token, topped by the guest's selfie as a
 * camera-facing disc (ringed in their RSVP colour) when a photo is available,
 * else the plain coloured head. One component per seated chair so the texture
 * hook is a stable top-level call.
 */
function SeatedAvatar({ tok, bodyMat }: { tok: SeatToken; bodyMat: THREE.Material }) {
  const tex = useImageTexture(tok.photoUrl);
  // Attire-driven silhouette: gown / suit / plain token. Gown sits a touch
  // higher so the flared skirt clears the chair seat.
  const bodyGeo = tok.attire === 'gown' ? GOWN_GEO : tok.attire === 'suit' ? SUIT_GEO : TOKEN_BODY_GEO;
  const bodyY = tok.attire === 'gown' ? 0.72 : 0.7;
  return (
    <group position={[0, 0, -0.04]}>
      <mesh geometry={bodyGeo} position={[0, bodyY, 0]} material={bodyMat} />
      {tex ? (
        <Billboard position={[0, 1.04, 0]}>
          {/* RSVP-coloured ring behind the photo */}
          <mesh position={[0, 0, -0.001]}>
            <circleGeometry args={[0.17, 28]} />
            <meshBasicMaterial color={tok.color} transparent opacity={tok.opacity} />
          </mesh>
          {/* the selfie */}
          <mesh>
            <circleGeometry args={[0.15, 28]} />
            <meshBasicMaterial map={tex} transparent opacity={tok.opacity} toneMapped={false} />
          </mesh>
        </Billboard>
      ) : (
        <mesh geometry={TOKEN_HEAD_GEO} position={[0, 1.0, 0]} material={bodyMat} />
      )}
    </group>
  );
}

// A guest token animating between seats during a swap / table-swap.
type Mover = { gid: string; color: string; opacity: number; path: Vec2[]; target: SeatRef };

export default function SeatingLab3D({ eventId, tables: initialTables, floor, guests, paletteHexes, monogram, animatedMonogram, me }: Props) {
  const router = useRouter();
  // ONE reduced-motion flag threaded to every JS-driven motion (camera ease,
  // walk/swap glide+bob, table slide-lag + pop, orbit momentum). SSR-safe +
  // live-updating. The flow still COMPLETES when reduced — we drop the easing
  // and snap to the same final state, firing the same completion callbacks.
  const reduced = usePrefersReducedMotion();
  const room = useMemo(() => roomSize(floor), [floor]);
  const [mode, setMode] = useState<'build' | 'play'>('build');
  const [paletteKey, setPaletteKey] = useState('mood');
  const palette = useMemo<Lab3DPalette>(() => {
    if (paletteKey === 'mood') return resolvePalette(paletteHexes);
    return DEMO_PALETTES.find((p) => p.key === paletteKey)?.palette ?? resolvePalette(paletteHexes);
  }, [paletteKey, paletteHexes]);

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
      const known = new Set(prev.map((t) => t.id));
      const added = initialTables.filter((t) => !known.has(t.id));
      return added.length ? [...prev, ...added] : prev;
    });
  }, [initialTables]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [camBusy, setCamBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [walker, setWalker] = useState<WalkerState>(null);
  // Populate-Play: when set, the whole seated list walks in at once (mutually
  // exclusive with the single `walker`).
  const [crowd, setCrowd] = useState<CrowdAgent[] | null>(null);
  // Precise placement: an unseated guest "picked up" from the roster, waiting
  // for the couple to tap the table they should sit at (vs auto-first-free).
  const [placingGuestId, setPlacingGuestId] = useState<string | null>(null);
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
  const guestById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
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
    const plusOneSeated = new Set<string>(); // primaries whose +1 is already seated
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      if (!g) continue;
      if (g.plusOneOfGuestId) plusOneSeated.add(g.plusOneOfGuestId);
      if (movingGuests.has(gid)) continue; // mid-swap → drawn by its mover instead
      const style = guestTokenStyle(g);
      if (!style) continue; // declined → freed seat
      slot(s.tableId).set(s.seatNumber, style);
    }
    for (const [gid, s] of seats) {
      const g = guestById.get(gid);
      if (!g || !g.plusOneAllowed || plusOneSeated.has(gid) || seatStatusOf(g.rsvp) === 'hidden') continue;
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
      if (chosen >= 0) occ.set(chosen, { color: PLUS_ONE_COLOR, opacity: 0.4 });
    }
    return out;
  }, [seats, guestById, tablesById, movingGuests]);

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
      if (mode === 'build') setSelectedId(null);
    },
    [mode],
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
      const end = seatWorld(table, seat.seatNumber, room);
      // Clear every fixed object — other tables, the stage, the dance floor —
      // not just the tables, so the walker never cuts across the stage.
      const obstacles = floorObstacles(floor, tables, room, [seat.tableId]);
      const path = steerPath(entranceWorld, end, obstacles, 0.2);
      setMode('play');
      setArrived(null);
      setCrowd(null); // a single walk-in supersedes any populated crowd
      setWalker({ name: g.name, path, tableId: seat.tableId });
      return true;
    },
    [seats, tables, tablesById, room, entranceWorld, floor],
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
      const end = seatWorld(table, s.seatNumber, room);
      const obstacles = floorObstacles(floor, tables, room, [s.tableId]);
      const path = steerPath(entranceWorld, end, obstacles, 0.2);
      const style = guestTokenStyle(g);
      const color = style?.attireColor ?? style?.color ?? SIDE_COLOR[g.side];
      agents.push({ id: gid, name: g.name, path, color, startDelay: i * 0.16, obstacles });
      i += 1;
    }
    setWalker(null);
    setArrived(null);
    setMode('play');
    setCrowd(agents.length ? agents : null);
  }, [seats, guestById, tablesById, room, floor, tables, entranceWorld]);

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

  // Reassign guest `gid` to (toTableId, toSeat): persist (lock-gated) + fly a
  // token from its current seat to the new one.
  const moveGuestTo = useCallback(
    (gid: string, fromWorld: Vec2, toTableId: string, toSeat: number) => {
      const g = guestById.get(gid);
      const t = tablesById.get(toTableId);
      if (!g || !t) return;
      const end = seatWorld(t, toSeat, room);
      const fromTableId = seats.get(gid)?.tableId;
      const obstacles = floorObstacles(floor, tables, room, [toTableId, fromTableId]);
      const path = steerPath(fromWorld, end, obstacles, 0.2);
      const style = guestTokenStyle(g) ?? { color: SIDE_COLOR[g.side], opacity: 1 };
      setMovers((prev) => [
        ...prev,
        { gid, color: style.color, opacity: style.opacity, path, target: { tableId: toTableId, seatNumber: toSeat } },
      ]);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('lock_id', lock.lockId ?? '');
      fd.set('table_id', toTableId);
      fd.set('guest_id', gid);
      fd.set('seat_number', String(toSeat));
      void persist(() => assignGuest(fd));
    },
    [guestById, tablesById, tables, seats, room, eventId, lock.lockId, persist, floor],
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
      moveGuestTo(a, A.world, B.seat.tableId, B.seat.seatNumber);
      moveGuestTo(b, B.world, A.seat.tableId, A.seat.seatNumber);
    },
    [canEdit, movingGuests, seatWorldOf, moveGuestTo],
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
      for (let i = 0; i < maxc; i++) {
        const g1 = o1.get(i);
        const g2 = o2.get(i);
        if (g1) {
          const w = seatWorldOf(g1);
          if (w) moveGuestTo(g1, w.world, t2, i);
        }
        if (g2) {
          const w = seatWorldOf(g2);
          if (w) moveGuestTo(g2, w.world, t1, i);
        }
      }
    },
    [canEdit, tablesById, seats, movingGuests, seatWorldOf, moveGuestTo],
  );

  const onTableDown = useCallback(
    (id: string) => {
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
    [placingGuestId, guestById, sendGuest, tableSwapArmed, tableSwapFirst, swapTables, mode, canEdit, room, tablesById],
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

        <RoomShell
          room={room}
          floor={floor}
          palette={palette}
          buildMode={mode === 'build'}
          monogram={monogram}
          animatedMonogram={animatedMonogram}
          playSettled={mode === 'play' && !camBusy}
        />

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
            interactive={mode === 'build' && canEdit}
            onDown={onTableDown}
            showCloth={showCloth}
            showAccents={showAccents}
            seated={seatedByTable.get(t.id)}
            reduced={reduced}
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

        {walker && !crowd ? (
          <Walker
            walker={walker}
            palette={palette}
            entrance={entranceWorld}
            onArrive={() => setArrived(walker.name)}
            reduced={reduced}
          />
        ) : null}

        {mode === 'play' && crowd ? <Crowd agents={crowd} palette={palette} reduced={reduced} /> : null}

        {movers.map((m) => (
          <MoverToken key={m.gid} mover={m} onDone={onMoverDone} reduced={reduced} />
        ))}

        <CameraRig mode={mode} room={room} onBusy={setCamBusy} reduced={reduced} />
        <OrbitControls
          makeDefault
          enabled={!draggingId && !camBusy}
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
        onRotate={rotateSelected}
        onDelete={deleteSelected}
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
        selectedLabel={selectedId ? tablesById.get(selectedId)?.label ?? null : null}
        tableCount={tables.length}
      />
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
  buildMode,
  monogram,
  animatedMonogram,
  playSettled,
}: {
  room: { w: number; d: number };
  floor: Lab3DFloor;
  palette: Lab3DPalette;
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
  const wallH = 1.1;

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
  showCloth: boolean;
  showAccents: boolean;
  seated: Map<number, SeatToken> | undefined;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  // Chair centres + facing. Serpentine carries its own per-chair facing (outer
  // chairs look inward onto the band, inner chairs outward); every other shape
  // faces the table-local origin via atan2, matching the rendered geometry.
  const chairs = useMemo(() => {
    if (table.shape === 'serpentine') return serpentineChairs(table.capacity);
    return chairLocalPositions(table.shape, table.capacity).map((c) => ({
      x: c.x,
      z: c.z,
      faceY: Math.atan2(c.x, c.z),
    }));
  }, [table.shape, table.capacity]);
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
  // Share materials by reference (one per table, not one per chair/token) — the
  // cheap pre-instancing win. Full InstancedMesh is the documented v2 collapse.
  const chairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.7 }),
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
            <mesh position={[0, 0.37, 0]}>
              <cylinderGeometry args={[dims.w / 2, dims.w / 2 + 0.04, 0.74, 32]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.745, 0]}>
              <cylinderGeometry args={[dims.w / 2, dims.w / 2, 0.04, 32]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} />
            </mesh>
          </group>
        ) : (
          <group>
            <mesh position={[0, 0.37, 0]}>
              <boxGeometry args={[dims.w, 0.74, dims.d]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.745, 0]}>
              <boxGeometry args={[dims.w + 0.04, 0.04, dims.d + 0.04]} />
              <meshStandardMaterial color={clothColor} roughness={0.85} />
            </mesh>
          </group>
        )
      ) : (
        <group>
          <mesh position={[0, 0.74, 0]} castShadow>
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

      {/* Chairs (seat + backrest, oriented to face the table) + seated guests */}
      {chairs.map((c, i) => {
        const ang = c.faceY;
        const tok = seated?.get(i);
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
            <mesh geometry={CHAIR_SEAT_GEO} position={[0, 0.46, 0]} material={chairMat} />
            <mesh geometry={CHAIR_BACK_GEO} position={[0, 0.69, 0.19]} material={chairMat} />
            {tok ? <SeatedAvatar tok={tok} bodyMat={tokenMat(tok.attireColor ?? tok.color, tok.opacity)} /> : null}
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
function Crowd({ agents, palette, reduced }: { agents: CrowdAgent[]; palette: Lab3DPalette; reduced: boolean }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const seg = useRef<number[]>([]);
  const elapsed = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    seg.current = agents.map(() => 0);
    elapsed.current = 0;
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
  });

  return (
    <group>
      {agents.map((a, i) => (
        <group
          key={a.id}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <mesh position={[0, 0.5, 0]}>
            <capsuleGeometry args={[0.15, 0.4, 5, 9]} />
            <meshStandardMaterial color={a.color} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={palette.table} roughness={0.55} />
          </mesh>
        </group>
      ))}
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
      <mesh geometry={TOKEN_BODY_GEO} position={[0, 0.62, 0]}>
        <meshStandardMaterial color={mover.color} roughness={0.5} transparent={transparent} opacity={mover.opacity} emissive={mover.color} emissiveIntensity={0.22} />
      </mesh>
      <mesh geometry={TOKEN_HEAD_GEO} position={[0, 0.92, 0]}>
        <meshStandardMaterial color={mover.color} roughness={0.5} transparent={transparent} opacity={mover.opacity} />
      </mesh>
    </group>
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
  onRotate,
  onDelete,
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
  selectedLabel,
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
  onRotate: (delta: number) => void;
  onDelete: () => void;
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
              <button
                type="button"
                onClick={onAddTable}
                className="mb-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                + Add a table
              </button>
            )}
            {selectedLabel ? (
              <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
                <p className="mb-1.5 truncate text-xs font-medium text-white/85">{selectedLabel}</p>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={!canEdit} onClick={() => onRotate(-15)} aria-label="Rotate left" className="flex-1 rounded-lg bg-white/10 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-40">⟲</button>
                  <button type="button" disabled={!canEdit} onClick={() => onRotate(15)} aria-label="Rotate right" className="flex-1 rounded-lg bg-white/10 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-40">⟳</button>
                  <button type="button" disabled={!canEdit} onClick={onDelete} className="flex-1 rounded-lg bg-danger-500/30 py-1.5 text-sm text-white hover:bg-danger-500/50 disabled:opacity-40">Delete</button>
                </div>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed text-white/70">
              {canEdit ? 'Tap a table to select · drag to slide it. ' : ''}Drag empty space to orbit ·
              scroll to zoom.
            </p>
            <p className="mt-2 text-[11px] text-white/50">{tableCount} tables</p>
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
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onGuestTap(g)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-white/90 transition ${
                        placing
                          ? 'bg-amber-400/25 ring-1 ring-amber-300/60'
                          : selected
                            ? 'bg-white/25 ring-1 ring-white/50'
                            : 'hover:bg-white/15'
                      }`}
                    >
                      <span className="truncate">{g.name}</span>
                      <span className={`ml-2 shrink-0 text-[10px] ${seated ? 'text-white/55' : 'text-white/40'}`}>
                        {placing ? 'placing…' : selected ? 'swap?' : seated ? 'seated' : 'place'}
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
