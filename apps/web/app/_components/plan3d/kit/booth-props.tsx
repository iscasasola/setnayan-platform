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
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Lab3DPalette } from '@/lib/seating-3d';
import { GOWN_GEO, SUIT_GEO, outfitMaterial } from './outfits';
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
  | 'gown_form'
  // 2026-07-08 polish — DJ ≠ Lights&Sound differentiators (owner catch):
  | 'turntable_deck'
  | 'vinyl_crate'
  | 'speaker_tower'
  | 'light_tree'
  | 'food_tray'
  // ── catalog completion (2026-07-08 · the remaining-37-templates PR) ──
  | 'maquette' //            reception — ballroom scale model on the desk
  | 'chapel_arch' //         ceremony_venue — capsule arch + pew pair
  | 'calendar_board' //      date_specialist — month grid, circled date
  | 'crate_stack' //         crew_meals — packed-meal crates
  | 'capiz_string' //        outdoor / filipiniana / ceremony — warm-gold shells
  | 'mortar_rack' //         fireworks — tube battery + starburst sign
  | 'led_panel' //           led_wall — upright animated colour-band panel
  | 'led_floor' //           dance_floor — the same LED look laid as floor tile
  | 'tech_set' //            digital_services — laptop + QR standee
  | 'music_stand' //         orchestra / choir — post + tilted tray
  | 'cello' //               orchestra — waisted lathe body on a stand
  | 'hoop_ribbon' //         performers — leaning hoop + helix ribbon
  | 'magazine_rack' //       editorial / printing — leaning covers on a rail
  | 'suit_form' //           grooms/mens attire — charcoal suit on a form
  | 'barong_form' //         filipiniana — jusi barong (embroidery bump) on a form
  | 'garment_rack' //        womens_attire — mini gown shells on a rail
  | 'suit_rack' //           mens_attire — the same rail, dark suit shells
  | 'towel_stack' //         grooming / wellness / massage / nails — rolled tiers
  | 'glass_case' //          jewelleries — translucent case + sparkles
  | 'fruit_tower' //         mocktail — stacked bowls, FOOD-TRUE fruit
  | 'recliner' //            massage_chair — tilted lounger on a pedestal
  | 'arcade_set' //          arcade_games — claw machine + mini hoop
  | 'low_table_cushions' //  henna_tattoo — low table + floor cushions
  | 'polish_rack' //         mini_nail_bar — rack of tiny accent bottles
  | 'crystal_set' //         tarot — crystal ball + fanned cards
  | 'embroidery_hoop' //     engraving_embroidery — tilted hoop on a stand
  | 'print_press' //         printing — press body + roller + sheet
  | 'gift_shelf' //          souvenir_giveaways — ribboned gift boxes
  | 'trophy_shelf' //        trophies_awards — gold cup row
  | 'dance_marks' //         choreographer — numbered-spot floor discs
  | 'ribbon_cans' //         bridal_car — bow + trailing cans
  | 'traffic_cone' //        escort — cone + base
  | 'barber_pole' //         grooming — striped pole, wall-clock spin
  | 'perfume_organ'; //      perfume_bar — stepped shelves of glass bottles

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

type InstanceXf = {
  p: readonly [number, number, number];
  s?: number;
  /** Optional per-instance Euler (XYZ, radians) — leaning covers, fanned
   *  cards, trailing cans. Omitted = identity, exactly as before. */
  r?: readonly [number, number, number];
};

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
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    transforms.forEach((t, i) => {
      e.set(t.r?.[0] ?? 0, t.r?.[1] ?? 0, t.r?.[2] ?? 0);
      q.setFromEuler(e);
      pos.set(t.p[0], t.p[1], t.p[2]);
      scl.setScalar(t.s ?? 1);
      m.compose(pos, q, scl);
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

let liveLampFaceMatCache: THREE.MeshStandardMaterial | null = null;
/** The "● LIVE" lamp face material — a lazy module singleton (it bakes the
 *  browser-only CanvasTexture) so every mounted livestream lamp shares ONE
 *  material, per the kit's keyed-cache discipline. */
function liveLampFaceMaterial(): THREE.MeshStandardMaterial {
  if (!liveLampFaceMatCache) {
    liveLampFaceMatCache = new THREE.MeshStandardMaterial({
      map: liveLampTexture(),
      emissive: '#ff3b30',
      emissiveIntensity: 0.75,
      emissiveMap: liveLampTexture(),
      roughness: 0.4,
      toneMapped: false,
    });
  }
  return liveLampFaceMatCache;
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

// ── Catalog-completion textures + emissive singletons (2026-07-08) ──────────

// Fixed-look singletons for the completion set. Capiz is the heritage rule
// made material: warm-gold emissive ONLY, never palette-RGB — a parol/capiz
// string recoloured to a motif reads as plastic bunting, not capiz.
const capizMat = new THREE.MeshStandardMaterial({
  color: '#fff3da',
  emissive: '#f0c46a',
  emissiveIntensity: 0.55,
  roughness: 0.35,
});
const glassMat = new THREE.MeshStandardMaterial({
  color: '#dfe8ee',
  transparent: true,
  opacity: 0.22,
  roughness: 0.05,
  metalness: 0.1,
  depthWrite: false,
});
const crystalMat = new THREE.MeshStandardMaterial({
  color: '#cfd9ec',
  transparent: true,
  opacity: 0.5,
  roughness: 0.05,
  metalness: 0.2,
});
const marqueeMat = new THREE.MeshStandardMaterial({
  color: '#ffe9b8',
  emissive: '#ffc857',
  emissiveIntensity: 0.8,
  roughness: 0.4,
});
const perfumeMat = new THREE.MeshStandardMaterial({
  color: '#e8c9a0',
  transparent: true,
  opacity: 0.72,
  roughness: 0.12,
});
const screenGlowMat = new THREE.MeshStandardMaterial({
  color: '#bcd8ff',
  emissive: '#9cc2f0',
  emissiveIntensity: 0.6,
  roughness: 0.3,
  toneMapped: false,
});

let calTex: THREE.CanvasTexture | null = null;
/** The date-specialist month grid — a paper field, weekday header band, day
 *  cells, and ONE circled date in the clipboard's warm accent red. */
function calendarTexture(): THREE.CanvasTexture {
  if (calTex) return calTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8f4ea';
  ctx.fillRect(0, 0, 128, 112);
  ctx.fillStyle = '#c26a4a';
  ctx.fillRect(0, 0, 128, 18); // month header band
  ctx.strokeStyle = '#b8bcc4';
  ctx.lineWidth = 1.5;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 5; row++) {
      ctx.strokeRect(4 + col * 17.2, 24 + row * 16.5, 15, 14.5);
    }
  }
  // The circled date — the whole prop's story in one accent ring.
  ctx.strokeStyle = '#c2452e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(4 + 4 * 17.2 + 7.5, 24 + 2 * 16.5 + 7.2, 9, 0, Math.PI * 2);
  ctx.stroke();
  calTex = new THREE.CanvasTexture(canvas);
  calTex.colorSpace = THREE.SRGBColorSpace;
  return calTex;
}

let calMatCache: THREE.MeshStandardMaterial | null = null;
function calendarMaterial(): THREE.MeshStandardMaterial {
  if (!calMatCache) {
    calMatCache = new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.8 });
  }
  return calMatCache;
}

let ledTex: THREE.CanvasTexture | null = null;
/** Animated colour-band LED content: soft vertical gradient bars the panel
 *  scrolls by advancing `offset.x` from the wall clock. RepeatWrapping. */
function ledTexture(): THREE.CanvasTexture {
  if (ledTex) return ledTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const bands = ['#8a3d8f', '#3d6a9e', '#3d9e8a', '#c2892e', '#a83a5e', '#4a4a9e'];
  const bw = 128 / bands.length;
  bands.forEach((c, i) => {
    const g = ctx.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
    g.addColorStop(0, c);
    g.addColorStop(1, bands[(i + 1) % bands.length]!);
    ctx.fillStyle = g;
    ctx.fillRect(i * bw, 0, bw + 1, 64);
  });
  ledTex = new THREE.CanvasTexture(canvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  ledTex.wrapS = THREE.RepeatWrapping;
  ledTex.wrapT = THREE.RepeatWrapping;
  return ledTex;
}

let ledMatCache: THREE.MeshStandardMaterial | null = null;
function ledMaterial(): THREE.MeshStandardMaterial {
  if (!ledMatCache) {
    ledMatCache = new THREE.MeshStandardMaterial({
      map: ledTexture(),
      emissive: '#ffffff',
      emissiveIntensity: 0.85,
      emissiveMap: ledTexture(),
      roughness: 0.4,
      toneMapped: false, // a designated cinematic-Play bloom star
    });
  }
  return ledMatCache;
}

let qrTex: THREE.CanvasTexture | null = null;
/** A deterministic pseudo-QR block pattern (finder squares + hashed cells) —
 *  reads as a scan code at booth distance; never a real payload. */
function qrTexture(): THREE.CanvasTexture {
  if (qrTex) return qrTex;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = '#1c1c22';
  const cells = 12;
  const cw = 96 / cells;
  for (let x = 0; x < cells; x++) {
    for (let y = 0; y < cells; y++) {
      // FNV-flavoured parity — stable, dependency-free "random" fill.
      if (((x * 31 + y * 17 + ((x * y) % 7)) & 3) < 2) {
        ctx.fillRect(x * cw + 0.5, y * cw + 0.5, cw - 1, cw - 1);
      }
    }
  }
  // The three finder squares.
  for (const [fx, fy] of [
    [0, 0],
    [9, 0],
    [0, 9],
  ] as const) {
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(fx * cw, fy * cw, cw * 3, cw * 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx * cw + cw * 0.6, fy * cw + cw * 0.6, cw * 1.8, cw * 1.8);
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(fx * cw + cw * 1.05, fy * cw + cw * 1.05, cw * 0.9, cw * 0.9);
  }
  qrTex = new THREE.CanvasTexture(canvas);
  qrTex.colorSpace = THREE.SRGBColorSpace;
  return qrTex;
}

let qrMatCache: THREE.MeshBasicMaterial | null = null;
function qrMaterial(): THREE.MeshBasicMaterial {
  if (!qrMatCache) {
    qrMatCache = new THREE.MeshBasicMaterial({ map: qrTexture(), toneMapped: false });
  }
  return qrMatCache;
}

let starTex: THREE.CanvasTexture | null = null;
/** The fireworks starburst sign face: warm radiating rays on night blue —
 *  drawn (not 12 instanced boxes), so the whole sign is one plane. */
function starburstTexture(): THREE.CanvasTexture {
  if (starTex) return starTex;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1c2036';
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = '#f0c46a';
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(48 + Math.cos(a) * 10, 48 + Math.sin(a) * 10);
    ctx.lineTo(48 + Math.cos(a) * (i % 2 ? 30 : 40), 48 + Math.sin(a) * (i % 2 ? 30 : 40));
    ctx.stroke();
  }
  ctx.fillStyle = '#fff3da';
  ctx.beginPath();
  ctx.arc(48, 48, 7, 0, Math.PI * 2);
  ctx.fill();
  starTex = new THREE.CanvasTexture(canvas);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

let starMatCache: THREE.MeshStandardMaterial | null = null;
function starburstMaterial(): THREE.MeshStandardMaterial {
  if (!starMatCache) {
    starMatCache = new THREE.MeshStandardMaterial({
      map: starburstTexture(),
      emissive: '#f0c46a',
      emissiveIntensity: 0.6,
      emissiveMap: starburstTexture(),
      roughness: 0.5,
      toneMapped: false, // warm bloom star (heritage-warm, never palette-RGB)
    });
  }
  return starMatCache;
}

let barberTex: THREE.CanvasTexture | null = null;
/** Diagonal barber stripes (red/blue on white), RepeatWrapping — the pole
 *  spins by advancing `offset.y` from the wall clock. */
function barberTexture(): THREE.CanvasTexture {
  if (barberTex) return barberTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, 64, 64);
  const stripe = (color: string, shift: number) => {
    ctx.fillStyle = color;
    for (let i = -2; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32 + shift, 64);
      ctx.lineTo(i * 32 + shift + 32, 0);
      ctx.lineTo(i * 32 + shift + 44, 0);
      ctx.lineTo(i * 32 + shift + 12, 64);
      ctx.closePath();
      ctx.fill();
    }
  };
  stripe('#c2452e', 0);
  stripe('#3d5a9e', 16);
  barberTex = new THREE.CanvasTexture(canvas);
  barberTex.colorSpace = THREE.SRGBColorSpace;
  barberTex.wrapS = THREE.RepeatWrapping;
  barberTex.wrapT = THREE.RepeatWrapping;
  barberTex.repeat.set(1.5, 1.5);
  return barberTex;
}

let barberMatCache: THREE.MeshStandardMaterial | null = null;
function barberMaterial(): THREE.MeshStandardMaterial {
  if (!barberMatCache) {
    barberMatCache = new THREE.MeshStandardMaterial({ map: barberTexture(), roughness: 0.35 });
  }
  return barberMatCache;
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
const TRIPOD_COLLAR_GEO = new THREE.CylinderGeometry(0.05, 0.07, 0.1, 12);
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
// 2026-07-08 polish props — the DJ's deck + crate, and Lights&Sound's towers
// + light tree (the moving heads move UP onto the tree, out of the staff zone).
const TRAY_GEO = new RoundedBoxGeometry(0.42, 0.06, 0.3, 3, 0.02);
const FOOD_MOUND_GEO = new THREE.SphereGeometry(0.06, 12, 9);
const TT_BODY_GEO = new RoundedBoxGeometry(0.78, 0.07, 0.4, 3, 0.03);
const TT_DISC_GEO = new THREE.CylinderGeometry(0.14, 0.14, 0.022, 26);
const TT_MIXER_GEO = new RoundedBoxGeometry(0.16, 0.05, 0.3, 3, 0.02);
const CRATE_GEO = new RoundedBoxGeometry(0.34, 0.26, 0.34, 3, 0.03);
const VINYL_GEO = new RoundedBoxGeometry(0.28, 0.28, 0.015, 2, 0.006);
const TOWER_POLE_GEO = new THREE.CylinderGeometry(0.035, 0.045, 0.9, 12);
const TREE_POLE_GEO = new THREE.CylinderGeometry(0.035, 0.05, 1.9, 12);
const TREE_BAR_GEO = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10);

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

// ── Catalog-completion geometries (2026-07-08 · the remaining-37 PR) ────────

const MAQ_BASE_GEO = new RoundedBoxGeometry(0.52, 0.035, 0.38, 2, 0.012);
const MAQ_TABLE_GEO = new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10);
const MAQ_ARCH_GEO = new THREE.TorusGeometry(0.055, 0.011, 8, 14, Math.PI);

const ARCH_POST_GEO = new THREE.CapsuleGeometry(0.045, 1.9, 4, 12);
const ARCH_TOP_GEO = new THREE.TorusGeometry(0.62, 0.05, 10, 24, Math.PI);
const PEW_GEO = new RoundedBoxGeometry(0.55, 0.3, 0.22, 3, 0.04);

const CAL_BOARD_GEO = new RoundedBoxGeometry(0.62, 0.52, 0.05, 3, 0.02);
const CAL_FACE_GEO = new THREE.PlaneGeometry(0.54, 0.44);

const CAPIZ_POLE_GEO = new THREE.CapsuleGeometry(0.025, 1.7, 4, 10);
const CAPIZ_SHELL_GEO = new THREE.SphereGeometry(0.035, 10, 8);
CAPIZ_SHELL_GEO.scale(1, 1.25, 0.35); // flattened capiz disc, baked in

const MORTAR_BASE_GEO = new RoundedBoxGeometry(0.5, 0.12, 0.34, 3, 0.03);
const MORTAR_TUBE_GEO = new THREE.CylinderGeometry(0.05, 0.055, 0.34, 14);
const STAR_SIGN_GEO = new THREE.PlaneGeometry(0.48, 0.48);
const STAR_POST_GEO = new THREE.CapsuleGeometry(0.02, 1.1, 4, 8);

const LED_FRAME_GEO = new RoundedBoxGeometry(1.7, 1.1, 0.08, 3, 0.03);
const LED_SCREEN_GEO = new THREE.PlaneGeometry(1.56, 0.96);
const LED_FLOOR_FRAME_GEO = new RoundedBoxGeometry(1.3, 0.06, 1.3, 3, 0.025);
const LED_FLOOR_SCREEN_GEO = new THREE.PlaneGeometry(1.16, 1.16);
LED_FLOOR_SCREEN_GEO.rotateX(-Math.PI / 2); // face up, baked in

const LAPTOP_BASE_GEO = new RoundedBoxGeometry(0.34, 0.02, 0.24, 2, 0.008);
const LAPTOP_LID_GEO = new RoundedBoxGeometry(0.34, 0.23, 0.02, 2, 0.008);
const LAPTOP_SCREEN_GEO = new THREE.PlaneGeometry(0.29, 0.18);
const QR_POST_GEO = new THREE.CapsuleGeometry(0.015, 0.42, 4, 8);
const QR_BOARD_GEO = new RoundedBoxGeometry(0.3, 0.3, 0.03, 2, 0.012);
const QR_FACE_GEO = new THREE.PlaneGeometry(0.24, 0.24);

const MS_POST_GEO = new THREE.CapsuleGeometry(0.014, 0.85, 4, 8);
const MS_TRAY_GEO = new RoundedBoxGeometry(0.4, 0.3, 0.02, 2, 0.008);

const CELLO_BODY_GEO = lathe(
  [
    [0.03, 0.62],
    [0.15, 0.5],
    [0.105, 0.36], // the waist
    [0.185, 0.16],
    [0.15, 0.0],
  ],
  24,
);
CELLO_BODY_GEO.scale(1, 1, 0.5); // flat-bodied, baked in
const CELLO_NECK_GEO = new THREE.CapsuleGeometry(0.016, 0.55, 4, 8);

const HOOP_GEO = new THREE.TorusGeometry(0.42, 0.02, 10, 28);
const HOOP_STAND_GEO = new THREE.CapsuleGeometry(0.018, 0.5, 4, 8);
const RIBBON_GEO = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(
    Array.from({ length: 12 }, (_, i) => {
      const a = i * 1.05;
      return new THREE.Vector3(Math.sin(a) * 0.16, 0.08 + i * 0.085, Math.cos(a) * 0.07);
    }),
  ),
  36,
  0.012,
  6,
  false,
);

const RACK_BASE_GEO = new RoundedBoxGeometry(0.7, 0.05, 0.24, 2, 0.02);
const RACK_BACK_GEO = new RoundedBoxGeometry(0.7, 0.45, 0.03, 2, 0.012);

const RAIL_UPRIGHT_GEO = new THREE.CapsuleGeometry(0.02, 1.5, 4, 8);
const RAIL_BAR_GEO = new THREE.CapsuleGeometry(0.015, 1.0, 4, 8);

const TOWEL_GEO = new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12);
TOWEL_GEO.rotateX(Math.PI / 2); // rolled towels lie flat, baked in

const CASE_PLINTH_GEO = new RoundedBoxGeometry(0.5, 0.9, 0.4, 3, 0.045);
const CASE_GLASS_GEO = new RoundedBoxGeometry(0.44, 0.3, 0.34, 3, 0.03);

const FRUIT_BOWL_GEO = lathe([
  [0.2, 0.12],
  [0.17, 0.06],
  [0.05, 0.0],
]);
const FRUIT_GEO = new THREE.SphereGeometry(0.045, 12, 9);

const REC_SEAT_GEO = new RoundedBoxGeometry(0.5, 0.12, 0.55, 3, 0.05);
const REC_BACK_GEO = new RoundedBoxGeometry(0.5, 0.6, 0.12, 3, 0.05);
const REC_LEGREST_GEO = new RoundedBoxGeometry(0.46, 0.1, 0.4, 3, 0.04);
const REC_PED_GEO = lathe([
  [0.08, 0.35],
  [0.1, 0.05],
  [0.26, 0.0],
]);

const CLAW_BODY_GEO = new RoundedBoxGeometry(0.6, 0.75, 0.55, 3, 0.05);
const CLAW_GLASS_GEO = new RoundedBoxGeometry(0.54, 0.5, 0.5, 3, 0.04);
const MARQUEE_GEO = new RoundedBoxGeometry(0.6, 0.14, 0.5, 3, 0.04);
const PRIZE_GEO = new THREE.SphereGeometry(0.06, 10, 8);
const HOOP_BOARD_GEO = new RoundedBoxGeometry(0.4, 0.3, 0.03, 2, 0.012);

const LOWTABLE_GEO = new RoundedBoxGeometry(0.7, 0.22, 0.45, 3, 0.04);
const CUSHION_GEO = new RoundedBoxGeometry(0.3, 0.1, 0.3, 3, 0.045);

const POLISH_BOARD_GEO = new RoundedBoxGeometry(0.4, 0.3, 0.04, 2, 0.015);
const POLISH_LEDGE_GEO = new RoundedBoxGeometry(0.4, 0.025, 0.07, 2, 0.01);

const CRYSTAL_GEO = new THREE.SphereGeometry(0.11, 20, 16);
const CRYSTAL_STAND_GEO = lathe([
  [0.07, 0.05],
  [0.045, 0.02],
  [0.1, 0.0],
]);
const CARD_GEO = new RoundedBoxGeometry(0.09, 0.006, 0.14, 1, 0.002);

const EMB_RING_GEO = new THREE.TorusGeometry(0.16, 0.014, 8, 24);
const EMB_CLOTH_GEO = new THREE.CircleGeometry(0.15, 24);

const PRESS_BODY_GEO = new RoundedBoxGeometry(0.55, 0.3, 0.4, 3, 0.04);
const PRESS_ROLLER_GEO = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16);
PRESS_ROLLER_GEO.rotateZ(Math.PI / 2); // spans the press, baked in
const PRESS_SHEET_GEO = new RoundedBoxGeometry(0.3, 0.012, 0.34, 1, 0.004);

const GIFT_GEO = new RoundedBoxGeometry(0.16, 0.14, 0.16, 2, 0.02);
const GIFT_RIBBON_GEO = new RoundedBoxGeometry(0.035, 0.15, 0.17, 1, 0.008);

const TROPHY_GEO = lathe(
  [
    [0.012, 0.3],
    [0.09, 0.26],
    [0.1, 0.22],
    [0.03, 0.12],
    [0.035, 0.04],
    [0.08, 0.0],
  ],
  20,
);

const MARK_GEO = new THREE.CylinderGeometry(0.14, 0.14, 0.012, 20);

const BOW_LOBE_GEO = new THREE.SphereGeometry(0.09, 12, 10);
BOW_LOBE_GEO.scale(1, 0.6, 0.4); // flattened bow lobe, baked in
const CAN_GEO = new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12);

const CONE_GEO = new THREE.ConeGeometry(0.14, 0.42, 20);
const CONE_BAND_GEO = new THREE.TorusGeometry(0.095, 0.018, 8, 20);
const CONE_BASE_GEO = new RoundedBoxGeometry(0.34, 0.05, 0.34, 2, 0.02);

const BARBER_POLE_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 18);
const BARBER_CAP_GEO = new THREE.SphereGeometry(0.075, 14, 10);
const BARBER_POST_GEO = new THREE.CapsuleGeometry(0.02, 0.5, 4, 8);

const ORGAN_SHELF_GEO = new RoundedBoxGeometry(0.8, 0.04, 0.22, 2, 0.015);

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

// ── Catalog-completion instance tables (2026-07-08) ─────────────────────────

const MAQ_TABLES: readonly InstanceXf[] = [
  { p: [-0.15, 0.028, -0.08] },
  { p: [-0.02, 0.028, 0.09] },
  { p: [0.12, 0.028, -0.05] },
  { p: [0.19, 0.028, 0.1], s: 0.85 },
  { p: [-0.18, 0.028, 0.11], s: 0.85 },
  { p: [0.02, 0.028, -0.12], s: 0.9 },
];

/** The capiz catenary: 9 shells hung on a shallow parabola between the two
 *  poles (x ±0.85, tops ≈1.72), each with a small alternating z-roll so the
 *  string reads hand-strung, not machine-stamped. */
const CAPIZ_CATENARY: readonly InstanceXf[] = Array.from({ length: 9 }, (_, i) => {
  const x = -0.72 + (i * 1.44) / 8;
  const y = 1.66 - 0.3 * (1 - (x / 0.85) ** 2);
  return { p: [x, y, 0] as const, r: [0, 0, ((i % 3) - 1) * 0.16] as const };
});

const MORTAR_TUBES: readonly InstanceXf[] = [
  { p: [-0.13, 0.26, -0.06] },
  { p: [0.01, 0.26, -0.06] },
  { p: [0.15, 0.26, -0.06] },
  { p: [-0.06, 0.26, 0.08] },
  { p: [0.08, 0.26, 0.08] },
];

const MAG_COVERS: readonly InstanceXf[] = [
  { p: [-0.2, 0.24, 0.02], r: [-0.22, 0, 0] },
  { p: [0.02, 0.24, 0.04], r: [-0.3, 0, 0] },
  { p: [0.22, 0.24, 0.01], r: [-0.18, 0, 0] },
];

const GOWN_RAIL_ROW: readonly InstanceXf[] = [
  { p: [-0.3, 1.16, 0], s: 0.55, r: [0, 0.2, 0] },
  { p: [0, 1.16, 0.02], s: 0.55, r: [0, -0.12, 0] },
  { p: [0.3, 1.16, 0], s: 0.55, r: [0, 0.28, 0] },
];

const TOWEL_TIERS: readonly InstanceXf[] = [
  { p: [-0.1, 0.045, 0] },
  { p: [0, 0.045, 0.01] },
  { p: [0.1, 0.045, 0] },
  { p: [-0.05, 0.13, 0.005] },
  { p: [0.05, 0.13, 0.005] },
];

const CASE_SPARKLES: readonly InstanceXf[] = [
  { p: [-0.12, 1.02, 0.04], s: 0.7 },
  { p: [0.02, 1.06, -0.06], s: 0.55 },
  { p: [0.13, 1.0, 0.05], s: 0.65 },
  { p: [0.05, 1.1, 0.08], s: 0.5 },
];

// FOOD-TRUE fruit — citrus + lime vs berry, never palette-tinted.
const FRUIT_CITRUS: readonly InstanceXf[] = [
  { p: [-0.08, 0.14, 0.03] },
  { p: [0.07, 0.14, -0.04], s: 0.9 },
  { p: [0.0, 0.15, 0.09], s: 0.85 },
  { p: [-0.03, 0.34, 0.02], s: 0.8 },
];
const FRUIT_BERRY: readonly InstanceXf[] = [
  { p: [0.03, 0.14, -0.08], s: 0.75 },
  { p: [-0.09, 0.15, -0.05], s: 0.7 },
  { p: [0.04, 0.35, -0.03], s: 0.7 },
];

const PRIZE_PILE: readonly InstanceXf[] = [
  { p: [-0.12, 0.82, 0.05] },
  { p: [0.02, 0.8, -0.08], s: 1.1 },
  { p: [0.13, 0.83, 0.08], s: 0.9 },
  { p: [-0.02, 0.9, 0.02], s: 0.85 },
];

const CUSHION_RING: readonly InstanceXf[] = [
  { p: [-0.55, 0.05, 0.25], r: [0, 0.3, 0] },
  { p: [0.55, 0.05, 0.25], r: [0, -0.25, 0] },
  { p: [0, 0.05, 0.5], r: [0, 0.12, 0] },
];

const POLISH_ROW: readonly InstanceXf[] = [
  { p: [-0.12, 0.11, 0.035], s: 0.5 },
  { p: [-0.04, 0.11, 0.035], s: 0.55 },
  { p: [0.04, 0.11, 0.035], s: 0.5 },
  { p: [0.12, 0.11, 0.035], s: 0.55 },
];

const CARD_FAN: readonly InstanceXf[] = [
  { p: [-0.04, 0.005, 0.02], r: [0, 0.45, 0] },
  { p: [0, 0.011, 0.03], r: [0, 0.1, 0] },
  { p: [0.04, 0.017, 0.02], r: [0, -0.3, 0] },
];

const GIFT_ROW: readonly InstanceXf[] = [
  { p: [-0.24, 0.07, 0] },
  { p: [0, 0.07, 0.02], s: 1.15 },
  { p: [0.24, 0.07, 0] },
  { p: [0.02, 0.22, 0.01], s: 0.8 },
];
// Two crossed ribbon bands per box (one instanced draw for all 8 bands).
const GIFT_BOWS: readonly InstanceXf[] = GIFT_ROW.flatMap((g) => [
  { p: g.p, s: (g.s ?? 1) * 1.02 },
  { p: g.p, s: (g.s ?? 1) * 1.02, r: [0, Math.PI / 2, 0] as const },
]);

const TROPHY_ROW: readonly InstanceXf[] = [
  { p: [-0.26, 0, 0], s: 0.85 },
  { p: [0, 0, 0.02] },
  { p: [0.26, 0, 0], s: 0.9 },
];

const MARK_SPOTS: readonly InstanceXf[] = [
  { p: [-0.45, 0.006, 0.2] },
  { p: [0.45, 0.006, 0.2] },
  { p: [-0.2, 0.006, 0.75], s: 0.9 },
  { p: [0.2, 0.006, 0.75], s: 0.9 },
];

const CAN_TRAIL: readonly InstanceXf[] = [
  { p: [-0.12, 0.045, 0.16], r: [Math.PI / 2, 0, 0.4] },
  { p: [0.05, 0.045, 0.3], r: [Math.PI / 2, 0, -0.6] },
  { p: [0.16, 0.045, 0.12], r: [0.3, 0, 1.2] },
];

const PERFUME_ROWS: readonly InstanceXf[] = [
  { p: [-0.3, 0.02, 0], s: 1.6 },
  { p: [-0.15, 0.02, 0.02], s: 1.3 },
  { p: [0.0, 0.02, 0], s: 1.7 },
  { p: [0.16, 0.02, 0.02], s: 1.35 },
  { p: [0.3, 0.02, 0], s: 1.55 },
  { p: [-0.22, 0.24, 0.01], s: 1.4 },
  { p: [-0.02, 0.24, 0.01], s: 1.6 },
  { p: [0.2, 0.24, 0.01], s: 1.35 },
];

const ARCH_POSTS: readonly InstanceXf[] = [
  { p: [-0.62, 0.98, 0] },
  { p: [0.62, 0.98, 0] },
];
const PEW_PAIR: readonly InstanceXf[] = [
  { p: [-0.85, 0.15, 0.75], r: [0, 0.25, 0] },
  { p: [0.85, 0.15, 0.75], r: [0, -0.25, 0] },
];
const CAPIZ_POLES: readonly InstanceXf[] = [
  { p: [-0.85, 0.88, 0] },
  { p: [0.85, 0.88, 0] },
];
const CRATE_STACK_XF: readonly InstanceXf[] = [
  { p: [0, 0.13, 0] },
  { p: [0.06, 0.39, 0.03], s: 0.95 },
  { p: [-0.03, 0.63, -0.02], s: 0.9 },
];
const RAIL_POSTS: readonly InstanceXf[] = [
  { p: [-0.55, 0.78, 0] },
  { p: [0.55, 0.78, 0] },
];
const GOWN_RAIL_CREAM: readonly InstanceXf[] = GOWN_RAIL_ROW.slice(0, 2);
const BOW_XF: readonly InstanceXf[] = [
  { p: [-0.07, 0.5, 0], r: [0, 0, 0.5] },
  { p: [0.07, 0.5, 0], r: [0, 0, -0.5] },
  { p: [0, 0.48, 0.01], s: 0.45 },
];
const BARBER_CAPS: readonly InstanceXf[] = [
  { p: [0, 0.6, 0], s: 0.9 },
  { p: [0, 1.16, 0], s: 0.9 },
];

// ── Wall-clock-animated sub-components (never frame-count-bound) ────────────

/** The LED content plane — advances the shared texture's `offset.x` as a pure
 *  function of `clock.elapsedTime` (an idempotent assignment, so any number of
 *  mounted panels/floors agree and reduced-motion pausing is trivial). */
function LedScreen({
  geometry,
  position,
}: {
  geometry: THREE.BufferGeometry;
  position: readonly [number, number, number];
}) {
  useFrame(({ clock }) => {
    ledTexture().offset.x = (clock.elapsedTime * 0.06) % 1;
  });
  return <mesh geometry={geometry} material={ledMaterial()} position={[position[0], position[1], position[2]]} />;
}

/** The spinning barber-pole cylinder — same wall-clock idempotent-assignment
 *  discipline, advancing the stripe texture's `offset.y`. */
function BarberSpinner() {
  useFrame(({ clock }) => {
    barberTexture().offset.y = (clock.elapsedTime * 0.18) % 1;
  });
  return <mesh geometry={BARBER_POLE_GEO} material={barberMaterial()} position={[0, 0.88, 0]} castShadow />;
}

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
          {/* Apex collar — visually joins the three legs to the camera so the
              body never reads as floating beside the tripod (owner polish). */}
          <mesh geometry={TRIPOD_COLLAR_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 1.07, 0]} />
          <mesh geometry={CAM_BODY_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 1.18, 0]} castShadow />
          <mesh geometry={LENS_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 1.18, 0.16]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case 'live_lamp':
      return (
        <group>
          <mesh geometry={LAMP_BOX_GEO} material={boothSheenMaterial(KIT_DARK)} castShadow />
          <mesh geometry={LAMP_FACE_GEO} material={liveLampFaceMaterial()} position={[0, 0, 0.065]} />
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
    case 'food_tray':
      // An OPEN tray — the food is visible (owner: "a long table of food").
      // Mound colours are food-true, never palette-tinted.
      return (
        <group>
          <mesh geometry={TRAY_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.03, 0]} castShadow />
          {[
            { x: -0.12, c: '#f3ead8' }, // garlic rice
            { x: 0.02, c: '#8a4a2b' }, // lechon / adobo browns
            { x: 0.14, c: '#6f8f3f' }, // greens
          ].map((m) => (
            <mesh key={m.x} geometry={FOOD_MOUND_GEO} material={boothSheenMaterial(m.c)} position={[m.x, 0.075, 0]} scale={[1.1, 0.72, 0.9]} castShadow />
          ))}
        </group>
      );
    case 'turntable_deck':
      // Tabletop DJ deck: slab + two platters with accent labels + centre
      // mixer — the silhouette that says "DJ" instead of "mixing desk".
      return (
        <group>
          <mesh geometry={TT_BODY_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.05, 0]} castShadow />
          {[-0.24, 0.24].map((x) => (
            <group key={x} position={[x, 0.1, 0]}>
              <mesh geometry={TT_DISC_GEO} material={boothSheenMaterial('#111013')} castShadow />
              <mesh geometry={TT_DISC_GEO} material={boothSheenMaterial(palette.accent)} scale={[0.35, 1.1, 0.35]} />
            </group>
          ))}
          <mesh geometry={TT_MIXER_GEO} material={boothSheenMaterial('#2c2a30')} position={[0, 0.095, 0]} castShadow />
        </group>
      );
    case 'vinyl_crate':
      // Floor crate of records — three sleeves lean at different angles.
      return (
        <group>
          <mesh geometry={CRATE_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.13, 0]} castShadow receiveShadow />
          {[-0.06, 0, 0.06].map((z, i) => (
            <mesh key={z} geometry={VINYL_GEO} material={boothSheenMaterial(i === 1 ? palette.accent : '#3a3640')} position={[0, 0.24, z]} rotation={[-0.18 - i * 0.07, 0, 0]} castShadow />
          ))}
        </group>
      );
    case 'speaker_tower':
      // The Lights&Sound differentiator: a tall PA — pole + stacked cabs, the
      // top one tilted toward the room.
      return (
        <group>
          <mesh geometry={TOWER_POLE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.45, 0]} />
          <mesh geometry={SPEAKER_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.95, 0]} scale={[1.25, 1.35, 1.25]} castShadow />
          <mesh geometry={SPEAKER_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 1.5, 0.03]} rotation={[-0.22, 0, 0]} castShadow />
        </group>
      );
    case 'light_tree':
      // T-bar truss with two moving heads UP HIGH (beams angled outward) —
      // reads over the staff's head instead of standing in their spot, and
      // feeds the cinematic-Play bloom pass.
      return (
        <group>
          <mesh geometry={TREE_POLE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.95, 0]} />
          <mesh geometry={TREE_BAR_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 1.85, 0]} rotation={[0, 0, Math.PI / 2]} />
          {[-0.48, 0.48].map((x) => (
            <group key={x} position={[x, 1.78, 0]}>
              <mesh geometry={MH_HEAD_GEO} material={boothSheenMaterial(KIT_DARK)} rotation={[2.6, 0, x > 0 ? -0.35 : 0.35]} castShadow />
              <mesh geometry={MH_BEAM_GEO} material={beamMat} position={[x > 0 ? 0.28 : -0.28, -0.5, 0.1]} rotation={[2.6, 0, x > 0 ? -0.5 : 0.5]} />
            </group>
          ))}
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
    // ── Catalog completion (2026-07-08 · the remaining-37 PR) ────────────────
    case 'maquette':
      // Desk-top ballroom scale model: slab + instanced mini tables + a tiny
      // aisle arch. 3 draws.
      return (
        <group>
          <mesh geometry={MAQ_BASE_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.018, 0]} castShadow />
          <StaticInstances geometry={MAQ_TABLE_GEO} material={boothSheenMaterial(palette.table)} transforms={MAQ_TABLES} />
          <mesh geometry={MAQ_ARCH_GEO} material={boothSheenMaterial(palette.accent)} position={[0.02, 0.035, 0.15]} />
        </group>
      );
    case 'chapel_arch':
      // Two capsule posts + the half-torus top + a pew pair flanking the
      // floor zone. 4 draws (posts + pews instanced).
      return (
        <group>
          <StaticInstances
            geometry={ARCH_POST_GEO}
            material={boothSheenMaterial(KIT_CREAM)}
            transforms={ARCH_POSTS}
            castShadow
          />
          <mesh geometry={ARCH_TOP_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 1.9, 0]} castShadow />
          <StaticInstances
            geometry={PEW_GEO}
            material={boothSheenMaterial(KIT_WOOD)}
            transforms={PEW_PAIR}
            castShadow
          />
        </group>
      );
    case 'calendar_board':
      // The date specialist's oversized month grid, tilted like the
      // clipboard family, circled date in the accent-red ring. 2 draws.
      return (
        <group rotation={[-0.3, 0, 0]}>
          <mesh geometry={CAL_BOARD_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.27, 0]} castShadow />
          <mesh geometry={CAL_FACE_GEO} material={calendarMaterial()} position={[0, 0.27, 0.028]} />
        </group>
      );
    case 'crate_stack':
      // Packed-meal crates in an offset 3-stack (CRATE_GEO reuse). 1 draw.
      return (
        <StaticInstances
          geometry={CRATE_GEO}
          material={boothSheenMaterial(KIT_WOOD)}
          transforms={CRATE_STACK_XF}
          castShadow
        />
      );
    case 'capiz_string':
      // Warm-gold capiz shells on a shallow catenary between two poles —
      // heritage rule: emissive warm-gold ONLY, never palette-RGB. 2 draws.
      return (
        <group>
          <StaticInstances
            geometry={CAPIZ_POLE_GEO}
            material={boothSheenMaterial(KIT_WOOD)}
            transforms={CAPIZ_POLES}
            castShadow
          />
          <StaticInstances geometry={CAPIZ_SHELL_GEO} material={capizMat} transforms={CAPIZ_CATENARY} />
        </group>
      );
    case 'mortar_rack':
      // The tilted tube battery + the drawn starburst sign on a post; the
      // starburst face is one warm-emissive plane (a bloom star). 4 draws.
      return (
        <group>
          <group rotation={[-0.3, 0, 0]} position={[-0.25, 0.02, 0]}>
            <mesh geometry={MORTAR_BASE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.06, 0]} castShadow />
            <StaticInstances geometry={MORTAR_TUBE_GEO} material={boothMetalMaterial(KIT_DARK)} transforms={MORTAR_TUBES} castShadow />
          </group>
          <mesh geometry={STAR_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0.5, 0.58, 0]} />
          <mesh geometry={STAR_SIGN_GEO} material={starburstMaterial()} position={[0.5, 1.28, 0.02]} />
        </group>
      );
    case 'led_panel':
      // Upright LED wall sample: frame + the scrolling colour-band screen
      // (wall-clock offset; cinematic-Play bloom star). 2 draws.
      return (
        <group>
          <mesh geometry={LED_FRAME_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.85, 0]} castShadow />
          <LedScreen geometry={LED_SCREEN_GEO} position={[0, 0.85, 0.045]} />
        </group>
      );
    case 'led_floor':
      // The same LED look laid flat — the dance-floor tile sample. 2 draws.
      return (
        <group>
          <mesh geometry={LED_FLOOR_FRAME_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.03, 0]} receiveShadow />
          <LedScreen geometry={LED_FLOOR_SCREEN_GEO} position={[0, 0.065, 0]} />
        </group>
      );
    case 'tech_set':
      // Desk-top composite: hinged laptop (glowing screen) + QR standee.
      // 6 draws — the plan's designated composite.
      return (
        <group>
          <group position={[-0.16, 0, 0.05]} rotation={[0, 0.2, 0]}>
            <mesh geometry={LAPTOP_BASE_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.01, 0]} castShadow />
            <group position={[0, 0.02, -0.12]} rotation={[0.35, 0, 0]}>
              <mesh geometry={LAPTOP_LID_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.115, 0]} />
              <mesh geometry={LAPTOP_SCREEN_GEO} material={screenGlowMat} position={[0, 0.115, 0.012]} />
            </group>
          </group>
          <group position={[0.3, 0, -0.05]}>
            <mesh geometry={QR_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.22, 0]} />
            <mesh geometry={QR_BOARD_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.55, 0]} castShadow />
            <mesh geometry={QR_FACE_GEO} material={qrMaterial()} position={[0, 0.55, 0.017]} />
          </group>
        </group>
      );
    case 'music_stand':
      // Post + tilted folder tray (the choir reads it as the folder stand).
      // 3 draws.
      return (
        <group>
          <mesh geometry={MIC_BASE_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 0.02, 0]} scale={0.8} />
          <mesh geometry={MS_POST_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 0.45, 0]} />
          <mesh geometry={MS_TRAY_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.92, 0.03]} rotation={[-0.45, 0, 0]} castShadow />
        </group>
      );
    case 'cello':
      // Waisted flat-bodied lathe + capsule neck, leaning on its stand — the
      // honest orchestra silhouette. 3 draws.
      return (
        <group rotation={[0.16, 0, 0.12]}>
          <mesh geometry={CELLO_BODY_GEO} material={boothSheenMaterial('#7a4a2a')} position={[0, 0.05, 0]} castShadow />
          <mesh geometry={CELLO_NECK_GEO} material={boothSheenMaterial('#3a2a1c')} position={[0, 0.92, -0.02]} />
          <mesh geometry={HOOP_STAND_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0.12, 0.3, 0.14]} rotation={[0.4, 0, -0.35]} />
        </group>
      );
    case 'hoop_ribbon':
      // Leaning performance hoop + the accent ribbon frozen mid-swirl (a
      // helix tube). 3 draws.
      return (
        <group>
          <mesh geometry={HOOP_STAND_GEO} material={boothMetalMaterial(KIT_DARK)} position={[-0.3, 0.28, 0]} rotation={[0, 0, 0.2]} />
          <mesh geometry={HOOP_GEO} material={boothSheenMaterial(KIT_CHROME)} position={[-0.28, 0.55, 0.04]} rotation={[0.25, 0.3, -0.3]} castShadow />
          <mesh geometry={RIBBON_GEO} material={boothSheenMaterial(palette.accent)} position={[0.35, 0, 0]} castShadow />
        </group>
      );
    case 'magazine_rack':
      // Rail rack + leaning covers (VINYL_GEO reuse): instanced cream pair +
      // one accent hero cover. 4 draws.
      return (
        <group>
          <mesh geometry={RACK_BASE_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.025, 0]} castShadow />
          <mesh geometry={RACK_BACK_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.25, -0.09]} rotation={[-0.12, 0, 0]} />
          <StaticInstances geometry={VINYL_GEO} material={boothSheenMaterial(KIT_CREAM)} transforms={MAG_COVERS} castShadow />
          <mesh geometry={VINYL_GEO} material={boothSheenMaterial(palette.accent)} position={[0.12, 0.25, 0.06]} rotation={[-0.34, 0.08, 0]} castShadow />
        </group>
      );
    case 'suit_form':
      // FORM_BASE/POST reuse + the SUIT_GEO shell in charcoal — grooms/mens
      // attire. 3 draws.
      return (
        <group>
          <mesh geometry={FORM_BASE_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.02, 0]} />
          <mesh geometry={FORM_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.35, 0]} />
          <mesh geometry={SUIT_GEO} material={boothSheenMaterial('#33384a')} position={[0, 0.92, 0]} castShadow />
        </group>
      );
    case 'barong_form':
      // The filipiniana barong on a form — the kit's ACTUAL barong material
      // (near-white jusi + pechera embroidery bump), never motif-tinted.
      return (
        <group>
          <mesh geometry={FORM_BASE_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.02, 0]} />
          <mesh geometry={FORM_POST_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.35, 0]} />
          <mesh geometry={SUIT_GEO} material={outfitMaterial('barong', null)} position={[0, 0.92, 0]} castShadow />
        </group>
      );
    case 'garment_rack':
      // Two uprights + crossbar + hanging mini gown shells (GOWN_GEO at
      // ~0.55 with slight yaw variety). 4 draws.
      return (
        <group>
          <StaticInstances
            geometry={RAIL_UPRIGHT_GEO}
            material={boothMetalMaterial(KIT_CHROME)}
            transforms={RAIL_POSTS}
          />
          <mesh geometry={RAIL_BAR_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 1.52, 0]} rotation={[0, 0, Math.PI / 2]} />
          <StaticInstances geometry={GOWN_GEO} material={boothSheenMaterial(KIT_CREAM)} transforms={GOWN_RAIL_CREAM} castShadow />
          <mesh geometry={GOWN_GEO} material={boothSheenMaterial(palette.accent)} position={[0.3, 1.16, 0]} rotation={[0, 0.28, 0]} scale={0.55} castShadow />
        </group>
      );
    case 'suit_rack':
      // The same rail recoloured dark with SUIT_GEO shells — mens attire.
      return (
        <group>
          <StaticInstances
            geometry={RAIL_UPRIGHT_GEO}
            material={boothMetalMaterial(KIT_DARK)}
            transforms={RAIL_POSTS}
          />
          <mesh geometry={RAIL_BAR_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 1.52, 0]} rotation={[0, 0, Math.PI / 2]} />
          <StaticInstances geometry={SUIT_GEO} material={boothSheenMaterial('#33384a')} transforms={GOWN_RAIL_ROW} castShadow />
        </group>
      );
    case 'towel_stack':
      // Rolled towels in two tiers — placed at ~1.6 scale lying on the floor
      // it doubles as the wellness mat roll. 1 draw.
      return <StaticInstances geometry={TOWEL_GEO} material={boothSheenMaterial(KIT_CREAM)} transforms={TOWEL_TIERS} castShadow />;
    case 'glass_case':
      // Jewellery vitrine: plinth + translucent case + sparkle bulbs (the
      // bulbMat emissive — subtle bloom). 3 draws.
      return (
        <group>
          <mesh geometry={CASE_PLINTH_GEO} material={boothSheenMaterial(palette.table)} position={[0, 0.45, 0]} castShadow />
          <StaticInstances geometry={BULB_GEO} material={bulbMat} transforms={CASE_SPARKLES} />
          <mesh geometry={CASE_GLASS_GEO} material={glassMat} position={[0, 1.05, 0]} />
        </group>
      );
    case 'fruit_tower':
      // Stacked garnish bowls + FOOD-TRUE fruit (citrus + berry — never
      // palette-tinted). 4 draws.
      return (
        <group>
          <mesh geometry={FRUIT_BOWL_GEO} material={boothSheenMaterial(KIT_CREAM)} castShadow />
          <mesh geometry={FRUIT_BOWL_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.2, 0]} scale={0.68} />
          <StaticInstances geometry={FRUIT_GEO} material={boothSheenMaterial('#e8a33d')} transforms={FRUIT_CITRUS} />
          <StaticInstances geometry={FRUIT_GEO} material={boothSheenMaterial('#a83a4e')} transforms={FRUIT_BERRY} />
        </group>
      );
    case 'recliner':
      // Tilted massage lounger on a lathe pedestal — the template places a
      // pair. 4 draws.
      return (
        <group>
          <mesh geometry={REC_PED_GEO} material={boothMetalMaterial(KIT_DARK)} />
          <group position={[0, 0.38, 0]} rotation={[-0.18, 0, 0]}>
            <mesh geometry={REC_SEAT_GEO} material={boothSheenMaterial(palette.accent)} castShadow />
            <mesh geometry={REC_BACK_GEO} material={boothSheenMaterial(palette.accent)} position={[0, 0.3, -0.28]} rotation={[0.5, 0, 0]} castShadow />
            <mesh geometry={REC_LEGREST_GEO} material={boothSheenMaterial(palette.accent)} position={[0, -0.08, 0.42]} rotation={[-0.55, 0, 0]} />
          </group>
        </group>
      );
    case 'arcade_set':
      // Composite: claw machine (body + translucent glass + prize pile +
      // emissive marquee) + mini hoop. 7 draws — the plan's composite.
      return (
        <group>
          <group position={[-0.35, 0, 0]}>
            <mesh geometry={CLAW_BODY_GEO} material={boothSheenMaterial(palette.table)} position={[0, 0.375, 0]} castShadow />
            <StaticInstances geometry={PRIZE_GEO} material={boothSheenMaterial('#d98a9b')} transforms={PRIZE_PILE} />
            <mesh geometry={CLAW_GLASS_GEO} material={glassMat} position={[0, 1.0, 0]} />
            <mesh geometry={MARQUEE_GEO} material={marqueeMat} position={[0, 1.32, 0]} castShadow />
          </group>
          <group position={[0.5, 0, 0]}>
            <mesh geometry={HOOP_STAND_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 0.55, -0.08]} scale={[1, 2.2, 1]} />
            <mesh geometry={HOOP_BOARD_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 1.35, -0.06]} castShadow />
            <mesh geometry={HOOP_GEO} material={boothMetalMaterial('#c26a2e')} position={[0, 1.18, 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={0.45} />
          </group>
        </group>
      );
    case 'low_table_cushions':
      // The henna setting: low table + floor cushions ringing it. 2 draws.
      return (
        <group>
          <mesh geometry={LOWTABLE_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.11, 0]} castShadow />
          <StaticInstances geometry={CUSHION_GEO} material={boothSheenMaterial(palette.accent)} transforms={CUSHION_RING} castShadow />
        </group>
      );
    case 'polish_rack':
      // Leaning rack board + ledge + a row of tiny accent bottles
      // (BOTTLE_GEO at half scale). 3 draws.
      return (
        <group rotation={[-0.12, 0, 0]}>
          <mesh geometry={POLISH_BOARD_GEO} material={boothSheenMaterial(KIT_CREAM)} position={[0, 0.16, 0]} castShadow />
          <mesh geometry={POLISH_LEDGE_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.1, 0.035]} />
          <StaticInstances geometry={BOTTLE_GEO} material={boothSheenMaterial(palette.accent)} transforms={POLISH_ROW} />
        </group>
      );
    case 'crystal_set':
      // The reader's table set: crystal ball on its stand + a fanned card
      // spread. 4 draws.
      return (
        <group>
          <group position={[-0.12, 0, -0.04]}>
            <mesh geometry={CRYSTAL_STAND_GEO} material={boothMetalMaterial('#d4a94a')} />
            <mesh geometry={CRYSTAL_GEO} material={crystalMat} position={[0, 0.15, 0]} castShadow />
          </group>
          <StaticInstances geometry={CARD_GEO} material={boothSheenMaterial('#3a2a4a')} transforms={CARD_FAN} />
        </group>
      );
    case 'embroidery_hoop':
      // Tilted embroidery hoop (ring + cloth disc) on a slim stand. 3 draws.
      return (
        <group>
          <mesh geometry={HOOP_STAND_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.16, 0]} scale={[1, 0.65, 1]} />
          <group position={[0, 0.4, 0]} rotation={[-0.55, 0, 0]}>
            <mesh geometry={EMB_RING_GEO} material={boothSheenMaterial(KIT_WOOD)} castShadow />
            <mesh geometry={EMB_CLOTH_GEO} material={boothSheenMaterial(KIT_CREAM)} />
          </group>
        </group>
      );
    case 'print_press':
      // Tabletop press: body + roller + the emerging sheet. 3 draws.
      return (
        <group>
          <mesh geometry={PRESS_BODY_GEO} material={boothSheenMaterial(KIT_DARK)} position={[0, 0.15, 0]} castShadow />
          <mesh geometry={PRESS_ROLLER_GEO} material={boothMetalMaterial(KIT_CHROME)} position={[0, 0.34, 0]} />
          <mesh geometry={PRESS_SHEET_GEO} material={boothSheenMaterial('#fbf8f0')} position={[0, 0.3, 0.24]} rotation={[0.12, 0, 0]} />
        </group>
      );
    case 'gift_shelf':
      // Ribboned giveaway boxes (3 + 1 stacked): instanced boxes + ONE
      // instanced draw for all 8 crossed ribbon bands. 2 draws.
      return (
        <group>
          <StaticInstances geometry={GIFT_GEO} material={boothSheenMaterial(KIT_CREAM)} transforms={GIFT_ROW} castShadow />
          <StaticInstances geometry={GIFT_RIBBON_GEO} material={boothSheenMaterial(palette.accent)} transforms={GIFT_BOWS} />
        </group>
      );
    case 'trophy_shelf':
      // The gold cup row — one instanced lathe draw, metal gold (the
      // catalog's envMap glint comes free from the shared env). 1 draw.
      return <StaticInstances geometry={TROPHY_GEO} material={boothMetalMaterial('#d4a94a')} transforms={TROPHY_ROW} castShadow />;
    case 'dance_marks':
      // The choreographer's floor spots — flat accent discs. 1 draw.
      return <StaticInstances geometry={MARK_GEO} material={boothSheenMaterial(palette.accent)} transforms={MARK_SPOTS} />;
    case 'ribbon_cans':
      // The just-married tail: crossed bow lobes + knot + trailing cans.
      // 3 draws (lobes instanced).
      return (
        <group>
          <StaticInstances
            geometry={BOW_LOBE_GEO}
            material={boothSheenMaterial(palette.accent)}
            transforms={BOW_XF}
            castShadow
          />
          <StaticInstances geometry={CAN_GEO} material={boothMetalMaterial(KIT_CHROME)} transforms={CAN_TRAIL} />
        </group>
      );
    case 'traffic_cone':
      // The escort's cone: object-true safety orange + white band + base.
      // 3 draws.
      return (
        <group>
          <mesh geometry={CONE_BASE_GEO} material={boothSheenMaterial('#c2542e')} position={[0, 0.025, 0]} />
          <mesh geometry={CONE_GEO} material={boothSheenMaterial('#e0662f')} position={[0, 0.26, 0]} castShadow />
          <mesh geometry={CONE_BAND_GEO} material={boothSheenMaterial('#f4f1ea')} position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case 'barber_pole':
      // Post + the spinning striped cylinder + caps (wall-clock texture
      // spin). 4 draws.
      return (
        <group>
          <mesh geometry={BARBER_POST_GEO} material={boothMetalMaterial(KIT_DARK)} position={[0, 0.28, 0]} />
          <BarberSpinner />
          <StaticInstances
            geometry={BARBER_CAP_GEO}
            material={boothMetalMaterial(KIT_CHROME)}
            transforms={BARBER_CAPS}
          />
        </group>
      );
    case 'perfume_organ':
      // Stepped shelves of translucent bottles (BOTTLE_GEO scaled up) — the
      // perfumer's organ. 3 draws.
      return (
        <group>
          <mesh geometry={ORGAN_SHELF_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.01, 0]} castShadow />
          <mesh geometry={ORGAN_SHELF_GEO} material={boothSheenMaterial(KIT_WOOD)} position={[0, 0.23, -0.05]} scale={[0.85, 1, 0.75]} />
          <StaticInstances geometry={BOTTLE_GEO} material={perfumeMat} transforms={PERFUME_ROWS} />
        </group>
      );
  }
}

/**
 * The fallback TEXT sign — a booth with no brandable vendor logo still gets a
 * named board (the template's signText / the couple's booth label) drawn as a
 * CanvasTexture. Texture + material are cached together per (text, colour) so
 * every mount of the same label shares one material (the kit's keyed-cache
 * discipline), and the cache is LRU-BOUNDED: unlike the palette-bounded
 * material caches, distinct labels are unbounded across a session (renames,
 * lab paging), so past the cap the oldest entry is evicted and disposed —
 * a still-mounted evictee just re-uploads from its retained source canvas.
 */
const textSignCache = new Map<string, { tex: THREE.CanvasTexture; mat: THREE.MeshBasicMaterial }>();
const TEXT_SIGN_CACHE_MAX = 64; // ≫ any single floor's booth count

function textSignMaterial(text: string, accent: string): THREE.MeshBasicMaterial {
  const key = `${accent}|${text}`;
  const cached = textSignCache.get(key);
  if (cached) return cached.mat;
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
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  if (textSignCache.size >= TEXT_SIGN_CACHE_MAX) {
    const oldestKey = textSignCache.keys().next().value;
    if (oldestKey !== undefined) {
      const evicted = textSignCache.get(oldestKey)!;
      textSignCache.delete(oldestKey);
      evicted.mat.dispose();
      evicted.tex.dispose();
    }
  }
  textSignCache.set(key, { tex, mat });
  return mat;
}

const SIGN_BOARD_GEO = new RoundedBoxGeometry(1.5, 0.56, 0.07, 3, 0.03);
// Module-scope plane (constant 1.34×0.46) — the per-mount <planeGeometry>
// allocation contradicted the kit's shared-buffer rule.
const SIGN_FACE_GEO = new THREE.PlaneGeometry(1.34, 0.46);

/** The drawn nameboard, sized/positioned like the shared BoothSign's logo
 *  board so branded + unbranded booths hang signage at the same height. */
export function BoothTextSign({ text, palette }: { text: string; palette: Lab3DPalette }) {
  return (
    <group position={[0, 0, -0.62]}>
      <mesh geometry={SIGN_BOARD_GEO} material={boothSheenMaterial(palette.table)} position={[0, 1.75, 0]} castShadow />
      <mesh geometry={SIGN_FACE_GEO} material={textSignMaterial(text, palette.accent)} position={[0, 1.75, 0.045]} />
    </group>
  );
}
