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
 *
 * ── ROUND THREE (2026-07-26): IDENTITY IS NOT PROVENANCE ────────────────────
 * Round two was still the same defect in different clothes. Both earlier cuts
 * shipped a verdict that authorised a served artifact on the strength of
 * evidence gathered about a DIFFERENT artifact:
 *
 *   • round one — evidence was a HEAD of an R2 decoy; the browser fetched a
 *     foreign origin;
 *   • round two — evidence was a classification of a JPEG; the browser fetched
 *     the MP4 sitting next to it. `posterKey` arrives from the client with no
 *     derivation proof, so "upload a dirty video with a clean, unrelated
 *     poster" produced an approval that was bound, sealed, and wrong.
 *
 * Sealing fixed IDENTITY (is the served object still the object we froze?) and
 * left PROVENANCE (was the served object ever examined at all?) untouched.
 * Identity without provenance is a notarised signature on a blank page.
 *
 * THE RULE, stated once and enforced structurally:
 *
 *     An artifact may be served only if THAT ARTIFACT'S OWN BYTES were examined
 *     by an examiner competent to judge them. Anything else may only REJECT.
 *
 * It is monotone on purpose. Rejection is safe from any evidence — a dirty
 * poster is reason enough to refuse the video beside it. Approval is not.
 *
 * So the verdict no longer carries one status over two objects. It carries a
 * per-artifact `StdExamination` naming the SEALED ref, its fingerprint, and WHO
 * examined those bytes — and `COMPETENT_EXAMINERS` (below) decides which
 * examiners may authorise which role. An image classifier is competent for the
 * JPEG it read and for nothing else, so there is no value the poster screen can
 * write that authorises a video. The divergence is unrepresentable rather than
 * checked for.
 */

import { parseClientRef, stdSealedPolicy, stdVideoPosterPolicy, stdVideoSourcePolicy } from '@/lib/r2-client-ref';

export type StdMediaType = 'gallery' | 'video';

/**
 * Where a couple's video sits in the screening pipeline.
 *
 *  • `pending`   — never screened, or the media changed and it needs one again.
 *  • `in_review` — the poster passed the automatic screen and both objects are
 *                  SEALED, but nothing has examined the video's own bytes yet,
 *                  so it does NOT play. Waiting on a human in the Reveal Studio.
 *  • `approved`  — every artifact a guest receives has been examined. Plays.
 *  • `rejected`  — refused. Never plays.
 */
export type StdNsfwStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

/**
 * WHO looked at a specific artifact's bytes.
 *
 *  • `nsfwjs-image`  — the automatic classifier DOWNLOADED those bytes and ran
 *                      nsfwjs over them. Image-only: it can judge a JPEG.
 *  • `human-review`  — an admin streamed that exact SEALED object in the Reveal
 *                      Studio player and pressed Approve against its fingerprint.
 *
 * When server-side frame extraction lands it joins this union as
 * `'frame-extract'` and is added to `COMPETENT_EXAMINERS.video` — one line, same
 * rule, and the human gate can come back off.
 *
 *  • `legacy-poster-screen` — ⚠ NOT AN EXAMINATION OF THE VIDEO. The name is the
 *                      warning. It records that a row was serving on the strength
 *                      of the pre-SEC-6 poster-only screen when this release
 *                      landed, and was carried across rather than taken off the
 *                      air. It authorises a video ONLY on a row that carries the
 *                      service-role `grandfathered` marker (see
 *                      `GRANDFATHERED_VIDEO_EXAMINERS`), which one migration
 *                      wrote for one row. Nothing can mint another.
 */
export type StdExaminer = 'nsfwjs-image' | 'human-review' | 'legacy-poster-screen';

/**
 * WHICH examiners may authorise WHICH artifact. This table is the round-three
 * fix in four lines.
 *
 * An image classifier reads a JPEG. That makes it competent to judge the JPEG it
 * read — the poster is itself served to guests, so for the poster the examined
 * bytes and the served bytes are the same object. It says NOTHING about a video
 * file that merely sits next to that JPEG in the same row, which is why
 * `nsfwjs-image` is absent from the `video` set: a poster-derived approval of a
 * video is not a weak signal to be weighed, it is not evidence about the video
 * at all.
 *
 * A human who streamed the sealed object examined the served bytes by
 * definition, so `human-review` is competent for both.
 */
export const COMPETENT_EXAMINERS: Readonly<
  Record<'video' | 'poster', ReadonlySet<StdExaminer>>
> = {
  poster: new Set<StdExaminer>(['nsfwjs-image', 'human-review']),
  video: new Set<StdExaminer>(['human-review']),
};

/**
 * ⚠ THE ONE DELIBERATE EXCEPTION, AND ITS FENCE.
 *
 * When this release lands, exactly one production row is already serving a video
 * on the strength of the defect being fixed — a poster-only screen whose verdict
 * lived in the host-writable blob. Enforcing the new rule with no transition
 * would take a real couple's live Save-the-Date page down to their photo gallery
 * for the sake of a rule they did not break.
 *
 * So the row is carried across as `approved`, and the thing that carried it is
 * NAMED: `legacy-poster-screen`. It is deliberately absent from
 * `COMPETENT_EXAMINERS.video` above — the general model still says an image
 * classifier cannot authorise a video, and that stays true. This set is consulted
 * ONLY for a verdict that carries the `grandfathered` marker.
 *
 * That marker is the fence, and it is a real one:
 *   • `events.std_media_nsfw` is withheld from `authenticated` + `anon` by both a
 *     column REVOKE and a guard trigger, so no host can write a marker.
 *   • The only writer that ever emits one is a single migration, `WHERE
 *     event_id = <one uuid>`. The screen carries an existing marker forward; it
 *     cannot create one.
 *   • The marker is a column a human can grep for (`std_media_nsfw ? 'grandfathered'`),
 *     the Reveal Studio lists the row as needing re-review even though it is
 *     serving, and a real `human-review` approval REPLACES the examination and
 *     DROPS the marker.
 *
 * It is therefore a decaying exception with a visible expiry, not a hole. When
 * the last marker is gone, delete this set and the `'legacy-poster-screen'` arm
 * of `StdExaminer`; nothing else references them.
 */
export const GRANDFATHERED_VIDEO_EXAMINERS: ReadonlySet<StdExaminer> = new Set<StdExaminer>([
  'legacy-poster-screen',
]);

/**
 * The record that ONE artifact's own bytes were examined.
 *
 * `ref` is the SEALED object — precisely what the browser will fetch. Not the
 * couple's mutable upload key, not a sibling, not a proxy. If an examination
 * cannot name the served object, it cannot authorise it.
 */
export type StdExamination = {
  /** Sealed `r2://…/std-screened/…` ref — the object a guest receives. */
  ref: string;
  /** `<etag>:<bytes>` that object must still carry at serve time. */
  fingerprint: string;
  /**
   * SHA-256 of the examined bytes, when the examiner actually HELD them (the
   * poster screen downloads its JPEG, so it can hash it). Null when the examiner
   * streamed rather than buffered — a human watching a 200 MB clip.
   *
   * Recorded because `fingerprint`'s ETag is documented to be the body MD5 for a
   * single PUT (lib/r2.ts), and MD5 is not collision-resistant. Where we hold
   * the bytes we should not be relying on MD5, so we do not.
   */
  digest: string | null;
  /** WHO examined these bytes. */
  by: StdExaminer;
  /** When. */
  at: string;
};

/**
 * The pair of SEALED objects the screen produced for one media choice. Frozen
 * copies awaiting (or carrying) examination — see `StdNsfwVerdict.sealed`.
 */
export type StdSealedPair = {
  /** Sealed copy of the couple's video. */
  videoRef: string;
  /** `<etag>:<bytes>` the sealed video must still carry. */
  videoFingerprint: string;
  /** Sealed copy of the couple's poster frame. */
  posterRef: string;
  /** `<etag>:<bytes>` the sealed poster must still carry. */
  posterFingerprint: string;
};

/**
 * The marker that one row predates the examination rule and was carried across
 * rather than taken off the air. Purely descriptive — it grants nothing on its
 * own; it only unlocks `GRANDFATHERED_VIDEO_EXAMINERS` for the examination that
 * sits beside it.
 */
export type StdGrandfather = {
  /** Free-text provenance, e.g. 'pre-SEC-6 poster-only screen (std_media.nsfw)'. */
  reason: string;
  /** When the cutover migration recorded it. */
  at: string;
};

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
  /** The couple's video R2 ref this verdict is ABOUT (the invalidation key). */
  videoKey: string | null;
  /** The couple's poster R2 ref this verdict is ABOUT. */
  posterKey: string | null;
  /** `<etag>:<bytes>` of the object at videoKey when it was sealed. */
  videoFingerprint: string | null;
  /** `<etag>:<bytes>` of the object at posterKey when it was sealed. */
  posterFingerprint: string | null;
  /**
   * The SEALED candidate artifacts — immutable copies of the couple's two
   * objects, written by the service-role screen into `events/{id}/std-screened/`
   * (a prefix `/api/upload` refuses to presign).
   *
   * These are the CANDIDATES, not the authorisation. Sealing freezes an object
   * so that "the bytes examined" and "the bytes served" cannot drift apart; it
   * says nothing about whether anyone examined them. That is what `video` and
   * `poster` below are for, and it is the distinction round two collapsed.
   *
   * The reviewer's player streams `videoRef` — so a human approval is, by
   * construction, an examination of the exact object a guest will fetch.
   */
  sealed: StdSealedPair | null;
  /**
   * Proof that the SEALED VIDEO's own bytes were examined — the only thing that
   * can authorise streaming it.
   *
   * Null until a competent examiner has looked. The automatic screen CANNOT
   * fill this in: it reads the poster, and `COMPETENT_EXAMINERS.video` does not
   * include `nsfwjs-image`. Today only `human-review` can, which is why a clean
   * poster parks the row at `in_review` instead of publishing it.
   */
  video: StdExamination | null;
  /**
   * Proof that the SEALED POSTER's own bytes were examined. The automatic screen
   * fills this in, legitimately: it downloads that JPEG and classifies it, so
   * for the poster the examined bytes and the served bytes are one object.
   */
  poster: StdExamination | null;
  /**
   * ⚠ Present ONLY on a row carried across the SEC-6 cutover (see
   * `GRANDFATHERED_VIDEO_EXAMINERS`). Service-role written; one migration wrote
   * it for one event. Its presence is what lets a `legacy-poster-screen`
   * examination authorise a video, and its presence is also what keeps the row
   * in the admin re-review queue. A real `human-review` approval clears it.
   */
  grandfathered: StdGrandfather | null;
  /** When a terminal decision was reached (null while undecided). */
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
  sealed: null,
  video: null,
  poster: null,
  grandfathered: null,
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
    o.status === 'approved' || o.status === 'rejected' || o.status === 'in_review'
      ? o.status
      : 'pending';
  return {
    status,
    videoKey: nonEmpty(o.videoKey),
    posterKey: nonEmpty(o.posterKey),
    videoFingerprint: nonEmpty(o.videoFingerprint),
    posterFingerprint: nonEmpty(o.posterFingerprint),
    sealed: resolveSealedPair(o.sealed),
    video: resolveExamination(o.video),
    poster: resolveExamination(o.poster),
    grandfathered: resolveGrandfather(o.grandfathered),
    screenedAt: nonEmpty(o.screenedAt),
    attemptedAt: nonEmpty(o.attemptedAt),
  };
}

/** Parse the cutover marker. Both fields or nothing — a half-marker is no marker. */
function resolveGrandfather(raw: unknown): StdGrandfather | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reason = nonEmpty(o.reason);
  const at = nonEmpty(o.at);
  if (!reason || !at) return null;
  return { reason, at };
}

/** Parse the sealed-candidate pair. All four fields or nothing (fail closed). */
function resolveSealedPair(raw: unknown): StdSealedPair | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const videoRef = nonEmpty(o.videoRef);
  const videoFingerprint = nonEmpty(o.videoFingerprint);
  const posterRef = nonEmpty(o.posterRef);
  const posterFingerprint = nonEmpty(o.posterFingerprint);
  if (!videoRef || !videoFingerprint || !posterRef || !posterFingerprint) return null;
  if (videoRef === posterRef) return null; // one object may not be both artifacts
  return { videoRef, videoFingerprint, posterRef, posterFingerprint };
}

/**
 * Every sealed object this verdict OWNS — what to delete when it is superseded.
 *
 * Sealing creates a second permanent copy of the couple's media. Without this
 * the copies are write-only: a rejected video would stay fetchable forever at an
 * unsigned public URL, a re-upload would strand the previous pair, and nothing
 * would know they existed. `retireSupersededSeals` (lib/std-video-gate.ts) diffs
 * the outgoing verdict against the incoming one over this list.
 */
export function verdictSealedRefs(verdict: StdNsfwVerdict): string[] {
  const refs = new Set<string>();
  if (verdict.sealed) {
    refs.add(verdict.sealed.videoRef);
    refs.add(verdict.sealed.posterRef);
  }
  if (verdict.video) refs.add(verdict.video.ref);
  if (verdict.poster) refs.add(verdict.poster.ref);
  return [...refs];
}

/**
 * Parse one `StdExamination`. Total and fail-closed: an examination missing its
 * ref, its fingerprint, its examiner, or its timestamp is not a weaker
 * examination, it is NO examination — and an unrecognised `by` (a value written
 * by a newer deploy, or by hand) resolves to null rather than being trusted as
 * some unknown-but-probably-fine examiner.
 *
 * The pre-round-three shape (`servedVideoKey` / `servedPosterKey` as bare
 * strings, one `status` covering both objects) has no `by` field, so a verdict
 * written by the old code resolves to `{video:null, poster:null}` → not
 * servable → re-screened. That is the intended migration path: the column is
 * unapplied in prod, and even if it were, an approval with no recorded examiner
 * is exactly the thing this release stops honouring.
 */
function resolveExamination(raw: unknown): StdExamination | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ref = nonEmpty(o.ref);
  const fingerprint = nonEmpty(o.fingerprint);
  const at = nonEmpty(o.at);
  const by = o.by;
  if (!ref || !fingerprint || !at) return null;
  if (by !== 'nsfwjs-image' && by !== 'human-review' && by !== 'legacy-poster-screen') {
    return null;
  }
  return { ref, fingerprint, digest: nonEmpty(o.digest), by, at };
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
 *   (b) carries an EXAMINATION for each served artifact, AND
 *   (c) whose examiner is COMPETENT for that artifact's role, AND
 *   (d) whose ref is a well-formed SEALED ref under this event's prefix.
 *
 * (b)+(c) are round three and they are the whole point: (d) alone proves the
 * served object cannot change, which is worthless if nothing ever looked at it.
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
 * Is this examination good enough to authorise serving `role`?
 *
 * Three questions, and all three have to be yes:
 *   1. Does an examination exist at all?
 *   2. Was its examiner COMPETENT for this artifact — i.e. did it examine THIS
 *      KIND of thing, not something adjacent to it? (`COMPETENT_EXAMINERS`.)
 *   3. Does it name a well-formed SEALED object under THIS event's prefix — an
 *      object with no writer, so "the bytes examined" and "the bytes served"
 *      cannot drift apart afterwards?
 *
 * (2) is the round-three addition and it is the one that makes a poster-derived
 * approval of a video impossible to express, rather than merely unwise.
 */
export function examinationAuthorises(
  examination: StdExamination | null,
  role: 'video' | 'poster',
  eventId: string,
  opts?: {
    /**
     * Whether the VERDICT this examination belongs to carries the service-role
     * `grandfathered` marker. Only then may a `GRANDFATHERED_VIDEO_EXAMINERS`
     * examiner authorise a video. Defaults to false, so every caller that does
     * not deliberately opt in gets the strict rule.
     */
    grandfathered?: boolean;
  },
): boolean {
  if (!examination) return false;
  const competent =
    COMPETENT_EXAMINERS[role].has(examination.by) ||
    (role === 'video' &&
      opts?.grandfathered === true &&
      GRANDFATHERED_VIDEO_EXAMINERS.has(examination.by));
  if (!competent) return false;
  // Belt-and-braces: the ref came out of a service-role-only column, but it is
  // checked with the same parser the write side used, so an operator paste or a
  // future writer bug fails closed rather than presigning an arbitrary key.
  if (!parseClientRef(examination.ref, stdSealedPolicy(eventId))) return false;
  return examination.fingerprint.length > 0;
}

/**
 * THE serve decision, pure and total: given the row, the verdict and the event,
 * WHICH objects — if any — may be handed to a guest, and what must they hash to?
 *
 * This is the single place the "screen object A, serve object B" divergence is
 * killed, and round three is what finally kills it. It never returns the
 * couple's `videoKey`; the only refs it can emit come out of an EXAMINATION, and
 * an examination names the bytes its examiner actually looked at. So an object
 * nothing has examined has nothing to return it — not "has a verdict we decided
 * to distrust", but no path to the serve URL at all.
 *
 * Null on every unresolved case: not a video, not approved, verdict names other
 * media, an artifact with no examination, an examination by an examiner not
 * competent for that artifact (a poster classifier vouching for a video), a ref
 * outside this event's sealed prefix, or one object standing in for both roles.
 */
export function stdVideoServeRefs(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): StdServeRefs | null {
  if (!eventId) return null;
  if (verdict.status !== 'approved') return null;
  if (!verdictBindsMedia(media, verdict)) return null;
  const { video, poster } = verdict;
  // The grandfather unlock applies to the VIDEO role only, and only while the
  // service-role marker is on the row. The poster is judged strictly either way:
  // its examined bytes and its served bytes are the same object, so there has
  // never been a reason to relax it.
  const grandfathered = verdict.grandfathered !== null;
  if (!examinationAuthorises(video, 'video', eventId, { grandfathered })) return null;
  if (!examinationAuthorises(poster, 'poster', eventId)) return null;
  // Non-null after the guards above; TypeScript cannot see through the helper.
  const v = video as StdExamination;
  const p = poster as StdExamination;
  // A single object may not stand in for both roles — one examination must not
  // be able to cover two served artifacts.
  if (v.ref === p.ref) return null;
  return {
    videoRef: v.ref,
    posterRef: p.ref,
    videoFingerprint: v.fingerprint,
    posterFingerprint: p.fingerprint,
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
  if (verdict.status === 'rejected') return 'rejected';
  // An `approved` verdict that cannot actually serve — no examination, an
  // examiner not competent for the artifact, a malformed seal — is not
  // 'approved' in any sense the couple or the admin queue should be told. It
  // reads as 'pending', which is the truth: it still needs a screen. (Telling
  // them 'approved' is also what hid such a row from the ONE surface that can
  // fix it, since the queue filters on this function.)
  if (stdVideoServeRefs(media, verdict, eventId)) return 'approved';
  // Sealed and poster-screened, waiting on the human who must examine the video
  // itself. Distinct from 'pending' because nothing more will happen
  // automatically — no amount of re-screening can produce a video examination.
  if (stdVideoAwaitsReview(verdict, eventId)) return 'in_review';
  return 'pending';
}

/**
 * Has the automatic screen finished its part — sealed both objects and examined
 * the poster — leaving only the human examination of the video outstanding?
 *
 * This is the state a clean poster now produces. It is deliberately NOT
 * "approved with one field missing": the video has been examined by nobody, so
 * it does not play, and no automatic path can change that.
 */
export function stdVideoAwaitsReview(verdict: StdNsfwVerdict, eventId: string): boolean {
  if (verdict.status !== 'in_review' && verdict.status !== 'approved') return false;
  if (!verdict.sealed) return false;
  if (!examinationAuthorises(verdict.poster, 'poster', eventId)) return false;
  return !examinationAuthorises(verdict.video, 'video', eventId);
}

/**
 * Is this row still carrying the SEC-6 cutover marker — i.e. serving (or about
 * to serve) on a `legacy-poster-screen` examination rather than a real one?
 *
 * The admin queue uses this to keep the row VISIBLE even though
 * `stdNsfwDisplayStatus` says 'approved'. A grandfathered row is exactly the row
 * an operator should look at, and filtering the queue on 'approved' alone is how
 * it would hide.
 */
export function verdictIsGrandfathered(verdict: StdNsfwVerdict): boolean {
  return verdict.grandfathered !== null;
}

/**
 * A grandfathered row lands from the migration with the marker but NO seal and
 * NO examinations, because SQL cannot HEAD an R2 object and therefore cannot
 * know a fingerprint. So it does not serve yet — fail-closed by construction —
 * and it needs one pass of the automatic screen to fingerprint, classify the
 * poster and seal, after which the carried-over authorisation applies and the
 * couple's page is live again.
 *
 * True exactly during that window. The public loader fires the heal on it so a
 * real couple's page comes back on its own rather than waiting for someone to
 * open a dashboard.
 */
export function stdVideoNeedsGrandfatherHeal(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
  nowMs: number = Date.now(),
): boolean {
  if (!verdictIsGrandfathered(verdict)) return false;
  if (stdVideoServeRefs(media, verdict, eventId)) return false; // already live
  return stdVideoNeedsScreen(media, verdict, eventId, nowMs);
}

/** How long before a failed / never-finished screen may be retried. */
export const STD_SCREEN_RETRY_MS = 10 * 60_000; // 10 min

/**
 * Floor between screen attempts when the verdict does NOT bind the media.
 *
 * The full 10-minute window used to apply only to BOUND verdicts, which left the
 * unbound path — the one an attacker controls — with no throttle at all: PATCH
 * `std_media` with a different poster, load the builder, and the screen re-runs
 * immediately, downloading and classifying and re-sealing every time. A short
 * floor closes that loop without making a couple who legitimately re-picks their
 * video wait: 15 seconds is invisible to a person and ruinous to a loop.
 */
export const STD_SCREEN_UNBOUND_RETRY_MS = 15_000;

/**
 * Should the AUTOMATIC screen be (re-)attempted for this media right now?
 *
 * True when the media is a screenable video and the screen's own work — seal
 * both objects, examine the poster — is not yet done, outside the throttle
 * window. False once the row is sealed + poster-examined: at that point it is
 * waiting on a human, and re-running the classifier would only re-load the
 * 4.4 MB nsfwjs model to reach the same conclusion.
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
  if (bound) {
    // Terminal.
    if (verdict.status === 'rejected') return false;
    // Already sealed — by this screen, or by an admin preparing a re-review. The
    // screen's whole job is "freeze the bytes, classify the poster"; once frozen
    // bytes exist the row is waiting on a human, and re-running would only reload
    // the 4.4 MB model to reach the same conclusion (and, on an admin-prepared
    // row, would undo the preparation).
    if (verdict.sealed) return false;
  }
  if (verdict.attemptedAt) {
    const attempted = Date.parse(verdict.attemptedAt);
    const window = bound ? STD_SCREEN_RETRY_MS : STD_SCREEN_UNBOUND_RETRY_MS;
    if (Number.isFinite(attempted) && nowMs - attempted < window) return false;
  }
  return true;
}
