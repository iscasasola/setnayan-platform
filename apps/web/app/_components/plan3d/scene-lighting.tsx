'use client';

/**
 * SceneLighting — the SHARED lighting rig for every 3D seat-plan surface
 * (Wave 2a realism foundation, 2026-07-03). One rig, three call sites: the
 * couple lab (`seating-lab-3d.tsx`), the homepage 3D-Plan demo
 * (`plan3d-scene.tsx`) and the public guest venue walk (`guest-venue-3d.tsx`).
 * Centralising the lights the same way `TableMesh` / `VenueFixtures` centralise
 * geometry means one tuning pass lifts all three — and Wave 2b's mood-board
 * treatments + venue archetypes hook the SAME palette knobs here (see the
 * palette notes on each light below).
 *
 * WHAT IT IS
 *   · A procedural room environment map built from inline drei <Lightformer>
 *     panels ONLY — a warm key, a cool fill, an overhead wash and a soft floor
 *     bounce. NO preset, NO HDRI file, NO network fetch (CSP + offline-first).
 *     `frames={1}` bakes the env map once (the panels never move), so there is
 *     no per-frame PMREM cost — image-based lighting is a near-free realism
 *     win for the standard materials all three surfaces already use.
 *   · One warm, shadow-casting directional key (late-afternoon-through-windows),
 *     its shadow camera fitted TIGHT to the room so the shadow map spends its
 *     texels where the furniture is, with bias tuned against acne.
 *
 * QUALITY
 *   · 'high' (desktop lab + homepage orbit): 2048 shadow map, 256 env map.
 *   · 'low'  (phone walk / guest venue): 1024 shadow map, 128 env map. Real
 *     shadows STAY in 'low' — the homepage demo already ran shadow maps before
 *     this rig existed, and a per-frame drei <ContactShadows> blur pass costs
 *     MORE than a 1024 depth pass on phones. If a surface ever measures real
 *     shadows hurting, it passes `shadows: false` on its Canvas and renders its
 *     own ContactShadows — the choice stays at the call site.
 *
 * TONE MAPPING lives on each surface's <Canvas gl={…}> — a renderer setting,
 *   not a scene node, so it can't live here. Spread `RECOMMENDED_TONEMAP` into
 *   the Canvas `gl` props so exposure stays consistent across the three.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';
import type { Lab3DPalette } from '@/lib/seating-3d';

/** Canvas `gl` tone-mapping every 3D seat-plan surface should pass so the three
 *  read alike: ACES film curve + a gentle exposure lift tuned to the warm IBL. */
export const RECOMMENDED_TONEMAP = {
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.08,
} as const;

export type SceneLightingQuality = 'high' | 'low';

// ─────────────────────────────────────────────────────────────────────────────
// Shared floor roughness variation — a tiny grayscale noise CanvasTexture so
// big floor planes stop reading as one uniform sheet under the env light. Built
// LAZILY once per page (module singleton; `document` isn't available during
// SSR, and R3F only renders Canvas children in the browser) and shared by every
// floor material via `roughnessMap`. Values hover near white (≈0.72–1.0 of the
// material's own `roughness`) so the variation stays subtle — polish streaks,
// not dirt. No asset files, no fetch.
// ─────────────────────────────────────────────────────────────────────────────

let floorRoughnessTex: THREE.CanvasTexture | null = null;

export function floorRoughnessMap(): THREE.CanvasTexture {
  if (floorRoughnessTex) return floorRoughnessTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // Two octaves of value noise: a coarse mottle + a fine grain, deterministic
  // enough at this subtlety that plain Math.random reads fine.
  const coarse: number[] = [];
  const CG = 16; // coarse grid
  for (let i = 0; i < CG * CG; i++) coarse.push(Math.random());
  const sample = (x: number, y: number) => {
    // Bilinear over the coarse grid (wrapping) for smooth low-frequency blotches.
    const fx = (x / size) * CG;
    const fy = (y / size) * CG;
    const x0 = Math.floor(fx) % CG;
    const y0 = Math.floor(fy) % CG;
    const x1 = (x0 + 1) % CG;
    const y1 = (y0 + 1) % CG;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const v00 = coarse[y0 * CG + x0]!;
    const v10 = coarse[y0 * CG + x1]!;
    const v01 = coarse[y1 * CG + x0]!;
    const v11 = coarse[y1 * CG + x1]!;
    return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = sample(x, y) * 0.7 + Math.random() * 0.3; // coarse + fine grain
      const v = 185 + Math.round(n * 70); // 185–255 → subtle roughness dip only
      const o = (y * size + x) * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8); // ~2–4 m tiles on typical venue floors
  floorRoughnessTex = tex;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared surface DETAIL maps (Wave 2c materials pass) — procedural CanvasTextures
// that give the big flat surfaces a real material read under the raking key
// light, without any asset files or fetch. Same lazy module-singleton pattern as
// floorRoughnessMap: built once per page, shared by every call site.
//
//   · floorAlbedoMap  — pale marble/stone with soft veining + a subtle tile
//     grid. Near-WHITE so it MULTIPLIES the palette floor colour (`map * color`)
//     — the room stays fully themeable, the pattern only adds richness.
//   · floorBumpMap    — grayscale grout grooves for the same tile grid so the
//     seams catch a sliver of shadow (bumpMap; cheaper than a normal map, no
//     tangents needed).
//   · fabricBumpMap   — a fine warp/weft weave so tablecloths + drapes read as
//     cloth, not painted plastic.
// ─────────────────────────────────────────────────────────────────────────────

function buildCanvasTex(
  size: number,
  repeat: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

let floorAlbedoTex: THREE.CanvasTexture | null = null;
export function floorAlbedoMap(): THREE.CanvasTexture {
  if (floorAlbedoTex) return floorAlbedoTex;
  floorAlbedoTex = buildCanvasTex(512, 6, (ctx, size) => {
    // Near-white marble base so it tints, not overrides, the palette floor.
    ctx.fillStyle = '#f6f4f1';
    ctx.fillRect(0, 0, size, size);
    // Soft low-frequency stone mottle.
    for (let i = 0; i < 44; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 28 + Math.random() * 96;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.03 + Math.random() * 0.05;
      g.addColorStop(0, `rgba(176,170,161,${a})`);
      g.addColorStop(1, 'rgba(176,170,161,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint marble veins — a few meandering polylines.
    ctx.strokeStyle = 'rgba(150,144,136,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 130;
        y += (Math.random() - 0.5) * 130;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Tile grout grid (2 tiles per texture cell → ~1–1.5 m tiles once repeated).
    ctx.strokeStyle = 'rgba(120,115,108,0.22)';
    ctx.lineWidth = 3;
    const cells = 2;
    const step = size / cells;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
  });
  // Colour map → sRGB so `map * color` stays true to the palette floor tone.
  // (bump/roughness maps are DATA and correctly stay linear/default.)
  floorAlbedoTex.colorSpace = THREE.SRGBColorSpace;
  return floorAlbedoTex;
}

let floorBumpTex: THREE.CanvasTexture | null = null;
export function floorBumpMap(): THREE.CanvasTexture {
  if (floorBumpTex) return floorBumpTex;
  floorBumpTex = buildCanvasTex(512, 6, (ctx, size) => {
    // White field = flat; dark grout lines = recessed grooves (bumpMap reads
    // luminance, low = lower). Matches floorAlbedoMap's grid so relief aligns.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 4;
    const cells = 2;
    const step = size / cells;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
  });
  return floorBumpTex;
}

let fabricBumpTex: THREE.CanvasTexture | null = null;
export function fabricBumpMap(): THREE.CanvasTexture {
  if (fabricBumpTex) return fabricBumpTex;
  fabricBumpTex = buildCanvasTex(128, 20, (ctx, size) => {
    // Mid-grey field, then alternating light/dark warp + weft threads = weave.
    ctx.fillStyle = '#8f8f8f';
    ctx.fillRect(0, 0, size, size);
    const n = 16;
    const step = size / n;
    for (let i = 0; i < n; i++) {
      const p = i * step;
      // Vertical threads (warp), even = raised, odd = recessed.
      ctx.fillStyle = i % 2 === 0 ? '#bcbcbc' : '#6f6f6f';
      ctx.fillRect(p, 0, step * 0.5, size);
      // Horizontal threads (weft), offset phase for the over/under look.
      ctx.fillStyle = i % 2 === 0 ? '#6f6f6f' : '#bcbcbc';
      ctx.fillRect(0, p, size, step * 0.5);
    }
  });
  return fabricBumpTex;
}

/**
 * Drop inside a <Canvas>. Replaces a surface's ad-hoc ambient + single
 * directional with the shared rig. `room` fits the shadow camera + sizes the
 * env panels; `palette` warms/cools the whole rig (a Wave 2b mood-board
 * recolour lands here for free).
 */
export function SceneLighting({
  palette,
  quality,
  room,
}: {
  palette: Lab3DPalette;
  quality: SceneLightingQuality;
  /** Room footprint in metres — fits the shadow camera + scales the env panels. */
  room: { w: number; d: number };
}) {
  const shadowMap = quality === 'high' ? 2048 : 1024;

  // Warm key colour derives from the palette's ambient (its warmest hue) so a
  // mood-board recolour tints the "sunlight"; the fill is a cool complement so
  // shadow sides read blue-grey, not muddy; the floor bounce borrows the floor
  // colour — light picking up the room's own ground tone is the trick that
  // sells indoor IBL. (Wave 2b: treatments swap these three knobs.)
  const keyColor = palette.ambient || '#fbe9d8';
  const fillColor = '#aebdd6';
  const bounceColor = palette.floor || '#e7e1d8';

  // Fit the shadow camera to the room (+ margin for chairs standing proud of
  // the footprint) so every texel of the shadow map covers furniture, not empty
  // metres — the single biggest quality lever at a fixed map size.
  const span = Math.max(room.w, room.d);
  const half = span / 2 + 3;
  const keyPos = useMemo<[number, number, number]>(
    () => [room.w * 0.42, span * 0.9 + 6, -room.d * 0.34],
    [room.w, room.d, span],
  );

  return (
    <>
      {/* ── Image-based lighting: a procedural room, baked ONCE (frames=1).
          Inline emissive panels only — no preset, no file, no network. ────── */}
      <Environment frames={1} resolution={quality === 'high' ? 256 : 128}>
        {/* Warm key panel — the late-afternoon window wall. */}
        <Lightformer
          form="rect"
          intensity={2.2}
          color={keyColor}
          position={[span * 0.6, span * 0.5, -span * 0.4]}
          scale={[span, span * 0.7, 1]}
          target={[0, 0, 0]}
        />
        {/* Cool fill from the opposite side — keeps shadow sides from going dead. */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color={fillColor}
          position={[-span * 0.6, span * 0.4, span * 0.3]}
          scale={[span * 0.9, span * 0.6, 1]}
          target={[0, 0, 0]}
        />
        {/* Soft overhead wash so tabletops + shoulders catch a highlight. */}
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#fff6ea"
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, span * 0.8, 0]}
          scale={[span * 0.8, span * 0.8, 1]}
        />
        {/* Floor bounce — a low, wide panel tinted by the floor so the room's
            own ground colour lifts into the underside of everything. */}
        <Lightformer
          form="rect"
          intensity={0.6}
          color={bounceColor}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.2, 0]}
          scale={[span, span, 1]}
        />
      </Environment>

      {/* Dim cool ambient so the darkest shadow still reads as a surface, not a
          hole — the IBL does the heavy lifting, this only lifts the floor. */}
      <ambientLight intensity={0.28} color={palette.ambient} />

      {/* The one shadow-casting key: warm, high, raking across the room like sun
          through a window wall. 'low' quality halves the shadow map, and a
          surface can veto the depth pass entirely via its Canvas `shadows` flag. */}
      <directionalLight
        position={keyPos}
        intensity={1.35}
        color="#fff3e2"
        castShadow
        shadow-mapSize-width={shadowMap}
        shadow-mapSize-height={shadowMap}
        shadow-camera-near={1}
        shadow-camera-far={span * 2.4 + 20}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}
