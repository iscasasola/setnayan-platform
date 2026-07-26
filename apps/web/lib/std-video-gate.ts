import 'server-only';

/**
 * SEC-6 — the SERVER half of the Save-the-Date video gate.
 *
 * `lib/std-media.ts` holds the pure rules (which refs are even representable,
 * and which objects a guest may be served). This module is the I/O half: it
 * fingerprints R2 objects, SEALS screened bytes into an immutable copy, and
 * mints the presigned URLs the public page emits.
 *
 * ── ROUND ONE'S MISTAKE, AND WHY THIS FILE LOOKS DIFFERENT NOW ──────────────
 * The first cut fingerprinted the ref with a LENIENT parser (`parseR2Ref`,
 * which turns any non-`r2://` string into "a key in the public media bucket")
 * while the serve path handed the SAME string to `displayUrlForStoredAsset`,
 * which returns any non-`r2://` string VERBATIM as a URL. So an attacker made a
 * real R2 object whose key was `http:/evil.example/v/<uuid>-clip.mp4`, earned a
 * genuine `approved` verdict for it, and the browser resolved the identical
 * string to a foreign origin. The fingerprint was real; it described the wrong
 * resource.
 *
 * Two things changed:
 *
 *   1. **`parseR2Ref` is gone from this path.** Every ref this module touches
 *      goes through `parseClientRef` (lib/r2-client-ref.ts, SEC-1's strict,
 *      total parser) against an explicit policy. There is one parser now, so
 *      there is nothing for two parsers to disagree about.
 *
 *   2. **Guests are served a SEALED COPY, never the couple's object.** On a
 *      clean decision the screen copies the classified bytes, server-side and
 *      conditioned on the source ETag, to `events/{id}/std-screened/…` — a
 *      prefix `/api/upload` refuses to presign. The verdict records the sealed
 *      keys and the public page is given only those.
 *
 * ── WHY SEALING AND NOT A SHORTER TTL / A PER-REQUEST RE-HEAD ───────────────
 * Because the fingerprint HEAD and the browser's GET are different requests, and
 * a presigned GET carries no ETag condition (a browser cannot send `If-Match`,
 * and S3 has no query-string equivalent). Whatever bytes sit at the key when the
 * browser arrives are the bytes it plays. Shrinking that window shrinks the
 * exposure; it does not remove it, and it cannot help a URL already emitted into
 * an ISR-cached page. Making the object un-writable removes the window entirely:
 * there is no writer, so there is nothing to race.
 *
 * ── ROUND THREE: SEALING IS IDENTITY, NOT PROVENANCE ────────────────────────
 * Round two was still the same bug. Freezing an object answers "will the served
 * bytes still be the bytes we froze?" — it says nothing about whether anyone
 * ever LOOKED at them. The screen classified a poster JPEG and sealed the MP4
 * beside it, so a dirty video with a clean unrelated poster earned an approval
 * that was bound, sealed, and wrong.
 *
 * So a seal is now a CANDIDATE, and authorisation is a separate, per-artifact
 * `StdExamination` recording who examined those exact bytes
 * (`COMPETENT_EXAMINERS`, lib/std-media.ts). The poster screen can only write
 * the poster's. The video's requires an examiner competent for a video, which
 * today means a human — and `stdVideoReviewMedia` below hands that human the
 * SEALED object, so what they watch and what a guest receives are one object
 * rather than two reads of a writable key.
 *
 * ── FAIL CLOSED, EVERYWHERE ─────────────────────────────────────────────────
 * Every unresolvable case — R2 unconfigured, object missing, HEAD refused, no
 * ETag, malformed ref, foreign bucket, wrong event, copy refused, copy landed
 * with different bytes — returns "not servable" / null. No branch resolves an
 * unknown into a pass, and no refusal distinguishes "does not exist" from "not
 * yours" (matching lib/r2-client-ref.ts's no-existence-oracle house style).
 *
 * Cost: two HEADs on the render of a public page whose couple has an approved,
 * sealed video. Every other page pays nothing (the pure gate short-circuits).
 */

import { randomUUID } from 'node:crypto';

import * as Sentry from '@sentry/nextjs';

import { r2Copy, r2Delete, r2Head, type R2BucketName } from '@/lib/r2';
import {
  parseClientRef,
  stdSealedPolicy,
  stdVideoPosterPolicy,
  stdVideoSourcePolicy,
  type ClientRefPolicy,
} from '@/lib/r2-client-ref';
import { encodeR2Ref, presignDisplayUrl } from '@/lib/uploads';
import { sealObject, type SealDeps } from '@/lib/std-seal';
import {
  NO_STD_NSFW_VERDICT,
  resolveStdNsfwVerdict,
  stdVerdictMatchesContent,
  stdVideoServeRefs,
  verdictSealedRefs,
  type StdMedia,
  type StdNsfwVerdict,
  type StdSealedPair,
} from '@/lib/std-media';

/**
 * The minimum shape of a Supabase client this module needs. Taken as `unknown`
 * at the boundary and narrowed here on purpose: both the cookie-scoped and the
 * service-role clients call this, their generated types differ, and structurally
 * typing the parameter makes tsc walk the whole PostgREST builder chain
 * (TS2589 "type instantiation is excessively deep"). One query, one cast.
 */
type VerdictQuery = {
  select: (cols: string) => {
    eq: (
      col: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: Record<string, unknown> | null;
        error: unknown;
      }>;
    };
  };
};

/**
 * Read one event's verdict in its OWN query, never folded into a page's big
 * column list.
 *
 * DEPLOY-ORDER SAFETY, not style. Vercel ships on merge and migrations apply on
 * their own schedule, so there is a window where the code is live and the column
 * is not. A missing column inside `/[slug]`'s 50-column select would fail the
 * WHOLE read (42703) and 404 a live wedding page; inside the builder's select it
 * would blank the builder. Isolated, the worst case is a null verdict — which
 * means "not approved", which means the film closes on the photo gallery. That
 * is the correct behaviour in that window anyway.
 *
 * Any error resolves to NO_STD_NSFW_VERDICT (fail CLOSED).
 */
export async function loadStdNsfwVerdict(
  client: unknown,
  eventId: string,
): Promise<StdNsfwVerdict> {
  try {
    const from = (client as { from: (table: string) => VerdictQuery }).from;
    const { data, error } = await from
      .call(client, 'events')
      .select('std_media_nsfw')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return NO_STD_NSFW_VERDICT;
    return resolveStdNsfwVerdict(data.std_media_nsfw);
  } catch {
    return NO_STD_NSFW_VERDICT;
  }
}

/**
 * HEAD one `r2://bucket/key` ref that passed `policy`, returning `<etag>:<bytes>`.
 *
 * The policy argument is not optional and there is no default: every caller must
 * say which role this ref is playing, because "which prefix is this allowed to
 * be under?" is exactly the question round one answered implicitly (and wrongly)
 * with `bucket ?? R2_BUCKETS.media`.
 *
 * Returns null when the object cannot be identified for ANY reason. Callers must
 * treat null as a mismatch, never as "unchanged".
 */
async function r2ContentFingerprint(
  ref: unknown,
  policy: ClientRefPolicy,
): Promise<string | null> {
  const parsed = parseClientRef(ref, policy);
  if (!parsed) return null;
  return await fingerprintObject(parsed);
}

async function fingerprintObject(obj: {
  bucket: R2BucketName;
  key: string;
}): Promise<string | null> {
  try {
    const head = await r2Head(obj);
    if (!head || !head.etag) return null;
    // Size is belt-and-braces: an ETag collision would also have to reproduce
    // the exact byte length. NaN (R2 omitted ContentLength) is un-verifiable.
    if (!Number.isFinite(head.size)) return null;
    return `${head.etag}:${head.size}`;
  } catch {
    // r2Head throws only when R2 is unconfigured — a config error, and still
    // not a reason to show an unverified video.
    return null;
  }
}

/** Fingerprint the couple's uploaded video + poster, in one round trip each. */
export async function stdSourceFingerprints(
  media: StdMedia,
  eventId: string,
): Promise<{ video: string | null; poster: string | null }> {
  const [video, poster] = await Promise.all([
    r2ContentFingerprint(media.videoKey, stdVideoSourcePolicy(eventId)),
    r2ContentFingerprint(media.posterKey, stdVideoPosterPolicy(eventId)),
  ]);
  return { video, poster };
}

/**
 * The live R2 bindings for `lib/std-seal.ts`'s injected operations.
 *
 * `warn` goes to Sentry as well as the console on purpose. Every failure inside
 * sealing is fail-CLOSED, which means a systemic breakage — R2 rejecting the
 * conditional copy header, a bucket permission drift, a multipart path that
 * changes the ETag shape — presents to a couple as "my video just never plays"
 * and to us as silence. `r2Copy` had no caller in this codebase before SEC-6, so
 * this is the first real exercise of `CopySourceIfMatch` against R2; a total
 * outage of the feature must page someone rather than look like low demand.
 */
const liveSealDeps: SealDeps = {
  copy: (args) =>
    r2Copy({
      bucket: args.bucket as R2BucketName,
      fromKey: args.fromKey,
      toKey: args.toKey,
      sourceIfMatch: args.sourceIfMatch,
    }),
  fingerprint: (args) =>
    fingerprintObject({ bucket: args.bucket as R2BucketName, key: args.key }),
  warn: (message, context) => {
    console.warn(`${message} ${JSON.stringify(context)}`);
    Sentry.captureMessage(message, { level: 'error', extra: context });
  },
};

/**
 * Seal BOTH objects. All-or-nothing: a half-sealed pair authorises nothing, so
 * the caller leaves the verdict undecided and the heal retries.
 *
 * Note what this does and does not mean. Sealing FREEZES an object so the bytes
 * examined and the bytes served cannot drift apart. It is not itself an
 * examination — that is `StdExamination`, and the video's can only be written by
 * an examiner competent to judge a video. Round two collapsed the two ideas and
 * that is exactly how a classification of a JPEG ended up authorising an MP4.
 */
export async function sealScreenedMedia(args: {
  eventId: string;
  media: StdMedia;
  videoFingerprint: string;
  posterFingerprint: string;
}): Promise<StdSealedPair | null> {
  const video = parseClientRef(args.media.videoKey, stdVideoSourcePolicy(args.eventId));
  const poster = parseClientRef(args.media.posterKey, stdVideoPosterPolicy(args.eventId));
  if (!video || !poster) return null;

  const sealOne = async (
    role: 'video' | 'poster',
    source: { bucket: R2BucketName; key: string },
    fingerprint: string,
  ): Promise<string | null> => {
    const key = await sealObject(liveSealDeps, {
      eventId: args.eventId,
      role,
      bucket: source.bucket,
      sourceKey: source.key,
      fingerprint,
      nonce: randomUUID(),
    });
    if (!key) return null;
    const ref = encodeR2Ref(source.bucket, key);
    // Final self-check: the ref we are about to persist must satisfy the same
    // policy the serve path will apply to it. A seal the reader would refuse is
    // a seal we must not record.
    return parseClientRef(ref, stdSealedPolicy(args.eventId)) ? ref : null;
  };

  const videoRef = await sealOne('video', video, args.videoFingerprint);
  if (!videoRef) return null;
  const posterRef = await sealOne('poster', poster, args.posterFingerprint);
  if (!posterRef) return null;
  return {
    videoRef,
    videoFingerprint: args.videoFingerprint,
    posterRef,
    posterFingerprint: args.posterFingerprint,
  };
}

/**
 * Delete the sealed objects an OUTGOING verdict owned that the INCOMING one does
 * not — the takedown and the garbage collector, in one place.
 *
 * Sealing makes a second permanent copy of the couple's media in the
 * public-by-design media bucket, and until this existed nothing ever removed
 * one. Three consequences, all real:
 *
 *   • **Takedown did not take anything down.** A rejected video's sealed copy
 *     stayed fetchable at an unsigned public URL that every guest who loaded the
 *     page while it was approved already holds — and the new verdict overwrote
 *     the only pointer to it, so nothing could even enumerate it afterwards.
 *   • **Erasure could not reach it.** Account deletion walks refs it can read
 *     out of DB columns; a discarded seal is in no column.
 *   • **It grew without bound.** Every re-screen minted a fresh pair under a new
 *     random key and stranded the previous one.
 *
 * Best-effort by contract (the house rule for `r2Delete`): a failure here must
 * never break the decision that has already been written. Anything that does not
 * delete is logged, not thrown.
 */
export async function retireSupersededSeals(args: {
  eventId: string;
  previous: StdNsfwVerdict;
  next: StdNsfwVerdict;
}): Promise<void> {
  const keep = new Set(verdictSealedRefs(args.next));
  const drop = verdictSealedRefs(args.previous).filter((ref) => !keep.has(ref));
  if (drop.length === 0) return;
  const policy = stdSealedPolicy(args.eventId);
  for (const ref of drop) {
    // Only ever delete something that parses as THIS event's sealed object. A
    // malformed or foreign ref in the column must not become a delete primitive.
    const parsed = parseClientRef(ref, policy);
    if (!parsed) continue;
    try {
      await r2Delete({ bucket: parsed.bucket, key: parsed.key });
    } catch (err) {
      console.warn(
        `[std-video-gate] could not delete a superseded sealed object — event_id=${args.eventId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Resolve the guest-facing URLs for an approved Save-the-Date video, or null.
 *
 * THE ONLY function on the public path that may emit a Save-the-Date video URL.
 * `displayUrlForStoredAsset` must never be called with `std_media.videoKey` or
 * `.posterKey` again: its legacy-URL passthrough is precisely the mouth that
 * turned a URL-shaped key into a foreign-origin `<video src>`.
 *
 * The 24-hour presign TTL is deliberate and is no longer a security parameter.
 * A leaked URL now names an IMMUTABLE object in the public-by-design media
 * bucket (`R2_PUBLIC_URL` serves that bucket unsigned anyway), so a URL that
 * outlives its page cannot deliver anything other than the exact bytes the
 * screen classified. Shortening it would only break guests who left a tab open.
 */
export async function stdVideoServeUrls(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): Promise<{ videoUrl: string; posterUrl: string } | null> {
  const refs = stdVideoServeRefs(media, verdict, eventId);
  if (!refs) return null;
  const sealed = stdSealedPolicy(eventId);
  const video = parseClientRef(refs.videoRef, sealed);
  const poster = parseClientRef(refs.posterRef, sealed);
  if (!video || !poster) return null;
  const [liveVideo, livePoster] = await Promise.all([
    fingerprintObject(video),
    fingerprintObject(poster),
  ]);
  if (!stdVerdictMatchesContent(refs, { video: liveVideo, poster: livePoster })) return null;
  try {
    const [videoUrl, posterUrl] = await Promise.all([
      presignDisplayUrl(video.bucket, video.key),
      presignDisplayUrl(poster.bucket, poster.key),
    ]);
    return { videoUrl, posterUrl };
  } catch {
    return null; // R2 unconfigured — show the gallery, never an unsigned guess
  }
}

export type StdReviewMedia = {
  /** Presigned URL of the SEALED video — what the reviewer watches. */
  videoUrl: string | null;
  /** Presigned URL of the SEALED poster. */
  posterUrl: string | null;
  /** Live `<etag>:<bytes>` of the sealed video; the Approve pin. */
  videoFingerprint: string | null;
  /** Live `<etag>:<bytes>` of the sealed poster. */
  posterFingerprint: string | null;
  /**
   * Whether this row is in a state a human can approve at all. False when the
   * automatic screen has not sealed yet, or when a sealed object no longer
   * reads back the bytes it was sealed with.
   */
  approvable: boolean;
  /**
   * True when the verdict NAMES a sealed pair but R2 no longer serves it —
   * something deleted or replaced the object out of band. The row must stay
   * visible to an operator and be re-screened; it must never be quietly
   * approvable, and it must never look fine.
   */
  sealBroken: boolean;
};

/**
 * What the admin reviewer is shown, and what their Approve is pinned to.
 *
 * ── THE REVIEWER WATCHES THE SEAL, NOT THE SOURCE ───────────────────────────
 * This is the round-three change and it is the whole reason a human approval
 * means anything. Round two presigned the couple's SOURCE object: mutable, held
 * open by a 5-minute presigned PUT the couple still has, and pinned to an
 * MD5-derived ETag. So "the bytes on screen" and "the bytes served" were two
 * different reads of a writable key, reconciled by a hash comparison.
 *
 * Now the reviewer streams the SEALED object — the exact, immutable, writer-less
 * copy the guest's browser will fetch. There is no reconciliation to get wrong:
 * it is the same object. The fingerprint pin stays as a second lock (it catches
 * an out-of-band deletion or replacement between page load and click), but the
 * guarantee no longer rests on it.
 *
 * A row that is not sealed yet is NOT approvable. An admin can only ever put
 * their name to frozen bytes.
 */
export async function stdVideoReviewMedia(
  media: StdMedia,
  verdict: StdNsfwVerdict,
  eventId: string,
): Promise<StdReviewMedia> {
  const empty: StdReviewMedia = {
    videoUrl: null,
    posterUrl: null,
    videoFingerprint: null,
    posterFingerprint: null,
    approvable: false,
    sealBroken: false,
  };
  if (media.type !== 'video') return empty;
  const sealed = verdict.sealed;
  // Not sealed yet → nothing frozen to examine → nothing to approve. The queue
  // still shows the row (so an operator can see it is stuck and reject it), it
  // just cannot be approved into existence.
  if (!sealed) return empty;
  const policy = stdSealedPolicy(eventId);
  const video = parseClientRef(sealed.videoRef, policy);
  const poster = parseClientRef(sealed.posterRef, policy);
  if (!video || !poster) return { ...empty, sealBroken: true };
  try {
    const [videoFingerprint, posterFingerprint] = await Promise.all([
      fingerprintObject(video),
      fingerprintObject(poster),
    ]);
    // The sealed objects must still hold the bytes they were sealed with. They
    // have no writer, so a mismatch means an operator acted on the bucket — and
    // that is a refusal, never an assumption.
    if (
      videoFingerprint !== sealed.videoFingerprint ||
      posterFingerprint !== sealed.posterFingerprint
    ) {
      return { ...empty, sealBroken: true };
    }
    const [videoUrl, posterUrl] = await Promise.all([
      presignDisplayUrl(video.bucket, video.key),
      presignDisplayUrl(poster.bucket, poster.key),
    ]);
    return {
      videoUrl,
      posterUrl,
      videoFingerprint,
      posterFingerprint,
      approvable: true,
      sealBroken: false,
    };
  } catch {
    return empty;
  }
}
