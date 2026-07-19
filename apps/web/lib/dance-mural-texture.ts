'use client';

/**
 * dance-mural-texture — the mood-board DANCE-FLOOR MURAL for the 3D seat-plan
 * surfaces (Fable dossier §3.7). Turns the couple's `events.role_palette` into
 * a painted CanvasTexture floor finish: a dark polished base washed by two
 * radial gobo blooms in the couple's accents, seeded terrazzo chips, and an
 * inlaid border ring — with the couple's CANONICAL monogram optionally
 * composited at centre (via svg-monogram-texture's one-true-path mark).
 *
 * PALETTE DERIVATION reuses the LED Background math (`ledPaletteFromMoodBoard`,
 * lib/site-palette.ts) verbatim — the mural is decor in the same family as the
 * LED wall, so the venue's stage wall and dance floor recolour from ONE
 * mapping: bg keeps the mural's dark tone tinted toward the couple's deepest
 * swatch, accent1 = their boldest swatch, accent2 = the next-distinct one.
 * A thin/absent palette falls back to the mural's own hardcoded template
 * triple (a neutral champagne-on-charcoal floor), so every room gets a floor.
 *
 * RASTERIZE ONCE — the texture is painted a single time per (palette,
 * monogram) pair and held in a MODULE cache (same lazy-singleton discipline as
 * `floorRoughnessMap`, scene-lighting.tsx): three surfaces (couple lab ·
 * homepage demo · public guest walk) share one GPU texture, and NOTHING here
 * runs per frame. Cached textures are intentionally never disposed — the cache
 * owns them for the page's lifetime, exactly like the shared floor maps. All
 * per-mural variation comes from `mulberry32(fnv1a(cacheKey))`, so the same
 * couple sees the same chips forever (no per-visit reshuffle).
 *
 * The monogram composite is ASYNC (an <img> SVG decode): the texture returns
 * immediately with the painted mural and flips `needsUpdate` once when the
 * mark lands — a starved frame simply shows the mural sans mark until then.
 * Free events get this STATIC mark; the paid ANIMATED_MONOGRAM bloom stays on
 * the lab's MonogramPlane, untouched (the monetization boundary).
 *
 * Module scope is DOM-free so the pure parts (`muralPalette`,
 * `muralCacheKey`, `monogramMuralKey`) unit-test under `tsx --test` (node);
 * only `danceMuralTexture` touches `document` and is browser-only.
 */

import * as THREE from 'three';
import { ledPaletteFromMoodBoard } from '@/lib/site-palette';
import { monogramSourceToDataUri } from '@/lib/svg-monogram-texture';
import { mulberry32 } from '@/lib/wax-seal/types';
import type { RolePalette } from '@/lib/mood-board';
import type { MonogramTextureSource } from '@/lib/seating-3d';

/**
 * The mural's own `[bg, accent1, accent2]` template triple — a dark polished
 * floor (so `ledPaletteFromMoodBoard` keeps a DARK base and tints it toward
 * the couple's deepest swatch) washed in champagne + dusty mulberry. Also the
 * verbatim fallback when the palette is too thin to derive from.
 */
export const DANCE_MURAL_TEMPLATE: readonly [string, string, string] = [
  '#232028', // bg — charcoal parquet
  '#c9a25e', // accent1 — champagne gobo
  '#8a5a74', // accent2 — dusty mulberry gobo
];

/**
 * Derive the mural's `[bg, accent1, accent2]` from the couple's Mood Board via
 * the LED-wall math, falling back to the hardcoded template triple. PURE.
 */
export function muralPalette(palette: RolePalette | null | undefined): [string, string, string] {
  return (
    ledPaletteFromMoodBoard(palette, DANCE_MURAL_TEMPLATE) ?? [
      DANCE_MURAL_TEMPLATE[0],
      DANCE_MURAL_TEMPLATE[1],
      DANCE_MURAL_TEMPLATE[2],
    ]
  );
}

/** FNV-1a 32-bit — same tiny stable hash the figure kit uses (figure-rig.ts). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Stable identity for the monogram half of the cache key. PURE.
 *   none        → 'none'
 *   bespoke svg → 'svg:<fnv1a of the svg text>'
 *   config      → 'cfg:<fnv1a of the config json>'
 */
export function monogramMuralKey(src: MonogramTextureSource | null | undefined): string {
  if (!src) return 'none';
  if (src.kind === 'svg') return `svg:${fnv1a(src.svg).toString(16)}`;
  return `cfg:${fnv1a(JSON.stringify(src.monogram)).toString(16)}`;
}

/**
 * The module-cache key: the derived hex triple (case-normalized) + the
 * monogram identity. Same palette + same mark → same key → one rasterization,
 * shared across all three 3D surfaces. PURE.
 */
export function muralCacheKey(
  triple: readonly [string, string, string],
  monogramKey: string,
): string {
  return `${triple.join('|').toLowerCase()}·${monogramKey}`;
}

/* ────────────────────────── painting (browser-only) ────────────────────────── */

function hexA(hex: string, a: number): string {
  const body = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())?.[1] ?? '232028';
  const n = parseInt(body, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paint the terrazzo/gobo-wash motif. The canvas starts fully transparent; the
 * rounded-rect clip leaves the corners transparent so `alphaTest` feathers the
 * mural into the venue floor instead of stamping a hard rectangle. Colours are
 * kept dim (the mesh renders `toneMapped:false`, like MonogramPlane, so the
 * paint IS the final read — projected light, not lit vinyl).
 */
function paintMural(ctx: CanvasRenderingContext2D, px: number, [bg, a1, a2]: readonly [string, string, string], seed: number): void {
  const rnd = mulberry32(seed);
  const corner = px * 0.06;

  ctx.clearRect(0, 0, px, px);
  ctx.save();
  roundedRectPath(ctx, 0, 0, px, px, corner);
  ctx.clip();

  // Base — the palette bg pulled toward black so the washes carry the colour.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(0, 0, px, px);

  // Gobo washes — two big accent blooms (offset, like moving-head spots left
  // idle) + a soft centre lift where the monogram sits. 'lighter' so the
  // washes ADD light onto the dark base.
  ctx.globalCompositeOperation = 'lighter';
  const wash = (cx: number, cy: number, r: number, hex: string, peak: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hexA(hex, peak));
    g.addColorStop(0.55, hexA(hex, peak * 0.35));
    g.addColorStop(1, hexA(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, px, px);
  };
  wash(px * (0.3 + rnd() * 0.08), px * (0.32 + rnd() * 0.08), px * 0.62, a1, 0.34);
  wash(px * (0.7 + rnd() * 0.08), px * (0.66 + rnd() * 0.08), px * 0.58, a2, 0.28);
  wash(px * 0.5, px * 0.5, px * 0.34, a1, 0.14); // centre lift under the mark

  // Terrazzo chips — small seeded shards in both accents + a pale fleck, low
  // alpha so they read as stone inclusions, not confetti.
  ctx.globalCompositeOperation = 'source-over';
  const chipColors = [hexA(a1, 0.16), hexA(a2, 0.14), 'rgba(235, 228, 214, 0.10)'];
  const chips = 150;
  for (let i = 0; i < chips; i++) {
    const cx = px * (0.03 + rnd() * 0.94);
    const cy = px * (0.03 + rnd() * 0.94);
    const r = px * (0.004 + rnd() * 0.011);
    const rot = rnd() * Math.PI * 2;
    const sides = 3 + Math.floor(rnd() * 3); // 3–5-sided shards
    ctx.fillStyle = chipColors[i % chipColors.length]!;
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const ang = rot + (s / sides) * Math.PI * 2;
      const rr = r * (0.7 + rnd() * 0.5);
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Inlaid border ring — a thin accent stroke just inside the edge, the
  // classic rented-dance-floor trim.
  ctx.strokeStyle = hexA(a1, 0.4);
  ctx.lineWidth = px * 0.008;
  roundedRectPath(ctx, px * 0.025, px * 0.025, px * 0.95, px * 0.95, corner * 0.7);
  ctx.stroke();

  // Edge vignette — darken toward the border so the floor reads dimensional.
  const vg = ctx.createRadialGradient(px / 2, px / 2, px * 0.35, px / 2, px / 2, px * 0.72);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, px, px);

  ctx.restore();
}

/* ───────────────────────── module cache (browser-only) ─────────────────────── */

const muralTexCache = new Map<string, THREE.CanvasTexture>();

/**
 * The mural texture for a couple's palette (+ optional centred monogram).
 * SYNCHRONOUS — the painted mural returns on first call and is served from the
 * module cache after that (never re-rasterized, never per frame). When a
 * monogram source is passed, the mark decodes asynchronously and is drawn onto
 * the SAME canvas once (contain-fit, centred, ~52% of the mural) with a single
 * `needsUpdate` flip. Callers must NOT dispose the returned texture — the
 * cache owns it (shared across surfaces), same as `floorRoughnessMap`.
 */
export function danceMuralTexture(
  palette: RolePalette | null | undefined,
  monogram: MonogramTextureSource | null = null,
  px = 1024,
): THREE.CanvasTexture {
  const triple = muralPalette(palette);
  const key = muralCacheKey(triple, monogramMuralKey(monogram));
  const hit = muralTexCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  paintMural(ctx, px, triple, fnv1a(key));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; // painted colours read true under sRGB output
  tex.anisotropy = 8; // crisp at the floor's grazing camera angle
  muralTexCache.set(key, tex);

  if (monogram) {
    // Async composite — same data-URI path as svgToMonogramTexture (a data URI
    // never taints the canvas). Failure is silent by design: the mural without
    // its mark is still a correct floor.
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || px;
      const ih = img.naturalHeight || px;
      const box = px * 0.52;
      const scale = Math.min(box / iw, box / ih);
      const w = iw * scale;
      const h = ih * scale;
      ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
      tex.needsUpdate = true;
    };
    img.src = monogramSourceToDataUri(monogram);
  }

  return tex;
}
