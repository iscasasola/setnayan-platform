import 'server-only';

/**
 * SEC-6 — the SERVER half of the Save-the-Date video gate.
 *
 * `lib/std-media.ts` holds the pure rule (an `approved` verdict must BIND to the
 * media's two R2 keys). This module adds the half that needs I/O: proving the
 * bytes currently sitting at those keys are still the bytes the screen judged.
 *
 * ── WHY KEY IDENTITY IS NOT ENOUGH ──────────────────────────────────────────
 * `/api/upload` mints a server-chosen, UUID-pinned key and returns a presigned
 * PUT with a 5-MINUTE TTL. The client keeps that URL. The screen runs from
 * `after()` and lands within seconds. So the attack the naive fix invites is:
 *
 *     PUT  <presigned>  clean.mp4        → key K
 *     save → screen classifies K's poster → verdict approved, bound to K
 *     PUT  <same presigned URL>  dirty.mp4  → key K now holds different bytes
 *
 * The verdict still names K. Nothing in the row changed. A key-only binding —
 * and, worse, any "preserve the previous verdict on UPDATE" trigger — would
 * publish the swapped video. So the verdict also stores a CONTENT fingerprint
 * (`<etag>:<bytes>`, and for a single PUT R2's ETag is the body MD5), and this
 * module re-verifies it at read time.
 *
 * ── FAIL CLOSED, EVERYWHERE ─────────────────────────────────────────────────
 * Every unresolvable case — R2 unconfigured, object missing, HEAD refused, no
 * ETag, malformed ref, unknown bucket — returns "not servable". There is no
 * branch in this file that resolves an unknown into a pass.
 *
 * Cost: at most two HEADs, and only on the render of a public page whose couple
 * actually uploaded a video AND already holds a bound `approved` verdict. Every
 * other page pays nothing (the pure gate short-circuits first).
 */

import { R2_BUCKETS, r2Head, type R2BucketName } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import {
  NO_STD_NSFW_VERDICT,
  resolveStdNsfwVerdict,
  stdVerdictMatchesContent,
  stdVideoIsLive,
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

const KNOWN_BUCKETS: ReadonlySet<string> = new Set(Object.values(R2_BUCKETS));

/**
 * HEAD one `r2://bucket/key` (or bare key) ref and return `<etag>:<bytes>`.
 * Returns null when the object cannot be identified for ANY reason — callers
 * must treat null as a mismatch, never as "unchanged".
 */
export async function r2ContentFingerprint(ref: string | null): Promise<string | null> {
  if (!ref || !ref.trim()) return null;
  try {
    const { bucket, key } = parseR2Ref(ref.trim());
    const resolved: string = bucket ?? R2_BUCKETS.media;
    if (!KNOWN_BUCKETS.has(resolved)) return null; // an unrecognised bucket is not ours
    if (!key) return null;
    const head = await r2Head({ bucket: resolved as R2BucketName, key });
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

/**
 * THE public-surface gate. True only when:
 *   1. the verdict is `approved` AND binds to this media's videoKey + posterKey
 *      (pure rule, `stdVideoIsLive`), AND
 *   2. the objects at BOTH keys still carry the fingerprints the screen recorded.
 *
 * Anything else — including an object that has been re-PUT since approval —
 * is false, and the film closes on the couple's photo gallery instead.
 */
export async function stdVideoIsServable(
  media: StdMedia,
  verdict: StdNsfwVerdict,
): Promise<boolean> {
  if (!stdVideoIsLive(media, verdict)) return false;
  const [video, poster] = await Promise.all([
    r2ContentFingerprint(media.videoKey ?? null),
    r2ContentFingerprint(media.posterKey ?? null),
  ]);
  return stdVerdictMatchesContent(verdict, { video, poster });
}
