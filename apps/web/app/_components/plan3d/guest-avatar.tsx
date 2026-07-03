'use client';

/**
 * GuestPhotoAvatar — the shared "photo on the avatar's face" primitive for
 * every 3D seating surface (owner 2026-07-03, DECISION_LOG "photo avatars in
 * 3D"). Browsing a 3D room should be instant guest recognition: a billboarded
 * photo disc, ringed in a status colour, replaces the anonymous coloured token.
 * When no photo is available (or a load fails) it degrades to an initials
 * token so the room never shows a hole.
 *
 * PRIVACY: the ONLY sanctioned photo source is `guests.photo_url` (the guest's
 * own selfie / uploaded avatar), resolved to a display URL by the caller via
 * `displayUrlForStoredAsset`. This component NEVER touches face-enrollment /
 * biometric vectors (`guest_face_enrollments`, RA 10173, per-event scoped).
 *
 * Two call sites share it, each supplying its own ring colour:
 *   - the couple 3D lab (`seating-lab-3d.tsx`) — RSVP status colours
 *   - the homepage / phone 3D Plan demo (`plan3d-scene.tsx`) — SIDE_COLOR
 *
 * Textures load through a MODULE-LEVEL refcounted cache (see below) so a big
 * guest list shares one decode per URL, failures are cached (no retry storm),
 * and textures are disposed when the last avatar using them unmounts.
 *
 * Dependency-free beyond three / @react-three/fiber / @react-three/drei.
 */

import { useEffect, useMemo, useState } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level texture cache
//
// Keyed by URL. Each entry holds the loaded THREE.Texture (or `null` for a
// cached failure — we never re-fetch a URL that already errored), a refcount of
// live avatars using it, and the in-flight promise so concurrent mounts of the
// same URL share ONE network load. When an avatar unmounts we release its ref;
// when the count hits zero the texture is disposed and the entry dropped (a
// later remount simply reloads — cheap, and it keeps GPU memory bounded on long
// browsing sessions). Failure entries are kept (refcount irrelevant) so a
// broken URL stays a fast initials fallback for the life of the page.
// ─────────────────────────────────────────────────────────────────────────────

type CacheEntry = {
  texture: THREE.Texture | null; // null === load resolved to a failure
  failed: boolean;
  refcount: number;
  promise: Promise<THREE.Texture | null>;
};

const textureCache = new Map<string, CacheEntry>();

function loadTexture(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous'); // R2/Google-served selfies need CORS to paint in WebGL
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      () => resolve(null), // forbidden / 404 / no-CORS → cached failure, initials fallback
    );
  });
}

/** Acquire (or start) the cached load for `url`, incrementing its refcount. */
function acquireTexture(url: string): CacheEntry {
  let entry = textureCache.get(url);
  if (!entry) {
    entry = { texture: null, failed: false, refcount: 0, promise: Promise.resolve(null) };
    entry.promise = loadTexture(url).then((tex) => {
      // The entry may have been released before the load resolved; only keep the
      // texture if something still references it, else dispose immediately.
      entry!.texture = tex;
      entry!.failed = tex === null;
      if (tex && entry!.refcount <= 0) {
        tex.dispose();
        entry!.texture = null;
      }
      return entry!.texture;
    });
    textureCache.set(url, entry);
  }
  entry.refcount += 1;
  return entry;
}

/** Release one reference to `url`; dispose + drop the entry at zero (successes
 *  only — a cached failure entry is kept so we never re-fetch a broken URL). */
function releaseTexture(url: string): void {
  const entry = textureCache.get(url);
  if (!entry) return;
  entry.refcount -= 1;
  if (entry.refcount <= 0 && !entry.failed) {
    entry.texture?.dispose();
    textureCache.delete(url);
  }
}

/**
 * Warm the cache for a batch of URLs (e.g. the visible tables' guest photos)
 * WITHOUT holding a reference — the decode is shared with the avatars that
 * later mount, so the first frame paints photos instead of tokens. Safe to call
 * repeatedly; already-cached / in-flight URLs are skipped. `null`/empty ignored.
 */
export function preloadGuestPhotos(urls: (string | null | undefined)[]): void {
  for (const url of urls) {
    if (!url || textureCache.has(url)) continue;
    const entry: CacheEntry = { texture: null, failed: false, refcount: 0, promise: Promise.resolve(null) };
    entry.promise = loadTexture(url).then((tex) => {
      entry.texture = tex;
      entry.failed = tex === null;
      // No live ref yet — a preload keeps the successful texture parked in the
      // cache for the mounting avatar to adopt (its acquire bumps the refcount).
      return entry.texture;
    });
    textureCache.set(url, entry);
  }
}

/** React hook: resolve `url` to a cached THREE.Texture (or null on none/failure),
 *  managing the refcount across mount / url-change / unmount. */
function useCachedTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let alive = true;
    const entry = acquireTexture(url);
    if (entry.texture) {
      setTex(entry.texture);
    } else if (entry.failed) {
      setTex(null);
    } else {
      entry.promise.then((t) => {
        if (alive) setTex(t);
      });
    }
    return () => {
      alive = false;
      releaseTexture(url);
    };
  }, [url]);
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initials derivation — mirrors the 2D editor's `ChairAvatar`
// (`seating-editor.tsx`, backed by `guestInitials` in `lib/guests.ts`): first
// letter of the first two whitespace-separated name parts, uppercased; a single
// name falls back to its first two characters; empty → "?".
// ─────────────────────────────────────────────────────────────────────────────

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** Small module-level cache of initials → canvas texture, so a room full of
 *  photoless guests shares one decode per distinct initials pair. These are
 *  cheap and few (≤ a few dozen distinct pairs) so they live for the page. */
const initialsTextureCache = new Map<string, THREE.CanvasTexture>();

function initialsTexture(initials: string, color: string): THREE.CanvasTexture {
  const key = `${initials}|${color}`;
  const cached = initialsTextureCache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdfbf7'; // cream, matching the 2D ChairAvatar's text-cream
  ctx.font = `600 ${size * 0.42}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2 + size * 0.02);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  initialsTextureCache.set(key, tex);
  return tex;
}

export type GuestPhotoAvatarProps = {
  /** Resolved display URL of the guest's `photo_url` (see `displayUrlForStoredAsset`). */
  photoUrl?: string | null;
  /** Guest display name — drives the initials fallback. */
  name: string;
  /** Status ring / fallback-disc colour. Lab passes RSVP colours; demo SIDE_COLOR. */
  ringColor: string;
  /** Overall disc radius in world units. */
  radius?: number;
  /** Billboard height above the token's origin. */
  height?: number;
  /** Ring opacity (lab dims tentative guests). */
  opacity?: number;
};

/**
 * A camera-facing disc: the guest's photo (ringed in `ringColor`) when a photo
 * loads, otherwise a coloured disc with the guest's initials. Always billboards
 * to face the camera, so recognition holds from any orbit angle.
 */
export function GuestPhotoAvatar({
  photoUrl,
  name,
  ringColor,
  radius = 0.15,
  height = 1.04,
  opacity = 1,
}: GuestPhotoAvatarProps) {
  const tex = useCachedTexture(photoUrl);
  const initials = useMemo(() => initialsFromName(name), [name]);
  const fallbackTex = useMemo(
    () => (tex ? null : initialsTexture(initials, ringColor)),
    [tex, initials, ringColor],
  );

  // Cap segments — plenty round at this on-screen size, cheap on big lists.
  const ringR = radius * 1.13;

  return (
    <Billboard position={[0, height, 0]}>
      {/* status ring behind the disc */}
      <mesh position={[0, 0, -0.001]}>
        <circleGeometry args={[ringR, 24]} />
        <meshBasicMaterial color={ringColor} transparent opacity={opacity} />
      </mesh>
      {/* photo, or initials disc */}
      <mesh>
        <circleGeometry args={[radius, 24]} />
        <meshBasicMaterial
          map={tex ?? fallbackTex}
          transparent
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
