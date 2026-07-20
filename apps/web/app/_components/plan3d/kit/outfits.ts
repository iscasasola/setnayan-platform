/**
 * kit/outfits — shared outfit-shell geometries + material caches. Module-scope
 * THREE geometry/material instances are the lab's own precedent (GOWN_GEO /
 * SUIT_GEO): R3F never disposes module constants, so every mesh shares ONE GPU
 * buffer per shell instead of allocating per mount.
 *
 * ⚠ SCOPE (2026-07-09 one-piece rebuild → 2026-07-10 staff dressing):
 *   · GUEST figures render as a single matte-white mannequin (one shared
 *     `mannequinMaterial`, no wardrobe) — their outfit value is ignored.
 *   · BOOTH STAFF (isStaffOutfit: chef_whites/apron/vest/uniform/robe) DO get
 *     dressed: the figure renderer tints their torso + arms with
 *     `outfitMaterial` (garment cloth + CanvasTexture detail) and legs with
 *     `trouserMaterial`, so a chef/barista/florist read distinct at a booth.
 *   · The gown/suit SHELL GEOMETRIES (GOWN_GEO/SUIT_GEO) + the barong material
 *     serve ONLY static BOOTH DECOR (dress-form busts, garment rails in
 *     booth-props.tsx) — no per-figure shell is placed on anyone.
 * (`outfitGeometry`/`outfitIsSkirted`/`skinMaterial` were removed with the
 * rebuild — see the in-file notes.)
 *
 * The two Filipino-formalwear shells (booth decor):
 *   · barong — suit-proportioned, near-white jusi cloth with a subtle
 *     VERTICAL-embroidery bump texture (the classic pechera stitching) and a
 *     slight sheen. Procedural CanvasTexture only (offline-first — no asset
 *     pipeline; NOT a CSP limit, see BoothSign / GuestPhotoAvatar),
 *     imitating scene-lighting.tsx's fabricBumpMap builder.
 *   · filipiniana — the gown shell plus two flattened-sphere butterfly
 *     sleeves (terno); the sleeve geometry lives here so the renderer only
 *     places it.
 *
 * SSR NOTE: geometries + plain materials construct fine in Node (three is
 * isomorphic), but CanvasTextures need `document` — so the barong material is
 * built LAZILY on first use (inside a Canvas render, browser-only), the same
 * lazy-module-singleton pattern as fabricBumpMap.
 */

import * as THREE from 'three';
import { fabricBumpMap } from '@/app/_components/plan3d/scene-lighting';
import type { FigureSpec } from '@/lib/figure-rig';

export type OutfitKind = FigureSpec['outfit'];

// ── Shared shell geometries (module scope — one GPU buffer each) ────────────
//
// RE-PROPORTIONED 2026-07-08 (owner: figures "look like christmas trees
// instead of a realistic person"). The original shells were the lab tokens'
// cones — the gown flared from the NECK, which is exactly the tree read. The
// shells are now LatheGeometry dress-form profiles authored in TORSO space
// (y=0 at the pelvis, matching figure.tsx's rig constants): collar →
// shoulders → bust → WAIST → hips → hem. The waist pinch is what makes a
// silhouette read "person"; the skirt flare starts at the hips, never the
// chest. One shared buffer each, same as before.

/** Build a closed lathe from (radius, y) profile points (top → bottom); the
 *  last point is capped to centre so hems/jacket bottoms aren't see-through
 *  from a low camera. */
function latheProfile(points: ReadonlyArray<readonly [number, number]>, segments = 28): THREE.LatheGeometry {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  const last = points[points.length - 1]!;
  pts.push(new THREE.Vector2(0.001, last[1])); // cap
  return new THREE.LatheGeometry(pts, segments);
}

/** Gown: fitted bodice with a real waist, A-line skirt flaring from the HIPS
 *  to a mid-shin hem (shins stay visible for footfall while walking). */
export const GOWN_GEO = latheProfile([
  [0.045, 0.5], // collar
  [0.15, 0.44], // shoulder line
  [0.165, 0.32], // bust
  [0.108, 0.18], // waist — the pinch that kills the cone
  [0.155, 0.02], // hips
  [0.205, -0.38], // skirt mid-fall
  [0.245, -0.62], // hem (≈ mid-shin standing)
]);

/** Suit: squared shoulder line, slight chest→waist taper, jacket hem at the
 *  hips — trousered legs render below it. */
export const SUIT_GEO = latheProfile([
  [0.05, 0.52], // collar
  [0.155, 0.46], // shoulders
  [0.15, 0.3], // chest
  [0.125, 0.1], // waist taper
  [0.14, -0.05], // jacket hem at the hips
]);

/** Neutral: an unmarked soft column with shoulders — still humanoid, no
 *  wardrobe statement. */
export const NEUTRAL_GEO = latheProfile([
  [0.048, 0.5],
  [0.14, 0.44],
  [0.13, 0.15],
  [0.135, -0.02],
]);

// (Removed 2026-07-10: `outfitGeometry` + `outfitIsSkirted` — dead since the
// one-piece figure rebuild. The per-guest figure no longer places wardrobe
// shells; the GOWN_GEO/SUIT_GEO/NEUTRAL_GEO buffers + outfitMaterial are now
// consumed ONLY by static booth decor in booth-props.tsx.)

// ── Barong embroidery (lazy CanvasTexture — browser only) ───────────────────

let barongBumpTex: THREE.CanvasTexture | null = null;

/**
 * Vertical-embroidery bump for the barong: a mid-grey field with fine raised
 * vertical stitch columns (dashed, alternating light/dark like satin-stitch
 * rows) so the raking key light catches the classic pechera relief. Same
 * grayscale-luminance-as-height convention as fabricBumpMap. Built once per
 * page; repeated around the torso cylinder so the columns read front AND
 * back (a stylization — one 128px tile, no per-figure cost).
 */
export function barongEmbroideryBump(): THREE.CanvasTexture {
  if (barongBumpTex) return barongBumpTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8f8f8f'; // flat field
  ctx.fillRect(0, 0, size, size);
  const columns = 8;
  const step = size / columns;
  for (let i = 0; i < columns; i++) {
    const x = i * step + step / 2;
    // A raised stitch column: bright core line with darker gutters either
    // side so the relief reads as embroidery, not a painted stripe.
    ctx.fillStyle = '#6c6c6c';
    ctx.fillRect(x - 3, 0, 6, size);
    ctx.fillStyle = '#c9c9c9';
    // Dashed satin-stitch segments rather than one solid ridge.
    for (let y = 0; y < size; y += 10) {
      ctx.fillRect(x - 1.5, y, 3, 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.6); // fine columns at torso scale
  barongBumpTex = tex;
  return tex;
}

// ── Staff garment textures (lazy CanvasTextures — browser only) ─────────────
//
// The four booth-staff variants (2026-07-08) are the suit / neutral shells
// recoloured + ONE small drawn detail each — double-breasted buttons, an
// apron bib, a vest V, a uniform chest stripe. The detail canvas IS the
// garment colour map (drawn in full colour, material base stays white), so
// the bib/vest panels can sit over a contrasting shirt without multiply
// artefacts. Cached per (outfit, colour) — bounded like every kit cache.
//
// UV mapping notes (LatheGeometry, verified empirically on the rendered rig
// with a quadrant-colour test — 2026-07-08): the FIGURE'S FRONT samples the
// canvas HORIZONTAL CENTRE (u = 0.5), so the chest detail is drawn at
// cx = width/2 with no texture offset; the u = 0/1 seam sits at the BACK.
// `flipY = false` makes canvas top = collar (v = 0, the profile's first
// point). The upper-arm sleeves share this material, so their capsule UVs
// pick up the FIELD colour — keep details small and central so a sleeve
// never wears a stray bib fragment.

type StaffOutfit = 'chef_whites' | 'apron' | 'vest' | 'uniform' | 'robe';

// Exported so the figure renderer dresses ONLY booth STAFF (chef/barista/etc.)
// in a garment — guest outfits (gown/suit/barong/filipiniana/neutral) stay the
// matte-white mannequin (owner-locked 2026-07-09; staff differentiation added
// 2026-07-10).
export function isStaffOutfit(outfit: OutfitKind): outfit is StaffOutfit {
  return (
    outfit === 'chef_whites' ||
    outfit === 'apron' ||
    outfit === 'vest' ||
    outfit === 'uniform' ||
    outfit === 'robe'
  );
}

const staffTexCache = new Map<string, THREE.CanvasTexture>();

function staffGarmentTexture(outfit: StaffOutfit, color: string): THREE.CanvasTexture {
  const key = `${outfit}|${color}`;
  const cached = staffTexCache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // The chest detail, drawn relative to a horizontal centre `cx` — the
  // canvas centre, which the verified UV mapping puts on the figure's front.
  const detail = (cx: number) => {
    switch (outfit) {
      case 'chef_whites': {
        // The double-breasted twin button columns + the overlap seam.
        ctx.fillStyle = '#a89f90';
        for (const side of [-1, 1]) {
          for (let y = 34; y <= 88; y += 18) {
            ctx.beginPath();
            ctx.arc(cx + side * 9, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.strokeStyle = 'rgba(120, 112, 98, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, 26);
        ctx.lineTo(cx, 100);
        ctx.stroke();
        break;
      }
      case 'apron': {
        // Apron bib + waist-down skirt in the cloth colour + neck straps.
        ctx.fillStyle = color;
        ctx.fillRect(cx - 17, 30, 34, 40); // bib
        ctx.fillRect(cx - 26, 70, 52, 58); // waist-down skirt
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 14, 32);
          ctx.lineTo(cx + side * 24, 4);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 9, 46, 18, 14); // bib pocket
        break;
      }
      case 'vest': {
        // The open shirt V + closure buttons on the vest field.
        ctx.fillStyle = '#f1eee6';
        ctx.beginPath();
        ctx.moveTo(cx - 13, 8);
        ctx.lineTo(cx + 13, 8);
        ctx.lineTo(cx, 62);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        for (let y = 70; y <= 100; y += 15) {
          ctx.beginPath();
          ctx.arc(cx, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'uniform': {
        // A badge dot beside the placket.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(cx + 18, 28, 4.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'robe': {
        // The choir stole: two gold bands falling from the shoulders toward
        // a low centre meet — the read that says "robe", not "gown".
        ctx.strokeStyle = '#d4af5a';
        ctx.lineWidth = 9;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * 20, 0);
          ctx.lineTo(cx + side * 6, 96);
          ctx.stroke();
        }
        break;
      }
    }
  };

  // Field first (full canvas), then the centre-anchored chest detail.
  ctx.fillStyle = outfit === 'apron' ? '#efe8db' : color;
  ctx.fillRect(0, 0, size, size);
  if (outfit === 'uniform') {
    // The lighter chest stripe rides the full wrap.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, 40, size, 10);
  }
  detail(size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false; // canvas top → v = 0 → the collar
  staffTexCache.set(key, tex);
  return tex;
}

// ── Material caches (module scope, keyed — bounded by palette size) ─────────

// Default cloth colours when a figure carries no motif colour. Warm neutrals
// from the same family as the lab's palette fallbacks.
const DEFAULT_CLOTH: Record<OutfitKind, string> = {
  gown: '#efe6da',
  suit: '#41465a',
  barong: '#f3eddd', // near-white jusi — barong IGNORES motif colour by design
  filipiniana: '#e9d9c4',
  neutral: '#b9b2a6',
  // Booth staff (2026-07-08). Chef whites stay white whatever the motif (like
  // the barong — a lilac chef reads as a costume); the rest take a workwear
  // default a template can still recolour.
  chef_whites: '#f6f3ec',
  apron: '#b9673f', // warm terracotta canvas over a cream shirt
  vest: '#3a3f4d', // charcoal vest over a light shirt
  uniform: '#4f6b5e', // soft service green — the "branded staff polo"
  robe: '#6e3344', // deep choir burgundy under the gold stole (catalog row 18)
};

const outfitMats = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Cached shell material per (outfit, colour). Cloth shells get the shared
 * fabric weave bump (same texture instance the tablecloths use); the barong
 * swaps in its embroidery bump + a slight sheen (jusi/piña catches light in
 * a way cotton doesn't — lower roughness sells it at zero extra cost).
 * Key space is bounded (few outfits × a mood-board's few motif colours).
 */
export function outfitMaterial(outfit: OutfitKind, outfitColor: string | null): THREE.MeshStandardMaterial {
  // Barong stays near-white whatever the motif — recolouring it reads as a
  // polo, not a barong. Chef whites likewise (a lilac chef is a costume).
  const color =
    outfit === 'barong' || outfit === 'chef_whites'
      ? DEFAULT_CLOTH[outfit]
      : outfitColor ?? DEFAULT_CLOTH[outfit];
  const key = `${outfit}|${color}`;
  let m = outfitMats.get(key);
  if (!m) {
    m =
      outfit === 'barong'
        ? new THREE.MeshStandardMaterial({
            color,
            roughness: 0.42, // the slight sheen
            bumpMap: barongEmbroideryBump(),
            bumpScale: 0.01,
          })
        : isStaffOutfit(outfit)
          ? // Staff garments carry their colour IN the detail canvas (bib /
            // vest panels sit over a contrasting shirt), so the material base
            // stays white and the shared fabric bump keeps the cloth read.
            new THREE.MeshStandardMaterial({
              color: '#ffffff',
              map: staffGarmentTexture(outfit, color),
              roughness: 0.8,
              bumpMap: fabricBumpMap(),
              bumpScale: 0.005,
            })
          : new THREE.MeshStandardMaterial({
              color,
              roughness: 0.8,
              bumpMap: fabricBumpMap(),
              bumpScale: 0.005,
            });
    outfitMats.set(key, m);
  }
  return m;
}

const trouserMats = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Trouser/leg cloth for the non-skirted outfits: a darkened take on the
 * shell colour so a motif-coloured suit gets matching (not identical) legs.
 * Barong pairs with the traditional charcoal slacks regardless of motif.
 */
export function trouserMaterial(outfit: OutfitKind, outfitColor: string | null): THREE.MeshStandardMaterial {
  // Barong pairs with charcoal slacks; chef whites with checks-read charcoal
  // too (darkening white would give pale-grey trousers that vanish into the
  // jacket). Everything else darkens its own cloth.
  const base =
    outfit === 'barong' || outfit === 'chef_whites'
      ? '#2c2f36'
      : darken(outfitColor ?? DEFAULT_CLOTH[outfit], 0.55);
  let m = trouserMats.get(base);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85 });
    trouserMats.set(base, m);
  }
  return m;
}

/** Multiply a #rrggbb (or #rgb) hex toward black; non-hex input passes
 *  through untouched (a CSS named colour still renders, just undarkened). */
function darken(hex: string, k: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const raw = m[1]!;
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// (Removed 2026-07-10: `skinMaterial` + its cache — dead since the one-piece
// rebuild replaced skin/hair accents with a single shared body material.)

const mannequinMats = new Map<string, THREE.MeshStandardMaterial>();

/**
 * The one-piece blob's SATIN surface params — SINGLE SOURCE (2026-07-10
 * completeness audit). The individual figure (`mannequinMaterial` below) and
 * the instanced seated crowd (`instanced-seated-crowd.tsx`, an inline
 * `meshStandardMaterial`) MUST share these numbers or a neutral crowd figure
 * renders differently from an individual neutral figure — the pixel-identity
 * guarantee breaks. Both now read this constant, so they can't drift.
 * One-piece pass (2026-07-09): satin, not gloss — the old 0.18 gloss threw a
 * hard specular on every mesh-intersection crease and made the blob read as
 * plates; the reference model is a soft satin one-piece.
 */
export const MANNEQUIN_SURFACE = { roughness: 0.5, metalness: 0.02 } as const;

/** 2026-07-08 AVATAR PIVOT (owner blueprint): the figure is a blank
 *  mannequin — pure white #FFFFFF default, tintable via a flat colour so
 *  surfaces can re-skin it dynamically (mood-board tints, future theme maps).
 *  One cached material per tint. Satin surface from `MANNEQUIN_SURFACE`. */
export function mannequinMaterial(tint?: string | null): THREE.MeshStandardMaterial {
  const color = tint && /^#[0-9a-fA-F]{6}$/.test(tint) ? tint : '#ffffff';
  let m = mannequinMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, ...MANNEQUIN_SURFACE });
    mannequinMats.set(color, m);
  }
  return m;
}

const plainMats = new Map<string, THREE.MeshStandardMaterial>();

/** Cached plain standard material per colour — skin, hair, status accents.
 *  One roughness fits the kit's matte stylized look. */
export function plainMaterial(color: string): THREE.MeshStandardMaterial {
  let m = plainMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    plainMats.set(color, m);
  }
  return m;
}
