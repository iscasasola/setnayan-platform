/**
 * WEBSITE MEDIA — the read side of the media bucket.
 *
 * Every admin media surface we ship is a WRITE side: background-videos uploads
 * six clips, hero-video uploads one, papic-storage totals bytes from DATABASE
 * rows. None of them lists what is actually sitting in R2, so a file the
 * database stopped pointing at becomes invisible and stays forever. (Several
 * upload paths do exactly that: they repoint a row and never delete the object
 * they replaced.)
 *
 * This module is the pure logic behind `/admin/website-media`. Three safety
 * properties, all deliberate, all tested:
 *
 *   1. AN ALLOWLIST, NOT A FILTER. The page can only ever see the prefixes in
 *      SITE_MEDIA_PREFIXES — the site's own furniture. Customer content in the
 *      same bucket (`events/`, `living-heroes/`, `locked-qr-proof/`, …) is not
 *      reachable from this surface at all. `assertDeletableKey` re-checks the
 *      SAME allowlist inside the delete action, because a hidden form field is
 *      not a permission.
 *
 *   2. UNPROVEN IS NOT UNUSED. A key is reported `unreferenced` only when a
 *      resolver actually READ the references and came back without it. Missing,
 *      thrown or denied ⇒ `unknown`. An RLS denial and an empty read are the
 *      same value, and a broken read would otherwise paint every file "safe to
 *      delete" at once.
 *
 *   3. ONLY PROVEN-LEFTOVER IS DELETABLE. `isDeletableUsage` allows deletion for
 *      `unreferenced` and NOTHING else — `unknown` is refused just as firmly as
 *      `in-use`. An earlier revision allowed deleting `unknown` files behind a
 *      warning; a review found a LIVE file (the onboarding background music)
 *      sitting in an unresolved folder under prose calling it "probably left
 *      over", with Delete enabled. Prose is not a safety mechanism. Every prefix
 *      below therefore has a real resolver, and anything we cannot prove is
 *      simply not deletable here.
 *
 * ⚠ THE PREFIXES BELOW COME FROM THE UPLOAD CALL SITES, NOT FROM NAMES THAT
 * READ PLAUSIBLY. The first revision of this file guessed
 * `homepage-background-videos/` from a module name; the uploader actually writes
 * `homepage-bg/slot-N/`, so the allowlist matched zero objects and the page's
 * whole purpose silently did nothing. When adding a prefix, grep the
 * `presignAndPut(...)` / `pathPrefix` argument that mints the key.
 */

/** How confident we are that a stored object is still doing a job. */
export type MediaUsage =
  /** A live reference was found — deleting this breaks the site. */
  | 'in-use'
  /** References were read successfully and this key was not among them. */
  | 'unreferenced'
  /** We could not establish the truth. Never deletable. */
  | 'unknown';

export type SiteMediaPrefix = {
  /** R2 key prefix, always ending in `/`. */
  prefix: string;
  label: string;
  /** What this folder is for, in the owner's language. */
  blurb: string;
};

/**
 * The ONLY prefixes this surface may list or delete. Site furniture only.
 *
 * Verified against the code that mints each key:
 *   homepage-bg/    ← background-videos-manager.tsx  `homepage-bg/slot-${slot}`
 *   hero-videos/    ← hero-uploader.tsx              'hero-videos'
 *   hero-frames/    ← hero-uploader.tsx              `hero-frames/${sessionId}`
 *   onboarding/     ← onboarding-surface.tsx          pathPrefix="onboarding/background-music"
 *   brand-icon/     ← admin/settings/actions.ts      `brand-icon/${randomUUID()}`
 *   nav-icons/      ← admin/menus/actions.ts         `nav-icons/${slot}-${randomUUID()}.${ext}`
 *
 * Deliberately ABSENT (customer or financial content in the same bucket):
 *   events/ · living-heroes/ · locked-qr-proof/ · merchant-qr/ · editorial-vendor/
 */
export const SITE_MEDIA_PREFIXES: readonly SiteMediaPrefix[] = [
  {
    prefix: 'homepage-bg/',
    label: 'Homepage background videos',
    blurb:
      'The looping clips behind the homepage — one main video and five pillar clips. Replacing one leaves the old file here.',
  },
  {
    // RETIRED 2026-08-02: the uploader, its Studio surface and lib/hero-video.ts
    // were deleted. Nothing reads these prefixes, so every object under them is
    // genuinely unreferenced — see readHeroRefs() and its guard test.
    prefix: 'hero-videos/',
    label: 'Sign-in page video (retired)',
    blurb:
      'Clips from the old sign-in page video tool, which has been removed. Nothing on the site uses these, so all of them can go.',
  },
  {
    prefix: 'hero-frames/',
    label: 'Sign-in page frames (retired)',
    blurb:
      'Still frames from those same clips — a new folder every time one was uploaded. Nothing uses these either, and this is usually the biggest thing to clear.',
  },
  {
    prefix: 'onboarding/',
    label: 'Onboarding background music',
    blurb:
      'The music that plays while a couple answers the sign-up questions. Only the track currently chosen is live. (The city and style pictures are not stored here — they ship inside the app itself.)',
  },
  {
    // The brand-icon uploader ALREADY removes the previous set (settings/actions.ts
    // calls deletePublicAsset over the five brand_icon_*_url columns), so leftovers
    // here are the exception, not the rule. Do not promise a pile that is not there.
    prefix: 'brand-icon/',
    label: 'Brand icons',
    blurb:
      'The logo set — favicon, touch icon, PNG and SVG. Replacing the logo already removes the old set automatically, so anything left here is unusual.',
  },
  {
    prefix: 'nav-icons/',
    label: 'Menu icons',
    blurb:
      'Custom icons uploaded for individual menu items. Changing one leaves the previous icon here.',
  },
] as const;

/** True when `key` sits under one of the allowlisted site-media prefixes. */
export function isSiteMediaKey(key: string): boolean {
  return SITE_MEDIA_PREFIXES.some((p) => key.startsWith(p.prefix));
}

/** The allowlist entry owning `key`, or null. */
export function prefixFor(key: string): SiteMediaPrefix | null {
  return SITE_MEDIA_PREFIXES.find((p) => key.startsWith(p.prefix)) ?? null;
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

/**
 * Whether a file in this state may be deleted AT ALL.
 *
 * Proven-leftover only. `unknown` is refused because it means we did not manage
 * to check — see property 3 in the module docblock.
 */
export function isDeletableUsage(usage: MediaUsage): boolean {
  return usage === 'unreferenced';
}

/**
 * Recovers an object key from a stored URL or ref.
 *
 * Several columns hold a display URL or an `r2://bucket/key` ref rather than a
 * bare key — brand icons are URLs, and hero rows written before `frame_keys`
 * existed hold only `frame_urls`. Those files are still on screen, so failing to
 * parse one would mark a LIVE asset "left over". Accepts anything containing an
 * allowlisted prefix; returns null when it finds none.
 */
export function keyFromRef(value: string): string | null {
  if (typeof value !== 'string' || !value) return null;

  let s = value.split('?')[0] ?? '';
  if (s.startsWith('r2://')) {
    // r2://<bucket>/<key>
    const rest = s.slice('r2://'.length);
    const slash = rest.indexOf('/');
    s = slash > 0 ? rest.slice(slash + 1) : '';
  }
  try {
    // Percent-encoded keys appear inside signed URLs.
    s = decodeURIComponent(s);
  } catch {
    /* leave as-is */
  }
  if (!s) return null;

  if (prefixFor(s)) return s;
  for (const p of SITE_MEDIA_PREFIXES) {
    const at = s.indexOf(`/${p.prefix}`);
    if (at !== -1) return s.slice(at + 1);
  }
  return null;
}

/** One object as R2 reports it. */
export type StoredObject = {
  key: string;
  size: number;
  /** ISO-8601. A string, not a Date — this crosses the server/client boundary. */
  lastModified: string | null;
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
  /** True when the listing hit its ceiling — the rows below are NOT everything. */
  truncated?: boolean;
  /** Set when this folder could not be listed at all. */
  listingError?: string;
};

/**
 * Classifies the objects of ONE prefix against that prefix's reference lookup.
 *
 * When the lookup failed, every row is `unknown` — deliberately. A resolver that
 * errors returns no keys, and "no keys" read as "nothing is referenced" would
 * mark the entire folder deletable in one pass.
 */
export function classifyGroup(args: {
  prefix: SiteMediaPrefix;
  objects: readonly StoredObject[];
  lookup: ReferenceLookup;
  truncated?: boolean;
  listingError?: string;
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
    ...(args.truncated ? { truncated: true } : {}),
    ...(args.listingError ? { listingError: args.listingError } : {}),
  };
}

export type MediaSummary = {
  fileCount: number;
  totalBytes: number;
  /** Bytes held by files we PROVED nothing points at. */
  reclaimableBytes: number;
  reclaimableCount: number;
  unknownCount: number;
  /**
   * True when any folder failed to list or was truncated, so the totals above
   * are a FLOOR, not a measurement. The page must say so rather than presenting
   * a confident number it cannot stand behind.
   */
  incomplete: boolean;
};

export function summarize(groups: readonly MediaGroup[]): MediaSummary {
  let fileCount = 0;
  let totalBytes = 0;
  let reclaimableBytes = 0;
  let reclaimableCount = 0;
  let unknownCount = 0;
  let incomplete = false;

  for (const g of groups) {
    if (g.truncated || g.listingError) incomplete = true;
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
    incomplete,
  };
}

/** Human file size. Plain units — this page is read by the owner, not by ops. */
export function humanBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}

/**
 * Formats a stored timestamp identically on the server and in the browser.
 *
 * The timezone is PINNED. Without it the server renders in UTC and the browser
 * renders in the viewer's zone, so the two HTML strings disagree and React
 * reports a hydration mismatch on any file uploaded near midnight.
 */
export function formatStoredDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}
