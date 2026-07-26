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

import { r2Copy, r2Head, type R2BucketName } from '@/lib/r2';
import {
  parseClientRef,
  R2_SEALED_SEGMENT,
  stdSealedPolicy,
  stdVideoPosterPolicy,
  stdVideoSourcePolicy,
  type ClientRefPolicy,
} from '@/lib/r2-client-ref';
import { encodeR2Ref, presignDisplayUrl } from '@/lib/uploads';
import {
  NO_STD_NSFW_VERDICT,
  resolveStdNsfwVerdict,
  stdVerdictMatchesContent,
  stdVideoServeRefs,
  type StdMedia,
  type StdNsfwVerdict,
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

/** Split a `<etag>:<bytes>` fingerprint back into its parts. */
function splitFingerprint(fp: string): { etag: string; size: number } | null {
  const cut = fp.lastIndexOf(':');
  if (cut <= 0) return null;
  const etag = fp.slice(0, cut);
  const size = Number(fp.slice(cut + 1));
  if (!etag || !Number.isFinite(size)) return null;
  return { etag, size };
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
 * SEAL one screened object: copy it, server-side, into this event's
 * `std-screened/` prefix and prove the copy holds the bytes we judged.
 *
 * Three properties, and the design needs all three:
 *
 *   • **CONDITIONED ON THE SOURCE ETAG.** `CopySourceIfMatch` makes R2 refuse the
 *     copy if the source changed since we fingerprinted it, so the copy cannot
 *     silently capture a swap that landed between the classify and the copy.
 *   • **VERIFIED AFTER THE FACT.** We HEAD the destination and require the same
 *     `<etag>:<bytes>`. If R2 ever ignored the condition, or a multipart path
 *     produced a different ETag shape, this refuses rather than sealing bytes we
 *     did not check. The seal is never taken on trust.
 *   • **UNGUESSABLE *AND* UNWRITABLE.** The key carries a fresh `randomUUID()`
 *     (so it cannot be pre-created by someone who knows their own ETag) under a
 *     segment `/api/upload` refuses outright (so it cannot be written even if
 *     guessed). Two independent controls; neither is load-bearing on its own.
 *
 * Returns the sealed `r2://…` ref, or null. Null means "no approval" — the
 * caller must not write an `approved` verdict without a seal.
 */
async function sealScreenedObject(args: {
  eventId: string;
  role: 'video' | 'poster';
  source: { bucket: R2BucketName; key: string };
  fingerprint: string;
}): Promise<string | null> {
  const parts = splitFingerprint(args.fingerprint);
  if (!parts) return null;
  // Content-addressed AND unguessable: the digest is in the name (so a sealed
  // object is self-describing and a mismatch is obvious in a bucket listing),
  // behind a random segment (so the name cannot be predicted before it exists).
  const digest = `${parts.etag}-${parts.size}`.replace(/[^A-Za-z0-9._-]/g, '-');
  const toKey = `events/${args.eventId}/${R2_SEALED_SEGMENT}/${randomUUID()}/${args.role}-${digest}`;
  try {
    await r2Copy({
      bucket: args.source.bucket,
      fromKey: args.source.key,
      toKey,
      sourceIfMatch: parts.etag,
    });
  } catch {
    return null; // copy refused (source moved) or R2 unconfigured → no approval
  }
  const sealedFingerprint = await fingerprintObject({
    bucket: args.source.bucket,
    key: toKey,
  });
  if (sealedFingerprint !== args.fingerprint) return null;
  const ref = encodeR2Ref(args.source.bucket, toKey);
  // Final self-check: the ref we are about to persist must satisfy the same
  // policy the serve path will apply to it. A seal the reader would refuse is a
  // seal we must not record as an approval.
  return parseClientRef(ref, stdSealedPolicy(args.eventId)) ? ref : null;
}

/**
 * Seal both objects for an approval. All-or-nothing: a half-sealed approval is
 * no approval, so the caller leaves the verdict undecided and the heal retries.
 */
export async function sealScreenedMedia(args: {
  eventId: string;
  media: StdMedia;
  videoFingerprint: string;
  posterFingerprint: string;
}): Promise<{ servedVideoKey: string; servedPosterKey: string } | null> {
  const video = parseClientRef(args.media.videoKey, stdVideoSourcePolicy(args.eventId));
  const poster = parseClientRef(args.media.posterKey, stdVideoPosterPolicy(args.eventId));
  if (!video || !poster) return null;
  const servedVideoKey = await sealScreenedObject({
    eventId: args.eventId,
    role: 'video',
    source: video,
    fingerprint: args.videoFingerprint,
  });
  if (!servedVideoKey) return null;
  const servedPosterKey = await sealScreenedObject({
    eventId: args.eventId,
    role: 'poster',
    source: poster,
    fingerprint: args.posterFingerprint,
  });
  if (!servedPosterKey) return null;
  return { servedVideoKey, servedPosterKey };
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

/**
 * The admin reviewer's player. Presigns the couple's SOURCE objects — the bytes
 * under review, which is what a human must actually watch — and hands back the
 * fingerprints of exactly those bytes so the Approve action can be PINNED to
 * them (see app/admin/reveal-studio/actions.ts). Without that pin, an approval
 * covers "whatever is at the key when the button is clicked", which need not be
 * what was on screen.
 *
 * Same strict parser as everything else, so a reviewer can never be shown a
 * foreign origin while the fingerprint covers an R2 decoy.
 */
export async function stdVideoReviewMedia(
  media: StdMedia,
  eventId: string,
): Promise<{
  videoUrl: string | null;
  posterUrl: string | null;
  videoFingerprint: string | null;
  posterFingerprint: string | null;
}> {
  const empty = {
    videoUrl: null,
    posterUrl: null,
    videoFingerprint: null,
    posterFingerprint: null,
  };
  const video = parseClientRef(media.videoKey, stdVideoSourcePolicy(eventId));
  const poster = parseClientRef(media.posterKey, stdVideoPosterPolicy(eventId));
  if (!video) return empty;
  try {
    const [videoFingerprint, posterFingerprint, videoUrl, posterUrl] = await Promise.all([
      fingerprintObject(video),
      poster ? fingerprintObject(poster) : Promise.resolve(null),
      presignDisplayUrl(video.bucket, video.key),
      poster ? presignDisplayUrl(poster.bucket, poster.key) : Promise.resolve(null),
    ]);
    return { videoUrl, posterUrl, videoFingerprint, posterFingerprint };
  } catch {
    return empty;
  }
}
