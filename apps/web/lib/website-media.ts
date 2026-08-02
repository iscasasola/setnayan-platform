/**
 * WEBSITE MEDIA — the read side of the media bucket.
 *
 * Every admin media surface we ship today is a WRITE side: background-videos
 * uploads six clips, hero-video uploads one, papic-storage totals bytes from
 * DATABASE rows. None of them lists what is actually sitting in R2, so a file
 * the database stopped pointing at becomes invisible and stays forever. (The
 * background-video replace path is exactly that: it writes the new
 * `video_r2_key` and never deletes the old object.)
 *
 * This module is the pure logic behind `/admin/website-media`. It holds two
 * safety properties, both deliberate:
 *
 *   1. AN ALLOWLIST, NOT A FILTER. The page can only ever see the prefixes
 *      named in SITE_MEDIA_PREFIXES — the site's own furniture. Guest photos,
 *      payment screenshots, contracts and verification IDs are not reachable
 *      from this surface at all, so no bug or forged request here can touch
 *      user data. `assertDeletableKey` re-checks the SAME allowlist inside the
 *      delete action, because a hidden form field is not a permission.
 *
 *   2. UNPROVEN IS NOT UNUSED. A key is only ever reported `unreferenced` when
 *      a resolver actually READ the references and came back without it. If the
 *      resolver is missing, or threw, or the read was denied, the key is
 *      `unknown` — an RLS denial and an empty result are the same value, and a
 *      broken read would otherwise paint every file "safe to delete" at once.
 */

/** How confident we are that a stored object is still doing a job. */
export type MediaUsage =
  /** A live reference was found — deleting this breaks the site. */
  | 'in-use'
  /** References were read successfully and this key was not among them. */
  | 'unreferenced'
  /** We could not establish the truth. Never treat as deletable. */
  | 'unknown';

export type SiteMediaPrefix = {
  /** R2 key prefix, always ending in `/`. */
  prefix: string;
  label: string;
  /** What this folder is for, in the owner's language. */
  blurb: string;
};

/**
 * The ONLY prefixes this surface may list or delete.
 *
 * Site furniture only. Anything holding customer content is deliberately
 * absent — see property 1 above.
 */
export const SITE_MEDIA_PREFIXES: readonly SiteMediaPrefix[] = [
  {
    prefix: 'homepage-background-videos/',
    label: 'Homepage background videos',
    blurb:
      'The looping hero clip and the five pillar clips. Replacing one leaves the old file here.',
  },
  {
    prefix: 'hero-videos/',
    label: 'Hero videos',
    blurb: 'Clips uploaded from the Hero video admin page.',
  },
  {
    prefix: 'hero-frames/',
    label: 'Hero frame sequences',
    blurb:
      'The still frames behind the scroll-scrubbed hero. Each upload writes a NEW numbered folder, so only the newest one is live — the earlier folders are left-over copies.',
  },
  {
    prefix: 'onboarding/',
    label: 'Onboarding pictures',
    blurb:
      'City and style pictures for the sign-up questions. The website serves its own copies of these from the app itself, so copies here may be left over.',
  },
  {
    prefix: 'brand/',
    label: 'Brand artwork',
    blurb: 'Logos, marks and icons used across the public pages.',
  },
] as const;

/** True when `key` sits under one of the allowlisted site-media prefixes. */
export function isSiteMediaKey(key: string): boolean {
  return SITE_MEDIA_PREFIXES.some((p) => key.startsWith(p.prefix));
}

/**
 * Gate for the delete action. Throws unless `key` is site media.
 *
 * The page never renders a control for anything else, but the action must not
 * rely on that: the key arrives in a form field, and a form field is user
 * input. This is the line that keeps a bug on this page from ever reaching a
 * guest photo.
 */
export function assertDeletableKey(key: string): void {
  if (!key || key.includes('..') || key.startsWith('/')) {
    throw new Error('Refusing to delete: malformed key.');
  }
  if (!isSiteMediaKey(key)) {
    throw new Error(
      'Refusing to delete: that file is not website media. This page can only ' +
        'touch the site’s own pictures and videos.',
    );
  }
}

/** One object as R2 reports it. */
export type StoredObject = {
  key: string;
  size: number;
  lastModified: Date | null;
};

/**
 * What a reference resolver came back with for one prefix.
 *
 * `ok: false` is a first-class outcome, not an exception to swallow — it is
 * what turns the whole group `unknown` instead of `unreferenced`.
 */
export type ReferenceLookup =
  | { ok: true; keys: ReadonlySet<string> }
  | { ok: false; reason: string };

export type MediaRow = StoredObject & {
  usage: MediaUsage;
  /** Present when `usage` is `unknown` — why we could not tell. */
  unknownReason?: string;
};

export type MediaGroup = SiteMediaPrefix & {
  rows: MediaRow[];
  totalBytes: number;
  counts: Record<MediaUsage, number>;
  /** Set when the whole group is unknown because its lookup failed. */
  lookupFailure?: string;
};

/**
 * Classifies the objects of ONE prefix against that prefix's reference lookup.
 *
 * When the lookup failed, every row is `unknown` — deliberately. A resolver
 * that errors returns no keys, and "no keys" read as "nothing is referenced"
 * would mark the entire folder deletable in one pass.
 */
export function classifyGroup(args: {
  prefix: SiteMediaPrefix;
  objects: readonly StoredObject[];
  lookup: ReferenceLookup;
}): MediaGroup {
  const { prefix, objects, lookup } = args;

  const rows: MediaRow[] = objects
    .map((o) => {
      if (!lookup.ok) {
        return { ...o, usage: 'unknown' as const, unknownReason: lookup.reason };
      }
      return {
        ...o,
        usage: (lookup.keys.has(o.key) ? 'in-use' : 'unreferenced') as MediaUsage,
      };
    })
    // Biggest first: the point of the page is reclaiming space.
    .sort((a, b) => b.size - a.size);

  const counts: Record<MediaUsage, number> = {
    'in-use': 0,
    unreferenced: 0,
    unknown: 0,
  };
  let totalBytes = 0;
  for (const r of rows) {
    counts[r.usage] += 1;
    totalBytes += r.size;
  }

  return {
    ...prefix,
    rows,
    totalBytes,
    counts,
    ...(lookup.ok ? {} : { lookupFailure: lookup.reason }),
  };
}

export type MediaSummary = {
  fileCount: number;
  totalBytes: number;
  /** Bytes held by files we PROVED nothing points at. */
  reclaimableBytes: number;
  reclaimableCount: number;
  unknownCount: number;
};

export function summarize(groups: readonly MediaGroup[]): MediaSummary {
  let fileCount = 0;
  let totalBytes = 0;
  let reclaimableBytes = 0;
  let reclaimableCount = 0;
  let unknownCount = 0;

  for (const g of groups) {
    for (const r of g.rows) {
      fileCount += 1;
      totalBytes += r.size;
      if (r.usage === 'unreferenced') {
        reclaimableBytes += r.size;
        reclaimableCount += 1;
      } else if (r.usage === 'unknown') {
        unknownCount += 1;
      }
    }
  }

  return {
    fileCount,
    totalBytes,
    reclaimableBytes,
    reclaimableCount,
    unknownCount,
  };
}

/** Human file size. Plain units — this page is read by the owner, not by ops. */
export function humanBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}
