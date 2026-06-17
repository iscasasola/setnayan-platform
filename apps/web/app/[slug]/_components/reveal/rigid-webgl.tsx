'use client';

/**
 * RigidWebGL — the real-time three.js scene for the rigid Save-the-Date reveals
 * (0024 addendum §1a · faithful-rebuild Port A). A back invitation PAPER plane,
 * real flap MESHES, and ONE soft overhead light casting renderer-computed VSM
 * shadows. Driven by a single `progress` scalar (0 = sealed/flat, 1 = fully open)
 * read live via a ref so palette/progress changes never tear down the GL context.
 *
 * Port A locks (see 0024_Reveal_Tuning_and_Door_Spec_2026-06-17):
 *  - Overhead "softbox" light, owner-set DIAMETER 6 / DIFFUSION 100 / BRIGHTNESS 40,
 *    parallax on the light only (shadows slide for depth; off under reduced-motion).
 *  - Church doors: photo-accurate gothic plank doors (thick, iron-studded, ring
 *    pull, curved brace) in a carved stone gothic surround with a rose window; the
 *    couple's monogram carved into the wood, SPLIT across the seam; opening reveals
 *    the church interior — a red-carpet aisle (carpet colour customisable). Doors
 *    are 80% of screen height, sit 5% off the floor, swing SIMULTANEOUSLY with a
 *    slow-in "creak".
 *  - Envelope flap tips are ROUNDED (not sharp).
 *
 * Effects (falling petals / butterflies) are Port B. Real photoreal assets replace
 * the procedural textures here in a later pass; the motion/physics are final.
 *
 * Lazy-loaded via next/dynamic(ssr:false) so three.js stays code-split. On any
 * WebGL failure it calls onUnsupported() and the caller renders the CSS flaps.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadSurfaceMaps, type SurfaceMaps } from './reveal-textures';

export type RigidWebGLVariant =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors';

type Props = {
  variant: RigidWebGLVariant;
  /** Open amount 0..1 (from RigidStage). */
  progress: number;
  /** Couple's lettered monogram (e.g. "A & J") — carved into the cathedral doors. */
  monogramText?: string;
  /** Called once if WebGL can't initialise → caller falls back to CSS flaps. */
  onUnsupported: () => void;
};

// LOCKED light values (owner-set 2026-06-17 — DIAMETER 6 / DIFFUSION 100 / BRIGHTNESS 40).
const LIGHT_LOCK = {
  SHADOW_RADIUS: 6,
  SHADOW_BLUR_SAMPLES: 18,
  SPOT_PENUMBRA: 1.0, // diffusion 100
  SPOT_INTENSITY: 0.6 + (40 / 100) * 1.8, // brightness 40 → 1.32
  HEMI_INTENSITY: 0.4 + (100 / 100) * 0.9, // diffusion 100 → 1.3
} as const;

const Z_FLAP = 0.06;
const PARALLAX_RADIUS = 0.6;
const LIGHT_ANCHOR = new THREE.Vector3(0, 0.82, 2.3); // overhead softbox
const smooth = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const eased = (t: number, slowIn: boolean) => {
  const s = smooth(t);
  return slowIn ? Math.pow(s, 1.5) : s;
};

/** Read a `--color-*` space-separated-RGB var into a THREE.Color (moodboard). */
function cssColor(probe: HTMLElement, varName: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(probe).getPropertyValue(varName).trim();
  const m = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(raw);
  const c = new THREE.Color();
  if (m) c.setRGB(+m[1]! / 255, +m[2]! / 255, +m[3]! / 255, THREE.SRGBColorSpace);
  else c.set(fallback);
  return c;
}

// ── procedural texture helpers (real photoreal assets land in a later pass) ──
function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Tangent-space normal map from a grayscale height canvas (wrap-safe Sobel). */
function heightToNormal(hc: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const S = hc.width;
  const hd = hc.getContext('2d')!.getImageData(0, 0, S, S).data;
  const nc = mkCanvas(S, S);
  const nx = nc.getContext('2d')!;
  const ni = nx.createImageData(S, S);
  const nd = ni.data;
  const at = (px: number, py: number) => hd[(((py + S) % S) * S + ((px + S) % S)) * 4]! / 255;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const gy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let vx = -gx;
      let vy = -gy;
      const vz = 1;
      const L = Math.hypot(vx, vy, vz) || 1;
      vx /= L;
      vy /= L;
      const i = (y * S + x) * 4;
      nd[i] = (vx * 0.5 + 0.5) * 255;
      nd[i + 1] = (vy * 0.5 + 0.5) * 255;
      nd[i + 2] = (1 / L) * 255;
      nd[i + 3] = 255;
    }
  nx.putImageData(ni, 0, 0);
  const t = new THREE.CanvasTexture(nc);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Honey-oak planks with iron studs, a curved brace and a ring pull (per photo). */
function paintDoor(x: CanvasRenderingContext2D, S: number, mode: 'color' | 'height', mirror: boolean) {
  if (mode === 'height') {
    x.fillStyle = '#7a7a7a';
    x.fillRect(0, 0, S, S);
  } else {
    x.fillStyle = '#a8855e';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(${Math.floor(rnd(60, 106))},${Math.floor(rnd(40, 74))},24,${rnd(0.05, 0.17)})`;
      x.lineWidth = rnd(1, 4);
      x.beginPath();
      const gx = rnd(0, S);
      x.moveTo(gx, 0);
      x.bezierCurveTo(gx + rnd(-12, 12), S * 0.4, gx + rnd(-12, 12), S * 0.72, gx + rnd(-10, 10), S);
      x.stroke();
    }
  }
  // vertical plank seams
  x.strokeStyle = mode === 'height' ? '#444' : 'rgba(40,26,14,0.5)';
  x.lineWidth = mode === 'height' ? 6 : 3;
  for (let k = 1; k < 4; k++) {
    x.beginPath();
    x.moveTo((k / 4) * S, 0);
    x.lineTo((k / 4) * S, S);
    x.stroke();
  }
  // curved brace (sweeping up toward the seam side) + a horizontal rail
  const seamX = mirror ? S * 0.08 : S * 0.92;
  x.strokeStyle = mode === 'height' ? '#d0d0d0' : 'rgba(70,46,28,0.55)';
  x.lineWidth = mode === 'height' ? 14 : 10;
  x.beginPath();
  x.moveTo(mirror ? S * 0.92 : S * 0.08, S * 0.86);
  x.quadraticCurveTo(S * 0.5, S * 0.5, seamX, S * 0.18);
  x.stroke();
  x.beginPath();
  x.moveTo(S * 0.06, S * 0.5);
  x.lineTo(S * 0.94, S * 0.5);
  x.stroke();
  // iron studs along borders + brace
  const stud = (cx: number, cy: number, r: number) => {
    if (mode === 'height') {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#7a7a7a');
      x.fillStyle = g;
    } else {
      const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      g.addColorStop(0, '#5a5046');
      g.addColorStop(1, '#161210');
      x.fillStyle = g;
    }
    x.beginPath();
    x.arc(cx, cy, r, 0, 6.2832);
    x.fill();
  };
  const sr = S * 0.018;
  for (let i = 0; i <= 12; i++) {
    stud(S * 0.06, (i / 12) * S, sr);
    stud(S * 0.94, (i / 12) * S, sr);
    stud((i / 12) * S, S * 0.06, sr);
  }
  for (let i = 0; i <= 8; i++) {
    const tt = i / 8;
    const bx = (mirror ? S * 0.92 : S * 0.08) * (1 - tt) + seamX * tt;
    const by = S * 0.86 * (1 - tt) + S * 0.18 * tt;
    stud(bx, by, sr * 0.8);
  }
  // ring pull near the seam
  const rx = mirror ? S * 0.16 : S * 0.84;
  x.strokeStyle = mode === 'height' ? '#202020' : '#0e0b09';
  x.lineWidth = S * 0.03;
  x.beginPath();
  x.arc(rx, S * 0.52, S * 0.06, 0, 6.2832);
  x.stroke();
}
function doorTex(mirror: boolean): { color: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const S = 512;
  const cc = mkCanvas(S, S);
  paintDoor(cc.getContext('2d')!, S, 'color', mirror);
  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace;
  const hc = mkCanvas(S, S);
  paintDoor(hc.getContext('2d')!, S, 'height', mirror);
  return { color, normal: heightToNormal(hc, 2.6) };
}

function stoneTex(): THREE.CanvasTexture {
  const S = 256;
  const c = mkCanvas(S, S);
  const x = c.getContext('2d')!;
  x.fillStyle = '#5f5b52';
  x.fillRect(0, 0, S, S);
  const rows = 8;
  const rh = S / rows;
  const cols = 4;
  const cw = S / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 0.5;
    for (let cI = -1; cI < cols + 1; cI++) {
      const bx = (cI + off) * cw;
      const tn = rnd(-16, 12);
      x.fillStyle = `rgb(${150 + tn},${142 + tn},${130 + tn})`;
      x.fillRect(bx + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }
  for (let i = 0; i < 6500; i++) {
    x.fillStyle = `rgba(0,0,0,${rnd(0.01, 0.045)})`;
    x.fillRect(rnd(0, S), rnd(0, S), 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 5);
  return t;
}

function roseTex(): THREE.CanvasTexture {
  const S = 256;
  const c = mkCanvas(S, S);
  const x = c.getContext('2d')!;
  const cx = S / 2;
  const cy = S / 2;
  const gl = x.createRadialGradient(cx, cy, 0, cx, cy, S * 0.46);
  gl.addColorStop(0, 'rgba(230,180,120,0.95)');
  gl.addColorStop(0.5, 'rgba(150,90,120,0.85)');
  gl.addColorStop(1, 'rgba(70,50,90,0.6)');
  x.fillStyle = gl;
  x.beginPath();
  x.arc(cx, cy, S * 0.46, 0, 6.2832);
  x.fill();
  x.strokeStyle = 'rgba(40,34,30,0.9)';
  x.lineWidth = S * 0.026;
  x.beginPath();
  x.arc(cx, cy, S * 0.21, 0, 6.2832);
  x.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * 6.2832;
    x.lineWidth = S * 0.02;
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a) * S * 0.46, cy + Math.sin(a) * S * 0.46);
    x.stroke();
  }
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * 6.2832;
    x.beginPath();
    x.arc(cx + Math.cos(pa) * S * 0.3, cy + Math.sin(pa) * S * 0.3, S * 0.07, 0, 6.2832);
    x.stroke();
  }
  x.lineWidth = S * 0.05;
  x.beginPath();
  x.arc(cx, cy, S * 0.46, 0, 6.2832);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Church interior down the aisle: dark nave + a red carpet runner in perspective. */
function interiorTex(carpet: THREE.Color): THREE.CanvasTexture {
  const W = 256;
  const Hc = 512;
  const c = mkCanvas(W, Hc);
  const x = c.getContext('2d')!;
  const sky = x.createLinearGradient(0, 0, 0, Hc);
  sky.addColorStop(0, '#1a1712');
  sky.addColorStop(0.55, '#2a2018');
  sky.addColorStop(1, '#3a2c20');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, Hc);
  // distant warm glow (altar / window at the far end)
  const gl = x.createRadialGradient(W * 0.5, Hc * 0.34, 0, W * 0.5, Hc * 0.34, Hc * 0.28);
  gl.addColorStop(0, 'rgba(240,210,150,0.55)');
  gl.addColorStop(1, 'rgba(240,210,150,0)');
  x.fillStyle = gl;
  x.fillRect(0, 0, W, Hc);
  // red carpet aisle — wide at the threshold (bottom), narrowing to the vanishing point
  const hex = `#${carpet.getHexString()}`;
  x.fillStyle = hex;
  x.beginPath();
  x.moveTo(W * 0.5 - 14, Hc * 0.4);
  x.lineTo(W * 0.5 + 14, Hc * 0.4);
  x.lineTo(W * 0.86, Hc);
  x.lineTo(W * 0.14, Hc);
  x.closePath();
  x.fill();
  // carpet sheen + edge
  const cg = x.createLinearGradient(W * 0.5, Hc * 0.4, W * 0.5, Hc);
  cg.addColorStop(0, 'rgba(255,255,255,0.10)');
  cg.addColorStop(0.5, 'rgba(0,0,0,0)');
  cg.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = cg;
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plush red carpet threshold (the floor strip below the doors). */
function carpetTex(carpet: THREE.Color): THREE.CanvasTexture {
  const S = 128;
  const c = mkCanvas(S, S);
  const x = c.getContext('2d')!;
  x.fillStyle = `#${carpet.getHexString()}`;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    x.fillRect(rnd(0, S), rnd(0, S), rnd(1, 2), rnd(2, 5));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

/** Couple's monogram crest (ring + initials) — painted whole, split L/R by UV. */
function paintMono(x: CanvasRenderingContext2D, S: number, mode: 'color' | 'height', text: string) {
  const ink = mode === 'height' ? '#dcdcdc' : 'rgba(70,46,30,0.95)';
  if (mode === 'height') {
    x.fillStyle = '#7a7a7a';
    x.fillRect(0, 0, S, S);
  } else {
    x.clearRect(0, 0, S, S);
  }
  x.strokeStyle = ink;
  x.fillStyle = ink;
  x.lineCap = 'round';
  x.lineWidth = S * 0.02;
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.42, 0, 6.2832);
  x.stroke();
  x.lineWidth = S * 0.012;
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.375, 0, 6.2832);
  x.stroke();
  // initials from the monogram text (e.g. "A & J" → A, J)
  const letters = (text || 'S').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'S';
  x.font = `italic ${Math.floor(S * 0.44)}px Georgia, serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (letters.length >= 2) {
    x.fillText(letters[0]!, S * 0.39, S * 0.46);
    x.fillText(letters[1]!, S * 0.61, S * 0.49);
    x.font = `italic ${Math.floor(S * 0.15)}px Georgia, serif`;
    x.fillText('&', S * 0.5, S * 0.73);
  } else {
    x.fillText(letters[0]!, S * 0.5, S * 0.48);
  }
}
function monoTex(text: string): { color: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const S = 384;
  const cc = mkCanvas(S, S);
  paintMono(cc.getContext('2d')!, S, 'color', text);
  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace;
  const hc = mkCanvas(S, S);
  paintMono(hc.getContext('2d')!, S, 'height', text);
  return { color, normal: heightToNormal(hc, 3.4) };
}

// Effect sizes — owner-locked house defaults (admin-tunable later), 2026-06-17.
const PETAL_SIZE = 0.006 + (22 / 100) * 0.05; // size 22 → ~0.017
const BFLY_SIZE = 0.05 + (20 / 100) * 0.14; // size 20 → ~0.078

/** A soft rose petal sprite (real photographic petals swap in later). */
function petalTex(): THREE.CanvasTexture {
  const S = 64;
  const c = mkCanvas(S, S);
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(S * 0.5, S * 0.4, 2, S * 0.5, S * 0.52, S * 0.5);
  g.addColorStop(0, 'rgba(232,168,182,0.97)');
  g.addColorStop(0.55, 'rgba(196,92,118,0.92)');
  g.addColorStop(1, 'rgba(150,48,80,0)');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(S * 0.5, S * 0.5, S * 0.32, S * 0.47, 0, 0, 6.2832);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One butterfly wing (mirrored for the pair). */
function wingGeom(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.95, 0.72, 0.72, 1.32);
  s.quadraticCurveTo(0.42, 1.04, 0.05, 0.82);
  s.quadraticCurveTo(0.34, 0.34, 0, 0);
  return new THREE.ShapeGeometry(s);
}

/** One template's flaps: hinge groups + the per-progress angle for each. */
type Flap = {
  group: THREE.Group;
  axis: 'x' | 'y';
  maxDeg: number;
  start: number;
  end: number;
  slowIn?: boolean;
};

export default function RigidWebGL({ variant, progress, monogramText, onUnsupported }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const monoRef = useRef(monogramText);
  monoRef.current = monogramText;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let W = mount.clientWidth || window.innerWidth;
    let H = mount.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onUnsupported();
      return;
    }
    const mobile = Math.min(W, H) < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    let cancelled = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // moodboard colours (read once at mount)
    const paperCol = cssColor(mount, '--color-cream', '#f4efe6');
    const linerCol = cssColor(mount, '--color-terracotta', '#c5a059');
    const carpetCol = cssColor(mount, '--color-carpet', '#6e1f2a'); // red carpet (customisable)
    const isDoors = variant === 'church-doors';

    const scene = new THREE.Scene();
    let aspect = W / H;
    const halfH = 1;
    let halfW = halfH * aspect;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 12);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    const baseHalfW = halfW;

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <Tt extends { dispose: () => void }>(o: Tt): Tt => {
      disposables.push(o);
      return o;
    };

    // ── back plane: invitation paper (envelopes) or stone cathedral wall (doors) ──
    let baseMat: THREE.MeshStandardMaterial;
    if (isDoors) {
      const stone = track(stoneTex());
      baseMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: stone, roughness: 0.96, metalness: 0 }));
    } else {
      baseMat = track(new THREE.MeshStandardMaterial({ color: paperCol, roughness: 0.93, metalness: 0 }));
    }
    const paper = new THREE.Mesh(track(new THREE.PlaneGeometry(2 * halfW, 2 * halfH)), baseMat);
    paper.receiveShadow = true;
    scene.add(paper);

    // ── overhead softbox light + hemisphere fill ──
    const spot = new THREE.SpotLight(0xfff7ec, LIGHT_LOCK.SPOT_INTENSITY, 0, Math.PI / 4, LIGHT_LOCK.SPOT_PENUMBRA, 0);
    spot.position.copy(LIGHT_ANCHOR);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    spot.shadow.radius = LIGHT_LOCK.SHADOW_RADIUS;
    spot.shadow.blurSamples = LIGHT_LOCK.SHADOW_BLUR_SAMPLES;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 9;
    scene.add(spot, spot.target);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e2d6, LIGHT_LOCK.HEMI_INTENSITY));

    // ── flap materials ──
    const frontMat = track(new THREE.MeshStandardMaterial({ color: paperCol, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
    const linerMat = track(new THREE.MeshStandardMaterial({ color: linerCol, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }));

    // photoreal paper/liner maps (recoloured from the moodboard) for the envelopes
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const applyMaps = (mats: THREE.MeshStandardMaterial[], m: SurfaceMaps) => {
      for (const mat of mats) {
        mat.map = m.map;
        mat.normalMap = m.normalMap;
        mat.roughnessMap = m.roughnessMap;
        mat.roughness = 1;
        mat.needsUpdate = true;
      }
      disposables.push(m.map, m.normalMap, m.roughnessMap);
    };
    const disposeMaps = (m: SurfaceMaps | null) => {
      if (m) [m.map, m.normalMap, m.roughnessMap].forEach((t) => t.dispose());
    };
    if (!isDoors) {
      loadSurfaceMaps('paper', paperCol, 1.6, aniso).then((m) => {
        if (cancelled) return disposeMaps(m);
        if (m) applyMaps([frontMat], m);
      });
      loadSurfaceMaps('liner', linerCol, 2.4, aniso).then((m) => {
        if (cancelled) return disposeMaps(m);
        if (m) applyMaps([linerMat], m);
      });
    }

    // ── falling-petal + butterfly effects (Port B), gated on `progress` ──
    const PETAL = track(petalTex());
    const WING = track(wingGeom());
    const fx: Array<{ g0: number; update: (p: number, fr: number) => void }> = [];

    type Petal = { m: THREE.Mesh; vy: number; sw: number; sa: number; rx: number; ry: number; vrx: number; vry: number; settled: boolean; vr: number; bn: number };
    function fxPetals(reg: { x0: number; x1: number; yBot: number; yTop: number; z: number; g0: number; n: number; cols: number; inc: number }) {
      const colW = (reg.x1 - reg.x0) / reg.cols;
      const colH = new Array<number>(reg.cols).fill(0);
      const mat = track(new THREE.MeshStandardMaterial({ map: PETAL, transparent: true, alphaTest: 0.3, roughness: 0.85, side: THREE.DoubleSide }));
      const geo = track(new THREE.PlaneGeometry(1, 1.35));
      const grp = new THREE.Group();
      scene.add(grp);
      const ps: Petal[] = [];
      const spawn = (p: Petal) => {
        p.m.position.set(rnd(reg.x0, reg.x1), reg.yTop + rnd(0.02, 0.45), reg.z + rnd(-0.004, 0.004));
        p.vy = -rnd(0.0014, 0.0032);
        p.sw = rnd(0, 6.28);
        p.sa = rnd(0.001, 0.0032);
        p.rx = rnd(0, 6.28);
        p.ry = rnd(0, 6.28);
        p.vrx = rnd(-0.05, 0.05);
        p.vry = rnd(-0.07, 0.07);
        p.settled = false;
        p.vr = rnd(0.8, 1.2);
        p.bn = 0;
      };
      for (let i = 0; i < reg.n; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        const p: Petal = { m, vy: 0, sw: 0, sa: 0, rx: 0, ry: 0, vrx: 0, vry: 0, settled: false, vr: 1, bn: 0 };
        spawn(p);
        m.visible = false;
        grp.add(m);
        ps.push(p);
      }
      const colOf = (x: number) => {
        const c = Math.floor((x - reg.x0) / colW);
        return c < 0 ? 0 : c >= reg.cols ? reg.cols - 1 : c;
      };
      return {
        g0: reg.g0,
        update: (p: number, fr: number) => {
          grp.visible = p > 0.02;
          const act = Math.ceil(p * reg.n);
          const sz = PETAL_SIZE;
          for (let i = 0; i < reg.n; i++) {
            const it = ps[i]!;
            const m = it.m;
            if (i >= act) {
              m.visible = false;
              continue;
            }
            m.visible = true;
            const s = sz * it.vr;
            if (it.settled) {
              m.scale.set(s, s, s);
              continue;
            }
            it.vy -= 0.000022;
            m.position.y += it.vy;
            m.position.x += Math.sin(fr * 0.04 + it.sw) * it.sa;
            it.rx += it.vrx;
            it.ry += it.vry;
            m.rotation.set(it.rx, it.ry, m.rotation.z + 0.012);
            m.scale.set(s, s, s);
            const c = colOf(m.position.x);
            const surf = reg.yBot + colH[c]! * reg.inc;
            if (m.position.y <= surf) {
              let lc = c;
              const cl = c > 0 ? c - 1 : c;
              const cr = c < reg.cols - 1 ? c + 1 : c;
              if (colH[cl]! < colH[lc]! - 1) lc = cl;
              if (colH[cr]! < colH[lc]! - 1) lc = cr;
              if (it.bn < 1 && it.vy < -0.0045) {
                it.vy = -it.vy * 0.22;
                it.bn++;
                m.position.y = surf;
              } else {
                m.position.set(reg.x0 + (lc + 0.5) * colW + rnd(-colW * 0.35, colW * 0.35), reg.yBot + colH[lc]! * reg.inc + s * 0.25, reg.z + rnd(-0.003, 0.003));
                colH[lc] = colH[lc]! + 1;
                it.settled = true;
                m.rotation.set(rnd(-0.25, 0.25), 0, rnd(-1.5, 1.5));
              }
            }
          }
        },
      };
    }

    type Bfly = { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; angle: number; delay: number; ph: number; life: number; wob: number };
    function fxButterflies() {
      const N = 9;
      const cols = [0xeccae6, 0xf4dcc2, 0xd2dcf2, 0xf2cdd6];
      const bs: Bfly[] = [];
      for (let i = 0; i < N; i++) {
        const g = new THREE.Group();
        const wm = track(new THREE.MeshStandardMaterial({ color: cols[i % 4]!, transparent: true, opacity: 0.92, roughness: 0.6, side: THREE.DoubleSide }));
        const wl = new THREE.Mesh(WING, wm);
        const wr = new THREE.Mesh(WING, wm);
        wr.scale.x = -1;
        wl.castShadow = true;
        wr.castShadow = true;
        g.add(wl, wr);
        g.visible = false;
        scene.add(g);
        bs.push({ g, wl, wr, angle: (i / N) * 6.2832 + rnd(-0.3, 0.3), delay: (i / N) * 0.5, ph: rnd(0, 6.28), life: 0, wob: rnd(0.5, 1) });
      }
      return {
        g0: 0.5,
        update: (p: number, fr: number) => {
          for (let i = 0; i < N; i++) {
            const b = bs[i]!;
            const local = (p - b.delay) / (1 - b.delay);
            if (local <= 0) {
              b.g.visible = false;
              b.life = 0;
              continue;
            }
            b.g.visible = true;
            b.life = Math.min(1, b.life + 0.006);
            const e = b.life * b.life * (3 - 2 * b.life);
            const r = e * 1.7; // outward, past the screen corner
            const z = 0.1 + e * 0.5; // toward the camera
            const wob = Math.sin(fr * 0.05 + b.ph) * 0.08 * b.wob;
            b.g.position.set(Math.cos(b.angle) * r + wob, Math.sin(b.angle) * r + e * 0.15 + wob, z);
            const sc = BFLY_SIZE * (1 + (z - 0.1) * 1.6); // grows as it approaches
            b.g.scale.setScalar(sc);
            const fl = Math.sin(fr * 0.32 + b.ph) * 0.95 + 0.35;
            b.wl.rotation.y = fl;
            b.wr.rotation.y = -fl;
            b.g.rotation.z = Math.sin(fr * 0.04 + b.ph) * 0.25 + b.angle * 0.1;
          }
        },
      };
    }

    function makeFlap(geom: THREE.BufferGeometry, px: number, py: number, pz: number, back: THREE.Material): THREE.Group {
      const g = new THREE.Group();
      g.position.set(px, py, pz);
      const front = new THREE.Mesh(geom, frontMat);
      front.castShadow = true;
      front.receiveShadow = true;
      const rear = new THREE.Mesh(geom, back);
      rear.position.z = -0.006;
      rear.castShadow = true;
      rear.receiveShadow = true;
      g.add(front, rear);
      disposables.push(geom);
      return g;
    }
    function rectGeom(w: number, h: number, ox: number, oy: number): THREE.PlaneGeometry {
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(ox, oy, 0);
      return geo;
    }
    /** Triangle with a ROUNDED apex (c). a,b are the hinge-edge ends. */
    function roundedTri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): THREE.ShapeGeometry {
      const ua = new THREE.Vector2(ax - cx, ay - cy).normalize();
      const ub = new THREE.Vector2(bx - cx, by - cy).normalize();
      const pa = new THREE.Vector2(cx + ua.x * r, cy + ua.y * r);
      const pb = new THREE.Vector2(cx + ub.x * r, cy + ub.y * r);
      const s = new THREE.Shape();
      s.moveTo(ax, ay);
      s.lineTo(pb.x, pb.y);
      s.quadraticCurveTo(cx, cy, pa.x, pa.y);
      s.lineTo(bx, by);
      s.lineTo(ax, ay);
      return new THREE.ShapeGeometry(s);
    }

    const flaps: Flap[] = [];

    if (variant === 'two-flap-vertical') {
      const w = halfW;
      const h = 2 * halfH;
      flaps.push({ group: makeFlap(rectGeom(w, h, w / 2, 0), -halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: -158, start: 0, end: 0.62 });
      flaps.push({ group: makeFlap(rectGeom(w, h, -w / 2, 0), halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: 158, start: 0.06, end: 0.7 });
    } else if (variant === 'two-flap-horizontal') {
      const w = 2 * halfW;
      const h = halfH;
      flaps.push({ group: makeFlap(rectGeom(w, h, 0, -h / 2), 0, halfH, Z_FLAP, linerMat), axis: 'x', maxDeg: -158, start: 0, end: 0.62 });
      flaps.push({ group: makeFlap(rectGeom(w, h, 0, h / 2), 0, -halfH, Z_FLAP, linerMat), axis: 'x', maxDeg: 158, start: 0.06, end: 0.7 });
    } else if (isDoors) {
      buildChurchDoors();
    } else {
      // four-flap with ROUNDED tips at the centre apex, z-staggered cascade.
      const R = 0.1 * halfH;
      flaps.push({ group: makeFlap(roundedTri(-halfW, 0, halfW, 0, 0, -halfH, R), 0, halfH, Z_FLAP + 0.003, linerMat), axis: 'x', maxDeg: -160, start: 0.0, end: 0.5 });
      flaps.push({ group: makeFlap(roundedTri(-halfW, 0, halfW, 0, 0, halfH, R), 0, -halfH, Z_FLAP + 0.001, linerMat), axis: 'x', maxDeg: 160, start: 0.2, end: 0.65 });
      flaps.push({ group: makeFlap(roundedTri(0, -halfH, 0, halfH, halfW, 0, R), -halfW, 0, Z_FLAP, linerMat), axis: 'y', maxDeg: -160, start: 0.3, end: 0.75 });
      flaps.push({ group: makeFlap(roundedTri(0, -halfH, 0, halfH, -halfW, 0, R), halfW, 0, Z_FLAP + 0.002, linerMat), axis: 'y', maxDeg: 160, start: 0.1, end: 0.55 });
    }

    /** Photo-accurate cathedral doors: gothic plank doors, carved monogram split,
     *  stone surround, rose window, red-carpet interior + threshold. */
    function buildChurchDoors() {
      const dB = -0.9 * halfH; // bottom 5% off the floor
      const dT = 0.7 * halfH; // 80% tall
      const yS = 0.32 * halfH; // arch spring line
      const mid = yS + (dT - yS) * 0.45;
      const Wd = halfW;

      // rose window above the doorway
      const rose = new THREE.Mesh(
        track(new THREE.PlaneGeometry(0.4 * halfW, 0.4 * halfW)),
        track(new THREE.MeshBasicMaterial({ map: track(roseTex()), transparent: true })),
      );
      rose.position.set(0, dT + 0.16, 0.02);
      scene.add(rose);

      // interior reveal (red-carpet aisle) filling the gothic doorway, behind the doors
      const hs = new THREE.Shape();
      hs.moveTo(-Wd, dB);
      hs.lineTo(Wd, dB);
      hs.lineTo(Wd, yS);
      hs.quadraticCurveTo(0, mid, 0, dT);
      hs.quadraticCurveTo(0, mid, -Wd, yS);
      hs.lineTo(-Wd, dB);
      const hg = new THREE.ShapeGeometry(hs);
      hg.computeBoundingBox();
      const bb = hg.boundingBox!;
      const iw = 1 / (bb.max.x - bb.min.x);
      const ih = 1 / (bb.max.y - bb.min.y);
      const uvAttr = hg.attributes.uv as THREE.BufferAttribute;
      const posAttr = hg.attributes.position as THREE.BufferAttribute;
      for (let vi = 0; vi < uvAttr.count; vi++) {
        uvAttr.setXY(vi, (posAttr.getX(vi) - bb.min.x) * iw, (posAttr.getY(vi) - bb.min.y) * ih);
      }
      uvAttr.needsUpdate = true;
      const hole = new THREE.Mesh(hg, track(new THREE.MeshBasicMaterial({ map: track(interiorTex(carpetCol)) })));
      hole.position.z = 0.01;
      scene.add(hole);
      disposables.push(hg);

      // red-carpet threshold strip (the floor in front of / below the doors)
      const carpet = new THREE.Mesh(
        track(rectGeom(2 * halfW * 0.6, halfH * 0.12, 0, 0)),
        track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: track(carpetTex(carpetCol)), roughness: 0.95 })),
      );
      carpet.position.set(0, dB - 0.04, 0.03);
      carpet.receiveShadow = true;
      scene.add(carpet);

      // wood door materials (planks + studs + ring + brace baked in)
      const edgeMat = track(new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8, side: THREE.DoubleSide }));
      const mono = monoTex(monoRef.current || 'S');
      disposables.push(mono.color, mono.normal);

      const doorShape = (mirror: boolean) => {
        const ov = 0.015 * halfW;
        const w = halfW + ov;
        const sg = mirror ? -1 : 1;
        const s = new THREE.Shape();
        s.moveTo(0, dB);
        s.lineTo(sg * w, dB);
        s.lineTo(sg * w, dT);
        s.quadraticCurveTo(sg * w, mid, 0, yS);
        s.lineTo(0, dB);
        return s;
      };
      const doorGeom = (mirror: boolean) => {
        const TH = 0.08;
        const g = new THREE.ExtrudeGeometry(doorShape(mirror), { depth: TH, bevelEnabled: false });
        g.translate(0, 0, -TH / 2);
        return g;
      };
      // split monogram decal: left door shows left half, right door right half
      const decal = (right: boolean) => {
        const w = 0.46 * halfW;
        const h = 0.92 * halfW;
        const g = new THREE.PlaneGeometry(w, h);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const xs = right ? [0.5, 1, 0.5, 1] : [0, 0.5, 0, 0.5];
        for (let i = 0; i < 4; i++) uv.setX(i, xs[i]!);
        uv.needsUpdate = true;
        const dm = track(
          new THREE.MeshStandardMaterial({
            map: mono.color,
            normalMap: mono.normal,
            transparent: true,
            roughness: 0.66,
            metalness: 0.05,
            side: THREE.DoubleSide,
          }),
        );
        dm.normalScale = new THREE.Vector2(1.3, 1.3);
        return { mesh: new THREE.Mesh(track(g), dm), w };
      };
      const makeDoor = (mirror: boolean) => {
        const g = new THREE.Group();
        g.position.set(mirror ? halfW : -halfW, 0, mirror ? Z_FLAP + 0.012 : Z_FLAP);
        const dt = doorTex(mirror);
        disposables.push(dt.color, dt.normal);
        const face = track(
          new THREE.MeshStandardMaterial({ color: 0xffffff, map: dt.color, normalMap: dt.normal, roughness: 0.78, side: THREE.DoubleSide }),
        );
        face.normalScale = new THREE.Vector2(0.7, 0.7);
        const slab = new THREE.Mesh(track(doorGeom(mirror)), [face, edgeMat]);
        slab.castShadow = true;
        slab.receiveShadow = true;
        g.add(slab);
        const d = decal(mirror);
        const ov = 0.015 * halfW;
        const w = halfW + ov;
        d.mesh.position.set(mirror ? -w + d.w / 2 : w - d.w / 2, -0.02, 0.043);
        g.add(d.mesh);
        return g;
      };
      flaps.push({ group: makeDoor(false), axis: 'y', maxDeg: -138, start: 0, end: 1.0, slowIn: true });
      flaps.push({ group: makeDoor(true), axis: 'y', maxDeg: 138, start: 0, end: 1.0, slowIn: true });

      // rose petals fall through the doorway, feather-slow, piling on the carpet
      fx.push(fxPetals({ x0: -Wd * 0.92, x1: Wd * 0.92, yBot: dB + 0.02, yTop: dT, z: 0.014, g0: 0.05, n: 90, cols: 30, inc: 0.0045 }));
    }

    // envelopes release butterflies from the centre as the flaps open
    if (!isDoors) fx.push(fxButterflies());

    for (const f of flaps) scene.add(f.group);

    // ── parallax: move ONLY the light around its overhead anchor ──
    const aim = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      if (reduced) return;
      aim.x = (e.clientX / window.innerWidth) * 2 - 1;
      aim.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (reduced) return;
      aim.x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 35));
      aim.y = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 35));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });

    const onResize = () => {
      W = mount.clientWidth || window.innerWidth;
      H = mount.clientHeight || window.innerHeight;
      aspect = W / H;
      halfW = halfH * aspect;
      cam.left = -halfW;
      cam.right = halfW;
      cam.top = halfH;
      cam.bottom = -halfH;
      cam.updateProjectionMatrix();
      scene.scale.x = halfW / baseHalfW;
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let frame = 0;
    const loop = () => {
      frame++;
      const p = progressRef.current;
      for (const f of flaps) {
        const t = THREE.MathUtils.clamp((p - f.start) / (f.end - f.start), 0, 1);
        const ang = THREE.MathUtils.degToRad(f.maxDeg) * eased(t, !!f.slowIn);
        if (f.axis === 'y') f.group.rotation.y = ang;
        else f.group.rotation.x = ang;
      }
      for (const e of fx) {
        const lp = THREE.MathUtils.clamp((p - e.g0) / (1 - e.g0), 0, 1);
        e.update(lp, frame);
      }
      renderer.toneMappingExposure = 1.0 + smooth(p) * 0.28 + Math.max(0, p - 0.9) * 1.3;
      spot.position.x += (LIGHT_ANCHOR.x + aim.x * PARALLAX_RADIUS - spot.position.x) * 0.1;
      spot.position.y += (LIGHT_ANCHOR.y + aim.y * (PARALLAX_RADIUS * 0.5) - spot.position.y) * 0.1;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const el = renderer.domElement;
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('resize', onResize);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return <div ref={mountRef} className="absolute inset-0" style={{ touchAction: 'none' }} aria-hidden />;
}
