import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, R2_BUCKETS, r2Delete, r2List } from '@/lib/r2';
import { retirableKeys } from '@/lib/media-retirement';
import {
  classifyGroup,
  keyFromRef,
  prefixFor,
  SITE_MEDIA_PREFIXES,
  summarize,
  type MediaGroup,
  type MediaSummary,
  type ReferenceLookup,
  type StoredObject,
} from '@/lib/website-media';

/**
 * Server side of `/admin/website-media`: list the bucket, then ask the database
 * which of those keys are still doing a job.
 *
 * THE ASYMMETRY THAT GOVERNS EVERY RESOLVER BELOW: over-reporting a reference is
 * harmless (the file shows as in-use and simply stays), while under-reporting
 * one invites the owner to delete something live. So each resolver collects
 * generously — current column AND legacy fallback — and any error at all
 * degrades the whole prefix to `unknown` rather than returning the keys it
 * managed to read. A partial answer is the dangerous shape here: it looks
 * complete.
 *
 * EVERY allowlisted prefix has a resolver. That is a requirement, not a
 * coincidence: without one a folder is permanently `unknown`, and an earlier
 * revision paired that state with an enabled Delete button and a blurb guessing
 * the files were junk — over a folder whose only occupant was live. Adding a
 * prefix to the allowlist without adding its resolver here reintroduces exactly
 * that. `resolverFor` therefore has no silent default.
 */

/**
 * Hard ceiling per prefix so a broad listing can't stall a page render.
 * `hero-frames/` accumulates a folder per upload and is the one built to grow,
 * so truncation is reported rather than hidden — see `r2List`'s `truncated`.
 */
const MAX_KEYS_PER_PREFIX = 5000;

/** Pulls a string array out of a jsonb / text[] column without trusting its shape. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    // jsonb arrives as JSON; a Postgres text[] can arrive as `{a,b}`.
    if (s.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        return [];
      }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      return s
        .slice(1, -1)
        .split(',')
        .map((p) => p.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }
    return [s];
  }
  return [];
}

/** References held by `homepage_background_videos` (the six homepage clips). */
async function readBackgroundVideoRefs(): Promise<ReferenceLookup> {
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
    const parsed = k ? keyFromRef(k) : null;
    if (parsed) keys.add(parsed);
    if (k) keys.add(k); // belt and braces — over-reporting is the safe direction
  }
  return { ok: true, keys };
}

/**
 * References held by `homepage_hero_config` — the hero clip AND its frame
 * sequence. One read serves both the `hero-videos/` and `hero-frames/` groups.
 *
 * All rows are read, not just the published one: an unpublished draft's frames
 * are still needed the moment it is published, so treating them as leftover
 * would delete the next hero out from under the owner.
 */
async function readHeroRefs(): Promise<ReferenceLookup> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('homepage_hero_config')
    .select('video_r2_key, frame_keys, frame_urls');

  if (error) {
    return { ok: false, reason: `Could not read the sign-in page settings (${error.message}).` };
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { video_r2_key: string | null; frame_keys: unknown; frame_urls: unknown };
    if (r.video_r2_key) {
      keys.add(r.video_r2_key);
      const p = keyFromRef(r.video_r2_key);
      if (p) keys.add(p);
    }
    for (const k of toStringArray(r.frame_keys)) {
      keys.add(k);
      const p = keyFromRef(k);
      if (p) keys.add(p);
    }
    // Legacy rows carry only URLs — recover the keys so live frames are never
    // reported as left over.
    for (const u of toStringArray(r.frame_urls)) {
      const p = keyFromRef(u);
      if (p) keys.add(p);
    }
  }
  return { ok: true, keys };
}

/**
 * References held by `platform_settings` — the onboarding background music and
 * the brand icon set. One read serves both groups.
 *
 * ⚠ This resolver exists because a review found the onboarding music sitting in
 * an unresolved folder, labelled "probably left over", with Delete enabled. It
 * is the live track every couple hears on the sign-up flow.
 */
async function readPlatformSettingsRefs(): Promise<ReferenceLookup> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select(
      'onboarding_bg_music_r2_key, brand_icon_master_url, brand_favicon_ico_url, brand_apple_touch_url, brand_icon_png_512_url, brand_icon_svg_url',
    );

  if (error) {
    return { ok: false, reason: `Could not read the site settings (${error.message}).` };
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (typeof value !== 'string' || !value) continue;
      keys.add(value);
      const p = keyFromRef(value);
      if (p) keys.add(p);
    }
  }
  return { ok: true, keys };
}

/**
 * Which read backs which prefix. Exhaustive by construction — an unmapped
 * prefix throws at build/dev time rather than defaulting to a permanently
 * `unknown` folder.
 */
type LookupSource = 'backgroundVideos' | 'hero' | 'platformSettings';

const SOURCE_FOR_PREFIX: Record<string, LookupSource> = {
  'homepage-bg/': 'backgroundVideos',
  'hero-videos/': 'hero',
  'hero-frames/': 'hero',
  'onboarding/': 'platformSettings',
  'brand-icon/': 'platformSettings',
};

/**
 * Reads each source AT MOST ONCE per call and hands the same result to every
 * prefix that depends on it.
 *
 * Request-scoped on purpose: an earlier revision cached these in a module-level
 * promise, which is shared across concurrent requests in a Next server module,
 * so one request's reset could land between another's two hero lookups and
 * classify its two groups from different reads.
 */
async function readAllSources(): Promise<Record<LookupSource, ReferenceLookup>> {
  const [backgroundVideos, hero, platformSettings] = await Promise.all([
    readBackgroundVideoRefs().catch(
      (e: unknown): ReferenceLookup => ({
        ok: false,
        reason: `Could not read the homepage videos list (${e instanceof Error ? e.message : String(e)}).`,
      }),
    ),
    readHeroRefs().catch(
      (e: unknown): ReferenceLookup => ({
        ok: false,
        reason: `Could not read the sign-in page settings (${e instanceof Error ? e.message : String(e)}).`,
      }),
    ),
    readPlatformSettingsRefs().catch(
      (e: unknown): ReferenceLookup => ({
        ok: false,
        reason: `Could not read the site settings (${e instanceof Error ? e.message : String(e)}).`,
      }),
    ),
  ]);
  return { backgroundVideos, hero, platformSettings };
}

export type WebsiteMediaReport = {
  configured: boolean;
  groups: MediaGroup[];
  summary: MediaSummary;
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
        incomplete: false,
      },
    };
  }

  const sources = await readAllSources();
  const groups: MediaGroup[] = [];

  for (const prefix of SITE_MEDIA_PREFIXES) {
    const source = SOURCE_FOR_PREFIX[prefix.prefix];
    const lookup: ReferenceLookup = source
      ? sources[source]
      : {
          ok: false,
          reason:
            'This folder has no automatic check yet, so nothing in it can be removed from here.',
        };

    let objects: StoredObject[] = [];
    let truncated = false;
    let listingError: string | undefined;

    try {
      const listed = await r2List({
        bucket: R2_BUCKETS.media,
        prefix: prefix.prefix,
        maxKeys: MAX_KEYS_PER_PREFIX,
      });
      truncated = listed.truncated;
      objects = listed.objects.map((o) => ({
        key: o.key,
        size: o.size,
        lastModified: o.lastModified ? o.lastModified.toISOString() : null,
      }));
    } catch (err) {
      listingError = err instanceof Error ? err.message : String(err);
    }

    // A folder that failed to list is SHOWN, with its error — omitting it would
    // read as "this folder is clean" and quietly shrink the reported total.
    if (objects.length === 0 && !listingError) continue;

    groups.push(classifyGroup({ prefix, objects, lookup, truncated, listingError }));
  }

  return { configured: true, groups, summary: summarize(groups) };
}

/**
 * Re-derives, server-side, whether ONE key is still referenced.
 *
 * The delete action calls this instead of trusting the page's rendering. The
 * client's Delete button is disabled for anything not proven-leftover, but a
 * `disabled` attribute is a hint to a browser, not a permission — and the
 * verdict it was computed from may be seconds stale, or may have come from a
 * read that has since started failing.
 */
export async function usageForKey(key: string): Promise<ReferenceLookup> {
  const prefix = prefixFor(key);
  if (!prefix) return { ok: false, reason: 'That file is not website media.' };

  const source = SOURCE_FOR_PREFIX[prefix.prefix];
  if (!source) return { ok: false, reason: 'This folder has no automatic check yet.' };

  const sources = await readAllSources();
  return sources[source];
}

/**
 * Sweeps up the objects an upload path just replaced.
 *
 * Called by `saveBackgroundVideo` / `saveHeroVideo` AFTER their row update
 * succeeds. Until this existed, every replace left its predecessor in the bucket
 * forever — one clip per background-video replace, and an entire
 * `hero-frames/<sessionId>/` folder per hero re-upload.
 *
 * TWO INDEPENDENT REASONS ARE REQUIRED before anything is deleted:
 *   1. `retirableKeys` — the key is site media and is not among the new values;
 *   2. a FRESH reference read says nothing points at it any more.
 *
 * (2) is what makes this safe to run unattended. Two slots could in principle
 * hold the same object, or a row we do not update could still reference it; the
 * read settles that instead of assuming. If the read fails, NOTHING is deleted —
 * an empty result and a denied query are the same value, and treating a failure
 * as "unreferenced" would delete the live file this function exists to protect.
 *
 * BEST-EFFORT BY CONTRACT, matching `r2Delete`'s own docblock: a failure here
 * leaves an orphan (visible and removable at /admin/website-media), never a
 * broken publish. It never throws, and callers ignore the result.
 */
export async function retireReplacedMedia(args: {
  previous: readonly (string | null | undefined)[];
  next: readonly (string | null | undefined)[];
  /** For the log line, e.g. 'background-video slot 3'. */
  context: string;
}): Promise<{ deleted: string[]; kept: string[] }> {
  const deleted: string[] = [];
  const kept: string[] = [];

  try {
    const candidates = retirableKeys({ previous: args.previous, next: args.next });
    if (candidates.length === 0) return { deleted, kept };

    const sources = await readAllSources();

    for (const key of candidates) {
      const prefix = prefixFor(key);
      const source = prefix ? SOURCE_FOR_PREFIX[prefix.prefix] : undefined;
      const lookup = source ? sources[source] : undefined;

      // No resolver, or the read failed → we cannot prove it is unused. Leave it.
      if (!lookup || !lookup.ok) {
        kept.push(key);
        continue;
      }
      if (lookup.keys.has(key)) {
        // Something still points at it — a sibling row, or a value shape we
        // normalised differently. Leave it alone.
        kept.push(key);
        continue;
      }

      try {
        await r2Delete({ bucket: R2_BUCKETS.media, key });
        deleted.push(key);
      } catch (err) {
        kept.push(key);
        console.warn(
          `[website-media] could not remove the replaced object ${key} (${args.context}): ` +
            `${err instanceof Error ? err.message : String(err)}. It stays in storage and can be ` +
            'removed from /admin/website-media.',
        );
      }
    }

    if (deleted.length || kept.length) {
      console.info(
        `[website-media] ${args.context}: removed ${deleted.length} replaced file(s), ` +
          `kept ${kept.length} that could not be proven unused.`,
      );
    }
  } catch (err) {
    // Never let cleanup break a publish.
    console.warn(
      `[website-media] replacement sweep failed for ${args.context}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { deleted, kept };
}
