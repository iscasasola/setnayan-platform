/**
 * 👗 gown/scenes — the six lighting scenes the bride previews her gown in (prototype v186 `SCENES`, `sceneEnv`).
 * Studio is the calibrated neutral light for choosing colour; the others are mood previews. Owner rule: only the three
 * lights in this table (sky, key, rim), a tiny sky picture for reflections, the exposure and the backdrop change.
 * No extra lights, no shadow maps (the prototype's key-light shadow is not ported: phones stay cool).
 *
 * These colours are the stage's own light and backdrop (scene data, like `cake-colours.ts`), never page colours.
 */
import * as THREE from 'three';

type Rgb = readonly [number, number, number];
type Spot = { d: Rgb; c: Rgb; p: number; w: number };
export type GownScene = {
  id: GownSceneId;
  label: string;
  sky: number; gnd: number; hemi: number;
  keyC: number; key: number; keyP: Rgb;
  rimC: number; rim: number; rimP: Rgb;
  /** Reflection strength, exposure, how much light comes through a sheer from behind. */
  env: number; exp: number; back: number;
  /** The backdrop behind her. */
  bg: string;
  /** True on a dark backdrop: the stage's own controls switch to their light-on-dark look. */
  dark: boolean;
  /** The sky picture the cloth reflects; null = the neutral room. */
  sky3: { top: Rgb; hor: Rgb; gnd: Rgb; k: number; spots: Spot[] } | null;
};

export const GOWN_SCENE_IDS = ['studio', 'morning', 'afternoon', 'sunset', 'evening', 'indoor'] as const;
export type GownSceneId = (typeof GOWN_SCENE_IDS)[number];

export const GOWN_SCENES: Record<GownSceneId, GownScene> = {
  studio: { id: 'studio', label: 'Studio (true colour)', sky: 0xffffff, gnd: 0xdcdcdc, hemi: 1.85, keyC: 0xffffff, key: 1.5, keyP: [1.3, 6.3, 2.8], rimC: 0xffffff, rim: 0.8, rimP: [-3, 3, -3], env: 1, exp: 1, back: 0, bg: '#f0efed', dark: false, sky3: null },
  morning: {
    id: 'morning', label: 'Morning', sky: 0xdce8ff, gnd: 0xe9dfd0, hemi: 1.6, keyC: 0xffe6c4, key: 1.7, keyP: [-3.4, 2.6, 3.0], rimC: 0xdfe8ff, rim: 0.5, rimP: [3, 3, -3], env: 1, exp: 1, back: 0.35, bg: '#eef1f3', dark: false,
    sky3: { top: [0.55, 0.72, 1.0], hor: [1.0, 0.93, 0.82], gnd: [0.62, 0.58, 0.52], k: 1.0, spots: [{ d: [-3.4, 2.6, 3.0], c: [1.0, 0.86, 0.66], p: 9, w: 0.22 }] },
  },
  afternoon: {
    id: 'afternoon', label: 'Afternoon', sky: 0xe6efff, gnd: 0xece4d2, hemi: 1.65, keyC: 0xfff1dc, key: 2.2, keyP: [1.6, 6.5, 2.2], rimC: 0xffffff, rim: 0.5, rimP: [-3, 3, -3], env: 1, exp: 1.05, back: 0.25, bg: '#f3f2ec', dark: false,
    sky3: { top: [0.5, 0.7, 1.0], hor: [0.95, 0.97, 1.0], gnd: [0.7, 0.66, 0.56], k: 1.1, spots: [{ d: [1.6, 6.5, 2.2], c: [1.0, 0.95, 0.85], p: 12, w: 0.16 }] },
  },
  sunset: {
    id: 'sunset', label: 'Sunset', sky: 0xd4dcf2, gnd: 0xf2dcc4, hemi: 1.05, keyC: 0xff8a3c, key: 3.2, keyP: [4.2, 1.3, -1.6], rimC: 0xffc890, rim: 1.6, rimP: [2.6, 1.5, 3.4], env: 1, exp: 1, back: 1, bg: '#f3d3b8', dark: false,
    sky3: { top: [0.35, 0.45, 0.8], hor: [0.95, 0.75, 0.6], gnd: [0.5, 0.4, 0.33], k: 1.0, spots: [{ d: [4.2, 1.3, -1.6], c: [1.0, 0.5, 0.18], p: 16, w: 0.22 }, { d: [2.6, 1.5, 3.4], c: [1.0, 0.65, 0.4], p: 4, w: 0.3 }] },
  },
  evening: {
    id: 'evening', label: 'Evening', sky: 0x6f90f0, gnd: 0x39405c, hemi: 0.7, keyC: 0xffd2a0, key: 2.6, keyP: [2.4, 2.6, 3.0], rimC: 0xff9a3c, rim: 1.5, rimP: [-3, 2.2, -2.5], env: 1, exp: 1.1, back: 0.5, bg: '#232c47', dark: true,
    sky3: { top: [0.1, 0.16, 0.42], hor: [0.22, 0.3, 0.6], gnd: [0.08, 0.09, 0.14], k: 1.0, spots: [{ d: [2.4, 2.6, 3.0], c: [1.0, 0.7, 0.4], p: 8, w: 0.12 }, { d: [-3, 2.2, -2.5], c: [1.0, 0.55, 0.2], p: 6, w: 0.1 }, { d: [-2.5, 1.6, 3], c: [1.0, 0.7, 0.4], p: 4, w: 0.07 }] },
  },
  indoor: {
    id: 'indoor', label: 'Indoor', sky: 0xfff0dc, gnd: 0xddd0c0, hemi: 1.7, keyC: 0xffe2bc, key: 1.3, keyP: [0.8, 7, 1.8], rimC: 0xffe9d0, rim: 0.6, rimP: [-3, 3, -3], env: 1, exp: 1, back: 0.15, bg: '#e8ddcf', dark: false,
    sky3: { top: [1.0, 0.88, 0.7], hor: [0.85, 0.74, 0.6], gnd: [0.5, 0.43, 0.36], k: 1.0, spots: [{ d: [0.8, 7, 1.8], c: [1.0, 0.82, 0.55], p: 5, w: 0.3 }, { d: [3, 2, 2], c: [1.0, 0.8, 0.5], p: 3, w: 0.08 }, { d: [-3, 2, 1], c: [1.0, 0.8, 0.5], p: 3, w: 0.08 }] },
  },
};

/** The mannequin's own colour (v186 `mat`: a warm pale grey, matte) and the measuring tape's (v186 `tapeMat`). */
export const GOWN_MANNEQUIN = { color: 0xdedbd6, roughness: 0.82, tape: 0xc9a46a } as const;

/**
 * The sky picture a scene's cloth reflects: a 64 × 32 equirectangular gradient with soft light spots (v186 `sceneEnv`),
 * as linear half-floats. Pure maths over the table, so it can be tested; the stage blurs it once into a reflection map.
 */
export function gownSkyPixels(id: GownSceneId): Uint16Array | null {
  const g = GOWN_SCENES[id].sky3;
  if (!g) return null;
  const W = 64, H = 32, a = new Uint16Array(W * H * 4), h = THREE.DataUtils.toHalfFloat, v = new THREE.Vector3();
  const sp = g.spots.map((s) => ({ ...s, d: new THREE.Vector3(...s.d).normalize() }));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = ((y + 0.5) / H - 0.5) * Math.PI, lon = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      v.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const up = v.y, c = [0, 0, 0];
      for (let i = 0; i < 3; i++) c[i] = (up >= 0 ? g.hor[i]! + (g.top[i]! - g.hor[i]!) * Math.pow(up, 0.6) : g.hor[i]! + (g.gnd[i]! - g.hor[i]!) * Math.min(1, -up * 4)) * g.k;
      for (const s of sp) {
        const d = Math.acos(Math.min(1, v.dot(s.d))), e = Math.exp((-d * d) / (2 * s.w * s.w)) * s.p;
        for (let i = 0; i < 3; i++) c[i]! += s.c[i]! * e;
      }
      const o = (y * W + x) * 4;
      a[o] = h(c[0]!); a[o + 1] = h(c[1]!); a[o + 2] = h(c[2]!); a[o + 3] = h(1);
    }
  }
  return a;
}

/** The sky picture as a texture, ready for `PMREMGenerator.fromEquirectangular`. */
export function gownSkyTexture(id: GownSceneId): THREE.DataTexture | null {
  const px = gownSkyPixels(id);
  if (!px) return null;
  const t = new THREE.DataTexture(px, 64, 32, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
