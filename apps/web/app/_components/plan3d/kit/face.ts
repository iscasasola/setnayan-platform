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
  0.1325, // a shade over the 0.13 mascot head (2026-07-08 mascot-smooth pass)
  24,
  16,
  Math.PI / 2 - 0.9,
  1.8,
  Math.PI * 0.28,
  Math.PI * 0.42,
);

// ── Face textures (lazy — needs `document`; built once per variant) ─────────

const INK = '#3a2a20'; // warm dark brown — reads softer than pure black

/** Draw one face variant onto a transparent canvas — MASCOT-SMOOTH pass
 *  (owner-locked 2026-07-08, "mascot-smooth 3D style"): big friendly eyes
 *  with white sclera + warm iris + a catchlight, soft brows, a real smile
 *  and a whisper of blush. Canvas top maps to the patch top (flipY default),
 *  so brows/eyes live in the upper half. */
function drawFace(ctx: CanvasRenderingContext2D, size: number, variant: number): void {
  const s = size / 128; // author at 128, scale-proof
  ctx.lineCap = 'round';

  const eyeY = 52 * s;
  const eyeDX = 25 * s;
  const cx = 64 * s;

  if (variant === 1) {
    // Beaming: happy closed-arc eyes keep their charm — thicker, warmer.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7 * s;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * eyeDX, eyeY + 3 * s, 10 * s, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
  } else {
    // Big mascot eyes: sclera → iris → pupil catchlight, subtle upper lash.
    const rx = (variant === 2 ? 10 : 11) * s;
    const ry = (variant === 2 ? 12 : 13.5) * s;
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDX;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex + side * 1.5 * s, eyeY + 2 * s, rx * 0.58, ry * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex - 2.5 * s, eyeY - 2.5 * s, 2.6 * s, 3.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Upper lash line hugging the sclera — sells the "drawn character" read.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  // Brows — soft strokes above the eyes; variant 2 lifts them (bright-eyed).
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5 * s;
  const browY = (variant === 2 ? 28 : 32) * s;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * (eyeDX - 10 * s), browY + 2 * s);
    ctx.quadraticCurveTo(cx + side * eyeDX, browY - 4 * s, cx + side * (eyeDX + 10 * s), browY + 2 * s);
    ctx.stroke();
  }

  // Blush — a whisper of warmth under each eye (mascot appeal, kept subtle).
  ctx.fillStyle = 'rgba(217, 118, 99, 0.28)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * (eyeDX + 6 * s), eyeY + 20 * s, 9 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The smile — fuller than the old hairline arc; variant 1 beams widest.
  ctx.strokeStyle = '#7c4437';
  ctx.lineWidth = 6 * s;
  const smileR = (variant === 1 ? 21 : variant === 2 ? 15 : 18) * s;
  const smileY = 80 * s;
  ctx.beginPath();
  ctx.arc(cx, smileY, smileR, Math.PI * 0.22, Math.PI * 0.78);
  ctx.stroke();
}

const faceTextures: (THREE.CanvasTexture | null)[] = Array(FACE_VARIANT_COUNT).fill(null);

/** The cached face texture for a variant (transparent background — only the
 *  features paint; the skin shows through the decal). */
export function faceTexture(variant: number): THREE.CanvasTexture {
  const v = Math.abs(Math.trunc(variant)) % FACE_VARIANT_COUNT;
  const cached = faceTextures[v];
  if (cached) return cached;
  const size = 256; // mascot pass — crisp eyes at Play-mode close-ups
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
