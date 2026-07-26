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
 * (`stdVideoServeUrls`, lib/std-video-gate.ts).
 *
 * ── ROUND TWO (2026-07-26): SCREEN OBJECT A, SERVE OBJECT B ─────────────────
 * The first cut of the above shipped a fingerprint that was computed against a
 * DIFFERENT RESOURCE than the one the guest's browser fetched. Two parsers read
 * the same `videoKey` string:
 *
 *   • the verify side treated a bare (non-`r2://`) string as an object KEY in
 *     the public media bucket, HEADed it, and got a real etag+size;
 *   • the serve side treated the identical string as a legacy URL and emitted it
 *     VERBATIM into `<video src>`, where the browser resolved
 *     `http:/evil.example/v/x.mp4` to a foreign origin.
 *
 * So an attacker created a real R2 object whose KEY was URL-shaped, earned a
 * genuine `approved` verdict for it, and served arbitrary unscreened video. The
 * binding was real; it just bound the wrong thing.
 *
 * Two structural answers, both in this file:
 *
 *   1. **ONE PARSER.** `resolveStdMedia` now takes the eventId and requires
 *      every ref to be `r2://setnayan-media/events/{eventId}/std-video[-poster]/…`
 *      via `parseClientRef` — the same strict, total parser SEC-1 shipped. There
 *      is no longer a string that means "object" to one side and "URL" to the
 *      other, because there is no longer a lenient side. Anything else resolves
 *      to `{type:'gallery'}` — the media does not exist, so nothing screens it
 *      and nothing serves it.
 *
 *   2. **THE GUEST IS NEVER SERVED THE COUPLE'S OBJECT.** On approval the screen
 *      SEALS the classified bytes: a server-side R2 copy, conditioned on the
 *      source ETag, into `events/{id}/std-screened/…` — a prefix `/api/upload`
 *      refuses to presign (`R2_RESERVED_KEY_SEGMENTS`). The verdict records the
 *      sealed keys, and the public page is served only those. A re-PUT to the
 *      couple's upload key after approval now lands on an object no guest reads.
 *      Check-then-serve, the 24-hour presign TTL and the 60-second ISR window
 *      all stop mattering, because the object behind the URL cannot change.
 */

import { parseClientRef, stdSealedPolicy, stdVideoPosterPolicy, stdVideoSourcePolicy } from '@/lib/r2-client-ref';

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
  /**
   * The SEALED copy of the video — `events/{id}/std-screened/…`, written by the
   * service-role screen as a server-side R2 copy conditioned on
   * `videoFingerprint`'s ETag, into a prefix no client upload can name.
   *
   * THIS, not `videoKey`, is what the guest's browser fetches. The couple's own
   * upload key stays mutable (they hold a 5-minute presigned PUT and may re-PUT
   * to it); the sealed copy does not, so a post-approval byte swap has nowhere
   * to land that a guest reads. An `approved` verdict without sealed keys is
   * incomplete and does not serve.
   */
  servedVideoKey: string | null;
  /** The sealed copy of the poster frame — the bytes that were classified. */
  servedPosterKey: string | null;
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
  servedVideoKey: null,
  servedPosterKey: null,
  screenedAt: null,
  attemptedAt: null,
};

/**
 * Parse + validate events.std_media → a safe StdMedia (falls back to gallery).
 *
 * ── eventId IS REQUIRED, AND IT IS THE POINT ────────────────────────────────
 * Every caller — the public loader, the builder, the screen, the admin queue,
 * the admin override — resolves through THIS function, so requiring the id here
 * makes "which event's uploads may this row name?" a typecheck, not a habit.
 *
 * A ref must be `r2://setnayan-media/events/{eventId}/std-video/…` (video) or
 * `…/std-video-poster/…` (poster). That single rule closes, at one line each:
 *   • the URL-shaped decoy key (`http:/evil.example/…`) — not an `r2://` ref;
 *   • the foreign / unknown bucket — `parseClientRef` pins the bucket;
 *   • a poster masquerading as a video (and vice versa) — disjoint prefixes;
 *   • another couple's object — the eventId is IN the prefix;
 *   • path traversal, control characters, over-long keys — `parseClientRef`.
 *
 * Anything that fails is not "a video we distrust", it is NOT A VIDEO: the row
 * resolves to `{type:'gallery'}`, so the screen never runs for it and the serve
 * path never asks about it. Fail closed by making the hostile state
 * unrepresentable rather than by remembering to check for it downstream.
 *
 * Verified against prod before shipping: the one live video row is
 * `r2://setnayan-media/events/{its own id}/std-video/{uuid}-…mp4` with a poster
 * under `…/std-video-poster/` — it passes unchanged.
 */
export function resolveStdMedia(raw: unknown, eventId: string): StdMedia {
  if (!eventId) return { type: 'gallery' };
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.type === 'video' && parseClientRef(o.videoKey, stdVideoSourcePolicy(eventId))) {
      const posterKey = parseClientRef(o.posterKey, stdVideoPosterPolicy(eventId))
        ? (o.posterKey as string)
        : null;
      // Default 'fill' so legacy rows (no fit key) keep filling the screen.
      const fit: 'fill' | 'fit' = o.fit === 'fit' ? 'fit' : 'fill';
      // NOTE: any `nsfw` key on the incoming object is DROPPED, not read. It is
      // host-writable and therefore worthless as a verdict (SEC-6).
      return { type: 'video', videoKey: o.videoKey as string, posterKey, fit };
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
    servedVideoKey: nonEmpty(o.servedVideoKey),
    servedPosterKey: nonEmpty(o.servedPosterKey),
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
 * A convenience boolean over `stdVideoServeRefs` (below), which is the real
 * decision and which requires an `approved` verdict that
 *   (a) binds to this exact media (both source keys), AND
 *   (b) carries both content fingerprints, AND
 *   (c) names SEALED copies of both objects, each a well-formed ref under this
 *       event's `std-screened/` prefix.
 *
 * (c) is round two. Without it an `approved` verdict authorises the couple's own
 * mutable upload key; with it, an approval that never produced sealed bytes is
 * simply incomplete and does not serve. There is no "approved but unsealed"
 * state that shows anything to a guest.
 *
 * PURE. A server caller about to SERVE must additionally confirm the SEALED
 * objects still carry the recorded fingerprints — use `stdVideoServeUrls`
 * (lib/std-video-gate.ts), the ONE function allowed to emit a video URL.
 */
export function stdVideoIsLive(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): boolean {
  return stdVideoServeRefs(media, verdict, eventId) !== null;
}

/** What a guest is allowed to be served, and the fingerprints it must match. */
export type StdServeRefs = {
  /** Sealed video ref — `r2://setnayan-media/events/{id}/std-screened/…`. */
  videoRef: string;
  /** Sealed poster ref. */
  posterRef: string;
  /** `<etag>:<bytes>` the sealed video must still carry. */
  videoFingerprint: string;
  /** `<etag>:<bytes>` the sealed poster must still carry. */
  posterFingerprint: string;
};

/**
 * THE serve decision, pure and total: given the row, the verdict and the event,
 * WHICH objects — if any — may be handed to a guest, and what must they hash to?
 *
 * This is the single place the "screen object A, serve object B" divergence is
 * killed. It never returns the couple's `videoKey`. The only refs it can emit
 * are sealed ones, and a sealed ref is one the screen wrote after classifying
 * the bytes — so "an unscreened digest simply has no approved verdict" is
 * enforced by there being nothing else to return.
 *
 * Null on every unresolved case: not a video, not approved, verdict names other
 * media, missing fingerprint, missing seal, seal outside this event's screened
 * prefix, seal not an `r2://` ref at all.
 */
export function stdVideoServeRefs(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): StdServeRefs | null {
  if (!eventId) return null;
  if (verdict.status !== 'approved') return null;
  if (!verdictBindsMedia(media, verdict)) return null;
  const { videoFingerprint, posterFingerprint, servedVideoKey, servedPosterKey } = verdict;
  if (!videoFingerprint || !posterFingerprint) return null;
  if (!servedVideoKey || !servedPosterKey) return null;
  // The seals came out of a service-role-only column, so this is belt-and-braces
  // — but it is the same parser the write side used, and an operator paste or a
  // future writer bug should fail closed rather than presign an arbitrary key.
  const sealed = stdSealedPolicy(eventId);
  if (!parseClientRef(servedVideoKey, sealed)) return null;
  if (!parseClientRef(servedPosterKey, sealed)) return null;
  // A single object may not stand in for both roles.
  if (servedVideoKey === servedPosterKey) return null;
  return {
    videoRef: servedVideoKey,
    posterRef: servedPosterKey,
    videoFingerprint,
    posterFingerprint,
  };
}

/**
 * Do the SEALED objects still hold the bytes the verdict judged?
 *
 * `live` fingerprints come from an R2 HEAD of the sealed keys (`<etag>:<bytes>`).
 * A missing or unreadable fingerprint is a mismatch — never a pass.
 *
 * With sealing in place this can only fail through an out-of-band act (an
 * operator deleting or replacing the object in the R2 dashboard), because no
 * application path can write a sealed key. It is kept precisely so that case is
 * a refusal instead of an assumption.
 */
export function stdVerdictMatchesContent(
  refs: StdServeRefs,
  live: { video: string | null; poster: string | null },
): boolean {
  if (!live.video || !live.poster) return false;
  return refs.videoFingerprint === live.video && refs.posterFingerprint === live.poster;
}

/**
 * What the COUPLE is told about their own upload (the builder badge). A verdict
 * that no longer binds reads as 'pending' — because that is what it means: the
 * media changed, so it is being screened again.
 */
export function stdNsfwDisplayStatus(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): StdNsfwStatus {
  if (!verdictBindsMedia(media, verdict)) return 'pending';
  // An `approved` verdict that produced no sealed copy shows nothing to a guest
  // (stdVideoServeRefs returns null), so telling the couple "approved" would be
  // a lie and would hide the row from the admin queue, which filters on this.
  // It reads as 'pending' — which is the truth: it still needs a screen.
  if (verdict.status === 'approved' && !stdVideoServeRefs(media, verdict, eventId)) {
    return 'pending';
  }
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
  eventId: string,
  nowMs: number = Date.now(),
): boolean {
  if (media.type !== 'video') return false;
  if (!nonEmpty(media.videoKey) || !nonEmpty(media.posterKey)) return false;
  const bound = verdictBindsMedia(media, verdict);
  // 'approved' with no usable seal is NOT decided — the copy step failed (or the
  // row predates sealing). Re-screening is the recovery path, and it is what
  // stops a row from going permanently dark AND invisible.
  const decided =
    verdict.status === 'rejected' ||
    (verdict.status === 'approved' && stdVideoServeRefs(media, verdict, eventId) !== null);
  if (bound && decided) return false; // already decided
  if (bound && verdict.attemptedAt) {
    const attempted = Date.parse(verdict.attemptedAt);
    if (Number.isFinite(attempted) && nowMs - attempted < STD_SCREEN_RETRY_MS) {
      return false;
    }
  }
  return true;
}
