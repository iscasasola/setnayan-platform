/**
 * chibi-geometry — pure procedural three.js geometry for the chibi character
 * system (Build ② PR-1). Ports the corpus prototype's recipes VERBATIM where
 * they stand (`3D_Avatar_Maker_2026-07-19/chibi_studio_prototype.html` — the
 * geometry contract: closedLathe, buildFace, buildHair, the outfit lathes)
 * and RE-AUTHORS the junction-bearing parts per the owner-corrected V5
 * silhouette law (`Chibi_Rig_Production_Spec_2026-07-19.md § 11`,
 * 2026-07-21):
 *
 *   🔑 THE FIX IS TO CHANGE THE GEOMETRY, NOT TO OVERLAP PARTS. The earlier
 *   "overlap law" draft is RETIRED — each part is authored so it conceals its
 *   own junction:
 *   · arms are part of the body silhouette — NO shoulder pivot, no shoulder
 *     bulge: the sleeve capsule STARTS inside the torso lathe and runs
 *     down-along the body;
 *   · hands are the arms' own rounded ends — a coaxial SAME-RADIUS skin
 *     capsule continues the arm axis (the wider mitten-sphere-on-narrower-
 *     capsule ball-joint read is gone by construction);
 *   · the body lathe's top ring terminates INSIDE the head sphere (the
 *     integral neck the head seats onto); the head stays a SEPARATE part so
 *     PR-2's idle can tilt it;
 *   · ears fold into the head buffer; leg stubs are rounded capsules buried
 *     under the outfit hem; shoes are self-concealing beans.
 *
 *   § 11.2 NO-EXPOSED-CAP LAW (merge gate): no part may terminate in a
 *   visible end-face outside its parent's surface. `chibiJunctionAudit()`
 *   below makes that mechanical — it returns every structural junction with
 *   its computed containment margin, and `lib/chibi-geometry.test.ts` asserts
 *   all margins positive for every (bodyType × outfit). Decorative TRIMS
 *   (gold bands, collars, plackets, cap brim, face ink) ride ON a surface by
 *   design and are listed in CHIBI_TRIM_PARTS, not audited as junctions.
 *
 *   CLOSED-LATHE LAW (carried from the prototype): every lathe profile is
 *   forced to touch the axis at BOTH ends (`closedLatheProfile`) — the
 *   transparency bug class the owner already rejected once cannot recur. The
 *   unit test walks every registered profile.
 *
 * ── INSTANCING / BATCHING CONTRACT (for the later crowd PR — read before
 *    touching part decomposition) ─────────────────────────────────────────
 * Parts are grouped by COLOUR REGION, one merged BufferGeometry per region
 * per variant, because that is exactly the unit the part-batched instanced
 * crowd draws: one InstancedMesh per DISTINCT BUFFER over a white material,
 * per-guest colour FREE via instanceColor (`instanced-seated-crowd.tsx`
 * precedent, pixel-identity proven by `figure-sit-bake.test.ts`).
 *   · head+ears skin: 1 shared buffer (instanceColor = skinTone)
 *   · nose: 1 shared buffer (instanceColor = darkenHex(skin, 0.88))
 *   · hair: 1 buffer PER STYLE (instanceColor = hairColor)
 *   · body/outfit: 1-2 buffers PER OUTFIT (instanceColor = outfitColor /
 *     darkenHex(outfitColor, k) for two-tone bottoms; fixed-colour outfits
 *     like barong/tux tint with their constant)
 *   · hands+legs skin: 1 buffer per outfit-exposure class (instanceColor =
 *     skinTone) · shoes: 1 shared buffer · face ink: small per-style buffers
 *     · accessories: 1 buffer each
 * Whole-room cost ≈ ~30 batches regardless of guest count (§ 6) — the crowd
 * PR must RE-COUNT on a 250-pax phone scene before merge.
 *   ⚠ NEVER merge across colour regions per look-combination: whole-figure
 *   merging turns bodyType × outfit × hair × colour into N unbatchable
 *   geometries (§ 11's surviving invariant). Merging WITHIN a colour region
 *   of one variant (what this module does) is free — § 6 already prices one
 *   buffer per part geometry.
 * All derived colours (nose, two-tone bottoms) come from
 * `lib/chibi-config.ts` darkenHex so the crowd derives per-instance colours
 * from the SAME function and can never drift from the individual figure.
 *
 * Pure module: NO React, NO @react-three/fiber (the figure-sit-bake
 * discipline) — everything here runs under `tsx --test` without a GPU.
 * Geometry construction is LAZY (first call) + cached per variant; caches
 * are module-lifetime and bounded by catalog size. Callers must NOT dispose
 * returned geometries — they are shared across every mounted figure.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  darkenHex,
  type effectiveChibiColors,
  type ChibiAvatarConfig,
  type ChibiBodyType,
  type ChibiOutfit,
  type ChibiHairStyle,
  type ChibiEyes,
  type ChibiMouth,
  type ChibiMark,
  type ChibiAccessory,
} from './chibi-config';

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants (prototype-verbatim)
// ─────────────────────────────────────────────────────────────────────────────

/** Head sphere radius (m at figure scale 1) — rig spec § 2. */
export const CHIBI_HEAD_R = 0.34;
/** Head centre height. Head parts are authored RELATIVE to the head centre
 *  and mounted in a group at this Y so PR-2 can tilt the whole head. */
export const CHIBI_HEAD_Y = 1.06;
/** Head squash — baked into the head/hair buffers (rig spec § 2). */
export const CHIBI_HEAD_SCALE: readonly [number, number, number] = [1, 0.93, 0.97];
/** Face ink colour (fixed — not a config field). */
export const CHIBI_FACE_INK = '#2b211b';
/** Standing height to the top of the head ≈ 1.06 + 0.34·0.93 ≈ 1.38 m at
 *  scale 1. The scale-vs-furniture call (rig spec § 9.1) is an OPEN owner
 *  sign-off for the default-flip PR — do not silently rescale. */
export const CHIBI_HEIGHT_M = CHIBI_HEAD_Y + CHIBI_HEAD_R * CHIBI_HEAD_SCALE[1];

/** Torso proportions per body (prototype-verbatim: female tops ×0.95 width;
 *  one-piece hems flare ×1.05, bottom-garment hems ×1.06; male 1.0).
 *  bodyType is COSMETIC — these multipliers are its only geometric effect. */
const BODY_WIDTH: Record<ChibiBodyType, number> = { female: 0.95, male: 1.0 };
const BODY_FLARE: Record<ChibiBodyType, number> = { female: 1.05, male: 1.0 };
const BODY_BOTTOM_FLARE: Record<ChibiBodyType, number> = { female: 1.06, male: 1.0 };

// ─────────────────────────────────────────────────────────────────────────────
// Paint descriptors — the colour-region contract
// ─────────────────────────────────────────────────────────────────────────────

/** How a part gets its colour. 'skin'/'hair'/'outfit'/'shoes' resolve through
 *  `effectiveChibiColors`; derived kinds apply `darkenHex`; 'fixed' is a
 *  constant. These descriptors ARE the per-instance colour strategy for the
 *  crowd PR (see the batching contract above). */
export type ChibiPaint =
  | { kind: 'skin' }
  | { kind: 'hair' }
  | { kind: 'outfit' }
  | { kind: 'shoes' }
  | { kind: 'outfitDarkened'; k: number }
  | { kind: 'skinDarkened'; k: number }
  | { kind: 'fixed'; hex: string };

export type ChibiPart = {
  /** Stable part name (cache/debug key; the crowd PR's batch key). */
  name: string;
  geometry: THREE.BufferGeometry;
  paint: ChibiPaint;
  /** Suggested MeshStandardMaterial roughness (prototype values). */
  roughness: number;
};

export type ChibiGeometryBundle = {
  /** Static figure-space parts (y = 0 at the floor). */
  body: ChibiPart[];
  /** Head-space parts (origin = head centre) — mount in a group at
   *  CHIBI_HEAD_Y; PR-2 tilts that group for the idle. */
  head: ChibiPart[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────────────────────────

type ProfilePoint = readonly [number, number]; // [radius, y]

/**
 * The closed-lathe law, as data: force the profile to touch the axis at BOTH
 * ends so the lathe is watertight (prototype `closedLathe`). Exported so the
 * unit suite can walk every registered profile through the same closure.
 */
export function closedLatheProfile(points: readonly ProfilePoint[]): THREE.Vector2[] {
  const pts = [new THREE.Vector2(0.001, points[0]![1])];
  for (const [r, y] of points) pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  pts.push(new THREE.Vector2(0.001, points[points.length - 1]![1]));
  return pts;
}

function closedLathe(points: readonly ProfilePoint[], segments = 30): THREE.BufferGeometry {
  return new THREE.LatheGeometry(closedLatheProfile(points), segments);
}

/** Half-torus for eye arcs + mouth curves (prototype `halfTorus`). Face-ink
 *  trim: its tiny tube ends (< 1 cm) ride the head surface by design. */
function halfTorus(r: number, tube: number): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, tube, 8, 16, Math.PI);
}

type Vec3 = readonly [number, number, number];

/** Bake a mesh-style transform (T·R·S, euler XYZ) into the geometry. */
function bake(
  geo: THREE.BufferGeometry,
  opts: { p?: Vec3; e?: Vec3; s?: Vec3 } = {},
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...(opts.p ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(opts.e ?? [0, 0, 0]))),
    new THREE.Vector3(...(opts.s ?? [1, 1, 1])),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Orient + place like the prototype's `g.lookAt(pos × 2)` accessory idiom:
 *  +Z faces outward from the head centre. */
function bakeLookOut(geo: THREE.BufferGeometry, p: Vec3): THREE.BufferGeometry {
  const pos = new THREE.Vector3(...p);
  const m = new THREE.Matrix4().lookAt(pos.clone().multiplyScalar(2), pos, new THREE.Vector3(0, 1, 0));
  geo.applyMatrix4(m);
  geo.translate(pos.x, pos.y, pos.z);
  return geo;
}

/**
 * A capsule whose CYLINDER runs from `a` to `b` (rounded ends extend r
 * beyond each) — the integral-arm/leg primitive. Capsules have no end-faces,
 * so a coaxial same-radius pair is seamless by construction (§ 11.1 "hands
 * are the arms' own rounded ends").
 */
function capsuleBetween(a: Vec3, b: Vec3, r: number, segs = 10): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(r, len, 6, segs);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  geo.applyQuaternion(quat);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

function merged(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 1) return geos[0]!;
  const out = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!out) throw new Error('chibi-geometry: mergeGeometries failed (attribute mismatch)');
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integral arms + legs (§ 11.1 re-authoring — replaces the prototype's
// pivot-mounted arm group + mitten hands + separate bean-on-stub feet)
// ─────────────────────────────────────────────────────────────────────────────

const ARM_R = 0.062;
/** Sleeve start — INSIDE every registered top/dress lathe at this height
 *  (audited below): the arm emerges from the silhouette, no shoulder pivot. */
const ARM_START: Vec3 = [0.14, 0.64, 0];
/** Hand end — the arm's own rounded tip, hugging the body line. */
const ARM_END: Vec3 = [0.26, 0.4, 0.015];
/** Sleeve covers 0 → 0.55 of the arm axis; skin hand runs 0.6 → 1 at the
 *  SAME radius (deep coaxial overlap — seamless, no ring). */
const ARM_SLEEVE_T = 0.55;
const ARM_HAND_T = 0.6;

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const mirrorX = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];

function armSleeveGeos(): THREE.BufferGeometry[] {
  return [1, -1].map((s) => {
    const a: Vec3 = s === 1 ? ARM_START : mirrorX(ARM_START);
    const b: Vec3 = s === 1 ? ARM_END : mirrorX(ARM_END);
    return capsuleBetween(a, lerp3(a, b, ARM_SLEEVE_T), ARM_R);
  });
}

function armHandGeos(): THREE.BufferGeometry[] {
  return [1, -1].map((s) => {
    const a: Vec3 = s === 1 ? ARM_START : mirrorX(ARM_START);
    const b: Vec3 = s === 1 ? ARM_END : mirrorX(ARM_END);
    return capsuleBetween(lerp3(a, b, ARM_HAND_T), b, ARM_R);
  });
}

const LEG_R = 0.07;
const LEG_X = 0.1;
const SHOE_POS: Vec3 = [0.105, 0.055, 0.035];
const SHOE_R = 0.095;
const SHOE_SCALE: Vec3 = [0.95, 0.62, 1.35];

/** Exposed skin leg stubs — rounded capsules from under the hem down into
 *  the shoes (only when the outfit's legLevel > 0). */
function legStubGeos(legLevel: number): THREE.BufferGeometry[] {
  return [1, -1].map((s) =>
    capsuleBetween([s * LEG_X, 0.1 + legLevel, 0.01], [s * LEG_X, 0.1, 0.01], LEG_R),
  );
}

function shoeGeos(): THREE.BufferGeometry[] {
  return [1, -1].map((s) =>
    bake(new THREE.SphereGeometry(SHOE_R, 14, 10), {
      p: [s * SHOE_POS[0], SHOE_POS[1], SHOE_POS[2]],
      s: SHOE_SCALE,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outfit recipes (prototype lathes, single outfitColor + derived two-tone)
// ─────────────────────────────────────────────────────────────────────────────

type OutfitRecipe = {
  /** Exposed skin leg length above y=0.1 (0 = outfit covers the legs). */
  legLevel: number;
  /** Sleeve colour source — 'outfit' | fixed hex (barong ivory, tux black). */
  sleeve: 'outfit' | string;
  /** Primary lathe profile (the top / the dress), pre-width scaling. */
  topProfile: (width: number, flare: number) => readonly ProfilePoint[];
  /** Primary roughness (prototype shine values). */
  topRoughness: number;
  /** 'outfit' colour or fixed hex for the primary lathe. */
  topPaint: 'outfit' | string;
  /** Optional bottom lathe (two-tone: darkened outfitColor, or fixed). */
  bottom?: {
    profile: (flare: number) => readonly ProfilePoint[];
    paint: { kind: 'outfitDarkened'; k: number } | { kind: 'fixed'; hex: string };
  };
  /** Extra outfit-coloured watertight forms (filipiniana butterfly sleeves). */
  extraOutfit?: (width: number) => THREE.BufferGeometry[];
  /** Decorative trims: [fixedHex, roughness, buildGeos] — merged per colour. */
  trims?: readonly (readonly [string, number, (width: number) => THREE.BufferGeometry[]])[];
};

const base =
  (r1: number, r2: number) =>
  (width: number): readonly ProfilePoint[] => [
    [0.1 * width, 0.77],
    [r1 * width, 0.6],
    [r2 * width, 0.38],
  ];

const jacketProfile = (width: number): readonly ProfilePoint[] => [
  [0.1 * width, 0.77],
  [0.215 * width, 0.6],
  [0.21 * width, 0.36],
];

/** Ivory shirt-V wedge under a jacket (prototype cone idiom). Trim. */
const shirtV =
  (r: number, h: number, y: number, z: number) =>
  (width: number): THREE.BufferGeometry[] => [
    bake(new THREE.ConeGeometry(r, h, 3), { p: [0, y, z * width], e: [-3.03, 0, 0] }),
  ];

export const CHIBI_OUTFIT_RECIPES: Record<ChibiOutfit, OutfitRecipe> = {
  wedding: {
    legLevel: 0,
    sleeve: 'outfit',
    topRoughness: 0.55,
    topPaint: 'outfit',
    topProfile: (_w, flare) => [
      [0.1, 0.77],
      [0.2, 0.6],
      [0.165, 0.46],
      [0.24, 0.3],
      [0.36 * flare, 0.1],
    ],
    trims: [
      [
        '#b98a2f',
        0.45,
        () => [bake(new THREE.CylinderGeometry(0.177, 0.177, 0.04, 22), { p: [0, 0.47, 0] })],
      ],
    ],
  },
  gown: {
    legLevel: 0,
    sleeve: 'outfit',
    topRoughness: 0.6,
    topPaint: 'outfit',
    topProfile: (_w, flare) => [
      [0.1, 0.77],
      [0.2, 0.6],
      [0.17, 0.46],
      [0.25, 0.28],
      [0.34 * flare, 0.1],
    ],
  },
  dress: {
    legLevel: 0.12,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: (_w, flare) => [
      [0.1, 0.77],
      [0.2, 0.6],
      [0.18, 0.45],
      [0.27 * flare, 0.26],
    ],
  },
  cocktail: {
    legLevel: 0.2,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: (_w, flare) => [
      [0.1, 0.77],
      [0.2, 0.6],
      [0.17, 0.48],
      [0.29 * flare, 0.33],
    ],
  },
  filipiniana: {
    legLevel: 0,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: base(0.2, 0.185),
    extraOutfit: (width) =>
      [1, -1].map((s) =>
        bake(new THREE.SphereGeometry(0.095, 14, 10), {
          p: [s * 0.235 * width, 0.66, 0],
          e: [0, 0, s * 0.35],
          s: [0.6, 0.9, 0.5],
        }),
      ),
    bottom: {
      profile: (flare) => [
        [0.2 * flare, 0.42],
        [0.27 * flare, 0.24],
        [0.31 * flare, 0.1],
      ],
      paint: { kind: 'outfitDarkened', k: 0.72 },
    },
    trims: [
      [
        '#b98a2f',
        0.45,
        (width) => [
          bake(new THREE.CylinderGeometry(0.2 * width, 0.205 * width, 0.045, 22), {
            p: [0, 0.42, 0],
          }),
        ],
      ],
    ],
  },
  tee_skirt: {
    legLevel: 0.09,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: base(0.2, 0.2),
    bottom: {
      profile: (flare) => [
        [0.2 * flare, 0.42],
        [0.3 * flare, 0.2],
        [0.28 * flare, 0.16],
      ],
      paint: { kind: 'outfitDarkened', k: 0.72 },
    },
  },
  tee_shorts: {
    legLevel: 0.1,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: base(0.2, 0.2),
    bottom: {
      profile: (flare) => [
        [0.21 * flare, 0.4],
        [0.22 * flare, 0.24],
        [0.2 * flare, 0.2],
      ],
      paint: { kind: 'outfitDarkened', k: 0.6 },
    },
  },
  barong: {
    legLevel: 0,
    sleeve: '#f4efdf',
    topRoughness: 0.75,
    topPaint: '#f4efdf',
    topProfile: (width) => [
      [0.1 * width, 0.77],
      [0.21 * width, 0.6],
      [0.205 * width, 0.36],
    ],
    bottom: {
      profile: () => [
        [0.21, 0.4],
        [0.19, 0.16],
        [0.17, 0.1],
      ],
      paint: { kind: 'fixed', hex: '#2e2c33' },
    },
    trims: [
      [
        '#e4d9b8',
        0.65,
        (width) => [
          bake(new THREE.TorusGeometry(0.1, 0.02, 8, 18), { p: [0, 0.75, 0], e: [Math.PI / 2, 0, 0] }),
          bake(new THREE.BoxGeometry(0.04, 0.2, 0.012), { p: [0, 0.51, 0.212 * width] }),
        ],
      ],
    ],
  },
  suit: {
    legLevel: 0,
    sleeve: 'outfit',
    topRoughness: 0.72,
    topPaint: 'outfit',
    topProfile: jacketProfile,
    bottom: {
      profile: () => [
        [0.21, 0.4],
        [0.19, 0.16],
        [0.17, 0.1],
      ],
      paint: { kind: 'outfitDarkened', k: 0.6 },
    },
    trims: [
      ['#f2efe8', 0.7, shirtV(0.08, 0.15, 0.545, 0.155)],
      ['#6e3344', 0.55, (width) => [bake(new THREE.SphereGeometry(0.032, 8, 6), { p: [0, 0.55, 0.2 * width] })]],
    ],
  },
  tux: {
    legLevel: 0,
    sleeve: '#1c1b19',
    topRoughness: 0.5,
    topPaint: '#1c1b19',
    topProfile: jacketProfile,
    bottom: {
      profile: () => [
        [0.21, 0.4],
        [0.19, 0.16],
        [0.17, 0.1],
      ],
      paint: { kind: 'fixed', hex: '#1c1b19' },
    },
    trims: [
      ['#ffffff', 0.65, shirtV(0.09, 0.17, 0.53, 0.15)],
      [
        '#2e2c33',
        0.3,
        (width) =>
          [1, -1].map((s) =>
            bake(new THREE.BoxGeometry(0.025, 0.16, 0.01), {
              p: [s * 0.055, 0.62, 0.195 * width],
              e: [-0.1, 0, s * 0.22],
            }),
          ),
      ],
      [
        '#17110c',
        0.4,
        (width) =>
          [1, -1].map((s) =>
            bake(new THREE.SphereGeometry(0.028, 8, 6), {
              p: [s * 0.032, 0.69, 0.2 * width],
              s: [1.25, 0.7, 0.5],
            }),
          ),
      ],
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Head + face (§ 10 FACES ARE IN — nose always on; head-space coordinates)
// ─────────────────────────────────────────────────────────────────────────────

const R = CHIBI_HEAD_R;

function headSkinGeo(): THREE.BufferGeometry {
  const head = bake(new THREE.SphereGeometry(R, 30, 20), { s: [...CHIBI_HEAD_SCALE] });
  const ears = [1, -1].map((s) =>
    bake(new THREE.SphereGeometry(0.055, 12, 8), {
      p: [s * R * 0.96, -0.02, 0],
      s: [0.6, 1, 0.8],
    }),
  );
  return merged([head, ...ears]);
}

function noseGeo(): THREE.BufferGeometry {
  return bake(new THREE.SphereGeometry(R * 0.085, 12, 10), {
    p: [0, -R * 0.06, R * 0.965],
    s: [0.85, 0.7, 0.6],
  });
}

function faceInkGeo(eyes: ChibiEyes, mouth: ChibiMouth, mark: ChibiMark): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  if (eyes === 'dots') {
    for (const s of [-1, 1])
      parts.push(
        bake(new THREE.SphereGeometry(R * 0.055, 10, 8), {
          p: [s * R * 0.34, R * 0.08, R * 0.9],
          s: [1, 1.25, 0.5],
        }),
      );
  } else if (eyes === 'happy') {
    for (const s of [-1, 1])
      parts.push(
        bake(halfTorus(R * 0.075, R * 0.02), {
          p: [s * R * 0.35, R * 0.07, R * 0.92],
          e: [-0.25, s * 0.36, 0],
        }),
      );
  } else if (eyes === 'sleepy') {
    for (const s of [-1, 1])
      parts.push(
        bake(halfTorus(R * 0.075, R * 0.02), {
          p: [s * R * 0.34, R * 0.1, R * 0.92],
          e: [Math.PI + 0.25, -s * 0.36, 0],
        }),
      );
  }
  if (mouth === 'smile') {
    parts.push(bake(halfTorus(R * 0.1, R * 0.02), { p: [0, -R * 0.2, R * 0.945], e: [Math.PI + 0.23, 0, 0] }));
  } else if (mouth === 'grin') {
    parts.push(bake(halfTorus(R * 0.13, R * 0.032), { p: [0, -R * 0.19, R * 0.925], e: [Math.PI + 0.23, 0, 0] }));
  } else if (mouth === 'soft') {
    parts.push(
      bake(new THREE.CapsuleGeometry(R * 0.02, R * 0.09, 4, 6), {
        p: [0, -R * 0.22, R * 0.95],
        e: [0, 0, Math.PI / 2],
        s: [1, 1, 0.5],
      }),
    );
  }
  if (mark !== 'none') {
    const p: Vec3 =
      mark === 'left'
        ? [-R * 0.47, -R * 0.1, R * 0.86]
        : mark === 'right'
          ? [R * 0.47, -R * 0.1, R * 0.86]
          : [R * 0.14, -R * 0.34, R * 0.9];
    parts.push(bake(new THREE.SphereGeometry(R * 0.028, 8, 6), { p, s: [1, 1, 0.5] }));
  }
  if (parts.length === 0) return null;
  return merged(parts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hair (two-piece cap + per-style extras — prototype-verbatim, incl. the
// 2026-07-21 placement-audit clamp)
// ─────────────────────────────────────────────────────────────────────────────

export type HairCapParams = { crown: number; nape: number; lift: number };

/**
 * PLACEMENT INVARIANT (2026-07-21 audit, ported verbatim): two constraints,
 * not eleven hand-tuned triples —
 *   crown ≤ 0.42 + lift ≥ 0.03 → front rim ABOVE the tallest brow;
 *   nape ≥ 0.70 → back hairline past the occiput, short of the 0.75 "beard"
 *   threshold (never past ~0.74 or it curls under the jaw).
 * Call sites keep their historic arguments; the clamp wins. Exported (with
 * `hairCapParamsForStyle`) so the unit suite asserts the clamp on every
 * style — the "caps hiding eyes" V4 bug class stays dead.
 */
export function clampHairCap(crown: number, nape = 0.64, lift = 0): HairCapParams {
  return { crown: Math.min(crown, 0.42), nape: Math.max(nape, 0.7), lift: Math.max(lift, 0.03) };
}

/** The cap() arguments each style uses (pre-clamp, prototype-historic). */
const HAIR_CAP_CALLS: Record<Exclude<ChibiHairStyle, 'bald'>, readonly [number, number, number]> = {
  crop: [0.42, 0.62, 0.02],
  side: [0.42, 0.62, 0.03],
  spiky: [0.42, 0.62, 0.02],
  curly: [0.44, 0.7, 0.02],
  bob: [0.44, 0.72, 0.03],
  buns: [0.42, 0.62, 0.02],
  pony: [0.42, 0.62, 0.02],
  long: [0.44, 0.7, 0.03],
  bangs: [0.44, 0.7, 0.03],
  knot: [0.42, 0.62, 0.02],
};

export function hairCapParamsForStyle(style: ChibiHairStyle): HairCapParams | null {
  if (style === 'bald') return null;
  const [c, n, l] = HAIR_CAP_CALLS[style];
  return clampHairCap(c, n, l);
}

/** Two-piece cap: full-circumference shallow CROWN (rim above the brow) +
 *  rear NAPE panel (phi 0.85π..2.15π — the 126° face gap stays open), both
 *  squashed to hug the head's scale and lifted. Open sphere-section rims
 *  ride the head surface (shell-over-head, prototype-accepted). */
function hairCapGeos(params: HairCapParams): THREE.BufferGeometry[] {
  const { crown, nape, lift } = params;
  const out: THREE.BufferGeometry[] = [];
  out.push(
    bake(new THREE.SphereGeometry(R * 1.05, 28, 18, 0, Math.PI * 2, 0, Math.PI * crown), {
      p: [0, lift, 0],
      s: [...CHIBI_HEAD_SCALE],
    }),
  );
  if (nape > crown) {
    out.push(
      bake(new THREE.SphereGeometry(R * 1.045, 28, 20, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * nape), {
        p: [0, lift, 0],
        s: [...CHIBI_HEAD_SCALE],
      }),
    );
  }
  return out;
}

function hairGeo(style: ChibiHairStyle): THREE.BufferGeometry | null {
  if (style === 'bald') return null; // the owner-requested clean dome
  const params = hairCapParamsForStyle(style)!;
  const parts: THREE.BufferGeometry[] = hairCapGeos(params);
  switch (style) {
    case 'side': {
      parts.push(
        bake(new THREE.SphereGeometry(R * 0.46, 16, 10), {
          p: [R * 0.3, R * 0.5, R * 0.72],
          e: [0, 0, -0.22],
          s: [1.0, 0.38, 0.62],
        }),
      );
      break;
    }
    case 'spiky': {
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.42;
        parts.push(
          bake(new THREE.ConeGeometry(R * 0.16, R * 0.42, 8), {
            p: [Math.sin(a) * R * 0.55, R * 1.0, Math.cos(a) * R * 0.28 - R * 0.1],
            e: [0.18, 0, -Math.sin(a) * 0.5],
          }),
        );
      }
      break;
    }
    case 'curly': {
      const seeds: Vec3[] = [
        [0, 0.95, 0],
        [0.5, 0.82, 0.3],
        [-0.5, 0.82, 0.3],
        [0.62, 0.75, -0.3],
        [-0.62, 0.75, -0.3],
        [0.3, 0.9, -0.5],
        [-0.3, 0.9, -0.5],
        [0, 0.85, 0.58],
        [0.55, 0.45, -0.55],
        [-0.55, 0.45, -0.55],
      ];
      for (const [x, y, z] of seeds)
        parts.push(bake(new THREE.SphereGeometry(R * 0.3, 12, 8), { p: [x * R, y * R, z * R] }));
      break;
    }
    case 'bob': {
      for (const s of [-1, 1])
        parts.push(
          bake(new THREE.CapsuleGeometry(R * 0.2, R * 0.5, 4, 8), { p: [s * R * 0.86, -R * 0.26, -R * 0.02] }),
        );
      parts.push(
        bake(new THREE.SphereGeometry(R * 0.98, 18, 12), {
          p: [0, -R * 0.06, -R * 0.28],
          s: [1, 1.0, 0.7],
        }),
      );
      break;
    }
    case 'buns': {
      for (const s of [-1, 1])
        parts.push(bake(new THREE.SphereGeometry(R * 0.32, 14, 10), { p: [s * R * 0.72, R * 0.72, -R * 0.15] }));
      break;
    }
    case 'pony': {
      parts.push(
        bake(new THREE.CapsuleGeometry(R * 0.22, R * 0.85, 4, 10), {
          p: [0, R * 0.2, -R * 0.8],
          e: [0.55, 0, 0],
        }),
      );
      break;
    }
    case 'long': {
      // The fall STARTS inside the nape panel (no scalp seam — 2026-07-21 fix).
      parts.push(
        bake(
          closedLathe([
            [R * 0.88, R * 0.1],
            [R * 0.92, -R * 0.8],
            [R * 0.62, -R * 1.5],
          ]),
          { p: [0, -R * 0.05, -R * 0.16], s: [1, 1, 0.95] },
        ),
      );
      for (const s of [-1, 1])
        parts.push(
          bake(new THREE.CapsuleGeometry(R * 0.17, R * 0.85, 4, 8), { p: [s * R * 0.74, -R * 0.42, R * 0.06] }),
        );
      break;
    }
    case 'bangs': {
      parts.push(
        bake(new THREE.SphereGeometry(R * 0.62, 20, 10), {
          p: [0, R * 0.4, R * 0.66],
          s: [1.08, 0.34, 0.5],
        }),
      );
      break;
    }
    case 'knot': {
      parts.push(bake(new THREE.SphereGeometry(R * 0.24, 12, 10), { p: [0, R * 0.95, -R * 0.28] }));
      break;
    }
    default:
      break; // crop = cap only
  }
  return merged(parts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Accessories (fixed colours, prototype-verbatim; positions sit at HAIR
// radius per the 2026-07-21 placement audit)
// ─────────────────────────────────────────────────────────────────────────────

function accessoryParts(acc: ChibiAccessory): ChibiPart[] {
  switch (acc) {
    case 'flower': {
      const petals: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        petals.push(
          bake(new THREE.SphereGeometry(R * 0.11, 8, 6), {
            p: [Math.cos(a) * R * 0.13, Math.sin(a) * R * 0.13, 0],
            s: [1, 1, 0.5],
          }),
        );
      }
      const pos: Vec3 = [R * 0.77, R * 0.59, R * 0.59];
      return [
        { name: 'acc-flower-petals', geometry: bakeLookOut(merged(petals), pos), paint: { kind: 'fixed', hex: '#e6c9c4' }, roughness: 0.7 },
        {
          name: 'acc-flower-heart',
          geometry: bakeLookOut(bake(new THREE.SphereGeometry(R * 0.08, 8, 6), { s: [1, 1, 0.6] }), pos),
          paint: { kind: 'fixed', hex: '#b98a2f' },
          roughness: 0.4,
        },
      ];
    }
    case 'bow': {
      const pos: Vec3 = [-R * 0.67, R * 0.81, R * 0.51];
      const loops: THREE.BufferGeometry[] = [1, -1].map((s) =>
        bake(new THREE.SphereGeometry(R * 0.14, 8, 6), { p: [s * R * 0.15, 0, 0], s: [1.2, 0.75, 0.5] }),
      );
      loops.push(new THREE.SphereGeometry(R * 0.08, 8, 6));
      return [
        { name: 'acc-bow', geometry: bakeLookOut(merged(loops), pos), paint: { kind: 'fixed', hex: '#6e3344' }, roughness: 0.6 },
      ];
    }
    case 'cap': {
      // Dome section over the hair + a brim disc (a brim IS a disc — trim).
      const dome = bake(new THREE.SphereGeometry(R * 1.3, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), {
        p: [0, R * 0.12, 0],
      });
      const brim = bake(new THREE.CylinderGeometry(R * 0.62, R * 0.62, R * 0.06, 18), {
        p: [0, R * 0.37, R * 0.85],
        e: [-0.12, 0, 0],
        s: [1, 1, 1.25],
      });
      return [
        { name: 'acc-cap', geometry: merged([dome, brim]), paint: { kind: 'fixed', hex: '#41465a' }, roughness: 0.6 },
      ];
    }
    case 'specs': {
      const parts: THREE.BufferGeometry[] = [1, -1].map((s) =>
        bake(new THREE.TorusGeometry(R * 0.2, R * 0.026, 8, 18), { p: [s * R * 0.34, R * 0.07, R * 1.0] }),
      );
      parts.push(
        bake(new THREE.CapsuleGeometry(R * 0.022, R * 0.18, 4, 6), {
          p: [0, R * 0.07, R * 1.0],
          e: [0, 0, Math.PI / 2],
        }),
      );
      return [
        { name: 'acc-specs', geometry: merged(parts), paint: { kind: 'fixed', hex: '#2e2c29' }, roughness: 0.4 },
      ];
    }
    case 'band': {
      return [
        {
          name: 'acc-band',
          geometry: bake(new THREE.TorusGeometry(R * 1.05, R * 0.06, 8, 26), {
            p: [0, R * 0.42, 0],
            e: [Math.PI / 2, 0, 0],
          }),
          paint: { kind: 'fixed', hex: '#b98a2f' },
          roughness: 0.5,
        },
      ];
    }
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle assembly + caches
// ─────────────────────────────────────────────────────────────────────────────

// Lazy module-lifetime caches, bounded by catalog size. Values are SHARED —
// never dispose a geometry handed out by this module.
const bodyCache = new Map<string, ChibiPart[]>();
const headSkinCache: { geo?: THREE.BufferGeometry } = {};
const noseCache: { geo?: THREE.BufferGeometry } = {};
const hairCache = new Map<string, THREE.BufferGeometry | null>();
const faceCache = new Map<string, THREE.BufferGeometry | null>();
const accCache = new Map<string, ChibiPart[]>();

function bodyParts(bodyType: ChibiBodyType, outfit: ChibiOutfit): ChibiPart[] {
  const key = `${bodyType}|${outfit}`;
  const hit = bodyCache.get(key);
  if (hit) return hit;

  const recipe = CHIBI_OUTFIT_RECIPES[outfit];
  const width = BODY_WIDTH[bodyType];
  const flare = BODY_FLARE[bodyType];
  const parts: ChibiPart[] = [];

  // Primary outfit buffer: dress/top lathe + integral sleeve-arms (when the
  // sleeve shares the outfit colour) + extra outfit forms — ONE buffer.
  const primary: THREE.BufferGeometry[] = [closedLathe(recipe.topProfile(width, flare))];
  if (recipe.sleeve === 'outfit') primary.push(...armSleeveGeos());
  if (recipe.extraOutfit) primary.push(...recipe.extraOutfit(width));
  parts.push({
    name: `body-${key}`,
    geometry: merged(primary),
    paint: recipe.topPaint === 'outfit' ? { kind: 'outfit' } : { kind: 'fixed', hex: recipe.topPaint },
    roughness: recipe.topRoughness,
  });
  // Fixed-colour sleeves (barong ivory / tux black) merge with their shirt
  // colour class instead.
  if (recipe.sleeve !== 'outfit') {
    parts.push({
      name: `sleeves-${key}`,
      geometry: merged(armSleeveGeos()),
      paint: { kind: 'fixed', hex: recipe.sleeve },
      roughness: 0.7,
    });
  }
  if (recipe.bottom) {
    parts.push({
      name: `bottom-${key}`,
      geometry: closedLathe(recipe.bottom.profile(BODY_BOTTOM_FLARE[bodyType])),
      paint: recipe.bottom.paint,
      roughness: 0.75,
    });
  }
  for (const [hex, roughness, build] of recipe.trims ?? []) {
    parts.push({ name: `trim-${hex}-${key}`, geometry: merged(build(width)), paint: { kind: 'fixed', hex }, roughness });
  }
  // Skin: hands (always) + exposed leg stubs (outfit-dependent) — one buffer.
  const skin: THREE.BufferGeometry[] = [...armHandGeos()];
  if (recipe.legLevel > 0) skin.push(...legStubGeos(recipe.legLevel));
  parts.push({ name: `skin-${key}`, geometry: merged(skin), paint: { kind: 'skin' }, roughness: 0.5 });
  parts.push({ name: 'shoes', geometry: merged(shoeGeos()), paint: { kind: 'shoes' }, roughness: 0.6 });

  bodyCache.set(key, parts);
  return parts;
}

/**
 * Resolve a NORMALIZED config (see `resolveChibiConfig`) to its shared part
 * bundle. Geometry only — colours are applied by the renderer from the
 * part's `paint` descriptor (that separation is what keeps one buffer
 * servable to N differently-coloured instances later).
 */
export function buildChibiGeometry(cfg: ChibiAvatarConfig): ChibiGeometryBundle {
  const body = bodyParts(cfg.bodyType, cfg.outfit);

  const head: ChibiPart[] = [];
  headSkinCache.geo ??= headSkinGeo();
  head.push({ name: 'head-skin', geometry: headSkinCache.geo, paint: { kind: 'skin' }, roughness: 0.5 });
  noseCache.geo ??= noseGeo();
  // Nose — ALWAYS on (§ 10, the front-facing cue), skin darkened ×0.88.
  head.push({ name: 'nose', geometry: noseCache.geo, paint: { kind: 'skinDarkened', k: 0.88 }, roughness: 0.5 });

  const faceKey = `${cfg.eyes}|${cfg.mouth}|${cfg.mark}`;
  if (!faceCache.has(faceKey)) faceCache.set(faceKey, faceInkGeo(cfg.eyes, cfg.mouth, cfg.mark));
  const ink = faceCache.get(faceKey);
  if (ink) head.push({ name: `face-${faceKey}`, geometry: ink, paint: { kind: 'fixed', hex: CHIBI_FACE_INK }, roughness: 0.45 });

  if (!hairCache.has(cfg.hairStyle)) hairCache.set(cfg.hairStyle, hairGeo(cfg.hairStyle));
  const hair = hairCache.get(cfg.hairStyle);
  if (hair) head.push({ name: `hair-${cfg.hairStyle}`, geometry: hair, paint: { kind: 'hair' }, roughness: 0.55 });

  if (cfg.accessory !== 'none') {
    if (!accCache.has(cfg.accessory)) accCache.set(cfg.accessory, accessoryParts(cfg.accessory));
    head.push(...accCache.get(cfg.accessory)!);
  }

  return { body, head };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11.2 audit — the no-exposed-cap merge gate, as data
// ─────────────────────────────────────────────────────────────────────────────

/** Decorative parts EXEMPT from the junction audit, with the reason. Keep
 *  this list honest — a part that stops being "a band riding a surface" and
 *  starts being a limb must move into the audit. */
export const CHIBI_TRIM_PARTS: readonly { part: string; reason: string }[] = [
  { part: 'gold waist/hem bands + barong collar/placket', reason: 'bands riding ON a lathe surface by design (prototype trim idiom)' },
  { part: 'shirt-V cones + ties + lapels + bow ties', reason: 'decorative wedges half-buried in the jacket front' },
  { part: 'face ink (eyes/mouth/mark) + nose', reason: 'surface decals ~1 cm proud of the head sphere; ink tube-ends < 1 cm' },
  { part: 'hair crown/nape sphere-sections', reason: 'open shells hugging the head; rims governed by the clampHairCap invariant (tested)' },
  { part: 'cap dome + brim', reason: 'a brim is a disc by design; dome is a shell over the hair' },
  { part: 'butterfly sleeves / puffs / buns / curls / falls', reason: 'watertight spheres+capsules partially buried in their host' },
];

export type ChibiJunctionAudit = {
  part: string;
  host: string;
  /** The extreme end-point that must be concealed (figure space, +X side). */
  tip: { x: number; y: number; z: number };
  /** Positive = concealed inside the host, with room to spare. Ellipsoid
   *  hosts report the normalized (1 − Σ(d²/r²)) value; lathe hosts report
   *  metres of radial clearance. */
  margin: number;
  contained: boolean;
};

/** Piecewise-linear radius of a lathe profile at height y (NaN outside). */
function profileRadiusAtY(profile: readonly ProfilePoint[], y: number): number {
  const pts = [...profile].sort((a, b) => a[1] - b[1]); // ascending y
  if (y < pts[0]![1] || y > pts[pts.length - 1]![1]) return NaN;
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i]!;
    const [r1, y1] = pts[i + 1]!;
    if (y >= y0 && y <= y1) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return NaN;
}

function latheAudit(part: string, host: string, profile: readonly ProfilePoint[], tip: Vec3): ChibiJunctionAudit {
  const radial = Math.hypot(tip[0], tip[2]);
  const rAt = profileRadiusAtY(profile, tip[1]);
  const margin = Number.isNaN(rAt) ? -1 : rAt - radial;
  return { part, host, tip: { x: tip[0], y: tip[1], z: tip[2] }, margin, contained: margin > 0 };
}

/**
 * Compute every STRUCTURAL junction's containment for one (bodyType, outfit)
 * — the § 11.2 law made mechanical. The +X side is audited; the −X side is
 * an exact mirror by construction (see mirrorX). The unit suite walks every
 * catalog combination and fails the build on any non-positive margin, so a
 * future proportion re-tune cannot silently re-open a seam.
 */
export function chibiJunctionAudit(bodyType: ChibiBodyType, outfit: ChibiOutfit): ChibiJunctionAudit[] {
  const recipe = CHIBI_OUTFIT_RECIPES[outfit];
  const width = BODY_WIDTH[bodyType];
  const flare = BODY_FLARE[bodyType];
  const top = recipe.topProfile(width, flare);
  const out: ChibiJunctionAudit[] = [];

  // 1 · Body-top-into-head: the lathe's top ring must terminate INSIDE the
  //     head ellipsoid (the integral neck the head seats onto).
  {
    const sorted = [...top].sort((a, b) => b[1] - a[1]);
    const [topR, topY] = sorted[0]!;
    // Ellipsoid semi-axes; the ring lies in the y-plane (z = 0), so only the
    // x + y axes participate in the containment value.
    const [a, b] = [R * CHIBI_HEAD_SCALE[0], R * CHIBI_HEAD_SCALE[1]];
    const dy = topY - CHIBI_HEAD_Y;
    const margin = 1 - ((topR / a) ** 2 + (dy / b) ** 2);
    out.push({
      part: `body-top-ring(${outfit})`,
      host: 'head-ellipsoid',
      tip: { x: topR, y: topY, z: 0 },
      margin,
      contained: margin > 0,
    });
  }

  // 2 · Sleeve-arm root: the capsule's rounded upper tip (r beyond ARM_START,
  //     up the arm axis) must sit inside the top lathe — the arm emerges from
  //     the silhouette, no shoulder pivot.
  {
    const a = ARM_START;
    const b = ARM_END;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const d: Vec3 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
    const tip: Vec3 = [a[0] - d[0] * ARM_R, a[1] - d[1] * ARM_R, a[2] - d[2] * ARM_R];
    out.push(latheAudit(`arm-root(${outfit})`, `top-lathe(${outfit})`, top, tip));
  }

  // 3 · Hand-into-sleeve: the skin capsule's inner rounded tip must lie
  //     within the sleeve capsule volume. Hand + sleeve are COAXIAL at the
  //     SAME radius, so the tip sits ON the shared axis — containment
  //     reduces to 1-D: the tip's parametric position (t along ARM_START→
  //     ARM_END, the rounded end extending ARM_R back from ARM_HAND_T) must
  //     land before the sleeve cylinder's end at ARM_SLEEVE_T. Margin is in
  //     axis-parameter units (× arm length ≈ metres).
  {
    const armLen = Math.hypot(
      ARM_END[0] - ARM_START[0],
      ARM_END[1] - ARM_START[1],
      ARM_END[2] - ARM_START[2],
    );
    const handTipT = ARM_HAND_T - ARM_R / armLen;
    const margin = ARM_SLEEVE_T - handTipT;
    out.push({
      part: 'hand-root',
      host: 'sleeve-capsule',
      tip: { x: handTipT, y: 0, z: 0 },
      margin,
      contained: margin > 0,
    });
  }

  // 4 · Leg-stub-into-hem: when the outfit exposes skin, the stub's rounded
  //     top tip must terminate inside the covering lathe (hem or dress).
  if (recipe.legLevel > 0) {
    const hostProfile = recipe.bottom ? recipe.bottom.profile(BODY_BOTTOM_FLARE[bodyType]) : top;
    const tip: Vec3 = [LEG_X, 0.1 + recipe.legLevel + LEG_R, 0.01];
    out.push(latheAudit(`leg-stub(${outfit})`, recipe.bottom ? `bottom-lathe(${outfit})` : `dress-lathe(${outfit})`, hostProfile, tip));
  }

  return out;
}

/** Every lathe profile the figure uses, for the closed-lathe unit test. */
export function chibiLatheProfiles(bodyType: ChibiBodyType, outfit: ChibiOutfit): readonly ProfilePoint[][] {
  const recipe = CHIBI_OUTFIT_RECIPES[outfit];
  const width = BODY_WIDTH[bodyType];
  const flare = BODY_FLARE[bodyType];
  const profiles: ProfilePoint[][] = [[...recipe.topProfile(width, flare)]];
  if (recipe.bottom) profiles.push([...recipe.bottom.profile(BODY_BOTTOM_FLARE[bodyType])]);
  return profiles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paint resolution — THE single colour mapping (individual figure + crowd)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a part's `ChibiPaint` descriptor to a hex, given the figure's
 * effective colours. Lives HERE (pure, unit-tested) — NOT in the client
 * component — because the later instanced-crowd PR derives per-instance
 * `instanceColor` values from this exact function; two copies would let the
 * crowd drift from the individual figure (§ 11.2: a colour mismatch across a
 * junction reintroduces the ring even when the geometry is correct).
 */
export function resolveChibiPaint(
  paint: ChibiPaint,
  colors: ReturnType<typeof effectiveChibiColors>,
): string {
  switch (paint.kind) {
    case 'skin':
      return colors.skin;
    case 'hair':
      return colors.hair;
    case 'outfit':
      return colors.outfit;
    case 'shoes':
      return colors.shoes;
    case 'outfitDarkened':
      return darkenHex(colors.outfit, paint.k);
    case 'skinDarkened':
      return darkenHex(colors.skin, paint.k);
    case 'fixed':
      return paint.hex;
  }
}
