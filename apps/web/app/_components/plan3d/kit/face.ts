/**
 * kit/face — simple drawn faces for the 3D figure kit: eyes + brows + a
 * gentle smile as a procedural CanvasTexture (3 variants), applied to the
 * head via a POLAR-CAPPED SPHERE SEGMENT — a partial-sphere patch sitting a
 * hair proud of the head's front (+Z) hemisphere, so the features curve with
 * the skull instead of billboarding. Same lazy-CanvasTexture discipline as
 * scene-lighting.tsx's fabricBumpMap (no assets, no fetch, browser-only
 * build, module-singleton cache).
 *
 * THE SELFIE PATH IS NOT HERE: when a figure has a `photoUrl`, the renderer
 * (kit/figure.tsx) mounts the EXISTING `GuestPhotoAvatar` billboard disc
 * (../guest-avatar.tsx — module-level refcounted texture cache, initials
 * fallback, consent-gated `guests.photo_url` only) in place of this decal.
 * This module deliberately knows nothing about photos so the privacy-audited
 * photo pipeline stays in exactly one file.
 *
 * VARIANT INDEX CONTRACT: `faceMaterial(v)` for v in 0..FACE_VARIANT_COUNT-1
 * (lib/figure-rig.ts resolveFigureLook hands out the index, hash-stable per
 * guest). Append variants, never reorder — bump FACE_VARIANT_COUNT together.
 */

import * as THREE from 'three';
import { FACE_VARIANT_COUNT } from '@/lib/figure-rig';

// ── The decal patch geometry (module scope — one shared buffer) ─────────────

/**
 * A front-hemisphere patch: sphere segment centred on +Z (three's sphere puts
 * φ = π/2 on +Z), spanning ~92° across and a mid band vertically (brow line
 * to chin), radius a shade over the 0.12 head so it drapes the face without
 * z-fighting. UVs of a partial sphere run 0..1 across the patch, so one
 * square face texture maps exactly onto it.
 */
export const FACE_GEO = new THREE.SphereGeometry(
  0.1225,
  16,
  12,
  Math.PI / 2 - 0.8,
  1.6,
  Math.PI * 0.3,
  Math.PI * 0.38,
);

// ── Face textures (lazy — needs `document`; built once per variant) ─────────

const INK = '#3a2a20'; // warm dark brown — reads softer than pure black

/** Draw one face variant onto a transparent 128px canvas. Canvas top maps to
 *  the patch top (flipY default), so brows/eyes live in the upper half. */
function drawFace(ctx: CanvasRenderingContext2D, size: number, variant: number): void {
  const s = size / 128; // author at 128, scale-proof
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';

  const eyeY = 52 * s;
  const eyeDX = 26 * s;
  const cx = 64 * s;

  if (variant === 1) {
    // Happy closed-arc eyes (the "beaming" face): two upside-down U strokes.
    ctx.lineWidth = 5 * s;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * eyeDX, eyeY + 3 * s, 8 * s, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    // Round eyes; variant 2 slightly smaller (a softer, wide-awake face).
    const r = (variant === 2 ? 5 : 6) * s;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * eyeDX, eyeY, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Brows — short strokes above the eyes; variant 2 lifts them a touch.
  ctx.lineWidth = 4 * s;
  const browY = (variant === 2 ? 34 : 38) * s;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * (eyeDX - 9 * s), browY + 2 * s);
    ctx.quadraticCurveTo(cx + side * eyeDX, browY - 3 * s, cx + side * (eyeDX + 9 * s), browY + 2 * s);
    ctx.stroke();
  }

  // A gentle smile — wider on variant 1, softest on variant 2.
  ctx.lineWidth = 5 * s;
  const smileR = (variant === 1 ? 20 : variant === 2 ? 14 : 17) * s;
  const smileY = 78 * s;
  ctx.beginPath();
  ctx.arc(cx, smileY, smileR, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

const faceTextures: (THREE.CanvasTexture | null)[] = Array(FACE_VARIANT_COUNT).fill(null);

/** The cached face texture for a variant (transparent background — only the
 *  features paint; the skin shows through the decal). */
export function faceTexture(variant: number): THREE.CanvasTexture {
  const v = Math.abs(Math.trunc(variant)) % FACE_VARIANT_COUNT;
  const cached = faceTextures[v];
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  drawFace(ctx, size, v);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceTextures[v] = tex;
  return tex;
}

const faceMats: (THREE.MeshBasicMaterial | null)[] = Array(FACE_VARIANT_COUNT).fill(null);

/**
 * Cached decal material per variant. Basic (unlit) + untone-mapped so the
 * drawn features stay crisp ink under any mood-board lighting — the same
 * choice the guest-avatar initials disc makes for legibility.
 */
export function faceMaterial(variant: number): THREE.MeshBasicMaterial {
  const v = Math.abs(Math.trunc(variant)) % FACE_VARIANT_COUNT;
  const cached = faceMats[v];
  if (cached) return cached;
  const m = new THREE.MeshBasicMaterial({
    map: faceTexture(v),
    transparent: true,
    toneMapped: false,
  });
  faceMats[v] = m;
  return m;
}
