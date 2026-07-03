import type { SupabaseClient } from '@supabase/supabase-js';

import { asVendorTier } from './vendor-tier-caps';

/**
 * Website-tier capability gate (owner 2026-07-03 tier ladder). Maps a vendor's
 * subscription `tier_state` to what the microsite editor unlocks:
 *   - canPersonalize (Solo+): About · accent · featured services · sections
 *   - canPremium (Pro+): custom slug · hero photo · pinned review · editorials
 *     + the 2-column public layout (mirrors tierCaps.customWebsiteName)
 *   - isEnterprise: the cinematic flagship layer
 * Free / Verified get the clean auto-composed page (no customization).
 */
export function micrositeCan(tierState: string | null | undefined): {
  canPersonalize: boolean;
  canPremium: boolean;
  isEnterprise: boolean;
} {
  const t = asVendorTier(tierState ?? null);
  const rank = t === 'enterprise' ? 3 : t === 'pro' ? 2 : t === 'solo' ? 1 : 0;
  return { canPersonalize: rank >= 1, canPremium: rank >= 2, isEnterprise: rank >= 3 };
}

/**
 * Vendor microsite customization — the curation layer a vendor sets in
 * My Shop → Website that overrides the auto-composed public `/v/[slug]` page.
 *
 * Everything here is OPTIONAL: an un-curated vendor renders exactly as before.
 * Reads are DEFENSIVE (see fetchVendorMicrosite) and deliberately decoupled
 * from the shared FULL_VENDOR_PROFILE_SELECT so a not-yet-applied migration
 * can never blank the profile / microsite.
 */

export type MicrositeSectionKey = 'portfolio' | 'trusted_by' | 'editorials';

export type VendorMicrosite = {
  about: string | null;
  /** Visibility map. Missing key = visible (default on). */
  sections: Record<string, boolean>;
  /** Service leaf keys floated to the front of the public Services list. */
  featuredServiceIds: string[];
  heroPhotoKey: string | null;
  accent: string | null;
  /** A review_id pinned to the top of the Reviews section (PRO). */
  pinnedReviewId: string | null;
  /** Story event_ids featured (first) in the public Editorials section (PRO). */
  featuredEditorialIds: string[];
  /**
   * Ordered video refs for the Enterprise "Films" video portfolio. Each is a
   * YouTube or Vimeo video (owner decision 2026-07-03: those two providers
   * ONLY; Google Drive declined). Stored provider-prefixed in the DB, parsed
   * back to structured refs here.
   */
  videos: VideoRef[];
};

export const MICROSITE_ABOUT_MAX = 600;
export const MICROSITE_FEATURED_SERVICES_MAX = 3;
export const MICROSITE_FEATURED_EDITORIALS_MAX = 3;
export const MICROSITE_VIDEOS_MAX = 30;

/**
 * Normalize a pasted YouTube link (or bare id) to its canonical 11-char video
 * id, or null if it isn't a recognizable YouTube video. Accepts watch?v=,
 * youtu.be/, /embed/, /shorts/, /live/, and a bare id. IDs are `[A-Za-z0-9_-]{11}`.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (ID.test(raw)) return raw;
  // watch?v=ID (and any &-params), plus embed/shorts/live/youtu.be path forms.
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1] ?? null;
  }
  return null;
}

/** A parsed film reference — YouTube or Vimeo (owner-locked providers). */
export type VideoRef =
  | { provider: 'youtube'; id: string }
  | { provider: 'vimeo'; id: string; hash?: string };

/**
 * Normalize a pasted link (or bare id) to a structured {@link VideoRef}, or
 * null if it isn't a recognizable YouTube or Vimeo video. Providers are
 * owner-locked to YouTube + Vimeo (2026-07-03) — Google Drive and everything
 * else are rejected via the null return.
 *
 * YouTube parsing is delegated to {@link parseYouTubeId} (bare 11-char ids and
 * all URL forms). Vimeo forms:
 *   - vimeo.com/{id}                       (numeric id)
 *   - vimeo.com/{id}/{hash}                (unlisted share link — h= hash)
 *   - vimeo.com/video/{id}
 *   - player.vimeo.com/video/{id}[?h={hash}]
 *   - vimeo.com/channels/{name}/{id}
 *   - vimeo.com/groups/{name}/videos/{id}
 *   - a bare numeric id
 *
 * Ambiguity: YouTube ids are exactly 11 chars from `[A-Za-z0-9_-]`; Vimeo ids
 * are purely numeric (typically 6–11 digits). An 11-digit bare number is a
 * valid YouTube id ONLY by coincidence — but a bare *all-digit* token is never
 * a real YouTube id in practice and is far more likely a pasted Vimeo id, so
 * bare all-numeric input resolves to Vimeo. Non-numeric bare 11-char tokens
 * stay YouTube (backward-compat with existing stored ids).
 */
export function parseVideoRef(input: string | null | undefined): VideoRef | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const looksLikeUrl = /^(https?:\/\/|www\.)|\//.test(raw) || raw.includes('.');

  // Bare token (no URL/path/dot): all-digits → Vimeo id; else try YouTube id.
  if (!looksLikeUrl) {
    if (/^\d{6,15}$/.test(raw)) return { provider: 'vimeo', id: raw };
    const yt = parseYouTubeId(raw);
    return yt ? { provider: 'youtube', id: yt } : null;
  }

  // A Vimeo URL? Match the host explicitly at a real host boundary (start, a
  // preceding "/" from the scheme, or a "." subdomain) so neither a Drive link
  // nor a look-alike like "evilvimeo.com" can slip in.
  if (/(?:^|\/\/|\.)(?:player\.)?vimeo\.com\//i.test(raw)) {
    // player.vimeo.com/video/{id}[?h={hash}] — hash lives in the query string.
    const player = raw.match(/player\.vimeo\.com\/video\/(\d+)/i);
    if (player?.[1]) {
      const h = raw.match(/[?&]h=([A-Za-z0-9]+)/);
      return h?.[1]
        ? { provider: 'vimeo', id: player[1], hash: h[1] }
        : { provider: 'vimeo', id: player[1] };
    }
    // vimeo.com/channels/{x}/{id} and /groups/{x}/videos/{id}
    const channel = raw.match(/vimeo\.com\/channels\/[^/]+\/(\d+)/i);
    if (channel?.[1]) return { provider: 'vimeo', id: channel[1] };
    const group = raw.match(/vimeo\.com\/groups\/[^/]+\/videos\/(\d+)/i);
    if (group?.[1]) return { provider: 'vimeo', id: group[1] };
    // vimeo.com/video/{id}
    const videoPath = raw.match(/vimeo\.com\/video\/(\d+)/i);
    if (videoPath?.[1]) return { provider: 'vimeo', id: videoPath[1] };
    // vimeo.com/{id}[/{hash}] — plain + unlisted share link.
    const plain = raw.match(/vimeo\.com\/(\d+)(?:\/([A-Za-z0-9]+))?/i);
    if (plain?.[1]) {
      return plain[2]
        ? { provider: 'vimeo', id: plain[1], hash: plain[2] }
        : { provider: 'vimeo', id: plain[1] };
    }
    return null;
  }

  // Otherwise fall back to YouTube URL parsing (rejects Drive / unknown hosts).
  const yt = parseYouTubeId(raw);
  return yt ? { provider: 'youtube', id: yt } : null;
}

/**
 * Serialize a {@link VideoRef} to its stored string form. YouTube stays a bare
 * 11-char id (backward-compat with pre-Vimeo rows); Vimeo stores as
 * `vimeo:{id}` or `vimeo:{id}:{hash}` for unlisted-with-hash links.
 */
export function serializeVideoRef(ref: VideoRef): string {
  if (ref.provider === 'youtube') return ref.id;
  return ref.hash ? `vimeo:${ref.id}:${ref.hash}` : `vimeo:${ref.id}`;
}

/**
 * Parse a stored string back to a {@link VideoRef}. `vimeo:{id}[:{hash}]` →
 * Vimeo; anything else is run through {@link parseVideoRef} (bare 11-char id →
 * YouTube, per the backward-compat rule). Returns null for unrecognized data.
 */
export function deserializeVideoRef(stored: string | null | undefined): VideoRef | null {
  const raw = (stored ?? '').trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith('vimeo:')) {
    const [, id, hash] = raw.split(':');
    if (id && /^\d+$/.test(id)) {
      return hash ? { provider: 'vimeo', id, hash } : { provider: 'vimeo', id };
    }
    return null;
  }
  return parseVideoRef(raw);
}

/** Privacy-preserving embed URL (no cookies/tracking until the viewer plays). */
export function videoEmbedUrl(ref: VideoRef): string {
  if (ref.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${ref.id}`;
  }
  const base = `https://player.vimeo.com/video/${ref.id}?dnt=1`;
  return ref.hash ? `${base}&h=${ref.hash}` : base;
}

/**
 * Static thumbnail URL for a video ref, or null when none exists without a
 * network call. YouTube has a deterministic thumb host; Vimeo does NOT — its
 * poster requires an oEmbed lookup (see {@link fetchVimeoThumb}), so this
 * returns null for Vimeo and the UI falls back to a poster-less card.
 */
export function videoThumb(ref: VideoRef): string | null {
  if (ref.provider === 'youtube') {
    return `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg`;
  }
  return null;
}

/** Privacy-preserving YouTube embed URL. @deprecated use {@link videoEmbedUrl}. */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** Lightweight YouTube thumbnail. @deprecated use {@link videoThumb}. */
export function youTubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Fetch a Vimeo poster via the public oEmbed endpoint, with long Next fetch
 * caching so the public page cost stays near zero. Any failure (outage, private
 * video, rate limit) degrades to null — the caller renders a poster-less card.
 * NO third-party thumbnail services; oEmbed is Vimeo's own endpoint.
 */
export async function fetchVimeoThumb(
  id: string,
  hash?: string,
): Promise<string | null> {
  try {
    const target = hash
      ? `https://vimeo.com/${id}/${hash}`
      : `https://vimeo.com/${id}`;
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(target)}`,
      // Cache aggressively — a poster URL is effectively immutable per video.
      { next: { revalidate: 60 * 60 * 24 * 7 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null;
  } catch {
    return null;
  }
}

/**
 * Sections a vendor may hide on their public microsite. Reviews are
 * deliberately absent — letting a vendor hide their own reviews would undermine
 * the event-bound, zero-fakes review pillar, so reviews always render.
 */
export const MICROSITE_TOGGLEABLE_SECTIONS: {
  key: MicrositeSectionKey;
  label: string;
}[] = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'trusted_by', label: 'Trusted by' },
  { key: 'editorials', label: 'Editorials' },
];

export const DEFAULT_MICROSITE: VendorMicrosite = {
  about: null,
  sections: {},
  featuredServiceIds: [],
  heroPhotoKey: null,
  accent: null,
  pinnedReviewId: null,
  featuredEditorialIds: [],
  videos: [],
};

/** A section renders unless it has been explicitly turned off. */
export function isSectionVisible(
  sections: Record<string, boolean>,
  key: MicrositeSectionKey,
): boolean {
  return sections[key] !== false;
}

/**
 * Curated accent presets (PRO control). NOT a free hex picker — each preset is a
 * hand-tuned 3-stop ramp (base · hover · deepest) that mirrors the default
 * champagne ramp's lightness relationships, so retinting stays legible on the
 * cream microsite. The stored value is the KEY; the ramp lives in code so it can
 * be tuned later without a migration. `null` / unknown = the default champagne
 * accent (no override).
 *
 * `ramp` values are space-separated RGB triplets (the format Tailwind's
 * `rgb(var(--color-terracotta) / <alpha>)` consumes). `swatch` is a display hex
 * for the editor picker.
 */
export type MicrositeAccent = {
  key: string;
  label: string;
  /** [base (500), hover (600), deepest (700)] as "R G B" triplets. */
  ramp: [string, string, string];
  swatch: string;
};

export const MICROSITE_ACCENTS: readonly MicrositeAccent[] = [
  { key: 'champagne', label: 'Champagne', ramp: ['197 160 89', '168 131 64', '140 105 50'], swatch: '#c5a059' },
  { key: 'clay', label: 'Clay', ramp: ['192 113 79', '158 91 62', '126 72 48'], swatch: '#c0714f' },
  { key: 'sage', label: 'Sage', ramp: ['124 144 112', '100 120 87', '78 94 67'], swatch: '#7c9070' },
  { key: 'slate', label: 'Dusty blue', ramp: ['110 134 163', '86 110 138', '67 86 110'], swatch: '#6e86a3' },
  { key: 'plum', label: 'Plum', ramp: ['138 90 120', '111 69 96', '87 54 80'], swatch: '#8a5a78' },
  { key: 'teal', label: 'Teal', ramp: ['74 140 134', '58 113 108', '44 85 79'], swatch: '#4a8c86' },
] as const;

/** The default accent when a vendor hasn't chosen one (matches globals.css). */
export const MICROSITE_DEFAULT_ACCENT_KEY = 'champagne';

export function isValidAccentKey(key: string | null | undefined): boolean {
  return !!key && MICROSITE_ACCENTS.some((a) => a.key === key);
}

/**
 * Inline CSS-variable overrides that retint the microsite's accent ramp for a
 * chosen preset. Returns `undefined` for the default / unset / unknown accent so
 * the page keeps its baseline champagne (no override emitted). Spread onto the
 * microsite root's `style` (cast to CSSProperties — custom props are valid CSS).
 */
export function micrositeAccentVars(
  accentKey: string | null | undefined,
): Record<string, string> | undefined {
  if (!accentKey || accentKey === MICROSITE_DEFAULT_ACCENT_KEY) return undefined;
  const preset = MICROSITE_ACCENTS.find((a) => a.key === accentKey);
  if (!preset) return undefined;
  const [base, hover, deep] = preset.ramp;
  return {
    '--color-terracotta': base,
    '--color-terracotta-600': hover,
    '--color-terracotta-700': deep,
  };
}

/**
 * Order a vendor's service leaves so the featured ones lead, preserving the
 * original relative order within each group (stable). Featured ids not present
 * in `services` are ignored — the picker constrains to owned leaves, but this
 * keeps the render honest if the two ever drift.
 */
export function orderFeaturedFirst(
  services: readonly string[],
  featuredServiceIds: readonly string[],
): string[] {
  const featured = new Set(featuredServiceIds);
  const lead: string[] = [];
  const rest: string[] = [];
  for (const s of services) (featured.has(s) ? lead : rest).push(s);
  return [...lead, ...rest];
}

type MicrositeRow = {
  microsite_about?: string | null;
  microsite_sections?: unknown;
  microsite_featured_service_ids?: unknown;
  microsite_hero_photo_key?: string | null;
  microsite_accent?: string | null;
  microsite_pinned_review_id?: string | null;
  microsite_featured_editorial_ids?: unknown;
  microsite_video_ids?: unknown;
};

function coerceSections(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function coerceStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((s): s is string => typeof s === 'string')
    : [];
}

/**
 * Read a vendor's microsite customization. Soft/defensive: a missing column
 * (schema not yet applied) or any query error degrades to DEFAULT_MICROSITE so
 * the public page + My Shop keep rendering their auto-composed baseline.
 */
export async function fetchVendorMicrosite(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorMicrosite> {
  let base: VendorMicrosite = DEFAULT_MICROSITE;
  try {
    const { data, error } = await client
      .from('vendor_profiles')
      .select(
        'microsite_about,microsite_sections,microsite_featured_service_ids,microsite_hero_photo_key,microsite_accent,microsite_pinned_review_id,microsite_featured_editorial_ids',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) return DEFAULT_MICROSITE;
    const row = data as MicrositeRow;
    const about = row.microsite_about?.trim();
    base = {
      about: about ? about : null,
      sections: coerceSections(row.microsite_sections),
      featuredServiceIds: coerceStringArray(row.microsite_featured_service_ids),
      heroPhotoKey: row.microsite_hero_photo_key ?? null,
      accent: row.microsite_accent ?? null,
      pinnedReviewId: row.microsite_pinned_review_id ?? null,
      featuredEditorialIds: coerceStringArray(row.microsite_featured_editorial_ids),
      videos: [],
    };
  } catch {
    return DEFAULT_MICROSITE;
  }

  // Videos live in a column added earlier (migration 20270505905788). Fetch it
  // SEPARATELY + defensively so a not-yet-applied migration only empties the
  // video rack — it can never blank the rest of the microsite above. Stored
  // values are provider-prefixed strings (`vimeo:{id}[:{hash}]`) or bare
  // 11-char YouTube ids (legacy rows) — deserializeVideoRef handles both.
  try {
    const { data } = await client
      .from('vendor_profiles')
      .select('microsite_video_ids')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const videos = coerceStringArray((data as MicrositeRow | null)?.microsite_video_ids)
      .map((v) => deserializeVideoRef(v))
      .filter((v): v is VideoRef => Boolean(v))
      .slice(0, MICROSITE_VIDEOS_MAX);
    base = { ...base, videos };
  } catch {
    // Column not applied yet → no videos; the rest of the microsite is intact.
  }

  return base;
}
