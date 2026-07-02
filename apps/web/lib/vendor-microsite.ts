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
};

/** A section renders unless it has been explicitly turned off. */
export function isSectionVisible(
  sections: Record<string, boolean>,
  key: MicrositeSectionKey,
): boolean {
  return sections[key] !== false;
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
        'microsite_about,microsite_sections,microsite_featured_service_ids,microsite_hero_photo_key,microsite_accent',
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
    };
  } catch {
    return DEFAULT_MICROSITE;
  }
}
