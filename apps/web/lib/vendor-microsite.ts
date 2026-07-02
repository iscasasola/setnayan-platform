import type { SupabaseClient } from '@supabase/supabase-js';

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
};

export const MICROSITE_ABOUT_MAX = 600;
export const MICROSITE_FEATURED_SERVICES_MAX = 3;

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
  try {
    const { data, error } = await client
      .from('vendor_profiles')
      .select(
        'microsite_about,microsite_sections,microsite_featured_service_ids,microsite_hero_photo_key,microsite_accent,microsite_pinned_review_id',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) return DEFAULT_MICROSITE;
    const row = data as MicrositeRow;
    const about = row.microsite_about?.trim();
    return {
      about: about ? about : null,
      sections: coerceSections(row.microsite_sections),
      featuredServiceIds: coerceStringArray(row.microsite_featured_service_ids),
      heroPhotoKey: row.microsite_hero_photo_key ?? null,
      accent: row.microsite_accent ?? null,
      pinnedReviewId: row.microsite_pinned_review_id ?? null,
    };
  } catch {
    return DEFAULT_MICROSITE;
  }
}
