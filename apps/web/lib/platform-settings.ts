import type { SupabaseClient } from '@supabase/supabase-js';

export type PlatformSettingsRow = {
  id: 1;
  business_name: string;
  business_tin: string | null;
  business_address: string | null;
  business_email: string | null;
  bdo_account_name: string | null;
  bdo_account_number: string | null;
  bdo_qr_url: string | null;
  gcash_account_name: string | null;
  gcash_number: string | null;
  gcash_qr_url: string | null;
  default_vat_rate_pct: number;
  /** r2:// ref to the owner-uploaded onboarding background music (owner 2026-06-08). */
  onboarding_bg_music_r2_key: string | null;
  /** Master toggle — onboarding music plays only when TRUE AND a track is set. */
  onboarding_bg_music_enabled: boolean;
  /** Admin default brand icon (owner 2026-06-10) — public asset URLs + version. */
  brand_icon_master_url: string | null;
  brand_favicon_ico_url: string | null;
  brand_apple_touch_url: string | null;
  brand_icon_png_512_url: string | null;
  brand_icon_svg_url: string | null;
  brand_icon_version: number;
  updated_at: string;
};

const SELECT =
  'id,business_name,business_tin,business_address,business_email,bdo_account_name,bdo_account_number,bdo_qr_url,gcash_account_name,gcash_number,gcash_qr_url,default_vat_rate_pct,onboarding_bg_music_r2_key,onboarding_bg_music_enabled,brand_icon_master_url,brand_favicon_ico_url,brand_apple_touch_url,brand_icon_png_512_url,brand_icon_svg_url,brand_icon_version,updated_at';

const FALLBACK: PlatformSettingsRow = {
  id: 1,
  business_name: 'Setnayan',
  business_tin: null,
  business_address: null,
  business_email: null,
  bdo_account_name: null,
  bdo_account_number: null,
  bdo_qr_url: null,
  gcash_account_name: null,
  gcash_number: null,
  gcash_qr_url: null,
  default_vat_rate_pct: 12,
  onboarding_bg_music_r2_key: null,
  onboarding_bg_music_enabled: true,
  brand_icon_master_url: null,
  brand_favicon_ico_url: null,
  brand_apple_touch_url: null,
  brand_icon_png_512_url: null,
  brand_icon_svg_url: null,
  brand_icon_version: 0,
  updated_at: new Date(0).toISOString(),
};

export async function fetchPlatformSettings(
  supabase: SupabaseClient,
): Promise<PlatformSettingsRow> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select(SELECT)
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return FALLBACK;
  return data as PlatformSettingsRow;
}

export function hasMerchantPaymentInfo(s: PlatformSettingsRow): boolean {
  return Boolean(
    s.bdo_account_number?.trim() ||
      s.gcash_number?.trim() ||
      s.bdo_qr_url?.trim() ||
      s.gcash_qr_url?.trim(),
  );
}

/**
 * Resolve the onboarding background-music stream URL, or null when none is set
 * / disabled (owner 2026-06-08). Self-contained server fetch (mirrors
 * lib/v2-catalog's admin-client + try/catch pattern) so the onboarding page can
 * `await` it directly: reads platform_settings via the admin client (the
 * onboarding flow is anonymous, so we don't depend on a logged-in session or
 * anon RLS), then presigns the r2:// ref. Returns null on ANY error (missing
 * service-role env in CI, no track, disabled) — the player simply never mounts.
 */
export async function fetchOnboardingBgMusicUrl(): Promise<string | null> {
  try {
    const { createAdminClient } = await import('./supabase/admin');
    const { displayUrlForStoredAsset } = await import('./uploads');
    const admin = createAdminClient();
    const s = await fetchPlatformSettings(admin);
    const key = s.onboarding_bg_music_r2_key;
    if (!s.onboarding_bg_music_enabled || !key || !key.startsWith('r2://')) return null;
    return await displayUrlForStoredAsset(key);
  } catch {
    return null;
  }
}
