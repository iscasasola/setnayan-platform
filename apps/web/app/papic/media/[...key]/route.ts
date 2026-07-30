import { type NextRequest } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, R2_BUCKETS } from '@/lib/r2';
import { rateLimit } from '@/lib/rate-limit';

/**
 * GET /papic/media/{bucket}/{...key} — the STABLE, STREAMING media route.
 *
 * WHY IT EXISTS: a crawler (Facebook, iMessage, Pinterest) caches an OG/social
 * image and re-fetches it on its own schedule with no auth. A 24-hour presigned
 * URL breaks under that cache → a dead preview. This route hands out a stable,
 * signature-less URL and STREAMS the bytes from R2 itself — it must NEVER 302 to
 * a presigned URL (a cached-immutable redirect would pin a soon-dead signed URL
 * for a year). Streaming is what lets caches hold the URL safely.
 *
 * Callers point at this route via `stableMediaPath()` (lib/papic-display-ref.ts),
 * and only ever for a resolved STILL ref — a geo-stripped derivative
 * (thumb/display/poster), never a raw geo-bearing original. Combined with the
 * media-bucket-only guard below, the route serves only the small, public,
 * metadata-free forever-copies.
 *
 * Caching: the derivative keys are PATH-derived (derivatives/${key}.display.avif),
 * not content hashes, so we must NOT pin `immutable` (a re-crop / re-moderate at
 * a stable key would be invisible for a year). A short max-age + ETag
 * revalidation keeps crawler/browser caches fresh cheaply.
 *
 * ── RATE LIMIT (SEC-1 deferred lane #4, added 2026-07-30) ────────────────────
 * The route is unauthenticated BY DESIGN and there is no confidentiality delta —
 * `SERVEABLE_BUCKETS` is media-only, and media is served unsigned to anyone
 * holding the key anyway. What is worth bounding is BANDWIDTH: this streams bytes
 * through the function, so a single caller looping it is a real egress/compute
 * bill, unlike a direct R2 hit.
 *
 * ⚠ THE LIMIT IS DELIBERATELY GENEROUS, AND SKIPS REVALIDATIONS, because the
 * intended consumers are exactly the traffic a naive limiter would break:
 * Facebook / iMessage / Pinterest crawlers refetching OG images on their own
 * schedule, and guests loading a gallery of many stills at once. A tight per-IP
 * budget would produce dead social previews — the precise failure this route was
 * built to prevent. So:
 *   • conditional requests (`If-None-Match`) are NOT counted. They are the crawler
 *     and browser-cache pattern, they short-circuit to a 304 without streaming a
 *     byte, and they are what we WANT callers doing.
 *   • only full-body streams count, at a per-IP budget sized well above a real
 *     gallery page-load burst.
 *   • it FAILS OPEN. A limiter fault must never black out a wedding's photos.
 * Per `lib/rate-limit.ts` this is per-instance best-effort defence-in-depth, not a
 * cross-instance guarantee — the honest ceiling on an in-memory limiter.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only the publicly-served media bucket is streamable here. The private buckets
// (thread-files, contracts, verification) are NEVER exposed by this route.
const SERVEABLE_BUCKETS = new Set<string>([R2_BUCKETS.media]);

/**
 * Full-body streams allowed per IP per minute.
 *
 * Sized against the real burst this route must absorb: a guest opening a gallery
 * pulls many stills at once, and a household or venue behind one NAT looks like a
 * single IP. 600/min leaves an enormous margin over that while still bounding a
 * scripted loop, and revalidations do not count against it at all.
 */
const MEDIA_STREAMS_PER_MINUTE = 600;

/** AWS SDK v3 Node streams carry this mixin; typed locally to avoid `any`. */
type WebStreamable = { transformToWebStream: () => ReadableStream };

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  if (!Array.isArray(key) || key.length < 2) return notFound();

  const bucket = key[0]!;
  const objectKey = key.slice(1).join('/');
  if (!SERVEABLE_BUCKETS.has(bucket) || objectKey.length === 0) return notFound();

  // Bandwidth guard — see the RATE LIMIT note in the header. Revalidations are
  // exempt (they stream nothing and are the crawler pattern we want), and a
  // limiter fault falls through to serving rather than blacking out a gallery.
  const isRevalidation = req.headers.get('if-none-match') !== null;
  if (!isRevalidation) {
    try {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';
      const rl = rateLimit(`papic-media:${ip}`, MEDIA_STREAMS_PER_MINUTE, 60_000);
      if (!rl.ok) {
        return new Response('Too many requests', {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
            // Never let an intermediary cache a 429 in place of an image.
            'Cache-Control': 'no-store',
          },
        });
      }
    } catch {
      // Fail OPEN: a limiter fault must not black out a wedding's photos.
    }
  }

  const client = getR2Client();
  if (!client) return new Response('Storage unavailable', { status: 503 });

  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    );

    const etag = out.ETag;
    // Cheap revalidation: a matching If-None-Match short-circuits the byte stream.
    const inm = req.headers.get('if-none-match');
    if (etag && inm && inm === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': cacheControl() },
      });
    }

    if (!out.Body) return notFound();
    const stream = (out.Body as unknown as WebStreamable).transformToWebStream();

    const headers = new Headers();
    headers.set('Content-Type', out.ContentType ?? 'application/octet-stream');
    if (typeof out.ContentLength === 'number') {
      headers.set('Content-Length', String(out.ContentLength));
    }
    if (etag) headers.set('ETag', etag);
    headers.set('Cache-Control', cacheControl());

    return new Response(stream, { status: 200, headers });
  } catch (err) {
    // NoSuchKey (a dropped raw / bad ref) → 404. Because callers only ever link a
    // derivative still-ref here, a dropped ORIGINAL never reaches this route.
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return notFound();
    return new Response('Storage error', { status: 502 });
  }
}

function cacheControl(): string {
  return 'public, max-age=300, stale-while-revalidate=86400';
}
