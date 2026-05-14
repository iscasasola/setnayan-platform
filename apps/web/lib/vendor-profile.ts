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
  created_at: string;
  updated_at: string;
};

export async function fetchOwnVendorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorProfileRow | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published,portfolio_r2_keys,created_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchOwnVendorProfile failed: ${error.message}`);
  if (!data) return null;
  // Defensive: column has NOT NULL DEFAULT '{}' so this is null only if the
  // migration hasn't run yet. Normalise so callers can assume an array.
  const row = data as Omit<VendorProfileRow, 'portfolio_r2_keys'> & {
    portfolio_r2_keys: string[] | null;
  };
  return { ...row, portfolio_r2_keys: row.portfolio_r2_keys ?? [] };
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
