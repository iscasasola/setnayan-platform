import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, r2SignedGet } from '@/lib/r2';

/**
 * Homepage hero video — the admin-uploaded scroll-scrub.
 *
 * The owner uploads a short video in /admin/hero-video; the admin's browser
 * extracts it into an ordered list of JPEG frames (Vercel can't run ffmpeg),
 * uploads them to R2, and stores the frame R2 KEYS in the single
 * `homepage_hero_config` row. The public homepage reads the published row and
 * renders <HeroVideoScrub> (a frame-by-frame scroll-scrub) in place of the
 * default hero — see app/_components/marketing/_sections.tsx Hero().
 *
 * # Display URLs are built from KEYS at read time (not stored)
 *
 * The media bucket's S3 API endpoint (`<account>.r2.cloudflarestorage.com`) is
 * NOT publicly readable — a plain browser <img> GET 400s — so storing public
 * URLs broke the scrub whenever `R2_PUBLIC_URL` was the S3 endpoint (its
 * current prod value). Instead we keep the raw keys and resolve them per read:
 *   • PUBLIC URL when `R2_PUBLIC_URL` is a real public host bound to the media
 *     bucket (custom domain / r2.dev) — cacheable, the preferred end state; or
 *   • a short-lived PRESIGNED GET otherwise — works with the existing R2 creds
 *     against the S3 endpoint, no public bucket needed. The homepage is
 *     force-dynamic, so presigned URLs regenerate every render and never serve
 *     stale/expired.
 *
 * Read uses the service-role client (no cookies → safe inside the homepage;
 * the row is a public marketing asset, not a secret). Returns null whenever
 * nothing is published or URLs can't be resolved, so the caller falls back to
 * the default hero. Never throws.
 */

export type HeroVideoConfig = {
  videoUrl: string | null;
  frameUrls: string[];
  frameCount: number;
  frameWidth: number | null;
  frameHeight: number | null;
  ctaText: string;
  ctaHref: string;
  isPublished: boolean;
};

type HeroConfigRow = {
  video_url: string | null;
  video_r2_key: string | null;
  video_mime_type: string | null;
  frame_keys: unknown;
  frame_urls: unknown;
  frame_count: number | null;
  frame_width: number | null;
  frame_height: number | null;
  cta_text: string | null;
  cta_href: string | null;
  is_published: boolean | null;
  updated_at: string | null;
};

const SELECT_COLS =
  'video_url, video_r2_key, video_mime_type, frame_keys, frame_urls, frame_count, frame_width, frame_height, cta_text, cta_href, is_published, updated_at';

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * True when `R2_PUBLIC_URL` is a real public host bound to the media bucket
 * (custom domain / r2.dev) — NOT the S3 API endpoint, which can't serve a
 * plain browser GET. When false, we presign instead.
 */
function publicHostConfigured(): boolean {
  const base = process.env.R2_PUBLIC_URL;
  return Boolean(base && !base.includes('.r2.cloudflarestorage.com'));
}

/** Builds a public media URL `${R2_PUBLIC_URL}/${key}` (bucket-bound host → no bucket segment). */
function mediaPublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${base}/${encoded}`;
}

const MEDIA_MARKER = `/${R2_BUCKETS.media}/`;

/**
 * Recovers an R2 key from a stored display URL, for rows written before
 * `frame_keys` existed. Handles `.../setnayan-media/<key>` (legacy account
 * endpoint) and `${host}/<key>` (bucket-bound public host) shapes.
 */
function keyFromUrl(url: string): string | null {
  const marker = url.indexOf(MEDIA_MARKER);
  if (marker >= 0) return decodeURIComponent(url.slice(marker + MEDIA_MARKER.length));
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '');
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

// Presigned GET lifetime (24h) and how often we re-sign the batch (6h). The
// cache TTL is well under the presign lifetime so a cached URL can never expire
// while it's still being served.
const PRESIGN_TTL_SECONDS = 60 * 60 * 24;
const FRAME_CACHE_TTL_SECONDS = 60 * 60 * 6;

/** Presigns an ordered list of media keys (module-scope for a stable unstable_cache identity). */
async function presignFrames(keys: string[]): Promise<string[]> {
  return Promise.all(
    keys.map((key) => r2SignedGet({ bucket: R2_BUCKETS.media, key, expiresIn: PRESIGN_TTL_SECONDS })),
  );
}

/**
 * Resolves an ordered list of media keys to browser-loadable URLs — public
 * when a real public host is configured, otherwise presigned GETs.
 *
 * The homepage is force-dynamic, so without caching the presigned branch would
 * re-sign on every request → the SigV4 query string differs each render → the
 * browser never gets a cache hit and a returning visitor re-downloads every
 * frame. So we cache the presigned batch keyed on the row's `updated_at`: the
 * same signed URLs are reused across renders (and the per-render crypto is
 * skipped), and any admin save/publish bumps `updated_at` → fresh key → fresh
 * URLs. The public-host branch needs no cache — those URLs are already stable
 * and browser-cacheable.
 *
 * Throws only if presigning fails (R2 not configured); callers catch → default hero.
 */
async function resolveMediaUrls(keys: string[], cacheKey: string): Promise<string[]> {
  if (publicHostConfigured()) return keys.map(mediaPublicUrl);
  const getCachedPresigned = unstable_cache(presignFrames, ['homepage-hero-frames', cacheKey], {
    revalidate: FRAME_CACHE_TTL_SECONDS,
    tags: ['homepage-hero'],
  });
  return getCachedPresigned(keys);
}

/** A single media key → one loadable URL (public or presigned), or null on failure. */
async function resolveOneMediaUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    if (publicHostConfigured()) return mediaPublicUrl(key);
    return await r2SignedGet({ bucket: R2_BUCKETS.media, key });
  } catch {
    return null;
  }
}

/** Reads keys from the row — prefers stored frame_keys, falls back to deriving them from frame_urls. */
function frameKeysFromRow(row: Pick<HeroConfigRow, 'frame_keys' | 'frame_urls'>): string[] {
  const stored = toStringArray(row.frame_keys);
  if (stored.length > 0) return stored;
  return toStringArray(row.frame_urls)
    .map(keyFromUrl)
    .filter((k): k is string => Boolean(k));
}

/**
 * Returns the published hero video config, or null when nothing is published
 * (or the published row has no resolvable frames). Never throws — any read or
 * URL-resolution failure degrades to the default hero.
 */
export async function fetchPublishedHeroVideo(): Promise<HeroVideoConfig | null> {
  let row: HeroConfigRow | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('homepage_hero_config')
      .select(SELECT_COLS)
      .eq('id', 1)
      .maybeSingle();
    row = (data as HeroConfigRow | null) ?? null;
  } catch {
    // Missing env / table not migrated yet → fall back to the default hero.
    return null;
  }

  if (!row || !row.is_published) return null;
  const keys = frameKeysFromRow(row);
  if (keys.length === 0) return null;

  let frameUrls: string[];
  try {
    // Key the presigned-URL cache on updated_at so a republish invalidates it.
    frameUrls = await resolveMediaUrls(keys, row.updated_at ?? 'v0');
  } catch {
    // R2 not configured / signing failed → fall back to the default hero.
    return null;
  }
  if (frameUrls.length === 0) return null;

  return {
    videoUrl: null, // the scrub renders frames, not the source video
    frameUrls,
    frameCount: row.frame_count ?? frameUrls.length,
    frameWidth: row.frame_width,
    frameHeight: row.frame_height,
    ctaText: row.cta_text?.trim() || 'Start your wedding planning here — free',
    ctaHref: row.cta_href?.trim() || '/onboarding/wedding',
    isPublished: true,
  };
}

/** Full config (incl. drafts) for the admin editor. */
export async function fetchHeroVideoConfigForAdmin(): Promise<HeroVideoConfig & { videoR2Key: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('homepage_hero_config')
    .select(SELECT_COLS)
    .eq('id', 1)
    .maybeSingle();
  const row = (data as HeroConfigRow | null) ?? null;
  const keys = row ? frameKeysFromRow(row) : [];
  const videoUrl = await resolveOneMediaUrl(row?.video_r2_key ?? null);
  return {
    videoUrl,
    videoR2Key: row?.video_r2_key ?? null,
    frameUrls: [], // admin editor shows counts + status, not frame previews
    frameCount: row?.frame_count ?? keys.length,
    frameWidth: row?.frame_width ?? null,
    frameHeight: row?.frame_height ?? null,
    ctaText: row?.cta_text?.trim() || 'Start your wedding planning here — free',
    ctaHref: row?.cta_href?.trim() || '/onboarding/wedding',
    isPublished: Boolean(row?.is_published),
  };
}
