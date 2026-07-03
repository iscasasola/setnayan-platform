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
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { chairLocalPositions, serpentineChairs, type ShapeHint } from '@/lib/seating-3d';

// Shared GPU buffers (module-level constants are never disposed by R3F).
// Identical dimensions to the lab's retired CHAIR_SEAT_GEO / CHAIR_BACK_GEO so
// the silhouette doesn't change, only the draw-call count.
const SEAT_GEO = new THREE.BoxGeometry(0.42, 0.07, 0.42);
const BACK_GEO = new THREE.BoxGeometry(0.42, 0.44, 0.06);
const SEAT_Y = 0.46;
const BACK_LOCAL = new THREE.Vector3(0, 0.69, 0.19);

export type ChairPlacement = { x: number; z: number; faceY: number };

/** Chair centres + facing for a shape — serpentine carries its own per-chair
 *  facing (outer chairs look onto the band, inner outward); every other shape
 *  faces the table-local origin. Mirrors the lab's retired per-mesh logic. */
export function chairPlacements(shape: ShapeHint, capacity: number): ChairPlacement[] {
  if (shape === 'serpentine') return serpentineChairs(capacity);
  return chairLocalPositions(shape, capacity).map((c) => ({
    x: c.x,
    z: c.z,
    faceY: Math.atan2(c.x, c.z),
  }));
}

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

  useLayoutEffect(() => {
    const seat = seatRef.current;
    const back = backRef.current;
    if (!seat || !back) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const off = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const c = chairs[i]!;
      const removed = removedSet.has(i);
      q.setFromAxisAngle(yAxis, c.faceY);
      s.setScalar(removed ? 0 : 1);
      // Seat cushion — the y-only offset is rotation-invariant.
      p.set(c.x, SEAT_Y, c.z);
      m.compose(p, q, s);
      seat.setMatrixAt(i, m);
      // Backrest — its z-offset swings with the chair's facing.
      off.copy(BACK_LOCAL).applyQuaternion(q);
      p.set(c.x + off.x, off.y, c.z + off.z);
      m.compose(p, q, s);
      back.setMatrixAt(i, m);
      const col = occupiedSeats?.has(i) ? occupiedColor : baseColor;
      seat.setColorAt(i, col);
      back.setColorAt(i, col);
    }
    seat.instanceMatrix.needsUpdate = true;
    back.instanceMatrix.needsUpdate = true;
    if (seat.instanceColor) seat.instanceColor.needsUpdate = true;
    if (back.instanceColor) back.instanceColor.needsUpdate = true;
  }, [chairs, count, removedSet, occupiedSeats, baseColor, occupiedColor]);

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
        args={[SEAT_GEO, undefined, count]}
        castShadow={castShadow}
        frustumCulled={false}
        onPointerDown={handleDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={roughness} />
      </instancedMesh>
      <instancedMesh
        key={`back-${count}`}
        ref={backRef}
        args={[BACK_GEO, undefined, count]}
        castShadow={castShadow}
        frustumCulled={false}
        onPointerDown={handleDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={roughness} />
      </instancedMesh>
    </>
  );
}
