'use client';

/**
 * entrance-tunnel — the evolved entrance-tunnel treatments (owner-locked
 * catalog `0008_3DPlan_Tunnel_Catalog_2026-07-08.md`). Ship-first #1:
 *
 * <ColdSparkTunnel> — the cold-spark fountain walk (catalog `cold_spark` row +
 * § 4 walk-integration spec). Near-zero structure: a 6.0 m corridor along the
 * entrance approach with 8 small dark machine boxes in 2 rows (4 pairs at bay
 * midpoints); each fountain is a tall thin drei <Sparkles> volume over an
 * emissive core cone (the Play-mode bloom stars), with 2–3 stacked soft-alpha
 * disc planes as low fog hugging the walkway.
 *
 * SEQUENCED TO THE WALK: the component consumes a `progressRef` — the walker's
 * path-t along the tunnel segment (0 at the entrance mouth, 1 at the exit,
 * −1 = nobody walking). The projection is LATERALLY GATED: a walker more than
 * COLD_SPARK_GATE_M off the centreline reads as −1, so roam walks elsewhere in
 * the room (or a seat approach swinging back near the entrance wall) can
 * neither fire the fountains nor dim pairs a real tunnel pass lit. Fountain
 * pairs ramp opacity/intensity as the walker approaches them, so the tunnel of
 * light builds in real time; at t ≥ COLD_SPARK_CLIMAX_T (0.85) the FINAL pair
 * ignites brighter — intensity ramp only in this slice (the chase-cam tilt-up
 * ships with cinematic Play). Idle (progressRef −1 / absent) = gentle low
 * shimmer.
 *
 * SHALLOW ROOMS: the 6.0 m corridor is the NOMINAL build — the frame clamps
 * the effective length (`frame.len`) to the room's inward depth (minus the
 * lead-out + a wall clearance), scaling every bay with it, so a 4–6 m room
 * keeps machines, path nodes and the lead-out INSIDE the walls instead of
 * threading the demo walker through the far wall.
 *
 * WALL-CLOCK LAW: every ramp is a PURE function of the walker's progress plus
 * a frame-rate-independent damp toward it — nothing accumulates per frame, so
 * a starved rAF frame consumes all owed progress and the walk's completion is
 * never gated on the tunnel (it is purely decorative).
 *
 * REALISM RULE (locked): sparks are titanium gold-white, NEVER palette-tinted.
 * The palette reaches only the runner (primary/accent) and the fog wash tint.
 *
 * Reduced motion: fountains render STATIC at the low idle shimmer (particle
 * drift speed 0, no ramps) — the walk itself completes exactly as today.
 *
 * Pure geometry helpers (frame · obstacle discs · path nodes · progress
 * projection) are exported so every walking surface registers the machine
 * boxes the same way booths do (`templateBoothObstacles` precedent) and the
 * scripted walk can thread the tunnel centreline.
 */

import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import type { Lab3DPalette, ObstacleDisc, Vec2 } from '@/lib/seating-3d';

type Room = { w: number; d: number };
type TunnelQuality = 'high' | 'low';

// ── Catalog § 4 geometry (cold_spark row) ────────────────────────────────────

/** NOMINAL corridor length — cold_spark runs 6.0 m (catalog exception to the
 *  9 m default). The frame clamps the EFFECTIVE length (`frame.len`) to the
 *  room's inward depth; every bay position scales with it. */
export const COLD_SPARK_LENGTH_M = 6.0;
/** Machine rows flank the 2.4 m interior clear width. */
const ROW_X_M = 1.2;
/** Obstacle disc radius at each machine box (catalog § 4: r 0.3 m). */
const MACHINE_R_M = 0.3;
/** 4 fountain pairs at the midpoints of four 1.5 m bays (nominal-length s). */
const PAIR_S_M = [0.75, 2.25, 3.75, 5.25] as const;
/** Lead-in/lead-out path nodes sit 0.5 m beyond the mouths (§ 4 path threading). */
const LEAD_M = 0.5;
/** Clearance kept between the lead-out node and the far wall (machine half-
 *  depth 0.22 m + walker body radius headroom) when clamping `frame.len`. */
const WALL_CLEAR_M = 0.45;
/** Degenerate floor on the clamped corridor length (one nominal bay). */
const MIN_LENGTH_M = 1.5;
/** Path-t along the tunnel segment where the final pair's climax beat fires. */
export const COLD_SPARK_CLIMAX_T = 0.85;
/** Lateral half-width of the progress projection: a walker further than this
 *  off the centreline is NOT in the tunnel (projection reads −1). Matches the
 *  machine-row offset — the corridor's own width. */
export const COLD_SPARK_GATE_M = 1.2;

// Titanium gold-white — the fixed cold-pyro colour. NEVER palette-tinted.
const SPARK_COLOR = '#fff1d9';

/** The tunnel's world frame: outer mouth at the entrance mark, axis along the
 *  room-inward normal of the wall the entrance sits on, `len` = the EFFECTIVE
 *  corridor length (nominal 6.0 m, clamped to the room's inward depth so
 *  shallow custom rooms never push the build through the far wall). */
export type ColdSparkFrame = { origin: Vec2; dir: Vec2; len: number };

/** Inward approach vector: axis-aligned normal of the NEAREST wall (the
 *  entrance always sits on one), pointing into the room. A dead-centre
 *  entrance (degenerate) falls back to "faces −z", matching the default
 *  `{ xPct: 50, yPct: 96 }` entrance on the +z wall. The corridor length is
 *  clamped so the lead-out node keeps WALL_CLEAR_M off the far wall (venue
 *  dims are user-editable down to 4 m — seating-editor clamp). */
export function coldSparkFrame(entrance: Vec2, room: Room): ColdSparkFrame {
  const dLeft = entrance.x + room.w / 2;
  const dRight = room.w / 2 - entrance.x;
  const dBack = entrance.z + room.d / 2;
  const dFront = room.d / 2 - entrance.z;
  const min = Math.min(dLeft, dRight, dBack, dFront);
  let dir: Vec2 = { x: 0, z: -1 }; // +z wall (the default entrance) → walk −z
  let avail = dBack; // walking −z: depth from the entrance to the −z wall
  if (min === dLeft) {
    dir = { x: 1, z: 0 };
    avail = dRight;
  } else if (min === dRight) {
    dir = { x: -1, z: 0 };
    avail = dLeft;
  } else if (min === dBack) {
    dir = { x: 0, z: 1 };
    avail = dFront;
  }
  const len = Math.min(COLD_SPARK_LENGTH_M, Math.max(MIN_LENGTH_M, avail - LEAD_M - WALL_CLEAR_M));
  return { origin: { x: entrance.x, z: entrance.z }, dir, len };
}

/** Bay-midpoint axial positions, scaled from nominal to the frame's clamped
 *  length — the ONE place the shallow-room compression happens. */
export function coldSparkBayS(frame: ColdSparkFrame): number[] {
  const f = frame.len / COLD_SPARK_LENGTH_M;
  return PAIR_S_M.map((s) => s * f);
}

/** World positions of the 8 machine boxes (2 rows × 4 pairs). */
function machinePositions(frame: ColdSparkFrame): Vec2[] {
  const { origin, dir } = frame;
  const perp: Vec2 = { x: -dir.z, z: dir.x };
  const out: Vec2[] = [];
  for (const s of coldSparkBayS(frame)) {
    for (const side of [-1, 1]) {
      out.push({
        x: origin.x + dir.x * s + perp.x * ROW_X_M * side,
        z: origin.z + dir.z * s + perp.z * ROW_X_M * side,
      });
    }
  }
  return out;
}

/**
 * Avoidance discs for the 8 machine boxes — r 0.3 m each (catalog § 4:
 * structureless treatments register discs only at their hardware). The
 * centreline keeps a 1.8 m clear channel (≥ the 1.6 m contract). Register
 * these in every surface's fixture-obstacle set the same way booth discs go
 * in via `templateBoothObstacles`.
 */
export function coldSparkObstacles(entrance: Vec2, room: Room): ObstacleDisc[] {
  return machinePositions(coldSparkFrame(entrance, room)).map((c) => ({ c, r: MACHINE_R_M }));
}

/**
 * Centreline path nodes for the scripted walk (catalog § 4 path threading):
 * one node at each bay midpoint plus a lead-out node 0.5 m beyond the inner
 * mouth so the chase cam settles straight before exiting. The § 4 lead-IN
 * node (0.5 m beyond the OUTER mouth) is the walk's own start — the demo walk
 * begins AT the entrance mark, which IS the outer mouth. The LAST node is the
 * hand-off point the seat-approach path continues from.
 */
export function coldSparkPathNodes(entrance: Vec2, room: Room): Vec2[] {
  const frame = coldSparkFrame(entrance, room);
  const { origin, dir } = frame;
  const along = (s: number): Vec2 => ({ x: origin.x + dir.x * s, z: origin.z + dir.z * s });
  return [...coldSparkBayS(frame).map(along), along(frame.len + LEAD_M)];
}

/**
 * The walker's path-t along the tunnel segment: the axial projection of a
 * world position onto the tunnel frame, normalised by the corridor length.
 * 0 = outer mouth, 1 = inner mouth; unclamped (<0 before, >1 after) so the
 * consumer can tell "approaching" from "gone". LATERALLY GATED: a position
 * more than COLD_SPARK_GATE_M off the centreline is not in the corridor at
 * all → −1 (idle), so a roam walk crossing the room beside the tunnel (or a
 * seat approach swinging back near the entrance wall) never sequences the
 * fountains. Pure — the scene feeds this into the tunnel's `progressRef`
 * every frame from the walker's live position.
 */
export function coldSparkProgress(pos: Vec2, frame: ColdSparkFrame): number {
  const dx = pos.x - frame.origin.x;
  const dz = pos.z - frame.origin.z;
  const perp = Math.abs(dx * -frame.dir.z + dz * frame.dir.x);
  if (perp > COLD_SPARK_GATE_M) return -1;
  return (dx * frame.dir.x + dz * frame.dir.z) / frame.len;
}

// ── Sequencing (pure — the wall-clock law lives on these being stateless) ────

/** Idle shimmer level (nobody walking) and the climax gain on the final pair. */
const IDLE_LEVEL = 0.18;
/** A fountain starts ramping this many metres before the walker reaches it. */
const RAMP_AHEAD_M = 1.5;
/** Final-pair climax multiplier (t ≥ COLD_SPARK_CLIMAX_T) — intensity only. */
const CLIMAX_GAIN = 1.6;

function smoothstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/**
 * Target intensity for the fountain at axial position `s` given the walker's
 * tunnel path-t (`t`; −1 or NaN = idle) and the frame's effective corridor
 * length. PURE function of progress — a starved frame computes the same target
 * an unbroken stream would, so owed progress is always consumable in one
 * frame. Fired pairs STAY lit ("the tunnel of light builds in real time");
 * the final pair exceeds 1 at the climax beat.
 */
export function coldSparkIntensity(
  t: number,
  s: number,
  isFinalPair: boolean,
  lengthM: number = COLD_SPARK_LENGTH_M,
): number {
  if (!Number.isFinite(t) || t < 0) return IDLE_LEVEL;
  const m = t * lengthM; // walker's axial metres
  const fire = smoothstep((m - (s - RAMP_AHEAD_M)) / RAMP_AHEAD_M);
  let v = IDLE_LEVEL + (1 - IDLE_LEVEL) * fire;
  if (isFinalPair && t >= COLD_SPARK_CLIMAX_T) v = CLIMAX_GAIN; // the § 4 climax beat
  return v;
}

// ── Shared geometries (module scope — the kit's budget rule) ─────────────────

// Machine box: a filleted dark road-case (mascot-smooth, RoundedBox precedent).
const MACHINE_GEO = new RoundedBoxGeometry(0.44, 0.34, 0.44, 2, 0.05);
const MACHINE_MAT = new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.6, metalness: 0.35 });
// Emissive core cone — the bright base of each spark column (Play-mode bloom).
const CORE_GEO = new THREE.ConeGeometry(0.06, 0.55, 8);
// Fog disc — a unit circle, scaled per layer into a soft walkway-hugging pool.
const FOG_GEO = new THREE.CircleGeometry(1, 24);
// Runner — unit plane scaled to the corridor (primary → runner per the catalog).
const RUNNER_GEO = new THREE.PlaneGeometry(1, 1);

/** Fog layers: y-height, radius scale (x across · z along), base opacity. */
const FOG_LAYERS = [
  { y: 0.05, sx: 1.7, sz: 3.3, o: 0.10 },
  { y: 0.13, sx: 1.45, sz: 3.0, o: 0.065 },
  { y: 0.22, sx: 1.2, sz: 2.6, o: 0.04 },
] as const;

// ── The component ────────────────────────────────────────────────────────────

export function ColdSparkTunnel({
  entrance,
  room,
  palette,
  quality = 'high',
  progressRef,
}: {
  /** Entrance mark world position — the tunnel's outer mouth. */
  entrance: Vec2;
  room: Room;
  palette: Lab3DPalette;
  /** 'low' (phone walk) = 4 fountains × 100 particles, no fog planes (catalog
   *  mobile fallback); 'high' = 8 fountains × 250 + fog. ALL 8 machine boxes
   *  render on both tiers — they're one instanced draw, and every surface
   *  registers all 8 obstacle discs (`coldSparkObstacles`), so dropping the
   *  visuals would leave walkers dodging invisible boxes. */
  quality?: TunnelQuality;
  /** Walker's path-t along the tunnel segment (see coldSparkProgress); −1 or
   *  absent = idle low shimmer. The scene writes it every frame. */
  progressRef?: MutableRefObject<number>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const frame = useMemo(() => coldSparkFrame(entrance, room), [entrance, room]);
  // Local space: the group sits at the origin rotated so local +z runs down
  // the tunnel axis (rotation.y = atan2(dir.x, dir.z) — the walker-heading
  // convention), so fountains/fog/runner lay out on plain (±ROW_X, s) coords.
  const yaw = Math.atan2(frame.dir.x, frame.dir.z);
  // All 4 bay midpoints, scaled to the frame's (possibly clamped) length —
  // the machine boxes ALWAYS sit at all 4 (they match the obstacle discs).
  const bayS = useMemo(() => coldSparkBayS(frame), [frame]);
  // Mobile fallback keeps FOUNTAINS at pairs 2 + 4 only (final/climax pair
  // survives); the machine boxes stay at all 4 pairs on both tiers.
  const fountainS = useMemo(
    () => (quality === 'low' ? [bayS[1]!, bayS[3]!] : bayS),
    [quality, bayS],
  );
  const particleCount = quality === 'low' ? 100 : 250;
  const fountainCount = fountainS.length * 2;

  // Per-fountain core-cone materials (2 per pair) — cloned so each fountain's
  // emissiveIntensity ramps independently; disposed on unmount. Geometry stays
  // the module-scope shared CORE_GEO.
  const coreMats = useMemo(
    () =>
      fountainS.flatMap(() => [
        new THREE.MeshStandardMaterial({
          color: SPARK_COLOR,
          emissive: SPARK_COLOR,
          emissiveIntensity: 2.4 * IDLE_LEVEL,
          toneMapped: false,
        }),
        new THREE.MeshStandardMaterial({
          color: SPARK_COLOR,
          emissive: SPARK_COLOR,
          emissiveIntensity: 2.4 * IDLE_LEVEL,
          toneMapped: false,
        }),
      ]),
    [fountainS],
  );
  useLayoutEffect(() => () => coreMats.forEach((m) => m.dispose()), [coreMats]);

  // Live refs: one <points> (Sparkles) + one column group per fountain, and the
  // eased intensity each fountain currently renders at (starts at idle).
  const sparkRefs = useRef<(THREE.Points | null)[]>([]);
  const columnRefs = useRef<(THREE.Group | null)[]>([]);
  const level = useRef<Float32Array | null>(null);
  if (level.current === null || level.current.length !== fountainCount) {
    level.current = new Float32Array(fountainCount).fill(IDLE_LEVEL);
  }

  // Machine boxes — ONE InstancedMesh for all 8 of them, on BOTH quality
  // tiers: the obstacle discs (`coldSparkObstacles`) always register all 8,
  // so the visuals must too or low-quality walkers dodge invisible boxes.
  const machineRef = useRef<THREE.InstancedMesh>(null);
  const machineCount = bayS.length * 2;
  useLayoutEffect(() => {
    const mesh = machineRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const sPos of bayS) {
      for (const side of [-1, 1]) {
        p.set(ROW_X_M * side, 0.17, sPos);
        m.compose(p, q, s);
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [bayS]);

  // The sequencing loop: ease each fountain toward its PURE target intensity.
  // Wall-clock damped (frame-rate independent) and target-stateless — a
  // starved frame lands where a smooth stream would. Skipped entirely under
  // reduced motion (fountains hold the static idle shimmer they mounted with).
  useFrame((_, delta) => {
    if (reducedMotion) return;
    const t = progressRef?.current ?? -1;
    const lv = level.current!;
    const k = 1 - Math.pow(0.002, delta); // ≈ fully converged within ~1 s
    for (let i = 0; i < fountainCount; i++) {
      const s = fountainS[i >> 1]!;
      const target = coldSparkIntensity(t, s, (i >> 1) === fountainS.length - 1, frame.len);
      const cur = lv[i]!;
      if (cur === target) continue; // settled — zero-write steady state
      let next = cur + (target - cur) * k;
      // Snap when within epsilon OF THE TARGET (not of the per-frame step —
      // a step test stalls at a frame-rate-dependent deadband short of it).
      if (Math.abs(target - next) < 0.002) next = target;
      lv[i] = next;
      // Spark particles: per-particle opacity attribute filled with the eased
      // level (clamped — the climax overdrive goes to emissive + height).
      const pts = sparkRefs.current[i];
      if (pts) {
        const attr = pts.geometry.getAttribute('opacity') as THREE.BufferAttribute | undefined;
        if (attr) {
          (attr.array as Float32Array).fill(Math.min(1, next));
          attr.needsUpdate = true;
        }
      }
      // Column height grows with the ramp (the fountain "fires up"), and the
      // core cone brightens — the climax pushes past 1 into a bloom spike.
      const col = columnRefs.current[i];
      if (col) col.scale.y = 0.45 + 0.55 * Math.min(1, next);
      coreMats[i]!.emissiveIntensity = 2.4 * next;
    }
  });

  const fogColor = useMemo(
    () => `#${new THREE.Color(palette.accent).lerp(new THREE.Color('#ffffff'), 0.7).getHexString()}`,
    [palette.accent],
  );

  return (
    <group position={[frame.origin.x, 0, frame.origin.z]} rotation={[0, yaw, 0]}>
      {/* Runner down the corridor centreline — the palette's ONLY strong say
          here (primary → runner; the sparks stay titanium gold-white). */}
      <mesh
        geometry={RUNNER_GEO}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.006, frame.len / 2]}
        scale={[1.2, frame.len, 1]}
        receiveShadow
      >
        <meshStandardMaterial color={palette.accent} roughness={0.85} />
      </mesh>

      {/* The 8 machine boxes (2 rows) — one instanced draw. */}
      <instancedMesh
        key={`csm-${machineCount}`}
        ref={machineRef}
        args={[MACHINE_GEO, MACHINE_MAT, machineCount]}
        frustumCulled={false}
        castShadow
      />

      {/* Fountains: per machine, an emissive core cone + a tall thin Sparkles
          column (fast upward drift; static when reduced motion). The column
          group's y-scale is the ramp's "fires up" height. */}
      {fountainS.map((s, pi) =>
        [-1, 1].map((side, si) => {
          const i = pi * 2 + si;
          return (
            <group key={`${s}:${side}`} position={[ROW_X_M * side, 0, s]}>
              <group
                ref={(g) => {
                  columnRefs.current[i] = g;
                }}
                scale={[1, 0.45 + 0.55 * IDLE_LEVEL, 1]}
              >
                <mesh geometry={CORE_GEO} material={coreMats[i]!} position={[0, 0.55, 0]} />
                <Sparkles
                  ref={(pts: THREE.Points | null) => {
                    sparkRefs.current[i] = pts;
                  }}
                  count={particleCount}
                  // Tall thin volume centred above the machine → a spark column.
                  scale={[0.38, 3.1, 0.38]}
                  position={[0, 1.85, 0]}
                  speed={reducedMotion ? 0 : 4}
                  opacity={IDLE_LEVEL}
                  size={3}
                  color={SPARK_COLOR}
                  noise={0.5}
                />
              </group>
            </group>
          );
        }),
      )}

      {/* Low fog: stacked soft-alpha discs pooling over the walkway (accent →
          fog wash). Dropped on 'low' per the catalog's mobile fallback. */}
      {quality === 'high'
        ? FOG_LAYERS.map((f, i) => (
            <mesh
              key={i}
              geometry={FOG_GEO}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, f.y, frame.len / 2]}
              scale={[f.sx, (f.sz * frame.len) / COLD_SPARK_LENGTH_M, 1]}
            >
              <meshBasicMaterial color={fogColor} transparent opacity={f.o} depthWrite={false} />
            </mesh>
          ))
        : null}
    </group>
  );
}
