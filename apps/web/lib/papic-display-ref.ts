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
