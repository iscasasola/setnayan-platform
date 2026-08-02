import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, R2_BUCKETS, r2List } from '@/lib/r2';
import {
  classifyGroup,
  SITE_MEDIA_PREFIXES,
  summarize,
  type MediaGroup,
  type MediaSummary,
  type ReferenceLookup,
} from '@/lib/website-media';

/**
 * Server side of `/admin/website-media`: list the bucket, then ask the database
 * which of those keys are still doing a job.
 *
 * THE ASYMMETRY THAT GOVERNS EVERY RESOLVER BELOW: over-reporting a reference
 * is harmless (the file shows as in-use and simply stays), while under-reporting
 * one invites the owner to delete something live. So each resolver collects
 * generously — current column AND legacy fallback — and any error at all
 * degrades the whole prefix to `unknown` rather than returning the keys it
 * managed to read. A partial answer is the dangerous shape here: it looks
 * complete.
 */

/** Hard ceiling per prefix so a broad listing can't stall a page render. */
const MAX_KEYS_PER_PREFIX = 5000;

type Resolver = () => Promise<ReferenceLookup>;

/** Pulls a string array out of a jsonb/text[] column without trusting its shape. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Recovers an object key from a stored URL.
 *
 * Rows written before the `frame_keys` column existed hold only URLs, and those
 * frames are still on screen. Ignoring them would mark a live sequence
 * unreferenced, so we parse them back into keys.
 */
function keyFromUrl(url: string): string | null {
  if (typeof url !== 'string' || !url) return null;
  const withoutQuery = url.split('?')[0] ?? '';
  for (const p of SITE_MEDIA_PREFIXES) {
    const at = withoutQuery.indexOf(`/${p.prefix}`);
    if (at !== -1) return withoutQuery.slice(at + 1);
    if (withoutQuery.startsWith(p.prefix)) return withoutQuery;
  }
  return null;
}

/** References held by `homepage_background_videos` (the six homepage clips). */
const resolveBackgroundVideos: Resolver = async () => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('homepage_background_videos')
    .select('video_r2_key');

  if (error) {
    return { ok: false, reason: `Could not read the homepage videos list (${error.message}).` };
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const k = (row as { video_r2_key: string | null }).video_r2_key;
    if (k) keys.add(k);
  }
  return { ok: true, keys };
};

/**
 * References held by `homepage_hero_config` — the hero clip AND its frame
 * sequence. One read serves both the `hero-videos/` and `hero-frames/` groups,
 * so a single failure degrades both rather than half-answering either.
 */
let heroLookupPromise: Promise<ReferenceLookup> | null = null;
const resolveHeroConfig: Resolver = () => {
  heroLookupPromise ??= (async (): Promise<ReferenceLookup> => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('homepage_hero_config')
      .select('video_r2_key, frame_keys, frame_urls');

    if (error) {
      return { ok: false, reason: `Could not read the hero settings (${error.message}).` };
    }

    const keys = new Set<string>();
    for (const row of data ?? []) {
      const r = row as {
        video_r2_key: string | null;
        frame_keys: unknown;
        frame_urls: unknown;
      };
      if (r.video_r2_key) keys.add(r.video_r2_key);
      for (const k of toStringArray(r.frame_keys)) keys.add(k);
      // Legacy rows carry only URLs — recover the keys so live frames are not
      // reported as left-over.
      for (const u of toStringArray(r.frame_urls)) {
        const k = keyFromUrl(u);
        if (k) keys.add(k);
      }
    }
    return { ok: true, keys };
  })();
  return heroLookupPromise;
};

/**
 * Prefixes with no resolver.
 *
 * Stated as a reason rather than left to a default, because the page prints it
 * verbatim: the owner should see WHY a folder can't be judged instead of a bare
 * "unknown". Onboarding art is the interesting case — the app ships its own
 * copies in `public/`, so these are very likely left-over, but "likely" is not
 * the standard this page deletes on.
 */
const NO_RESOLVER: Record<string, string> = {
  'onboarding/':
    'These are not tracked in the database. The sign-up pages load their pictures from the app’s own files, so copies here are probably left over — but check one before deleting it.',
  'brand/':
    'These are not tracked in the database — brand artwork is referenced directly by the page code.',
};

function resolverFor(prefix: string): Resolver {
  if (prefix === 'homepage-background-videos/') return resolveBackgroundVideos;
  if (prefix === 'hero-videos/' || prefix === 'hero-frames/') return resolveHeroConfig;
  const reason = NO_RESOLVER[prefix] ?? 'No automatic check exists for this folder.';
  return async () => ({ ok: false, reason });
}

export type WebsiteMediaReport = {
  configured: boolean;
  groups: MediaGroup[];
  summary: MediaSummary;
  /** Set when the bucket itself could not be listed. */
  listingError?: string;
};

/** Builds the whole page model: every allowlisted prefix, listed and classified. */
export async function loadWebsiteMedia(): Promise<WebsiteMediaReport> {
  if (!isR2Configured()) {
    return {
      configured: false,
      groups: [],
      summary: {
        fileCount: 0,
        totalBytes: 0,
        reclaimableBytes: 0,
        reclaimableCount: 0,
        unknownCount: 0,
      },
    };
  }

  // Fresh per request — a cached lookup would outlive the row it describes.
  heroLookupPromise = null;

  const groups: MediaGroup[] = [];
  let listingError: string | undefined;

  for (const prefix of SITE_MEDIA_PREFIXES) {
    let objects: { key: string; size: number; lastModified: Date | null }[] = [];
    try {
      objects = await r2List({
        bucket: R2_BUCKETS.media,
        prefix: prefix.prefix,
        maxKeys: MAX_KEYS_PER_PREFIX,
      });
    } catch (err) {
      // Could not even see the folder. Report it and skip — showing an empty
      // group would read as "this folder is clean".
      listingError = err instanceof Error ? err.message : String(err);
      continue;
    }

    if (objects.length === 0) continue;

    const lookup = await resolverFor(prefix.prefix)();
    groups.push(classifyGroup({ prefix, objects, lookup }));
  }

  return {
    configured: true,
    groups,
    summary: summarize(groups),
    ...(listingError ? { listingError } : {}),
  };
}
