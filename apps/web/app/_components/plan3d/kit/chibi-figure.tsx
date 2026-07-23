'use client';

/**
 * kit/chibi-figure — the reusable chibi character renderer (Build ② PR-1,
 * `OnTheDay_App_Build_Studies_2026-07-23.md § 2` · `Chibi_Rig_Production_
 * Spec_2026-07-19.md`). Config in → chibi out. NOTHING mounts this yet — it
 * ships flag-dark behind NEXT_PUBLIC_FIGURE_CHIBI (`FIGURE_CHIBI_ENABLED`,
 * lib/chibi-config.ts) as the foundation the later PRs consume:
 *   · PR-2 poses (idle bounce / head tilt / waddle on the REDUCED joint set —
 *     head + body-lean only, § 11: arms are integral, no shoulder joints),
 *   · PR-3 part-batched instanced crowd (see the BATCHING CONTRACT in
 *     lib/chibi-geometry.ts — one InstancedMesh per part buffer,
 *     per-instance colour via instanceColor over WHITE materials),
 *   · the maker + venue-walk swap PRs.
 *
 * DESIGN (owner-locked, § 11 V5 — the "overlap law" memory phrasing is
 * RETIRED 2026-07-21; integral part geometry conceals every junction):
 *   · FACES ARE IN (§ 10): nose always on, eyes/mouths/marks ×4, bald.
 *   · Head is a SEPARATE group (userData.headGroup, mounted at CHIBI_HEAD_Y)
 *     so PR-2 tilts it for the idle without touching the body buffers.
 *   · All geometry is procedural in-code (CSP-safe: NO external models,
 *     fonts, or textures — the corpus lock: RPM dead, CC0 breaks CSP).
 *   · Geometries come from lib/chibi-geometry's shared caches — do NOT
 *     dispose them on unmount. Materials come from the module-level cache
 *     below (one MeshStandardMaterial per (hex, roughness) across every
 *     mounted figure — the prototype's matCache discipline).
 *
 * INSTANCING NOTE (why materials are per-COLOUR here but must be WHITE in
 * the crowd): an individual figure affords a real material per colour; the
 * instanced crowd shares ONE white material per part buffer and tints via
 * instanceColor with the SAME derivations (effectiveChibiColors + darkenHex)
 * — keep both paths reading the one `ChibiPaint` descriptor so they can
 * never drift. § 11.2: an instanceColor mismatch across a junction
 * reintroduces the ring even when the geometry is correct — hand + head must
 * always tint with the SAME skin value.
 *
 * The maker-vs-crowd LOD rule (§ 11.4): this component is the ONE design at
 * individual fidelity. Do not let crowd constraints flatten it; do not let
 * added fidelity here leak into the crowd buffers — crowd-visible geometry
 * changes belong in lib/chibi-geometry where the audit tests gate them.
 */

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import {
  type ChibiAvatarConfig,
  resolveChibiConfig,
  effectiveChibiColors,
} from '@/lib/chibi-config';
import {
  buildChibiGeometry,
  resolveChibiPaint,
  CHIBI_HEAD_Y,
  type ChibiPart,
} from '@/lib/chibi-geometry';

// Module-level material cache — one material per (hex, roughness) shared by
// every mounted chibi (the prototype's matCache). DoubleSide is part of the
// solid-figure law (closed lathes + DoubleSide — the transparency bug class
// the owner rejected cannot recur). Lazy: nothing allocates until the first
// figure actually renders, so the module stays tree-shakeable while the
// feature is flag-dark.
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function chibiMaterial(hex: string, roughness: number): THREE.MeshStandardMaterial {
  const key = `${hex}|${roughness}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color: hex, roughness, side: THREE.DoubleSide });
    materialCache.set(key, mat);
  }
  return mat;
}

export type ChibiFigureProps = {
  /** Stable identity — hash-derives every unset look field (same id → same
   *  chibi forever, the resolveFigureLook convention). */
  id: string;
  /** Stored `guests.avatar_config` value (or any partial/junk — resolved
   *  through the sanitizer). null/undefined → full hash-default look. */
  config?: unknown;
  position?: readonly [number, number, number];
  rotationY?: number;
  /** Uniform figure scale. 1 → ~1.38 m to the head top. The scale-vs-
   *  furniture call is an OPEN owner sign-off (rig spec § 9.1) — surface,
   *  don't silently change. */
  scale?: number;
  castShadow?: boolean;
};

function ChibiFigureImpl({
  id,
  config,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
}: ChibiFigureProps) {
  const resolved: ChibiAvatarConfig = useMemo(() => resolveChibiConfig(id, config), [id, config]);
  const colors = useMemo(() => effectiveChibiColors(resolved), [resolved]);
  const bundle = useMemo(() => buildChibiGeometry(resolved), [resolved]);

  const renderParts = (parts: ChibiPart[]) =>
    parts.map((part) => (
      <mesh
        key={part.name}
        geometry={part.geometry}
        material={chibiMaterial(resolveChibiPaint(part.paint, colors), part.roughness)}
        castShadow={castShadow}
      />
    ));

  return (
    <group position={position as [number, number, number] | undefined} rotation-y={rotationY} scale={scale}>
      {renderParts(bundle.body)}
      {/* The head group — PR-2's idle tilts THIS group (userData.headGroup),
          never the individual meshes; parts inside are head-space. */}
      <group
        position-y={CHIBI_HEAD_Y}
        ref={(g: THREE.Group | null) => {
          if (g) {
            g.userData.headGroup = true;
            if (g.parent) g.parent.userData.headGroup = g;
          }
        }}
      >
        {renderParts(bundle.head)}
      </group>
    </group>
  );
}

/**
 * The chibi figure. Pure render — no useFrame, no motion (poses are PR-2's
 * job on the reduced joint set); mounting N figures shares every geometry
 * and material through the module caches.
 */
export const ChibiFigure = memo(ChibiFigureImpl);
