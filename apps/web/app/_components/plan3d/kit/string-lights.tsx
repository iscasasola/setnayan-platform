'use client';

/**
 * StringLights — cinematic Play-mode string lights (Fable §3.5 Tier A,
 * 2026-07-08). Catenary strands of warm emissive bulbs sagging across the room
 * above head height: the single strongest "this is an evening reception now"
 * cue, and the designated bloom stars for the Tier B postprocessing pass
 * (emissive + toneMapped=false so a later Bloom threshold catches exactly the
 * bulbs and nothing else).
 *
 * DISTINCT FROM venue-decor's fairy_lights ceiling treatment: that one is a
 * couple-chosen reception design (renders in Build + Play whenever the design
 * says so, open-air archetypes included — the precedent this component
 * follows). THIS component is the cinematic grade's own layer — mounted by
 * Play mode / the phone demo walk when the couple's ceiling band is FREE,
 * hung slightly lower and warmer so the film look never depends on a design
 * selection. Open-air archetypes keep them: strung lights hang from poles/
 * trees, not slabs (the venue-decor "strung, not slab-hung" rule).
 *
 * CEILING-BAND COORDINATION: the strands occupy y ≈ 2.5–3.45 m — the same band
 * as VenueDecor's hanging treatments (fairy-light runs 2.5–3.4, chandelier
 * crystals ~3.05, lanterns 2.4–2.9, hanging florals 2.2–3.3). Call sites gate
 * the mount on `ceilingDecorOccupied()` (venue-decor.tsx): a fairy_lights
 * choice would double up two near-identical string systems, and the other
 * hung treatments would have strands threading through crystals/clusters.
 * When the couple's own ceiling decor renders, it IS the film look's ceiling
 * layer. (Booths stay clear — their tallest prop tops out ~2.24 m.)
 *
 * BUDGET (mascot-smooth): ONE InstancedMesh for every bulb across all strands
 * (matrices written once — the instanced-chairs discipline; nothing here ever
 * animates, so reduced-motion needs no branch) + one cheap polyline per strand
 * for the wire. 3–5 strands at 'high'; 'low' (phones) halves the strand count.
 *
 * COLOUR LAW: bulbs are ALWAYS warm white (~2700 K). The mood-board palette
 * may only slide them along the amber axis (softer 3000 K ↔ deeper 2700 K by
 * how warm the board reads) — NEVER tint them the palette's RGB. A sage-green
 * board gets honey bulbs, not green ones.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Lab3DPalette } from '@/lib/seating-3d';
import {
  dominantWarmSwatch,
  CINEMATIC_BLOOM_LAYERS_MASK,
  type SceneLightingQuality,
} from '@/app/_components/plan3d/scene-lighting';

/** Strand end-height — above every head (figures ≈1.8 m), under venue-decor's
 *  CEILING_Y (3.6) so indoor rooms keep clearance to the slab. */
const HANG_Y = 3.45;
/** Sag depth at each strand's lowest point → bottoms out ≈2.6 m. */
const SAG_M = 0.85;
/** One bulb roughly every 0.55 m of horizontal run. */
const BULB_SPACING_M = 0.55;

/** Warm-white poles the palette slides between — amber axis ONLY. */
const BULB_SOFT = '#ffd9ae'; // ~3000 K soft glow
const BULB_DEEP = '#ffbf80'; // ~2700 K deep amber

/** Strand count: 3–5 across the room's depth at 'high'; 'low' halves it. */
export function stringLightStrandCount(roomD: number, quality: SceneLightingQuality): number {
  const base = Math.min(5, Math.max(3, Math.round(roomD / 4.5)));
  return quality === 'low' ? Math.max(2, Math.round(base / 2)) : base;
}

/** Bulb colour: 2700 K warmed/softened by how warm the mood board reads —
 *  never the board's own hue (colour law above). */
export function stringLightBulbColor(palette: Lab3DPalette): string {
  const swatch = dominantWarmSwatch(palette);
  // Warmth 0..1 from the swatch's red-over-blue bias; no warm swatch → middle.
  let t = 0.5;
  if (swatch) {
    const c = new THREE.Color(swatch);
    t = Math.min(1, Math.max(0, (c.r - c.b) * 2.2));
  }
  return `#${new THREE.Color(BULB_SOFT).lerp(new THREE.Color(BULB_DEEP), t).getHexString()}`;
}

/** Parabolic catenary stand-in (the venue-decor precedent) — strands span the
 *  room's WIDTH, spaced evenly along its depth, sag varied slightly per strand
 *  so the ceiling doesn't read as a printed pattern. */
function buildRuns(
  room: { w: number; d: number },
  strands: number,
): { bulbs: THREE.Vector3[]; wires: THREE.Vector3[][] } {
  const bulbs: THREE.Vector3[] = [];
  const wires: THREE.Vector3[][] = [];
  const spanW = room.w * 0.94; // pull ends just off the walls
  const segs = Math.max(10, Math.round(spanW / (BULB_SPACING_M / 2)));
  for (let s = 0; s < strands; s++) {
    const z = -room.d / 2 + (room.d / (strands + 1)) * (s + 1);
    const sag = SAG_M * (0.85 + 0.3 * ((s * 37) % 5) / 5); // deterministic wobble
    const line: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = -spanW / 2 + t * spanW;
      const y = HANG_Y - sag * (1 - Math.pow(2 * t - 1, 2));
      const v = new THREE.Vector3(x, y, z);
      line.push(v);
      // A bulb every second sample (≈BULB_SPACING_M), skipping the wall ends.
      if (i % 2 === 0 && i > 0 && i < segs) bulbs.push(v.clone());
    }
    wires.push(line);
  }
  return { bulbs, wires };
}

export function StringLights({
  room,
  palette,
  quality,
}: {
  room: { w: number; d: number };
  palette: Lab3DPalette;
  quality: SceneLightingQuality;
}) {
  const bulbRef = useRef<THREE.InstancedMesh>(null);
  const strands = stringLightStrandCount(room.d, quality);
  const { bulbs, wires } = useMemo(() => buildRuns(room, strands), [room, strands]);
  const bulbColor = useMemo(() => stringLightBulbColor(palette), [palette]);

  // Matrices written ONCE (static instances — the instanced-chairs discipline).
  useLayoutEffect(() => {
    const mesh = bulbRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < bulbs.length; i++) {
      p.copy(bulbs[i]!);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Enrol on the cinematic bloom layer — Tier B's SelectiveBloom depth-masks
    // its luminance pass to this layer so ONLY the designated stars halo.
    mesh.layers.mask = CINEMATIC_BLOOM_LAYERS_MASK;
  }, [bulbs]);

  return (
    <group>
      {wires.map((pts, i) => (
        <StrandWire key={i} points={pts} />
      ))}
      {/* All bulbs, one draw. toneMapped=false keeps them punching past the
          ACES curve — today's fake glow, Tier B's real Bloom threshold. */}
      <instancedMesh
        key={`cine-bulb-${bulbs.length}`}
        ref={bulbRef}
        args={[undefined, undefined, bulbs.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial
          color={bulbColor}
          emissive={bulbColor}
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

function StrandWire({ points }: { points: THREE.Vector3[] }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color="#1c1a18" transparent opacity={0.55} />
    </line>
  );
}
