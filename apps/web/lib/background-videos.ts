import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, r2SignedGet } from '@/lib/r2';

/**
 * Homepage background videos — six admin-uploaded PLAIN looping clips.
 *
 * The owner uploads them in /admin/background-videos:
 *   • slot 0    — the MAIN homepage background video (the looping hero).
 *   • slots 1-5 — the five PILLAR "icon" videos in the bottom dock
 *                 (Ala Ala · Likhaan · Planuhan · Surian · Tiangge).
 *
 * Unlike the scroll-scrub hero (lib/hero-video.ts, an extracted JPEG frame
 * sequence), each of these is a single looping <video> file: the row stores the
 * uploaded clip's R2 key + mime, and the DISPLAY URL is rebuilt from the key at
 * read time (the media bucket's S3 endpoint is not publicly readable, so a
 * stored presigned URL would expire / break). Mirrors the hero's resolver:
 *   • PUBLIC URL when R2_PUBLIC_URL is a real bucket-bound public host; or
 *   • a short-lived PRESIGNED GET otherwise — cached on the row's updated_at so
 *     the signed URL stays stable across the force-dynamic homepage's renders
 *     (a browser cache hit on repeat visits; a republish bumps updated_at →
 *     fresh URL).
 *
 * Reads use the service-role client (the rows are public marketing assets, not
 * secrets). Never throws — any read/URL failure degrades to "no video" so the
 * homepage falls back to its default hero / hides the dock.
 */

export type BackgroundVideoSlot = {
  slot: number;
  pillarKey: string | null;
  label: string;
  href: string | null;
  url: string | null;
  mime: string | null;
  videoR2Key: string | null;
  isPublished: boolean;
};

type Row = {
  slot: number;
  pillar_key: string | null;
  label: string | null;
  href: string | null;
  video_r2_key: string | null;
  video_mime_type: string | null;
  is_published: boolean | null;
  updated_at: string | null;
};

const SELECT_COLS =
  'slot, pillar_key, label, href, video_r2_key, video_mime_type, is_published, updated_at';

// 7-day presign (SigV4 max), re-signed every 6d, with a long immutable
// Cache-Control so a returning visitor serves the cached clip locally. Matches
// the hero-frame caching strategy (lib/hero-video.ts).
const PRESIGN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PRESIGN_CACHE_TTL_SECONDS = 60 * 60 * 24 * 6;
const VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** True when R2_PUBLIC_URL is a real public host (not the SigV4-only S3 endpoint). */
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

/** Presigns one media key (module-scope for a stable unstable_cache identity). */
async function presignOne(key: string): Promise<string> {
  return r2SignedGet({
    bucket: R2_BUCKETS.media,
    key,
    expiresIn: PRESIGN_TTL_SECONDS,
    responseCacheControl: VIDEO_CACHE_CONTROL,
  });
}

/**
 * Resolves a single media key to a browser-loadable URL — public when a real
 * public host is configured, otherwise a presigned GET cached on `cacheKey`
 * (the row's updated_at) so the signed URL is reused across renders. Returns
 * null on any failure (R2 not configured / signing error) → caller hides it.
 */
async function resolveMediaUrl(key: string | null, cacheKey: string): Promise<string | null> {
  if (!key) return null;
  try {
    if (publicHostConfigured()) return mediaPublicUrl(key);
    const getCached = unstable_cache(presignOne, ['homepage-bg-video', cacheKey, key], {
      revalidate: PRESIGN_CACHE_TTL_SECONDS,
      tags: ['homepage-background-videos'],
    });
    return await getCached(key);
  } catch {
    return null;
  }
}

async function rowToSlot(row: Row, publishedOnly: boolean): Promise<BackgroundVideoSlot> {
  const live = Boolean(row.is_published) && Boolean(row.video_r2_key);
  // For the public read we only resolve a URL when the slot is live; the admin
  // read resolves a preview URL regardless of publish state.
  const url =
    !publishedOnly || live
      ? await resolveMediaUrl(row.video_r2_key, row.updated_at ?? 'v0')
      : null;
  return {
    slot: row.slot,
    pillarKey: row.pillar_key,
    label: row.label ?? `Slot ${row.slot}`,
    href: row.href,
    url,
    mime: row.video_mime_type,
    videoR2Key: row.video_r2_key,
    isPublished: Boolean(row.is_published),
  };
}

async function fetchRows(): Promise<Row[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('homepage_background_videos')
    .select(SELECT_COLS)
    .order('slot', { ascending: true });
  return (data as Row[] | null) ?? [];
}

export type PublishedBackgroundVideos = {
  /** The main looping hero clip, or null when slot 0 isn't published. */
  main: { url: string; mime: string | null } | null;
  /** The five pillar dock icons that are published (URL resolved). */
  pillars: BackgroundVideoSlot[];
};

/**
 * Public read for the homepage. Returns the live main hero clip + the live
 * pillar dock icons (only slots that are published AND have a resolvable URL).
 * Never throws — degrades to { main: null, pillars: [] }.
 */
export async function fetchPublishedBackgroundVideos(): Promise<PublishedBackgroundVideos> {
  let rows: Row[];
  try {
    rows = await fetchRows();
  } catch {
    // Missing env / table not migrated yet → no background videos.
    return { main: null, pillars: [] };
  }
  const slots = await Promise.all(rows.map((r) => rowToSlot(r, true)));
  const mainSlot = slots.find((s) => s.slot === 0);
  const main = mainSlot?.isPublished && mainSlot.url ? { url: mainSlot.url, mime: mainSlot.mime } : null;
  const pillars = slots
    .filter((s) => s.slot >= 1 && s.isPublished && Boolean(s.url))
    .sort((a, b) => a.slot - b.slot);
  return { main, pillars };
}

/** Full state (incl. drafts) for the admin editor — all six slots, ordered. */
export async function fetchBackgroundVideosForAdmin(): Promise<BackgroundVideoSlot[]> {
  const rows = await fetchRows();
  return Promise.all(rows.map((r) => rowToSlot(r, false)));
}
