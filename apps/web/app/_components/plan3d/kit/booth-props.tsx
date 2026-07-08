'use client';

/**
 * kit/booth-props — the shared PROP primitives the booth-template kit's
 * top-20 categories place on their chassis (owner-locked catalog:
 * `0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`). One module, every
 * prop mascot-smooth (filleted RoundedBox / high-segment lathes / capsules),
 * every geometry a MODULE-SCOPE shared buffer, materials from the chassis
 * module's keyed caches — a floor of booths shares one GPU program per look.
 *
 * DRAW BUDGET: ≤ 2 draws per prop where possible — repeated elements
 * (bottles, mirror bulbs, donuts, blooms) are ONE static InstancedMesh each
 * (the instanced-chairs discipline), so a bottle shelf is shelf + 1 instanced
 * draw, never 6 meshes.
 *
 * TEXTURES: procedural CanvasTexture only (CSP: no fetched assets) — the
 * LIVE lamp face, the woven banig counter skirt, clipboard scribbles and the
 * awning stripes, all lazy module singletons (browser-only, the fabricBumpMap
 * pattern). EMISSIVE props (LIVE lamp, mirror bulbs, moving-head beam) are
 * the catalog's designated bloom stars for cinematic Play.
 *
 * COORDINATES: prop-local, origin at the prop's base centre, facing +z. The
 * template table (kit/booth-templates.ts) authors each placement explicitly.
 */

import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lab3DPalette } from '@/lib/seating-3d';
import { GOWN_GEO } from './outfits';
import {
  boothSheenMaterial,
  boothMetalMaterial,
  KIT_CHROME,
  KIT_DARK,
  KIT_WOOD,
  KIT_CREAM,
  KIT_GREEN,
} from './booth-chassis';

// ─────────────────────────────────────────────────────────────────────────────
// Kinds
// ─────────────────────────────────────────────────────────────────────────────

export type BoothPropKind =
  | 'chafing_dish'
  | 'plate_stack'
  | 'tiered_cake'
  | 'espresso_machine'
  | 'bottle_shelf'
  | 'shaker'
  | 'donut_board'
  | 'drum_kit'
  | 'mic_stand'
  | 'stage_monitor'
  | 'tripod_camera'
  | 'live_lamp'
  | 'bulb_mirror'
  | 'console_speakers'
  | 'moving_head'
  | 'bloom_cart'
  | 'drape_wall'
  | 'easel'
  | 'clipboard_board'
  | 'podium'
  | 'umbrella'
  | 'awning'
  | 'gown_form';

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a closed high-segment lathe (same shape as the chassis module's) —
 *  capped at BOTH ends (props are seen from above on counters; an open lathe
 *  top shows its interior as z-fighting streaks — the riser lesson). */
function lathe(points: ReadonlyArray<readonly [number, number]>, segments = 28): THREE.LatheGeometry {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  const first = points[0]!;
  const last = points[points.length - 1]!;
  pts.unshift(new THREE.Vector2(0.001, first[1]));
  pts.push(new THREE.Vector2(0.001, last[1]));
  return new THREE.LatheGeometry(pts, segments);
}

type InstanceXf = { p: readonly [number, number, number]; s?: number };

/** One static InstancedMesh for a repeated element — matrices written once
 *  (the instanced-chairs discipline; these props never animate instances). */
function StaticInstances({
  geometry,
  material,
  transforms,
  castShadow = false,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  transforms: readonly InstanceXf[];
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    transforms.forEach((t, i) => {
      const s = t.s ?? 1;
      m.makeScale(s, s, s);
      m.setPosition(t.p[0], t.p[1], t.p[2]);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, transforms.length]}
      castShadow={castShadow}
    />
  );
}

// Emissive singletons — fixed looks, no palette keying needed.
const liveLampFaceMat = new THREE.MeshStandardMaterial({
  color: '#1a0d0d',
  emissive: '#ff3b30',
  emissiveIntensity: 0.9,
  roughness: 0.4,
});
const bulbMat = new THREE.MeshStandardMaterial({
  color: '#fff6dd',
  emissive: '#ffd98a',
  emissiveIntensity: 1.1,
  roughness: 0.3,
});
const beamMat = new THREE.MeshStandardMaterial({
  color: '#d98a3d',
  emissive: '#d98a3d',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const steamMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.35,
  roughness: 1,
  depthWrite: false,
});
const mirrorMat = new THREE.MeshStandardMaterial({
  color: '#cfd6de',
  roughness: 0.08,
  metalness: 0.9,
});

// ─────────────────────────────────────────────────────────────────────────────
// Lazy CanvasTextures (browser-only module singletons)
// ─────────────────────────────────────────────────────────────────────────────

let liveTex: THREE.CanvasTexture | null = null;
/** The "● LIVE" lamp face. */
function liveLampTexture(): THREE.CanvasTexture {
  if (liveTex) return liveTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a0d0d';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#ff5148';
  ctx.beginPath();
  ctx.arc(26, 32, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIVE', 44, 34);
  liveTex = new THREE.CanvasTexture(canvas);
  liveTex.colorSpace = THREE.SRGBColorSpace;
  return liveTex;
}

let banigTex: THREE.CanvasTexture | null = null;
/**
 * Woven banig weave — alternating warm strips in a plaited over-under
 * pattern; the food-cart / counter skirt texture the catalog calls for.
 * Grayscale-free colour map, tiled.
 */
export function banigTexture(): THREE.CanvasTexture {
  if (banigTex) return banigTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tones = ['#c9a06a', '#b98b52', '#d9b47f', '#a87c48'];
  const cell = size / 8;
  for (let ix = 0; ix < 8; ix++) {
    for (let iy = 0; iy < 8; iy++) {
      ctx.fillStyle = tones[(ix + iy * 3) % tones.length]!;
      ctx.fillRect(ix * cell, iy * cell, cell, cell);
      // The over-under shadow line that sells the weave.
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      if ((ix + iy) % 2 === 0) ctx.fillRect(ix * cell, iy * cell, cell, 2);
      else ctx.fillRect(ix * cell, iy * cell, 2, cell);
    }
  }
  banigTex = new THREE.CanvasTexture(canvas);
  banigTex.colorSpace = THREE.SRGBColorSpace;
  banigTex.wrapS = THREE.RepeatWrapping;
  banigTex.wrapT = THREE.RepeatWrapping;
  banigTex.repeat.set(3, 2);
  return banigTex;
}

let banigMatCache: THREE.MeshStandardMaterial | null = null;
function banigMaterial(): THREE.MeshStandardMaterial {
  if (!banigMatCache) {
    banigMatCache = new THREE.MeshStandardMaterial({ map: banigTexture(), roughness: 0.85 });
  }
  return banigMatCache;
}

let clipTex: THREE.CanvasTexture | null = null;
/** Clipboard / timeline-board scribbles: a paper field with drawn task rows. */
function clipboardTexture(): THREE.CanvasTexture {
  if (clipTex) return clipTex;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8f4ea';
  ctx.fillRect(0, 0, 96, 128);
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 3;
  for (let y = 24; y < 120; y += 18) {
    ctx.strokeRect(10, y - 5, 10, 10); // the checkbox
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(84 - (y % 3) * 8, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c26a4a';
  for (const y of [24, 60]) {
    ctx.beginPath();
    ctx.moveTo(9, y);
    ctx.lineTo(22, y + 3);
    ctx.stroke(); // a tick
  }
  clipTex = new THREE.CanvasTexture(canvas);
  clipTex.colorSpace = THREE.SRGBColorSpace;
  return clipTex;
}

let clipMatCache: THREE.MeshStandardMaterial | null = null;
function clipboardMaterial(): THREE.MeshStandardMaterial {
  if (!clipMatCache) {
    clipMatCache = new THREE.MeshStandardMaterial({ map: clipboardTexture(), roughness: 0.8 });
  }
  return clipMatCache;
}

let awningTex: THREE.CanvasTexture | null = null;
/** Classic awning stripes (cream + warm red), tiled horizontally. */
function awningTexture(): THREE.CanvasTexture {
  if (awningTex) return awningTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = '#c25b4e';
  for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 32);
  awningTex = new THREE.CanvasTexture(canvas);
  awningTex.colorSpace = THREE.SRGBColorSpace;
  awningTex.wrapS = THREE.RepeatWrapping;
  awningTex.repeat.set(3, 1);
  return awningTex;
}

let awningMatCache: THREE.MeshStandardMaterial | null = null;
function awningMaterial(): THREE.MeshStandardMaterial {
  if (!awningMatCache) {
    awningMatCache = new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.8, side: THREE.DoubleSide });
  }
  return awningMatCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared geometry (module scope — one GPU buffer each)
// ─────────────────────────────────────────────────────────────────────────────

const CHAFING_TRAY_GEO = new RoundedBoxGeometry(0.36, 0.09, 0.26, 3, 0.03);
const CHAFING_DOME_GEO = new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

const PLATE_STACK_GEO = lathe([
  [0.11, 0.12],
  [0.13, 0.1],
  [0.13, 0.0],
]);

const CAKE_GEO = lathe(
  [
    [0.1, 0.52],
    [0.1, 0.38],
    [0.15, 0.37],
    [0.15, 0.2],
    [0.21, 0.19],
    [0.21, 0.0],
  ],
  36,
);
const CAKE_STAND_GEO = lathe([
  [0.12, 0.08],
  [0.04, 0.06],
  [0.05, 0.02],
  [0.24, 0.0],
]);

const ESPRESSO_BODY_GEO = new RoundedBoxGeometry(0.4, 0.32, 0.3, 4, 0.05);
const ESPRESSO_TOP_GEO = new RoundedBoxGeometry(0.3, 0.08, 0.22, 3, 0.03);
const STEAM_GEO = new THREE.SphereGeometry(0.05, 10, 8);

const SHELF_BOARD_GEO = new RoundedBoxGeometry(1.3, 0.05, 0.2, 3, 0.02);
const BOTTLE_GEO = lathe([
  [0.012, 0.26],
  [0.014, 0.2],
  [0.04, 0.15],
  [0.04, 0.0],
]);

const SHAKER_GEO = lathe([
  [0.02, 0.2],
  [0.045, 0.16],
  [0.055, 0.05],
  [0.05, 0.0],
]);

const DONUT_BOARD_GEO = new RoundedBoxGeometry(0.9, 0.7, 0.06, 3, 0.03);
const DONUT_GEO = new THREE.TorusGeometry(0.055, 0.026, 10, 18);

const KICK_GEO = new THREE.CylinderGeometry(0.26, 0.26, 0.32, 24);
const CYMBAL_GEO = new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24);
const CYMBAL_POST_GEO = new THREE.CapsuleGeometry(0.015, 0.75, 4, 8);

const MIC_POST_GEO = new THREE.CapsuleGeometry(0.016, 1.15, 4, 10);
const MIC_HEAD_GEO = new THREE.SphereGeometry(0.05, 12, 10);
const MIC_BASE_GEO = new THREE.CylinderGeometry(0.14, 0.16, 0.04, 20);

const MONITOR_GEO = new RoundedBoxGeometry(0.5, 0.3, 0.36, 4, 0.05);

const TRIPOD_LEG_GEO = new THREE.CapsuleGeometry(0.018, 1.1, 4, 8);
const CAM_BODY_GEO = new RoundedBoxGeometry(0.3, 0.2, 0.2, 4, 0.045);
const LENS_GEO = new THREE.CylinderGeometry(0.06, 0.07, 0.16, 18);

const LAMP_BOX_GEO = new RoundedBoxGeometry(0.42, 0.22, 0.12, 3, 0.03);
const LAMP_FACE_GEO = new THREE.PlaneGeometry(0.36, 0.17);

const MIRROR_PANEL_GEO = new RoundedBoxGeometry(0.72, 0.95, 0.07, 4, 0.035);
const MIRROR_GLASS_GEO = new THREE.PlaneGeometry(0.54, 0.76);
const BULB_GEO = new THREE.SphereGeometry(0.028, 10, 8);

const CONSOLE_GEO = new RoundedBoxGeometry(0.85, 0.14, 0.5, 4, 0.04);
const CONSOLE_PLINTH_GEO = new RoundedBoxGeometry(0.6, 0.12, 0.4, 4, 0.04);
const SPEAKER_GEO = new RoundedBoxGeometry(0.26, 0.44, 0.24, 4, 0.05);

const MH_BASE_GEO = new RoundedBoxGeometry(0.2, 0.08, 0.2, 3, 0.03);
const MH_HEAD_GEO = new RoundedBoxGeometry(0.14, 0.22, 0.14, 3, 0.04);
const MH_BEAM_GEO = new THREE.ConeGeometry(0.35, 1.0, 20, 1, true);

const CART_BODY_GEO = new RoundedBoxGeometry(0.8, 0.5, 0.5, 4, 0.06);
const CART_WHEEL_GEO = new THREE.TorusGeometry(0.11, 0.05, 10, 20);
const BLOOM_GEO = new THREE.SphereGeometry(0.11, 14, 12);
const BLOOM_LEAF_GEO = new THREE.SphereGeometry(0.16, 14, 12);

const DRAPE_GEO = new RoundedBoxGeometry(1.9, 2.0, 0.09, 4, 0.045);

const EASEL_LEG_GEO = new THREE.CapsuleGeometry(0.02, 1.3, 4, 8);
const EASEL_BOARD_GEO = new RoundedBoxGeometry(0.6, 0.75, 0.05, 3, 0.025);

const CLIPBOARD_GEO = new RoundedBoxGeometry(0.5, 0.65, 0.05, 3, 0.025);

const PODIUM_GEO = lathe(
  [
    [0.24, 1.1],
    [0.16, 0.9],
    [0.14, 0.3],
    [0.26, 0.06],
    [0.28, 0.0],
  ],
  28,
);
const PODIUM_TOP_GEO = new RoundedBoxGeometry(0.52, 0.05, 0.4, 3, 0.02);

const UMBRELLA_POLE_GEO = new THREE.CapsuleGeometry(0.02, 2.0, 4, 8);
const UMBRELLA_TOP_GEO = new THREE.ConeGeometry(0.85, 0.4, 24);

const AWNING_GEO = new RoundedBoxGeometry(1.25, 0.06, 0.6, 3, 0.025);

const FORM_POST_GEO = new THREE.CapsuleGeometry(0.02, 0.5, 4, 8);
const FORM_BASE_GEO = new THREE.CylinderGeometry(0.16, 0.19, 0.04, 20);

// ─────────────────────────────────────────────────────────────────────────────
// The prop renderer
// ─────────────────────────────────────────────────────────────────────────────

const BOTTLE_ROW: readonly InstanceXf[] = [
  { p: [-0.5, 0.025, 0] },
  { p: [-0.25, 0.025, 0], s: 1.1 },
  { p: [0, 0.025, 0], s: 0.9 },
  { p: [0.26, 0.025, 0] },
  { p: [0.5, 0.025, 0], s: 1.05 },
];

const DONUT_GRID: readonly InstanceXf[] = [
  { p: [-0.22, 0.5, 0.045] },
  { p: [0, 0.5, 0.045] },
  { p: [0.22, 0.5, 0.045] },
  { p: [-0.22, 0.28, 0.045] },
  { p: [0, 0.28, 0.045] },
  { p: [0.22, 0.28, 0.045] },
];

const BULB_RING: readonly InstanceXf[] = [
  { p: [-0.3, 0.25, 0.05] },
  { p: [-0.3, 0.55, 0.05] },
  { p: [-0.3, 0.85, 0.05] },
  { p: [0.3, 0.25, 0.05] },
  { p: [0.3, 0.55, 0.05] },
  { p: [0.3, 0.85, 0.05] },
  { p: [-0.12, 1.02, 0.05] },
  { p: [0.12, 1.02, 0.05] },
];

const BLOOM_CLUSTER: readonly InstanceXf[] = [
  { p: [-0.22, 0.66, 0.05], s: 1 },
  { p: [0.02, 0.72, -0.08], s: 1.25 },
  { p: [0.24, 0.64, 0.08], s: 0.95 },
  { p: [0.1, 0.6, 0.16], s: 0.8 },
  { p: [-0.08, 0.62, 0.14], s: 0.85 },
];

/**
 * One placed booth prop. `palette` recolours the tasteful surfaces (cake trim,
 * drape cloth, umbrella canvas stay prop-true where recolouring would read
 * wrong — the venue-objects BOOTH_* rule).
 */
export function BoothProp({ kind, palette }: { kind: BoothPropKind; palette: Lab3DPalette }) {
  switch (kind) {
    case 'chafing_dish':
      return (
        <group>
          <mesh geometry={CHAFING_TRAY_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.045, 0]} castShadow />
          <mesh geometry={CHAFING_DOME_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.09, 0]} />
        </group>
      );
    case 'plate_stack':
      return <mesh geometry={PLATE_STACK_GEO} material={boothSheenMaterial(KIT_CREAM)} castShadow />;
    case 'tiered_cake':
      return (
        <group>
          <mesh geometry={CAKE_STAND_GEO} material={boothMetalMaterial(KIT_CHROME)} />
          <group position={[0, 0.08, 0]}>
            <mesh geometry={CAKE_GEO} material={boothSheenMaterial('#f7f2ea')} castShadow />
            <mesh geometry={BULB_GEO} material={boothSheenMaterial(palette.accent)} position={[0, 0.56, 0]} scale={1.4} />
          </group>
        </group>
      );
    case 'espresso_machine':
      return (
        <group>
          <mesh geometry={ESPRESSO_BODY_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.16, 0]} castShadow />
          <mesh geometry={ESPRESSO_TOP_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.36, 0]} />
          {/* The steam puff — two soft translucent spheres over the group head. */}
          <mesh geometry={STEAM_GEO} material={steamMat} position={[0.1, 0.46, 0.08]} />
          <mesh geometry={STEAM_GEO} material={steamMat} position={[0.14, 0.55, 0.1]} scale={0.7} />
        </group>
      );
    case 'bottle_shelf':
      return (
        <group>
          <mesh geometry={SHELF_BOARD_GEO} material={boothSheenMaterial(KIT_WOOD)} castShadow />
          <StaticInstances geometry={BOTTLE_GEO} material={boothSheenMaterial('#3a5a4a')} transforms={BOTTLE_ROW} />
        </group>
      );
    case 'shaker':
      return <mesh geometry={SHAKER_GEO} material={boothMetalMaterial(KIT_CHROME)} castShadow />;
    case 'donut_board':
      return (
        <group>
          <mesh geometry={DONUT_BOARD_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.45, 0]} castShadow />
          <StaticInstances geometry={DONUT_GEO} material={boothSheenMaterial('#d98a9b')} transforms={DONUT_GRID} />
        </group>
      );
    case 'drum_kit':
      return (
        <group>
          <mesh geometry={KICK_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
          {[-0.42, 0.42].map((x) => (
            <group key={x} position={[x, 0, -0.12]}>
              <mesh geometry={CYMBAL_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.4, 0]} />
              <mesh geometry={CYMBAL_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.79, 0]} rotation={[0.15, 0, x > 0 ? -0.1 : 0.1]} castShadow />
            </group>
          ))}
        </group>
      );
    case 'mic_stand':
      return (
        <group>
          <mesh geometry={MIC_BASE_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.02, 0]} />
          <mesh geometry={MIC_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.6, 0]} castShadow />
          <mesh geometry={MIC_HEAD_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 1.2, 0.02]} />
        </group>
      );
    case 'stage_monitor':
      return (
        <mesh geometry={MONITOR_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.16, 0]} rotation={[-0.5, 0, 0]} castShadow />
      );
    case 'tripod_camera':
      return (
        <group>
          {[0, 2.1, -2.1].map((a) => (
            <mesh
              key={a}
              geometry={TRIPOD_LEG_GEO}
              material={boothMetalMaterial(KIT_DARK)}
              position={[Math.sin(a) * 0.2, 0.55, Math.cos(a) * 0.2]}
              rotation={[Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]}
              castShadow
            />
          ))}
          <mesh geometry={CAM_BODY_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 1.18, 0]} castShadow />
          <mesh geometry={LENS_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 1.18, 0.16]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case 'live_lamp':
      return (
        <group>
          <mesh geometry={LAMP_BOX_GEO} material={boothSheenMaterial(KIT_DARK)} castShadow />
          <mesh geometry={LAMP_FACE_GEO} position={[0, 0, 0.065]}>
            <meshStandardMaterial
              map={liveLampTexture()}
              emissive="#ff3b30"
              emissiveIntensity={0.75}
              emissiveMap={liveLampTexture()}
              roughness={0.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      );
    case 'bulb_mirror':
      return (
        <group>
          <mesh geometry={MIRROR_PANEL_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.62, 0]} castShadow />
          <mesh geometry={MIRROR_GLASS_GEO} material={mirrorMat} position={[0, 0.62, 0.045]} />
          <group position={[0, 0, -0.01]}>
            <StaticInstances geometry={BULB_GEO} material={bulbMat} transforms={BULB_RING} />
          </group>
        </group>
      );
    case 'console_speakers':
      // Base-origin TABLETOP unit (a low plinth, the tilted console, two
      // monitor speakers flanking on the same surface) — authored to sit on
      // the STATION worktable, not the floor.
      return (
        <group>
          <mesh geometry={CONSOLE_PLINTH_GEO} material={boothSheenMaterial(palette.table)} position={[0, 0.06, 0]} castShadow />
          <mesh geometry={CONSOLE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.17, 0]} rotation={[-0.14, 0, 0]} castShadow />
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} geometry={SPEAKER_GEO} material={boothSheenMaterial(KIT_DARK)} position={[x, 0.22, 0]} rotation={[0, x > 0 ? -0.25 : 0.25, 0]} castShadow />
          ))}
        </group>
      );
    case 'moving_head':
      return (
        <group>
          <mesh geometry={MH_BASE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.04, 0]} />
          <mesh geometry={MH_HEAD_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.2, 0]} rotation={[0.5, 0, 0]} castShadow />
          {/* The soft beam cone — one of the cinematic-Play bloom stars. */}
          <mesh geometry={MH_BEAM_GEO} material={beamMat} position={[0, 0.72, -0.26]} rotation={[-0.5, 0, 0]} />
        </group>
      );
    case 'bloom_cart':
      return (
        <group>
          <mesh geometry={CART_BODY_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.36, 0]} castShadow receiveShadow />
          {[-0.32, 0.32].map((x) => (
            <mesh key={x} geometry={CART_WHEEL_GEO} material={boothSheenMaterial(KIT_DARK)} position={[x, 0.12, 0.28]} />
          ))}
          <mesh geometry={BLOOM_LEAF_GEO} material={boothSheenMaterial(KIT_GREEN)} position={[0, 0.62, 0]} scale={[2.1, 0.9, 1.4]} castShadow />
          <StaticInstances geometry={BLOOM_GEO} material={boothSheenMaterial('#d9909b')} transforms={BLOOM_CLUSTER} castShadow />
        </group>
      );
    case 'drape_wall':
      return (
        <mesh geometry={DRAPE_GEO} material={boothSheenMaterial(palette.accent)} position={[0, 1.05, 0]} castShadow />
      );
    case 'easel':
      return (
        <group>
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} geometry={EASEL_LEG_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[x, 0.66, 0.05]} rotation={[0.12, 0, x > 0 ? -0.16 : 0.16]} castShadow />
          ))}
          <mesh geometry={EASEL_LEG_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.66, -0.2]} rotation={[-0.3, 0, 0]} />
          <mesh geometry={EASEL_BOARD_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.95, 0.09]} rotation={[0.12, 0, 0]} castShadow />
        </group>
      );
    case 'clipboard_board':
      return (
        <group rotation={[-0.35, 0, 0]}>
          <mesh geometry={CLIPBOARD_GEO} material={clipboardMaterial()} position={[0, 0.33, 0]} castShadow />
        </group>
      );
    case 'podium':
      return (
        <group>
          <mesh geometry={PODIUM_GEO} material={boothSheenMaterial(palette.table)} castShadow receiveShadow />
          <mesh geometry={PODIUM_TOP_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 1.13, -0.02]} rotation={[-0.2, 0, 0]} />
        </group>
      );
    case 'umbrella':
      return (
        <group>
          <mesh geometry={UMBRELLA_POLE_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 1.05, 0]} />
          <mesh geometry={UMBRELLA_TOP_GEO} material={awningMaterial()} position={[0, 2.15, 0]} castShadow />
        </group>
      );
    case 'awning':
      return (
        <mesh geometry={AWNING_GEO} material={awningMaterial()} rotation={[0.35, 0, 0]} castShadow />
      );
    case 'gown_form':
      // The dress form reuses the kit's GOWN_GEO shell (authored in torso
      // space, pelvis at y=0 with the hem at −0.62) on a slim stand.
      return (
        <group>
          <mesh geometry={FORM_BASE_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.02, 0]} />
          <mesh geometry={FORM_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.35, 0]} />
          <mesh geometry={GOWN_GEO} material={boothSheenMaterial(palette.accent)} position={[0, 0.92, 0]} castShadow />
        </group>
      );
  }
}

/**
 * The fallback TEXT sign — a booth with no brandable vendor logo still gets a
 * named board (the template's signText / the couple's booth label) drawn as a
 * CanvasTexture. Cached per (text, colour); bounded by the booths on a floor.
 */
const textSignCache = new Map<string, THREE.CanvasTexture>();

function textSignTexture(text: string, accent: string): THREE.CanvasTexture {
  const key = `${accent}|${text}`;
  const cached = textSignCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#faf6ec';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 84, 256, 12);
  ctx.fillStyle = '#3a2a20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = text.length > 22 ? `${text.slice(0, 21)}…` : text;
  ctx.font = `600 ${label.length > 14 ? 24 : 30}px system-ui, sans-serif`;
  ctx.fillText(label, 128, 44);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textSignCache.set(key, tex);
  return tex;
}

const SIGN_BOARD_GEO = new RoundedBoxGeometry(1.5, 0.56, 0.07, 3, 0.03);

/** The drawn nameboard, sized/positioned like the shared BoothSign's logo
 *  board so branded + unbranded booths hang signage at the same height. */
export function BoothTextSign({ text, palette }: { text: string; palette: Lab3DPalette }) {
  return (
    <group position={[0, 0, -0.62]}>
      <mesh geometry={SIGN_BOARD_GEO} material={boothSheenMaterial(palette.table)} position={[0, 1.75, 0]} castShadow />
      <mesh position={[0, 1.75, 0.045]}>
        <planeGeometry args={[1.34, 0.46]} />
        <meshBasicMaterial map={textSignTexture(text, palette.accent)} toneMapped={false} />
      </mesh>
    </group>
  );
}
