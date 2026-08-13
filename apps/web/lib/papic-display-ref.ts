// Pure, dependency-free Papic media resolvers (no `server-only`, no imports) so
// this unit-tests under `tsx --test`, mirroring lib/papic-fullres-drop-core.ts.
//
// WHY TWO DISJOINT RESOLVERS: a Papic row's columns mean DIFFERENT things for a
// photo vs a clip, so one chained resolver would eventually feed an <img> an
// .mp4 or feed a <video> a still.
//   • display_r2_key — a real IMAGE for a photo, but a POSTER STILL for a clip
//     (papic-derivatives.ts sets displayKey = posterRef for clips).
//   • r2_object_key  — the photo bytes for a photo, but the playable VIDEO (.mp4)
//     for a clip.
//   • clip_web_r2_key — the small playable web-copy of a clip. OPTIONAL here: the
//     column does not exist until a later PR, so the resolver treats it as an
//     optional field and falls back to r2_object_key when it's absent.
// So we split by INTENT:
//   resolveStillRef → ALWAYS an image ref (<img>, OG image, thumbnails)
//   resolvePlayRef  → ALWAYS a video ref (<video>, reel playback input)
//
// DROP-SAFETY (presign-boundary hardening): once the 90-day sweep deletes OUR R2
// original it stamps `full_res_dropped_at` but LEAVES `r2_object_key` populated
// as a dead pointer (it stays the Drive-match / history key). A resolver must
// never hand that dead key to a presigner, so when `full_res_dropped_at` is set
// the raw `r2_object_key` is dropped from the fallback chain — the durable
// derivative wins, and `null` beats a guaranteed 404. Guard A refuses to drop a
// photo without a `display_r2_key`, so a legitimately-dropped photo always still
// resolves to a derivative here.

export type PapicDisplayRow = {
  /** papic_photos.photo_type — 'photo' | 'clip'. */
  photo_type?: string | null;
  /** papic_guest_captures.media_type — 'photo' | 'clip'. */
  media_type?: string | null;
  r2_object_key?: string | null;
  display_r2_key?: string | null;
  /** Wall-sized AVIF (long-edge 640). NULL on rows captured before 2026-08-13. */
  tile_r2_key?: string | null;
  thumb_r2_key?: string | null;
  poster_r2_key?: string | null;
  /** OPTIONAL — column added by a later PR; absent → play falls back to raw. */
  clip_web_r2_key?: string | null;
  full_res_dropped_at?: string | null;
};

/** A clip in EITHER capture table (papic_photos.photo_type / guest.media_type). */
export function isClipRow(row: PapicDisplayRow): boolean {
  return row.photo_type === 'clip' || row.media_type === 'clip';
}

/**
 * ALWAYS an image ref — for `<img>`, OG images, and thumbnails. Never a video.
 *
 *   photo: thumb_r2_key ?? display_r2_key ?? r2_object_key
 *   clip : thumb_r2_key ?? poster_r2_key            (never r2_object_key — a video)
 *
 * When the original is dropped, `r2_object_key` is excluded from the photo chain
 * (dead pointer). For a clip the raw is a video and is never in this chain at all.
 */
export function resolveStillRef(row: PapicDisplayRow): string | null {
  if (isClipRow(row)) {
    // A clip's still is a freeze-frame image; its raw r2_object_key is an MP4 and
    // must NEVER appear here (it would render as a broken <img>). display==poster
    // for clips, but the still chain is thumb ?? poster explicitly.
    return firstRef(row.thumb_r2_key, row.poster_r2_key);
  }
  const droppedRaw = row.full_res_dropped_at ? null : row.r2_object_key;
  return firstRef(row.thumb_r2_key, row.display_r2_key, droppedRaw);
}

/**
 * ALWAYS an image ref, at DISPLAY resolution — for tiles big enough that a
 * thumbnail visibly falls apart.
 *
 * 🔑 THE DIFFERENCE FROM `resolveStillRef` IS THE ORDER, AND IT IS THE WHOLE
 * POINT. That one prefers `thumb_r2_key`, which the pipeline builds at
 * **long-edge 320, AVIF q50** — see `papic-derivatives.ts`, whose own comment
 * says *"Grid tiles use thumb_r2_key (320px)"*. That is correct for the small
 * strips it was written for (a 4-across album peek ≈ 80 CSS px).
 *
 * It is NOT correct for a wall. Measured against the Alaala wall's real grid:
 *
 *     home    lg:grid-cols-6   tile ≈ 192 CSS px → 383 device px @2×
 *     library lg:grid-cols-6   tile ≈ 155 CSS px → 310 device px @2×
 *     phone      grid-cols-3   tile ≈ 105 CSS px → 314 device px @3×
 *
 * …and because the tiles are `aspect-square` with `object-cover`, a LANDSCAPE
 * thumb is scaled by its 240 px HEIGHT, not its 320 px width. So every
 * breakpoint upscaled **1.3×–1.6×** from a quality-50 source. The owner's words
 * were *"the photos are pixelated"* — and they were, on every screen size.
 *
 * ── AND `display_r2_key` WAS THE WRONG END OF THE SAME MISTAKE (2026-08-13) ──
 * It is long-edge **1280, q60** — the "lightbox / full view" copy — so it is
 * sharp, at **27× the bytes** of a thumb (measured in prod: 4 KB avg vs 96 KB
 * avg, max 780 KB). It is 3–4× larger than any tile actually renders.
 *
 * `tile_r2_key` (long-edge **640, q55**) is the size that fits: a 1.25×
 * downscale into the largest tile, at roughly a quarter of display's bytes.
 * It is preferred here, with display as the fallback — rows captured before
 * 2026-08-13 have no tile, and for them sharp-and-heavy beats soft.
 *
 *   photo: tile ?? display ?? thumb ?? r2_object_key (unless dropped)
 *   clip : tile ?? display ?? poster ?? thumb        (never the raw MP4)
 *
 * ⚠ Bigger bytes are still the deliberate trade against `resolveStillRef`.
 * Call this only for tiles a person looks AT; keep `resolveStillRef` for dense
 * peek strips and the venue-WiFi day-of grid.
 */
export function resolveLargeStillRef(row: PapicDisplayRow): string | null {
  if (isClipRow(row)) {
    // display === poster for clips (papic-derivatives.ts), but both are named
    // explicitly so a future divergence cannot silently fall through to thumb.
    // r2_object_key is an MP4 and must NEVER appear in an image chain.
    return firstRef(row.tile_r2_key, row.display_r2_key, row.poster_r2_key, row.thumb_r2_key);
  }
  // Same drop-safety as resolveStillRef: once the sweep replaces the original,
  // `r2_object_key` is a dead pointer and must never reach a presigner.
  const droppedRaw = row.full_res_dropped_at ? null : row.r2_object_key;
  return firstRef(row.tile_r2_key, row.display_r2_key, row.thumb_r2_key, droppedRaw);
}

/**
 * ALWAYS a video ref — for `<video>` and reel playback input. Never a still.
 *
 *   clip: clip_web_r2_key ?? r2_object_key
 *
 * When the raw is dropped, `r2_object_key` is excluded (dead pointer) — the small
 * web-copy is then the only playable forever-copy (and `null` beats a 404).
 */
export function resolvePlayRef(row: PapicDisplayRow): string | null {
  const droppedRaw = row.full_res_dropped_at ? null : row.r2_object_key;
  return firstRef(row.clip_web_r2_key, droppedRaw);
}

/**
 * POSTER-TRAP guard (Papic storage PR-1): a clip's web copy is a VIDEO and must
 * be stored under its own key — never equal to the poster/display still (an
 * image) or the raw original. If a bug ever wrote the poster's key as the web
 * copy, resolveStillRef (poster) and resolvePlayRef (web copy) would collide and
 * the later full-res drop could delete the still a play surface still points at.
 * So the capture path asserts distinctness BEFORE persisting clip_web_r2_key.
 *
 * Returns true only when `webKey` is a non-empty ref that differs from every one
 * of poster_r2_key / display_r2_key / r2_object_key present on the row.
 */
export function clipWebKeyDistinct(
  webKey: string | null | undefined,
  row: Pick<PapicDisplayRow, 'poster_r2_key' | 'display_r2_key' | 'r2_object_key'>,
): boolean {
  if (typeof webKey !== 'string') return false;
  const key = webKey.trim();
  if (key.length === 0) return false;
  for (const other of [row.poster_r2_key, row.display_r2_key, row.r2_object_key]) {
    if (typeof other === 'string' && other.trim() === key) return false;
  }
  return true;
}

/** First non-empty string among the candidates, else null. */
function firstRef(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return null;
}

const R2_SCHEME = 'r2://';

/**
 * The stable, streaming media-route PATH for a stored ref, so a crawler-cached
 * OG / social preview survives presign expiry — the route (app/papic/media)
 * STREAMS bytes rather than 302-ing to a soon-dead signed URL, which lets caches
 * hold it safely. Returns:
 *   • an `r2://bucket/key` ref → `/papic/media/{bucket}/{key}` (a relative path);
 *   • a legacy (non-`r2://`) value → passed through unchanged;
 *   • empty / null / malformed → null.
 * Callers that need an ABSOLUTE URL (e.g. the satori OG render) prefix their
 * origin. This mirrors the `r2://` parse in lib/uploads.ts + lib/r2.ts.
 */
export function stableMediaPath(ref: string | null | undefined): string | null {
  if (typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith(R2_SCHEME)) return trimmed; // legacy URL — passthrough
  const rest = trimmed.slice(R2_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null; // malformed r2:// ref
  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `/papic/media/${encodeURIComponent(bucket)}/${encodedKey}`;
}
