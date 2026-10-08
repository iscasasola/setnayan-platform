/**
 * EVENT HUB MUSIC — "Our music": the tracks a Setnayan admin uploads at
 * /admin/hub-music and a couple picks in Look › Music (owner 2026-10-08:
 * "background music. where can we upload via admin to add music they can pick?").
 *
 * PURE ON PURPOSE — no `server-only`, no SDK, no I/O — so the admin page (a
 * client component), the upload route, the server action and the tests all read
 * ONE rule for: the moods, where the files live, which files are accepted, and
 * what a file name becomes. Table: `hub_music_tracks`
 * (migration 20271266495922_hub_music_tracks.sql).
 */

/**
 * The moods, in the order the couple's list shows them. A CLOSED list: the key
 * is what the database stores (its CHECK names the same nine), the label is
 * what a person reads.
 */
export const HUB_MUSIC_MOODS = [
  { key: 'classic_romantic', label: 'Classic Romantic' },
  { key: 'harana', label: 'Harana' },
  { key: 'garden_rustic', label: 'Garden and Rustic' },
  { key: 'modern_minimal', label: 'Modern Minimal' },
  { key: 'grand_cinematic', label: 'Grand and Cinematic' },
  { key: 'beach_sunset', label: 'Beach and Sunset' },
  { key: 'soft_jazz_reception', label: 'Soft Jazz Reception' },
  { key: 'playful_joyful', label: 'Playful and Joyful' },
  { key: 'warm_intimate', label: 'Warm and Intimate' },
] as const;

export type HubMusicMood = (typeof HUB_MUSIC_MOODS)[number]['key'];

/** What a track with no mood is called. It cannot be published until it has one. */
export const HUB_MUSIC_NO_MOOD_LABEL = 'No mood yet';

export function isHubMusicMood(value: unknown): value is HubMusicMood {
  return typeof value === 'string' && HUB_MUSIC_MOODS.some((m) => m.key === value);
}

export function hubMusicMoodLabel(mood: string | null | undefined): string {
  return HUB_MUSIC_MOODS.find((m) => m.key === mood)?.label ?? HUB_MUSIC_NO_MOOD_LABEL;
}

/** Lowercase words only: "Garden & Rustic-2" → "garden and rustic 2". */
function plain(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The mood a TITLE names, or null.
 *
 * Only a title that STARTS WITH a mood's own name is a match — "Harana -
 * Moonlit" is a Harana track, "Velvet Court" is nobody's. A guess that reached
 * further (one shared word, say) would file "Modern Love" under Modern Minimal
 * without anyone having decided that; an unmatched title is left for the admin
 * to pick in its row.
 */
export function guessHubMusicMood(title: string): HubMusicMood | null {
  const words = plain(title);
  if (!words) return null;
  for (const mood of HUB_MUSIC_MOODS) {
    const name = plain(mood.label);
    if (words === name || words.startsWith(`${name} `)) return mood.key;
  }
  return null;
}

/** The longest title the table accepts (its CHECK says the same). */
export const HUB_MUSIC_TITLE_MAX = 80;

/**
 * A file name → the track's first title.
 *
 *   "Classic Romantic.m4a"      → "Classic Romantic"
 *   "Classic Romantic-2.m4a"    → "Classic Romantic 2"
 *   "Harana - Moonlit-2.m4a"    → "Harana - Moonlit 2"
 *   "soft_jazz_reception (3).mp3" → "soft jazz reception 3"
 *
 * The generator names a second take "‹Title›-2"; a hyphen glued to a number
 * reads as a typo in a list, so it becomes a space. A hyphen WITH spaces
 * around it ("Harana - Moonlit") is the title's own and is kept.
 */
export function hubMusicTitleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const title = stem
    .replace(/_/g, ' ')
    .replace(/\s*\((\d+)\)\s*$/, ' $1')
    .replace(/(\S)-(\d+)$/, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return (title || 'Untitled').slice(0, HUB_MUSIC_TITLE_MAX);
}

/** A title as it will be stored, or null when there is nothing to store. */
export function cleanHubMusicTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title || title.length > HUB_MUSIC_TITLE_MAX) return null;
  return title;
}

/** "2:27" — or "—" when the length could not be read. Never "0:00". */
export function formatHubMusicLength(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// ── Where the files live, and which files are let in ────────────────────────

/** The folder in the public media bucket. Its own root, so nothing else's rule reaches it. */
export const HUB_MUSIC_ROOT = 'hub-music';
export const HUB_MUSIC_PREFIX = `${HUB_MUSIC_ROOT}/`;

/** 20 MB — the cap the couple's own song upload already uses (`SiteChromePanel`). */
export const HUB_MUSIC_MAX_BYTES = 20 * 1024 * 1024;

/** The three kinds of file accepted: M4A (AAC) · MP3 · AAC. */
export const HUB_MUSIC_CONTENT_TYPES = ['audio/mp4', 'audio/mpeg', 'audio/aac'] as const;
export type HubMusicContentType = (typeof HUB_MUSIC_CONTENT_TYPES)[number];

/** What the file picker offers. Extensions too: a browser's own type for .m4a varies. */
export const HUB_MUSIC_ACCEPT = '.m4a,.mp3,.aac,audio/mp4,audio/x-m4a,audio/mpeg,audio/aac';

const TYPE_ALIASES: Readonly<Record<string, HubMusicContentType>> = {
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/mp4a-latm': 'audio/mp4',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/aac': 'audio/aac',
  'audio/x-aac': 'audio/aac',
  'audio/aacp': 'audio/aac',
};

const EXTENSION_TYPES: Readonly<Record<string, HubMusicContentType>> = {
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
};

/**
 * The content type to upload a picked file as — or null when it is not one of
 * the three kinds.
 *
 * 🔑 A BROWSER DOES NOT CALL AN .m4a "audio/mp4". Chrome and Safari report
 * `audio/x-m4a`, Firefox `audio/mp4`, and some report nothing at all. The
 * upload route's list holds only the canonical names, so a picker that passed
 * `file.type` through would refuse the owner's own files in two browsers out of
 * three. The name's extension breaks a tie the browser left open; a type the
 * browser DID state and that is not audio we accept is refused, whatever the
 * extension says.
 */
export function hubMusicContentTypeFor(
  fileName: string,
  browserType: string | null | undefined,
): HubMusicContentType | null {
  const stated = (browserType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (stated && stated !== 'application/octet-stream') return TYPE_ALIASES[stated] ?? null;
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return EXTENSION_TYPES[ext] ?? null;
}

/** True for an object key this feature owns: `hub-music/<something>`, nothing escaping it. */
export function isHubMusicKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    key.startsWith(HUB_MUSIC_PREFIX) &&
    key.length > HUB_MUSIC_PREFIX.length &&
    key.length <= 512 &&
    !key.includes('..') &&
    !key.includes('//') &&
    !/[\u0000-\u001f\\]/.test(key)
  );
}

/**
 * The rule `/api/upload` applies when a presign names this folder — admin only,
 * the three audio kinds, 20 MB. `null` for every other folder, which keeps its
 * own rules untouched.
 *
 * Matched on the FIRST path segment, so `events/<id>/hub-music` (a couple's own
 * folder that happens to share the word) is not this.
 */
export function hubMusicUploadRule(
  sanitizedPathPrefix: string,
): { adminOnly: true; contentTypes: readonly string[]; maxBytes: number } | null {
  const root = sanitizedPathPrefix.split('/').find((s) => s.length > 0) ?? '';
  if (root.toLowerCase() !== HUB_MUSIC_ROOT) return null;
  return { adminOnly: true, contentTypes: HUB_MUSIC_CONTENT_TYPES, maxBytes: HUB_MUSIC_MAX_BYTES };
}

/**
 * The whole presign decision for this folder, as one pure answer the route
 * returns verbatim: `null` lets the upload through.
 *
 * The sentences name the limit a person can act on. The 403 does not — the
 * house style of `lib/upload-prefix-tenancy.ts`: a caller who is not allowed
 * here learns the location was refused, not why.
 */
export function hubMusicUploadRefusal(args: {
  bucketKey: string;
  isAdmin: boolean;
  /** The base content type — parameters already stripped. */
  contentType: string;
  sizeBytes: number;
}): { status: 400 | 403 | 413; error: string } | null {
  if (!args.isAdmin || args.bucketKey !== 'media') {
    return { status: 403, error: 'That upload location isn’t allowed.' };
  }
  if (!(HUB_MUSIC_CONTENT_TYPES as readonly string[]).includes(args.contentType)) {
    return { status: 400, error: 'Event Hub music must be an M4A, MP3 or AAC file.' };
  }
  if (!(args.sizeBytes <= HUB_MUSIC_MAX_BYTES)) {
    return {
      status: 413,
      error: `That file is ${(args.sizeBytes / 1024 / 1024).toFixed(1)} MB — Event Hub music can be up to ${HUB_MUSIC_MAX_BYTES / 1024 / 1024} MB.`,
    };
  }
  return null;
}

/** One track as the admin page holds it. */
export type HubMusicAdminTrack = {
  trackId: string;
  publicId: string;
  title: string;
  mood: HubMusicMood | null;
  durationSeconds: number | null;
  fileBytes: number;
  isPublished: boolean;
  sortOrder: number;
  /** A playable address for ▶, or null when one could not be made. */
  previewUrl: string | null;
};

/** Mood order, then the hand order, then the title — the order both lists use. */
export function sortHubMusicTracks<T extends { mood: string | null; sortOrder: number; title: string }>(
  tracks: readonly T[],
): T[] {
  const rank = (mood: string | null) => {
    const at = HUB_MUSIC_MOODS.findIndex((m) => m.key === mood);
    return at === -1 ? HUB_MUSIC_MOODS.length : at;
  };
  return [...tracks].sort(
    (a, b) =>
      rank(a.mood) - rank(b.mood) ||
      a.sortOrder - b.sortOrder ||
      a.title.localeCompare(b.title, 'en', { numeric: true }),
  );
}
