import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorProfileRow = {
  vendor_profile_id: string;
  public_id: string;
  user_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  /**
   * Logo storage. May hold:
   *   - A legacy http(s) URL the vendor pasted before file-upload shipped
   *   - An `r2://bucket/key` ref emitted by /api/upload + <FileUpload>
   *   - NULL (no logo yet)
   * Render via `displayLogoUrl(profile)` from lib/uploads.ts — it presigns
   * R2 refs and passes legacy URLs through unchanged.
   */
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_published: boolean;
  /**
   * Portfolio gallery. Each entry is an `r2://bucket/key` ref. Empty array
   * means no portfolio uploaded yet — column has a NOT NULL DEFAULT '{}'
   * in the database (see migration 20260514130000_vendor_portfolio.sql).
   */
  portfolio_r2_keys: string[];
  /**
   * Per-vendor toggle on the Completed-events backend card. FALSE (default)
   * = the card shows the same team-excluded count the public sees. TRUE =
   * the card shows the full unfiltered count with the team/internal delta
   * inline and the public count as a footnote. Public count is NEVER
   * toggleable. Column added in 20260515000000_public_stats_exclusion.sql.
   */
  show_team_bookings_in_backend_count: boolean;
  /**
   * Public visibility state (added in 20260515000000_vendor_public_visibility.sql).
   * Drives marketplace surfaces + payout schedule (verified → immediate T+1,
   * coming_soon → 20/60/20 staged). Defaults to 'coming_soon' for new
   * registrations; flipped to 'verified' by /admin/verify approval.
   */
  public_visibility: 'hidden' | 'coming_soon' | 'verified' | 'archived';
  /**
   * Iteration 0043 — wedding-type compatibility tags.
   *
   * NULL = "open to all" (legacy vendors who pre-date 0043 default here).
   * Non-empty array = vendor explicitly serves only these ceremony types.
   * Empty array = vendor has explicitly opted out of every type (rare; the
   * UI submits NULL when all checkboxes are unchecked rather than `{}`).
   *
   * Drives the "Match my wedding" toggle on /vendors (iteration 0043 §
   * compatibility filter). Couples toggle ON to filter the marketplace
   * to vendors whose tags include their event's ceremony_type.
   */
  compatible_ceremony_types: string[] | null;
  compatible_venue_settings: string[] | null;
  created_at: string;
  updated_at: string;
};

// Iteration 0043 — graceful fallback when the compatibility columns aren't
// yet in the database (migration 20260521000000 pending push). The legacy
// SELECT excludes them so the page can render against pre-0043 schemas;
// callers see compatible_* as null in that mode, identical to a vendor
// who hasn't picked any tags yet — "open to all" semantics.
const FULL_VENDOR_PROFILE_SELECT =
  'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published,portfolio_r2_keys,show_team_bookings_in_backend_count,public_visibility,compatible_ceremony_types,compatible_venue_settings,created_at,updated_at';

const LEGACY_VENDOR_PROFILE_SELECT =
  'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published,portfolio_r2_keys,show_team_bookings_in_backend_count,public_visibility,created_at,updated_at';

export async function fetchOwnVendorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorProfileRow | null> {
  let { data, error } = await supabase
    .from('vendor_profiles')
    .select(FULL_VENDOR_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Most likely: 0043 migration not yet applied to this database — the
    // compatible_* columns don't exist. Retry without them and surface
    // null compatibility on the returned row. Anything else still throws.
    const missingCompatColumns =
      typeof error.message === 'string' &&
      (error.message.includes('compatible_ceremony_types') ||
        error.message.includes('compatible_venue_settings') ||
        // PostgREST returns 42703 for "column does not exist"
        (error as { code?: string }).code === '42703');
    if (!missingCompatColumns) {
      throw new Error(`fetchOwnVendorProfile failed: ${error.message}`);
    }
    const fallback = await supabase
      .from('vendor_profiles')
      .select(LEGACY_VENDOR_PROFILE_SELECT)
      .eq('user_id', userId)
      .maybeSingle();
    if (fallback.error) {
      throw new Error(`fetchOwnVendorProfile failed: ${fallback.error.message}`);
    }
    if (!fallback.data) return null;
    data = {
      ...(fallback.data as Record<string, unknown>),
      compatible_ceremony_types: null,
      compatible_venue_settings: null,
    } as typeof data;
  }
  if (!data) return null;
  // Defensive: column has NOT NULL DEFAULT '{}' so this is null only if the
  // migration hasn't run yet. Normalise so callers can assume an array.
  // Same defensive default for `show_team_bookings_in_backend_count` — the
  // column has NOT NULL DEFAULT FALSE but pre-migration rows may surface
  // as `null` until the migration runs.
  const row = data as Omit<
    VendorProfileRow,
    | 'portfolio_r2_keys'
    | 'show_team_bookings_in_backend_count'
    | 'public_visibility'
  > & {
    portfolio_r2_keys: string[] | null;
    show_team_bookings_in_backend_count: boolean | null;
    public_visibility: VendorProfileRow['public_visibility'] | null;
  };
  return {
    ...row,
    portfolio_r2_keys: row.portfolio_r2_keys ?? [],
    show_team_bookings_in_backend_count:
      row.show_team_bookings_in_backend_count ?? false,
    public_visibility: row.public_visibility ?? 'coming_soon',
  };
}

/**
 * Per-vendor public + full completed-event counts. Wraps the two
 * materialized views from 20260515000000_public_stats_exclusion.sql.
 *
 *  - `public_completed_count` is what the marketplace / public profile
 *    surfaces. Team / internal / self-comp bookings are filtered out.
 *  - `full_completed_count` is the unfiltered sibling. Only the vendor's
 *    own backend card reads this when their toggle is ON.
 *
 * Returns 0 for either count if the vendor has no row in the view yet
 * (a brand-new profile or no completed bookings).
 */
export type VendorCompletedEventStats = {
  public_completed_count: number;
  full_completed_count: number;
};

export async function fetchVendorCompletedEventStats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorCompletedEventStats> {
  const [publicRes, fullRes] = await Promise.all([
    supabase
      .from('vendor_public_completed_events_stats')
      .select('public_completed_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    supabase
      .from('vendor_full_completed_events_stats')
      .select('full_completed_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  // We deliberately swallow "view doesn't exist yet" errors so the
  // dashboard still renders for environments where the migration hasn't
  // run. Both counts fall back to 0.
  const publicCount = publicRes.data?.public_completed_count ?? 0;
  const fullCount = fullRes.data?.full_completed_count ?? 0;
  return {
    public_completed_count: Number(publicCount) || 0,
    full_completed_count: Number(fullCount) || 0,
  };
}

/**
 * Completion check used by the vendor dashboard to nudge the vendor toward
 * a publishable profile. "Logo mandatory" per spec — but V1 only warns, it
 * doesn't block save.
 */
export function profileCompletion(profile: VendorProfileRow | null): {
  done: number;
  total: number;
  missing: string[];
} {
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: 'business_name', label: 'Business name', ok: !!profile?.business_name?.trim() },
    { key: 'business_slug', label: 'Slug', ok: !!profile?.business_slug },
    { key: 'tagline', label: 'Tagline', ok: !!profile?.tagline?.trim() },
    { key: 'logo_url', label: 'Logo URL (mandatory)', ok: !!profile?.logo_url?.trim() },
    {
      key: 'services',
      label: 'At least one service',
      ok: (profile?.services?.length ?? 0) > 0,
    },
    { key: 'location_city', label: 'City', ok: !!profile?.location_city?.trim() },
    {
      key: 'contact_email',
      label: 'Contact email',
      ok: !!profile?.contact_email?.trim(),
    },
  ];
  return {
    done: checks.filter((c) => c.ok).length,
    total: checks.length,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}
