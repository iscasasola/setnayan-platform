/**
 * Save-the-Date Step-3 media choice (events.std_media · iteration 0024 · 2026-06-19).
 *
 * The couple's closing-beat media: their existing photo GALLERY (default), or an
 * uploaded VIDEO that plays as a locked real-time island in the film. An uploaded
 * video is NSFW-screened before it goes live (platform lock); `nsfw` tracks that
 * gate — only 'approved' videos play on the public page (enforced in PR-B).
 */

export type StdMediaType = 'gallery' | 'video';
export type StdNsfwStatus = 'pending' | 'approved' | 'rejected';

export type StdMedia = {
  type: StdMediaType;
  /** R2 ref of the uploaded video (kind === 'video'). */
  videoKey?: string | null;
  /**
   * R2 ref of the client-extracted poster frame (kind === 'video'). nsfwjs is
   * image-only and the lambda has no ffmpeg, so this single JPEG (grabbed in
   * the browser at upload time) is the video's NSFW screening proxy — exactly
   * how Papic clips screen via `poster_r2_key`. Absent → the screen can't run
   * and the video stays 'pending' (never goes live).
   */
  posterKey?: string | null;
  /** NSFW screening status of the uploaded video. */
  nsfw?: StdNsfwStatus;
  /**
   * How the video plays on the full-screen beat (owner 2026-06-21 "an option how
   * the video plays, fit to screen or fill"):
   *  • 'fill' (DEFAULT) — object-cover, edge-to-edge; a slight crop, never bars.
   *  • 'fit'  — object-contain (whole frame) over a blurred poster fill.
   */
  fit?: 'fill' | 'fit';
};

/** Parse + validate events.std_media → a safe StdMedia (falls back to gallery). */
export function resolveStdMedia(raw: unknown): StdMedia {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.type === 'video' && typeof o.videoKey === 'string' && o.videoKey) {
      const nsfw: StdNsfwStatus =
        o.nsfw === 'approved' || o.nsfw === 'rejected' ? o.nsfw : 'pending';
      const posterKey =
        typeof o.posterKey === 'string' && o.posterKey ? o.posterKey : null;
      // Default 'fill' so legacy rows (no fit key) keep filling the screen.
      const fit: 'fill' | 'fit' = o.fit === 'fit' ? 'fit' : 'fill';
      return { type: 'video', videoKey: o.videoKey, posterKey, nsfw, fit };
    }
  }
  return { type: 'gallery' };
}

/** Whether an uploaded video may play on the PUBLIC page (NSFW-approved). */
export function stdVideoIsLive(media: StdMedia): boolean {
  return media.type === 'video' && Boolean(media.videoKey) && media.nsfw === 'approved';
}
