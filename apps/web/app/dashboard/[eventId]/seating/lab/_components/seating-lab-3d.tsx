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
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useSeatingLock } from '@/app/dashboard/[eventId]/seating/_components/use-seating-lock';
import { SeatingLockError } from '@/app/dashboard/[eventId]/seating/seating-lock-error';
import {
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
  seatStatusOf,
  SIDE_COLOR,
  TENTATIVE_COLOR,
  PLUS_ONE_COLOR,
} from '@/lib/seating-3d';

type Props = {
  eventId: string;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  paletteHexes: string[];
  coupleNames: string | null;
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
const VASE_GEO = new THREE.CylinderGeometry(0.085, 0.12, 0.24, 10);
const BLOOM_GEO = new THREE.IcosahedronGeometry(0.2, 0);

/** Per-seat token treatment computed from a guest's RSVP (see lib seatStatusOf). */
type SeatToken = { color: string; opacity: number };

/** A guest's token colour/opacity, or null when their seat is freed (declined). */
function guestTokenStyle(g: Lab3DGuest): SeatToken | null {
  const status = seatStatusOf(g.rsvp);
  if (status === 'hidden') return null;
  return {
    color: status === 'confirmed' ? SIDE_COLOR[g.side] : TENTATIVE_COLOR,
    opacity: status === 'confirmed' ? 1 : 0.62,
  };
}

// A guest token animating between seats during a swap / table-swap.
type Mover = { gid: string; color: string; opacity: number; path: Vec2[]; target: SeatRef };

export default function SeatingLab3D({ eventId, tables: initialTables, floor, guests, paletteHexes, me }: Props) {
  const router = useRouter();
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
  // Reconcile with the server snapshot by MERGING new rows in (not blind
  // replace) — so a router.refresh (from add, or a lost-lock recovery) can't
  // clobber an in-flight optimistic move/rotation. Deleted/peer changes
  // reconcile on a full reload; while the lab holds the lock it's the only
  // writer, so add-the-new-row is sufficient.
  useEffect(() => {
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
  // once (notifyLost) + reconciles the optimistic 3D state with the server; any
  // OTHER error is surfaced without a misleading "lost access" re-acquire.
  const persist = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        if (isLockLost(err)) {
          notifyLost();
          setNotice('Editing was taken over — your last change wasn’t saved.');
          router.refresh();
        } else {
          setNotice('Couldn’t save that change — please try again.');
        }
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
  }, [room, floor, canEdit, eventId, lock.lockId, persist]);

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

  // Move guest `gid` to (toTableId, toSeat) as a LOCAL Play-mode preview — fly
  // a token from its current seat to the new one and (on arrival) update local
  // `seats`. NOT persisted: a swap is two reassignments and persisting them
  // non-atomically (two assignGuest upserts, no seat-collision constraint) can
  // corrupt the SHARED event_seat_assignments table on a partial failure. Real
  // persistence needs an atomic swap RPC + seat-what-fits — the documented
  // follow-up. So swaps stay a what-if preview here; Build-mode edits persist.
  const moveGuestTo = useCallback(
    (gid: string, fromWorld: Vec2, toTableId: string, toSeat: number) => {
      const g = guestById.get(gid);
      const t = tablesById.get(toTableId);
      if (!g || !t) return;
      const end = seatWorld(t, toSeat, room);
      const fromTableId = seats.get(gid)?.tableId;
      const obstacles = tables
        .filter((tb) => tb.id !== toTableId && tb.id !== fromTableId)
        .map((tb) => ({ c: pctToWorld(tb.xPct, tb.yPct, room), r: tableAvoidR(tb) }));
      const path = steerPath(fromWorld, end, obstacles, 0.2);
      const style = guestTokenStyle(g) ?? { color: SIDE_COLOR[g.side], opacity: 1 };
      setMovers((prev) => [
        ...prev,
        { gid, color: style.color, opacity: style.opacity, path, target: { tableId: toTableId, seatNumber: toSeat } },
      ]);
    },
    [guestById, tablesById, tables, seats, room],
  );

  const swapGuests = useCallback(
    (a: string, b: string) => {
      if (a === b || movingGuests.has(a) || movingGuests.has(b)) return;
      const ga = guestById.get(a);
      const gb = guestById.get(b);
      if (!ga || !gb || !guestTokenStyle(ga) || !guestTokenStyle(gb)) return; // skip declined
      const A = seatWorldOf(a);
      const B = seatWorldOf(b);
      if (!A || !B) return;
      setMode('play');
      moveGuestTo(a, A.world, B.seat.tableId, B.seat.seatNumber);
      moveGuestTo(b, B.world, A.seat.tableId, A.seat.seatNumber);
    },
    [movingGuests, guestById, seatWorldOf, moveGuestTo],
  );

  const swapTables = useCallback(
    (t1: string, t2: string) => {
      const T1 = tablesById.get(t1);
      const T2 = tablesById.get(t2);
      if (t1 === t2 || !T1 || !T2) return;
      // Occupants of a table (skip mid-flight + declined), in seat order.
      const occList = (tid: string) => {
        const pairs: { seat: number; gid: string }[] = [];
        for (const [gid, s] of seats) {
          if (s.tableId !== tid || movingGuests.has(gid)) continue;
          const g = guestById.get(gid);
          if (!g || !guestTokenStyle(g)) continue;
          pairs.push({ seat: s.seatNumber, gid });
        }
        return pairs.sort((x, y) => x.seat - y.seat).map((p) => p.gid);
      };
      // Pack incoming guests into the destination's valid (non-removed, in-
      // capacity) chairs — seat-what-fits, so no token lands on a phantom seat
      // (handles differing capacities / deleted chairs). Overflow stays put.
      const fit = (dest: LiveTable, incoming: string[]) => {
        const removed = new Set(dest.removedSeats.filter((i) => Number.isInteger(i) && i >= 0 && i < dest.capacity));
        const out: { gid: string; seat: number }[] = [];
        let seat = 0;
        for (const gid of incoming) {
          while (seat < dest.capacity && removed.has(seat)) seat++;
          if (seat >= dest.capacity) break;
          out.push({ gid, seat });
          seat++;
        }
        return out;
      };
      const into2 = fit(T2, occList(t1));
      const into1 = fit(T1, occList(t2));
      if (!into2.length && !into1.length) return;
      setMode('play');
      for (const { gid, seat } of into2) {
        const w = seatWorldOf(gid);
        if (w) moveGuestTo(gid, w.world, t2, seat);
      }
      for (const { gid, seat } of into1) {
        const w = seatWorldOf(gid);
        if (w) moveGuestTo(gid, w.world, t1, seat);
      }
    },
    [tablesById, seats, movingGuests, guestById, seatWorldOf, moveGuestTo],
  );

  const onTableDown = useCallback(
    (id: string) => {
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
    [tableSwapArmed, tableSwapFirst, swapTables, mode, canEdit, room, tablesById],
  );

  // A guest-list tap: an UNSEATED guest walks in; a SEATED guest enters or
  // completes a swap selection.
  const onGuestTap = useCallback(
    (g: Lab3DGuest) => {
      if (!seats.has(g.id)) {
        sendGuest(g);
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
    [seats, sendGuest, swapSelId, swapGuests],
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
            interactive={mode === 'build' && canEdit}
            onDown={onTableDown}
            showCloth={showCloth}
            showAccents={showAccents}
            seated={seatedByTable.get(t.id)}
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

        {movers.map((m) => (
          <MoverToken key={m.gid} mover={m} onDone={onMoverDone} />
        ))}

        <CameraRig mode={mode} room={room} onBusy={setCamBusy} />
        <OrbitControls
          makeDefault
          enabled={!draggingId && !camBusy}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={room.d * 3}
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
}: {
  mode: 'build' | 'play';
  room: { w: number; d: number };
  onBusy: (b: boolean) => void;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const easing = useRef(false);
  useEffect(() => {
    if (mode === 'build') target.current.set(0, room.d * 1.9, room.d * 0.3);
    else target.current.set(0, room.d * 1.05 + 6, room.d * 0.95 + 6);
    easing.current = true;
    onBusy(true);
  }, [mode, room, onBusy]);
  useFrame((_, dt) => {
    if (!easing.current) return;
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
  showCloth,
  showAccents,
  seated,
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
}) {
  const ref = useRef<THREE.Group>(null);
  const dims = useMemo(() => tableDims(table.shape, table.capacity), [table.shape, table.capacity]);
  const chairs = useMemo(() => chairLocalPositions(table.shape, table.capacity), [table.shape, table.capacity]);
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
          else a bare top + pedestal. */}
      {showCloth ? (
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

      {/* Centerpiece accent (toggle) */}
      {showAccents ? (
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
        const ang = Math.atan2(c.x, c.z);
        const tok = seated?.get(i);
        return (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, ang, 0]}>
            <mesh geometry={CHAIR_SEAT_GEO} position={[0, 0.46, 0]} material={chairMat} />
            <mesh geometry={CHAIR_BACK_GEO} position={[0, 0.69, 0.19]} material={chairMat} />
            {tok ? (
              <group position={[0, 0, -0.04]}>
                <mesh geometry={TOKEN_BODY_GEO} position={[0, 0.7, 0]} material={tokenMat(tok.color, tok.opacity)} />
                <mesh geometry={TOKEN_HEAD_GEO} position={[0, 1.0, 0]} material={tokenMat(tok.color, tok.opacity)} />
              </group>
            ) : null}
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

// A guest token walking between seats during a swap. Colour = the guest's RSVP
// treatment; calls onDone(gid, target) once it reaches the destination chair.
function MoverToken({ mover, onDone }: { mover: Mover; onDone: (gid: string, target: SeatRef) => void }) {
  const ref = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const done = useRef(false);
  const t = useRef(0);
  const start = mover.path[0] ?? { x: 0, z: 0 };
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta;
    const path = mover.path;
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
          <button type="button" onClick={onDismissNotice} className="text-white/60 hover:text-white">✕</button>
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
            <p className="mb-2 text-[11px] text-white/60">
              {swapSelId
                ? 'Tap another seated guest to swap'
                : `${seatedCount} seated · tap two to swap, or an empty one to walk in`}
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
            <p className="mb-2 text-[10px] leading-snug text-white/45">
              Swaps are a what-if preview — not saved yet.
            </p>
            <div className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
              {guests.length === 0 ? (
                <p className="text-xs text-white/55">No guests yet.</p>
              ) : (
                guests.map((g) => {
                  const seated = seats.has(g.id);
                  const selected = swapSelId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onGuestTap(g)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-white/90 transition ${
                        selected ? 'bg-white/25 ring-1 ring-white/50' : 'hover:bg-white/15'
                      }`}
                    >
                      <span className="truncate">{g.name}</span>
                      <span className={`ml-2 shrink-0 text-[10px] ${seated ? 'text-white/55' : 'text-white/40'}`}>
                        {selected ? 'swap?' : seated ? 'seated' : 'walk'}
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
