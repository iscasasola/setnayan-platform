/**
 * reveal-textures — load + live-recolour the PBR maps for the rigid reveal 3D
 * scene (0024 §1a TRUE TEXTURE · PR3b). Client-only (uses Image/canvas/three).
 *
 * Each surface (paper · liner) is one map set made ONCE (scripts/build-reveal-
 * textures.mjs) and reused by every couple. The albedo is recoloured LIVE toward
 * the couple's Mood-Board role colour with a luminance-preserving Canvas `color`
 * blend (§2e: "blend, not tint" — fibre/grain survive), so only the colour
 * shifts. Normal + roughness are colour-agnostic and shared unchanged. ₱0 — no
 * per-couple asset, no shader. SRGB on albedo, LINEAR on normal/roughness.
 */

import * as THREE from 'three';

const BASE = '/reveal/textures';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Albedo recoloured toward `role` (luminance-preserving, low-opacity blend). */
async function recolouredAlbedo(url: string, role: THREE.Color): Promise<THREE.CanvasTexture> {
  const img = await loadImage(url);
  const S = img.naturalWidth || 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, S, S);
  ctx.globalCompositeOperation = 'color'; // keep base LUMINANCE, take role hue+sat
  ctx.globalAlpha = 0.22; // §2e whisper-subtle default
  ctx.fillStyle = `#${role.getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dataTexture(url: string): THREE.Texture {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.NoColorSpace; // linear data — never sRGB-decode normal/rough
  return t;
}

export type SurfaceMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

/** Load + recolour one surface's maps. Returns null on any failure (caller keeps
 *  the flat moodboard colour — the scene never breaks). */
export async function loadSurfaceMaps(
  surface: 'paper' | 'liner',
  role: THREE.Color,
  repeat = 1.6,
  anisotropy = 1,
): Promise<SurfaceMaps | null> {
  try {
    const map = await recolouredAlbedo(`${BASE}/${surface}/${surface}_albedo.webp`, role);
    const normalMap = dataTexture(`${BASE}/${surface}/${surface}_normal.webp`);
    const roughnessMap = dataTexture(`${BASE}/${surface}/${surface}_rough.webp`);
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = anisotropy;
    }
    return { map, normalMap, roughnessMap };
  } catch {
    return null;
  }
}
