/**
 * Booth poster — the vendor's own design for ONE couple's event, rendered on
 * their 3D booth beside the account-level logo (vendor_profiles.logo_url).
 *
 * WHY A FIXED PORTRAIT ASPECT (owner 2026-07-21): the poster renders on a booth
 * BACK WALL, which is narrow — portrait reads correctly there and matches the
 * pull-up-banner format PH vendors already design for. Fixing the aspect also
 * fixes the render geometry: one plane mesh, no per-vendor aspect maths, no
 * letterboxing a vendor never sees in context.
 *
 * ENFORCE, don't letterbox. A rejected upload with a clear message beats a
 * silently letterboxed poster — the vendor can fix their artwork; they cannot
 * fix a crop they never saw.
 *
 * Pure helpers here so the rule is unit-testable; the DOM-dependent probe lives
 * in validatePosterFile (browser only, used as FileUpload's `validateFile`).
 */

/** 2:3 portrait — width / height. */
export const POSTER_ASPECT = 2 / 3;

/** The master upload size vendors design against (power-of-two friendly for mipmaps). */
export const POSTER_MASTER_W = 1024;
export const POSTER_MASTER_H = 1536;

/**
 * Mobile derivative. The guest walk is phone-first (scan QR, walk the room) and
 * a 1024x1536 texture is ~6 MB uncompressed in GPU memory — ten branded booths
 * is ~60 MB on top of the room, the crowd and the figure atlases. Serve this to
 * mobile instead.
 */
export const POSTER_MOBILE_W = 512;
export const POSTER_MOBILE_H = 768;

/** Max upload weight. Posters are flat artwork; 500 KB is generous at 1024x1536. */
export const POSTER_MAX_MB = 0.5;

export const POSTER_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * How far from a true 2:3 we still accept. A designer exporting 1000x1500 or
 * 1080x1620 should sail through; 4:3 or square must not. 2% covers rounding in
 * every common export pipeline without admitting a different shape.
 */
export const POSTER_ASPECT_TOLERANCE = 0.02;

/** Human-readable target, for help text and error copy. */
export const POSTER_DIMENSION_LABEL = `${POSTER_MASTER_W} x ${POSTER_MASTER_H}`;

/**
 * The aspect rule, pure. Returns an error string to reject, or null to accept.
 * Exported separately from the File probe so it can be unit-tested without a DOM.
 */
export function posterAspectError(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    // Unreadable dimensions — fail OPEN. Validators gate content rules; they
    // must never brick the upload path (the FileUpload contract).
    return null;
  }
  const ratio = width / height;
  const drift = Math.abs(ratio - POSTER_ASPECT) / POSTER_ASPECT;
  if (drift <= POSTER_ASPECT_TOLERANCE) return null;
  return `Posters must be 2:3 portrait (like ${POSTER_DIMENSION_LABEL}). This image is ${width}x${height}.`;
}

/** Smallest master we accept — below this the poster is visibly soft on the booth wall. */
export const POSTER_MIN_W = 512;

export function posterSizeError(width: number, height: number): string | null {
  if (!Number.isFinite(width) || width <= 0) return null; // fail open
  if (width < POSTER_MIN_W) {
    return `Poster is too small — use at least ${POSTER_DIMENSION_LABEL} so it stays sharp on the booth.`;
  }
  return null;
}

/**
 * Read an image File's intrinsic dimensions. Browser only. Resolves to null
 * when the file can't be decoded, so callers fail open.
 */
export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * FileUpload `validateFile` for the booth poster: aspect first (the rule that
 * protects the render), then a minimum-size floor. Fail-open throughout — an
 * undecodable file is left to the upload path's own MIME/size checks.
 */
export async function validatePosterFile(file: File): Promise<string | null> {
  const dims = await readImageDimensions(file);
  if (!dims) return null;
  return posterAspectError(dims.width, dims.height) ?? posterSizeError(dims.width, dims.height);
}
