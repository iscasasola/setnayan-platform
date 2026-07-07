/**
 * kit/outfits — shared outfit-shell geometries + material caches for the 3D
 * figure kit. Module-scope THREE geometry/material instances are the lab's
 * own precedent (GOWN_GEO / SUIT_GEO in seating-lab-3d.tsx): R3F never
 * disposes module constants, so every figure on every surface shares ONE GPU
 * buffer per shell instead of allocating per mount.
 *
 * SILHOUETTE CONTRACT: gown + suit reuse the lab's exact proportions so a
 * guest reads the same from the 2D-adjacent lab and the new articulated kit
 * — the kit upgrades the rig, it must not re-proportion the wardrobe.
 *
 * The two Filipino-formalwear shells:
 *   · barong — suit-proportioned, near-white jusi cloth with a subtle
 *     VERTICAL-embroidery bump texture (the classic pechera stitching) and a
 *     slight sheen. Procedural CanvasTexture only (CSP: no fetched assets),
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

/** Gown: flares from a narrow bodice to a wide skirt — the LAB's proportions
 *  verbatim (seating-lab-3d.tsx GOWN_GEO) so silhouettes stay consistent. */
export const GOWN_GEO = new THREE.CylinderGeometry(0.08, 0.26, 0.56, 16);

/** Suit: a straighter tapered torso — the lab's SUIT_GEO verbatim. */
export const SUIT_GEO = new THREE.CylinderGeometry(0.13, 0.18, 0.5, 12);

/** Neutral: the plain token body (lab TOKEN_BODY_GEO proportions). */
export const NEUTRAL_GEO = new THREE.CylinderGeometry(0.13, 0.15, 0.4, 10);

/** Butterfly sleeve: a small sphere the renderer flattens via mesh scale
 *  (one shared buffer; the terno's signature peaks come from placement). */
export const SLEEVE_GEO = new THREE.SphereGeometry(0.085, 10, 8);

/** The shell geometry for an outfit. Barong wears the suit silhouette (it IS
 *  a suit-shaped garment — only cloth + texture differ); filipiniana wears
 *  the gown shell (sleeves are added by the renderer as separate meshes). */
export function outfitGeometry(outfit: OutfitKind): THREE.BufferGeometry {
  switch (outfit) {
    case 'gown':
    case 'filipiniana':
      return GOWN_GEO;
    case 'suit':
    case 'barong':
      return SUIT_GEO;
    case 'neutral':
      return NEUTRAL_GEO;
  }
}

/** True when the outfit is skirted — the renderer hides the THIGH meshes
 *  under the flared shell (the lab's gown figures never drew legs at all;
 *  the kit keeps shins so a walking gown still shows footfall). */
export function outfitIsSkirted(outfit: OutfitKind): boolean {
  return outfit === 'gown' || outfit === 'filipiniana';
}

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

// ── Material caches (module scope, keyed — bounded by palette size) ─────────

// Default cloth colours when a figure carries no motif colour. Warm neutrals
// from the same family as the lab's palette fallbacks.
const DEFAULT_CLOTH: Record<OutfitKind, string> = {
  gown: '#efe6da',
  suit: '#41465a',
  barong: '#f3eddd', // near-white jusi — barong IGNORES motif colour by design
  filipiniana: '#e9d9c4',
  neutral: '#b9b2a6',
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
  // polo, not a barong. (Surface this if a couple ever asks for tinted jusi.)
  const color = outfit === 'barong' ? DEFAULT_CLOTH.barong : outfitColor ?? DEFAULT_CLOTH[outfit];
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
  const base = outfit === 'barong' ? '#2c2f36' : darken(outfitColor ?? DEFAULT_CLOTH[outfit], 0.55);
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
