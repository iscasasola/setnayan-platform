'use client';

/**
 * svg-monogram-texture — turn the couple's CANONICAL monogram mark into a
 * THREE.CanvasTexture for WebGL surfaces. First consumer: the 3D seating lab's
 * floor medallion (animated-logo surface rollout, owner 2026-06-22). Built as a
 * shared util so the Live Wall + Recap 3D/render surfaces can inherit the same
 * one-true-path mark later.
 *
 * It composes the couple's CANONICAL mark the same way the QR centers / hero /
 * save-the-date do — `monogramOverlaySvg` (a self-contained cream-plate +
 * accent-ring + initials/lockup badge) — so the 3D scene never grows a second
 * monogram render ladder. Because that badge carries its own contrast, the mark
 * reads on ANY floor hue without surface-luminance branching.
 *
 * Face fidelity: the BESPOKE/uploaded SVG renders pixel-exact. The LETTERED
 * lockup/initials use the couple's chosen FACE only as far as an isolated <img>
 * rasterization allows — next/font web fonts (loaded behind CSS vars) aren't
 * available there, so the typeface degrades to its category-correct SYSTEM
 * fallback (serif vs script). Pixel-exact lettered parity would need an inlined
 * base64 @font-face — a deliberate followup (and the seam the Live Wall / Recap
 * reuse will want too).
 *
 * Client-only: uses Image + <canvas> + WebGL, none of which exist during SSR.
 * Never import this from a server path.
 */

import * as THREE from 'three';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { monogramOverlaySvg } from '@/lib/monogram';
import type { MonogramTextureSource } from '@/lib/seating-3d';

export type { MonogramTextureSource };

const VIEWBOX = 512;

/**
 * Drop `var(--…)` tokens from a font-family stack. The couple's chosen face is a
 * next/font web font exposed only as a hashed @font-face behind a CSS var
 * (`var(--font-display), 'Cormorant Garamond', Georgia, serif`). Inside a
 * standalone <img> SVG rasterization that var is UNDEFINED, and a bare
 * unresolved leading var() is invalid-at-computed-value → it poisons the WHOLE
 * font-family (the named + generic tail is discarded → UA default). Stripping
 * the var() leaves the stack's VALID named → generic tail, which rasterizes
 * category-correct (serif faces → Georgia/serif, script faces → Snell Roundhand/
 * cursive) using system fonts. Returns undefined when nothing remains, so
 * monogramOverlaySvg falls to its own (var-free) default. */
function stripFontVars(ff: string | undefined): string | undefined {
  if (!ff) return ff;
  const cleaned = ff
    .replace(/var\([^)]*\)\s*,?\s*/g, '')
    .replace(/^[\s,]+/, '')
    .trim();
  return cleaned || undefined;
}

/**
 * The mark as a same-origin SVG data-URI (safe to draw into a canvas — a data
 * URI never taints, so the resulting CanvasTexture is readable).
 */
export function monogramSourceToDataUri(src: MonogramTextureSource): string {
  if (src.kind === 'svg') return bespokeSvgToDataUri(src.svg);
  // monogramOverlaySvg returns FRAGMENT children (it's normally injected into a
  // QR's <svg>), so wrap it in a full document for an <img>. Strip the CSS-var
  // font tokens so the chosen face degrades to its category-correct system
  // fallback during rasterization (see stripFontVars). NO blanket <style>
  // override — that would flatten every couple's face to one family.
  const monogram = { ...src.monogram, fontFamily: stripFontVars(src.monogram.fontFamily) };
  const inner = monogramOverlaySvg({ viewBoxSize: VIEWBOX, monogram });
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">` +
    inner +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Rasterize the mark to a transparent square CanvasTexture. Resolves `null` on
 * ANY failure (bad/missing SVG, decode error) so the 3D scene never breaks — the
 * caller renders the surface only when this is non-null. The drawImage is
 * contain-fit (centered, aspect-preserved) so a non-square bespoke SVG never
 * distorts; the square overlay badge fills exactly.
 *
 * Caller owns disposal: this creates a GPU texture that R3F does NOT auto-dispose
 * (it wasn't declared in JSX), so the consumer must `.dispose()` it on unmount /
 * when the source changes.
 */
export async function svgToMonogramTexture(
  src: MonogramTextureSource,
  px = 1024,
): Promise<THREE.CanvasTexture | null> {
  try {
    const img = await loadImage(monogramSourceToDataUri(src));
    const cv = document.createElement('canvas');
    cv.width = px;
    cv.height = px;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, px, px); // transparent — only the mark's pixels show
    const iw = img.naturalWidth || px;
    const ih = img.naturalHeight || px;
    const scale = Math.min(px / iw, px / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; // composite true under the scene's sRGB output
    tex.anisotropy = 8; // crisp at the floor's grazing camera angle
    return tex;
  } catch {
    return null;
  }
}
