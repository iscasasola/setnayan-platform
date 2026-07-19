'use client';

/**
 * InstancedChairs — the shared per-table chair renderer for every 3D seat-plan
 * surface (Wave 2a realism foundation, 2026-07-03). This is the "documented v2
 * upgrade" the lab's per-chair meshes flagged: instead of two meshes PER CHAIR
 * (a 10-seat table = 20 draw calls just for chairs), each table renders exactly
 * TWO InstancedMesh draws — one for every seat cushion, one for every backrest —
 * regardless of capacity. A 15-table, 150-chair room drops from ~300 chair draw
 * calls to 30.
 *
 * Contract it honours (same as the meshes it replaces):
 *   · chair placement = `chairLocalPositions` / `serpentineChairs` (table-local,
 *     pre-rotation — the parent table <group> owns rotation + drag), facing the
 *     table via the exact `atan2(x, z)` the lab used;
 *   · `removedSeats` collapse to zero-scale instances (invisible, unraycastable,
 *     no shadow) — the LAB renders its own tappable ghost meshes on top for the
 *     restore affordance, this component just leaves the hole;
 *   · per-chair occupied/empty state via `instanceColor` (occupied seats warm
 *     toward the palette accent) — no extra draw calls, no extra materials;
 *   · optional per-seat pointer handler (`onSeatDown` receives the chair index
 *     from `instanceId`) so the lab's tap-to-remove keeps working.
 *
 * Materials: wood-grade roughness 0.6 (Wave 2a materials pass), base colour from
 * the caller's palette, instance colours multiply over white so tints stay true.
 *
 * DETACH-ONE-CHAIR (sit choreography, 2026-07-08): the sit-down clip needs ONE
 * chair to physically pull back + tuck in — an InstancedMesh can't animate a
 * single instance without rewriting the whole buffer every frame, so instead
 * the module exposes `detachChair(tableId, seat)` / `restoreChair(tableId,
 * seat)`: detach zero-scales that instance (the exact `removedSeats` treatment)
 * and returns its world transform so the caller mounts ONE real chair
 * (`kit/active-chair.tsx`, same shared geometry) in its place and animates
 * that. Tables opt in by passing the new optional `tableId` prop — the
 * component registers an imperative handle in a module registry keyed by it.
 * Everything else about the public component API is unchanged.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { chairLocalPositions, serpentineChairs, type ShapeHint } from '@/lib/seating-3d';

// Shared GPU buffers (module-level constants are never disposed by R3F).
// Identical dimensions to the lab's retired per-chair meshes so the silhouette
// doesn't change, only the draw-call count. EXPORTED so the detached "active"
// chair (kit/active-chair.tsx) mounts the IDENTICAL geometry — a pulled-back
// chair must be pixel-for-pixel the chair it replaced, never a re-model.
export const CHAIR_SEAT_GEO = new THREE.BoxGeometry(0.42, 0.07, 0.42);
export const CHAIR_BACK_GEO = new THREE.BoxGeometry(0.42, 0.44, 0.06);
export const CHAIR_SEAT_Y = 0.46;
export const CHAIR_BACK_LOCAL = new THREE.Vector3(0, 0.69, 0.19);

export type ChairPlacement = { x: number; z: number; faceY: number };

/** Chair centres + facing for a shape — serpentine carries its own per-chair
 *  facing (outer chairs look onto the band, inner outward); every other shape
 *  faces the table-local origin. Mirrors the lab's retired per-mesh logic. */
export function chairPlacements(shape: ShapeHint, capacity: number, even = false): ChairPlacement[] {
  // `even` → linked serpentine chains render chairs at a uniform spacing (no
  // seam pile-up); ignored for every other shape.
  if (shape === 'serpentine') return serpentineChairs(capacity, even);
  // One source of truth (slice-2 review fix): the chair yaw is the PROMOTED
  // SeatPose gaze + π (the documented backrest bridge) — never re-derived.
  // The old radial atan2(x, z) matched the gaze flip only for round tables;
  // on banquet rows it splayed end chairs diagonally and on sweethearts it
  // crossed them inward, so the sit choreography (which trusts SeatPose)
  // visibly popped at hand-off. Round is unchanged (radial ≡ gaze+π there);
  // banquet chairs now sit square to the linen, sweethearts front the room.
  return chairLocalPositions(shape, capacity).map((c) => {
    const yaw = c.faceY + Math.PI;
    return { x: c.x, z: c.z, faceY: Math.atan2(Math.sin(yaw), Math.cos(yaw)) };
  });
}

// ── Detach-one-chair API (sit choreography) ──────────────────────────────────

/** World transform of a detached chair: floor point + CHAIR yaw (backrest
 *  heading — the same convention as `ChairPlacement.faceY`, i.e. the seated
 *  guest's gaze + π). Y is omitted: every table group sits at floor 0. */
export type DetachedChairTransform = { x: number; z: number; yaw: number };

type ChairDetachHandle = {
  detach: (seatIndex: number) => DetachedChairTransform | null;
  restore: (seatIndex: number) => void;
};

// One InstancedChairs per table, so a plain Map keyed by tableId is the whole
// registry. Entries are registered/cleaned by the component's own effect —
// callers never touch the map directly.
const detachRegistry = new Map<string, ChairDetachHandle>();

/**
 * Zero-scale one chair instance (the `removedSeats` treatment: invisible,
 * unraycastable, no shadow) and return its world transform so the caller can
 * mount a REAL chair mesh (`kit/active-chair.tsx`) in its place. Returns null
 * when the table isn't registered (no `tableId` prop / not mounted), the seat
 * index is out of range, or the seat is a removed chair (nothing to hand over).
 * Idempotent — detaching an already-detached seat just re-returns the transform.
 */
export function detachChair(tableId: string, seatIndex: number): DetachedChairTransform | null {
  return detachRegistry.get(tableId)?.detach(seatIndex) ?? null;
}

/** Un-hide a detached chair instance (call after the sit clip hands the seated
 *  figure back to the normal seated path and the real chair unmounts). No-op
 *  for seats that aren't detached. */
export function restoreChair(tableId: string, seatIndex: number): void {
  detachRegistry.get(tableId)?.restore(seatIndex);
}

// Module-scope scratch for matrix writes + world-transform reads — the write
// path runs per chair per layout pass and imperatively from the detach handle;
// rendering is single-threaded, so shared scratch is safe and allocation-free.
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _off = new THREE.Vector3();
const _wp = new THREE.Vector3();
const _wq = new THREE.Quaternion();
const _ws = new THREE.Vector3();
const _v = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function InstancedChairs({
  chairs,
  removedSeats,
  occupiedSeats,
  color,
  occupiedTint = 0.28,
  accent,
  roughness = 0.6,
  castShadow = true,
  onSeatDown,
  tableId,
}: {
  /** Table-local chair placements (use `chairPlacements`). */
  chairs: ChairPlacement[];
  /** Seat indices the couple deleted — collapsed to invisible zero-scale instances. */
  removedSeats?: readonly number[];
  /** Seat indices with a guest on them — tinted toward `accent` via instanceColor. */
  occupiedSeats?: ReadonlySet<number>;
  /** Base chair colour (palette-driven — callers pass `palette.wall`). */
  color: string;
  /** How far an occupied seat warms toward the accent (0–1). */
  occupiedTint?: number;
  /** Accent colour occupied seats lean toward (callers pass `palette.accent`). */
  accent?: string;
  roughness?: number;
  castShadow?: boolean;
  /** Per-seat tap (lab's remove-chair tool) — receives the chair index. */
  onSeatDown?: (seatIndex: number, e: ThreeEvent<PointerEvent>) => void;
  /** Opt-in key for the detach-one-chair API (`detachChair`/`restoreChair`).
   *  Omit it and the component behaves exactly as before. */
  tableId?: string;
}) {
  const seatRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);
  const count = chairs.length;

  const removedSet = useMemo(() => new Set(removedSeats ?? []), [removedSeats]);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const occupiedColor = useMemo(
    () => (accent ? new THREE.Color(color).lerp(new THREE.Color(accent), occupiedTint) : new THREE.Color(color)),
    [color, accent, occupiedTint],
  );

  // Seats currently detached for a sit clip. A REF, not state: the layout pass
  // below re-runs mid-clip (seating a guest flips `occupiedSeats`, re-writing
  // every matrix) and the hole must survive those rewrites without re-rendering.
  const detachedRef = useRef<Set<number>>(new Set());

  // Write ONE chair's seat+back matrices and colours. Shared verbatim between
  // the layout pass (loops all i) and the imperative detach/restore handle
  // (touches exactly one i) so hidden-state logic can never diverge.
  const writeInstance = (i: number): void => {
    const seat = seatRef.current;
    const back = backRef.current;
    const c = chairs[i];
    if (!seat || !back || !c) return;
    const hidden = removedSet.has(i) || detachedRef.current.has(i);
    _q.setFromAxisAngle(Y_AXIS, c.faceY);
    _s.setScalar(hidden ? 0 : 1);
    // Seat cushion — the y-only offset is rotation-invariant.
    _p.set(c.x, CHAIR_SEAT_Y, c.z);
    _m.compose(_p, _q, _s);
    seat.setMatrixAt(i, _m);
    // Backrest — its z-offset swings with the chair's facing.
    _off.copy(CHAIR_BACK_LOCAL).applyQuaternion(_q);
    _p.set(c.x + _off.x, _off.y, c.z + _off.z);
    _m.compose(_p, _q, _s);
    back.setMatrixAt(i, _m);
    const col = occupiedSeats?.has(i) ? occupiedColor : baseColor;
    seat.setColorAt(i, col);
    back.setColorAt(i, col);
  };

  useLayoutEffect(() => {
    const seat = seatRef.current;
    const back = backRef.current;
    if (!seat || !back) return;
    for (let i = 0; i < count; i++) writeInstance(i);
    seat.instanceMatrix.needsUpdate = true;
    back.instanceMatrix.needsUpdate = true;
    if (seat.instanceColor) seat.instanceColor.needsUpdate = true;
    if (back.instanceColor) back.instanceColor.needsUpdate = true;
    // writeInstance is re-created per render but only reads the deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chairs, count, removedSet, occupiedSeats, baseColor, occupiedColor]);

  // Latest-closure refs for the registry handle (registered once per tableId,
  // but capacity/removed seats can change while it's live). Updated every
  // commit — same "cheap on purpose" rationale as the kit figure's freeze pass.
  const writeRef = useRef(writeInstance);
  const chairsRef = useRef(chairs);
  const removedRef = useRef(removedSet);
  useEffect(() => {
    writeRef.current = writeInstance;
    chairsRef.current = chairs;
    removedRef.current = removedSet;
  });

  useEffect(() => {
    if (!tableId) return;
    const handle: ChairDetachHandle = {
      detach: (seatIndex) => {
        const seat = seatRef.current;
        const back = backRef.current;
        const c = chairsRef.current[seatIndex];
        // A removed seat has no chair to hand over — refuse rather than return
        // a transform the caller would mount an orphan mesh at.
        if (!seat || !back || !c || removedRef.current.has(seatIndex)) return null;
        detachedRef.current.add(seatIndex);
        writeRef.current(seatIndex);
        seat.instanceMatrix.needsUpdate = true;
        back.instanceMatrix.needsUpdate = true;
        // World transform of the chair that just vanished: the mesh sits
        // directly in the table group, so its matrixWorld carries the table's
        // LIVE pose (drag slide-lag included) — truer than re-deriving from
        // xPct/rotationDeg math. Position: table-local floor point through the
        // full matrix; yaw: the local facing vector through the rotation only.
        seat.updateWorldMatrix(true, false);
        seat.matrixWorld.decompose(_wp, _wq, _ws);
        _v.set(c.x, 0, c.z).applyMatrix4(seat.matrixWorld);
        const x = _v.x;
        const z = _v.z;
        _v.set(Math.sin(c.faceY), 0, Math.cos(c.faceY)).applyQuaternion(_wq);
        return { x, z, yaw: Math.atan2(_v.x, _v.z) };
      },
      restore: (seatIndex) => {
        if (!detachedRef.current.delete(seatIndex)) return;
        const seat = seatRef.current;
        const back = backRef.current;
        if (!seat || !back) return;
        writeRef.current(seatIndex);
        seat.instanceMatrix.needsUpdate = true;
        back.instanceMatrix.needsUpdate = true;
      },
    };
    detachRegistry.set(tableId, handle);
    return () => {
      // Guard against a re-registered same-id handle (StrictMode double-mount).
      if (detachRegistry.get(tableId) === handle) detachRegistry.delete(tableId);
    };
  }, [tableId]);

  const handleDown = onSeatDown
    ? (e: ThreeEvent<PointerEvent>) => {
        if (e.instanceId == null) return;
        onSeatDown(e.instanceId, e);
      }
    : undefined;

  // `key={count}` recreates the InstancedMesh when capacity changes (instance
  // count is fixed at construction). `frustumCulled={false}` because an
  // InstancedMesh's bounding sphere is the (small, origin-centred) geometry's —
  // chairs spread metres from the table origin would pop out at screen edges.
  return (
    <>
      <instancedMesh
        key={`seat-${count}`}
        ref={seatRef}
        args={[CHAIR_SEAT_GEO, undefined, count]}
        castShadow={castShadow}
        frustumCulled={false}
        onPointerDown={handleDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={roughness} />
      </instancedMesh>
      <instancedMesh
        key={`back-${count}`}
        ref={backRef}
        args={[CHAIR_BACK_GEO, undefined, count]}
        castShadow={castShadow}
        frustumCulled={false}
        onPointerDown={handleDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={roughness} />
      </instancedMesh>
    </>
  );
}
