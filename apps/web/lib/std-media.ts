/**
 * Save-the-Date Step-3 media choice (events.std_media · iteration 0024 · 2026-06-19).
 *
 * The couple's closing-beat media: their existing photo GALLERY (default), or an
 * uploaded VIDEO that plays as a locked real-time island in the film. An uploaded
 * video is NSFW-screened before it goes live (platform lock: "NSFW filter is on
 * by default and CANNOT be disabled").
 *
 * ── SEC-6 (2026-07-26): THE VERDICT NO LONGER LIVES IN THIS OBJECT ──────────
 * `std_media` is a HOST-WRITABLE column (it has to be — the couple picks their
 * own video). Postgres RLS is row-level, never column-level, and the Supabase
 * anon key is public, so a host could simply
 *
 *     PATCH /rest/v1/events?event_id=eq.<their-own-event>
 *     { "std_media": { "type":"video", "videoKey":"…", "nsfw":"approved" } }
 *
 * and publish an unscreened video to their public guest page. The server action
 * did refuse to accept a client verdict — but that refusal lived in the wrong
 * layer, and PostgREST is reachable without it.
 *
 * The verdict therefore moved OUT of this blob into `events.std_media_nsfw`, a
 * column withheld from `authenticated` + `anon` (migration 20271007493007) and
 * written only by the service-role screen. `StdMedia` below has NO `nsfw` field
 * on purpose: a forged one is not merely ignored, it is unrepresentable.
 *
 * ── AND THE VERDICT IS BOUND TO THE MEDIA IT WAS COMPUTED FOR ───────────────
 * Moving the column alone would not be enough. The obvious "preserve the old
 * verdict on UPDATE" trigger is WORSE than the bug: it PINS an `approved`
 * verdict onto a video that was swapped underneath it. So the verdict records
 * exactly WHICH bytes it judged — both R2 keys AND a content fingerprint of each
 * object — and anything that no longer matches is stale. A stale or absent
 * verdict is not "probably fine": it is NOT SHOWN.
 *
 * Key identity alone is also not enough. `/api/upload` hands the client a
 * 5-minute presigned PUT for a server-chosen key, so a host can re-PUT different
 * bytes to the SAME key seconds after the screen approved it. That is why the
 * fingerprint half exists and why the public read re-verifies it against R2
 * (`stdVideoIsServable`, lib/std-video-gate.ts).
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
   * and the video never goes live.
   */
  posterKey?: string | null;
  /**
   * How the video plays on the full-screen beat (owner 2026-06-21 "an option how
   * the video plays, fit to screen or fill"):
   *  • 'fill' (DEFAULT) — object-cover, edge-to-edge; a slight crop, never bars.
   *  • 'fit'  — object-contain (whole frame) over a blurred poster fill.
   */
  fit?: 'fill' | 'fit';
};

/**
 * The screening verdict — `events.std_media_nsfw`. Service-role written ONLY
 * (see the migration); a host holds no UPDATE/INSERT privilege on the column.
 *
 * Every field except `status` exists to BIND the verdict to the exact media it
 * was computed for. A verdict that can outlive its media is the actual defect.
 */
export type StdNsfwVerdict = {
  status: StdNsfwStatus;
  /** The video R2 ref this verdict authorises. */
  videoKey: string | null;
  /** The poster R2 ref that was actually classified (the screening proxy). */
  posterKey: string | null;
  /** `<etag>:<bytes>` of the object at videoKey at screen time. */
  videoFingerprint: string | null;
  /** `<etag>:<bytes>` of the object at posterKey at screen time. */
  posterFingerprint: string | null;
  /** When a decision was reached (null while never decided). */
  screenedAt: string | null;
  /**
   * When a screen was last ATTEMPTED — written even when the attempt fails, so
   * the opportunistic heal can throttle instead of re-running on every render.
   */
  attemptedAt: string | null;
};

/** The fail-closed default: no verdict at all. Never `approved`. */
export const NO_STD_NSFW_VERDICT: StdNsfwVerdict = {
  status: 'pending',
  videoKey: null,
  posterKey: null,
  videoFingerprint: null,
  posterFingerprint: null,
  screenedAt: null,
  attemptedAt: null,
};

/** Parse + validate events.std_media → a safe StdMedia (falls back to gallery). */
export function resolveStdMedia(raw: unknown): StdMedia {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.type === 'video' && typeof o.videoKey === 'string' && o.videoKey) {
      const posterKey =
        typeof o.posterKey === 'string' && o.posterKey ? o.posterKey : null;
      // Default 'fill' so legacy rows (no fit key) keep filling the screen.
      const fit: 'fill' | 'fit' = o.fit === 'fit' ? 'fit' : 'fill';
      // NOTE: any `nsfw` key on the incoming object is DROPPED, not read. It is
      // host-writable and therefore worthless as a verdict (SEC-6).
      return { type: 'video', videoKey: o.videoKey, posterKey, fit };
    }
  }
  return { type: 'gallery' };
}

const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v : null;

/**
 * Parse + validate events.std_media_nsfw → a safe verdict. Anything absent,
 * malformed, or unrecognised resolves to NO_STD_NSFW_VERDICT (fail CLOSED).
 */
export function resolveStdNsfwVerdict(raw: unknown): StdNsfwVerdict {
  if (!raw || typeof raw !== 'object') return NO_STD_NSFW_VERDICT;
  const o = raw as Record<string, unknown>;
  const status: StdNsfwStatus =
    o.status === 'approved' || o.status === 'rejected' ? o.status : 'pending';
  return {
    status,
    videoKey: nonEmpty(o.videoKey),
    posterKey: nonEmpty(o.posterKey),
    videoFingerprint: nonEmpty(o.videoFingerprint),
    posterFingerprint: nonEmpty(o.posterFingerprint),
    screenedAt: nonEmpty(o.screenedAt),
    attemptedAt: nonEmpty(o.attemptedAt),
  };
}

/**
 * Does this verdict describe THIS media? Both R2 refs must match exactly.
 *
 * This is the invalidation rule, expressed positively: swap the video, swap the
 * poster, or drop either one, and the verdict stops binding — no trigger, no
 * cleanup job, nothing to forget to run. A host who PATCHes `std_media` around
 * the server action invalidates their own approval by doing so.
 */
export function verdictBindsMedia(media: StdMedia, verdict: StdNsfwVerdict): boolean {
  if (media.type !== 'video') return false;
  const videoKey = nonEmpty(media.videoKey);
  const posterKey = nonEmpty(media.posterKey);
  if (!videoKey || !posterKey) return false; // no poster ⇒ nothing was screenable
  return verdict.videoKey === videoKey && verdict.posterKey === posterKey;
}

/**
 * THE gate — whether an uploaded video may play on the PUBLIC page.
 *
 * Requires an `approved` verdict that (a) binds to this exact media and (b)
 * carries both content fingerprints, so the caller can re-verify the bytes.
 * PURE and key-level only: a server caller that is about to SERVE the video must
 * additionally confirm the live R2 objects still match — use `stdVideoIsServable`
 * (lib/std-video-gate.ts), which calls this first.
 */
export function stdVideoIsLive(media: StdMedia, verdict: StdNsfwVerdict): boolean {
  if (verdict.status !== 'approved') return false;
  if (!verdictBindsMedia(media, verdict)) return false;
  return Boolean(verdict.videoFingerprint && verdict.posterFingerprint);
}

/**
 * Do the CURRENT R2 objects still hold the bytes the verdict judged?
 *
 * `live` fingerprints come from an R2 HEAD (`<etag>:<bytes>`). A missing or
 * unreadable fingerprint is a mismatch — never a pass.
 */
export function stdVerdictMatchesContent(
  verdict: StdNsfwVerdict,
  live: { video: string | null; poster: string | null },
): boolean {
  if (!verdict.videoFingerprint || !verdict.posterFingerprint) return false;
  if (!live.video || !live.poster) return false;
  return (
    verdict.videoFingerprint === live.video && verdict.posterFingerprint === live.poster
  );
}

/**
 * What the COUPLE is told about their own upload (the builder badge). A verdict
 * that no longer binds reads as 'pending' — because that is what it means: the
 * media changed, so it is being screened again.
 */
export function stdNsfwDisplayStatus(
  media: StdMedia,
  verdict: StdNsfwVerdict,
): StdNsfwStatus {
  if (!verdictBindsMedia(media, verdict)) return 'pending';
  return verdict.status;
}

/** How long before a failed / never-finished screen may be retried. */
export const STD_SCREEN_RETRY_MS = 10 * 60_000; // 10 min

/**
 * Should a screen be (re-)attempted for this media right now?
 *
 * True when the media is a screenable video whose verdict does not bind (or
 * binds but is still undecided), and no attempt has been made inside the
 * throttle window. Keeps the opportunistic heal from re-loading the 4.4 MB
 * nsfwjs model on every render while a screen that already failed sits there.
 */
export function stdVideoNeedsScreen(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  nowMs: number = Date.now(),
): boolean {
  if (media.type !== 'video') return false;
  if (!nonEmpty(media.videoKey) || !nonEmpty(media.posterKey)) return false;
  const bound = verdictBindsMedia(media, verdict);
  if (bound && verdict.status !== 'pending') return false; // already decided
  if (bound && verdict.attemptedAt) {
    const attempted = Date.parse(verdict.attemptedAt);
    if (Number.isFinite(attempted) && nowMs - attempted < STD_SCREEN_RETRY_MS) {
      return false;
    }
  }
  return true;
}
