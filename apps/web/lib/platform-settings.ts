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
  /**
   * Decoded QR Ph payloads of the two uploaded merchant QRs (migration
   * 20271027100000). Checkout re-mints these per order so the code carries the
   * exact amount — see lib/emv-qr.ts. NULL means "not decodable"; every reader
   * falls back to the static *_qr_url image, which is what shipped before.
   */
  bdo_qr_payload: string | null;
  gcash_qr_payload: string | null;
  default_vat_rate_pct: number;
  /** r2:// ref to the owner-uploaded onboarding background music (owner 2026-06-08). */
  onboarding_bg_music_r2_key: string | null;
  /** Master toggle — onboarding music plays only when TRUE AND a track is set. */
  onboarding_bg_music_enabled: boolean;
  /** Ops digest email toggle — OFF by default. See lib/admin/digest-flush.ts. */
  admin_digest_enabled: boolean;
  /** Admin default brand icon (owner 2026-06-10) — public asset URLs + version. */
  brand_icon_master_url: string | null;
  brand_favicon_ico_url: string | null;
  brand_apple_touch_url: string | null;
  brand_icon_png_512_url: string | null;
  brand_icon_svg_url: string | null;
  brand_icon_version: number;
  /**
   * Max Hamming distance (0..64) at which two vendor-image pHashes count as a
   * repost match in the reverse-image repost-watch (migration 20270330665855).
   * Admin-managed via the "Repost-watch match sensitivity" field on
   * /admin/settings (saveBusinessIdentity in app/admin/settings/actions.ts);
   * default 10.
   */
  repost_watch_hamming_threshold: number;
  /**
   * Owner master switch for the PUBLIC homepage Spotlight strip (migration
   * 20270417213000). FALSE by default — featuring vendors publicly needs owner
   * sign-off, so the strip renders nothing until the owner flips this on AND an
   * admin has flagged award rows is_homepage_featured.
   */
  spotlight_homepage_enabled: boolean;
  /**
   * Owner master switch for the couple REFERRAL program (migration
   * 20270419213000). FALSE by default — the "Refer a couple" surface and the
   * signup/qualify engine stay inert until an admin flips this on. Separate
   * from referral_reward_php (the reward amount): a program can be on with a
   * ₱0 reward, but with the program OFF nothing is recorded or shown.
   */
  referral_program_enabled: boolean;
  updated_at: string;
};

const SELECT =
  'id,business_name,business_tin,business_address,business_email,bdo_account_name,bdo_account_number,bdo_qr_url,gcash_account_name,gcash_number,gcash_qr_url,default_vat_rate_pct,onboarding_bg_music_r2_key,onboarding_bg_music_enabled,admin_digest_enabled,brand_icon_master_url,brand_favicon_ico_url,brand_apple_touch_url,brand_icon_png_512_url,brand_icon_svg_url,brand_icon_version,repost_watch_hamming_threshold,spotlight_homepage_enabled,referral_program_enabled,updated_at';

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
  bdo_qr_payload: null,
  gcash_qr_payload: null,
  // 0, never 12 — an unreachable settings row must not invent a tax. See getEffectiveVatRatePct.
  default_vat_rate_pct: 0,
  onboarding_bg_music_r2_key: null,
  onboarding_bg_music_enabled: true,
  admin_digest_enabled: false,
  brand_icon_master_url: null,
  brand_favicon_ico_url: null,
  brand_apple_touch_url: null,
  brand_icon_png_512_url: null,
  brand_icon_svg_url: null,
  brand_icon_version: 0,
  repost_watch_hamming_threshold: 10,
  spotlight_homepage_enabled: false,
  referral_program_enabled: false,
  updated_at: new Date(0).toISOString(),
};

/**
 * Columns fetched as a SEPARATE, tolerant probe rather than inside SELECT.
 *
 * The QR payload columns (migration 20271027100000) arrived after the code
 * that reads them, and PR #3964 put them straight into SELECT — which is the
 * trap this file already documents for fetchVendorValidateContacts: on a
 * pre-migration database the whole fetch fails 42703, `error` is truthy, and
 * fetchPlatformSettings returns FALLBACK. That would blank the BUSINESS NAME,
 * VAT rate, brand icons AND the BDO/GCash account details across receipts and
 * checkout — a total payment-details outage caused by an optional nicety.
 *
 * Prod happened to migrate before anyone hit it, but the ordering is not
 * guaranteed: a rollback, a preview environment pointed at an older database,
 * or a cancelled migration job (which is exactly what happened on the #3964
 * deploy) reproduces it. So these live in their own probe that degrades to
 * nulls, and null already means "serve the static QR" everywhere downstream.
 */
const QR_PAYLOAD_SELECT = 'bdo_qr_payload,gcash_qr_payload';

export async function fetchPlatformSettings(
  supabase: SupabaseClient,
): Promise<PlatformSettingsRow> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select(SELECT)
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return FALLBACK;

  // Soft probe — a failure here costs the amount-in-QR nicety and nothing
  // else. Never let it take the core payment details down with it.
  let qr: { bdo_qr_payload: string | null; gcash_qr_payload: string | null } = {
    bdo_qr_payload: null,
    gcash_qr_payload: null,
  };
  try {
    const { data: qrRow, error: qrError } = await supabase
      .from('platform_settings')
      .select(QR_PAYLOAD_SELECT)
      .eq('id', 1)
      .maybeSingle();
    if (!qrError && qrRow) {
      const row = qrRow as Partial<typeof qr>;
      qr = {
        bdo_qr_payload: row.bdo_qr_payload ?? null,
        gcash_qr_payload: row.gcash_qr_payload ?? null,
      };
    }
  } catch {
    /* keep the nulls — downstream falls back to the static QR image */
  }

  return { ...(data as object), ...qr } as PlatformSettingsRow;
}

// ---------------------------------------------------------------------------
// Vendor VALIDATE contact destinations (migration 20270503417266)
//
// Where vendors send their "VALIDATE <shop name>" email/text during
// verification. Kept OUT of the main PlatformSettingsRow SELECT on purpose:
// adding new columns there makes the whole fetch fall back to FALLBACK on a
// pre-migration database (42703), degrading receipts/brand/payment surfaces
// that have nothing to do with verification. Instead this is a separate soft
// probe that degrades to the defaults on ANY error.
// ---------------------------------------------------------------------------

export const DEFAULT_VENDOR_VALIDATE_EMAIL = 'verify@setnayan.com';

export type VendorValidateContacts = {
  /** Inbox the vendor emails "VALIDATE <shop name>" to. */
  vendor_validate_email: string;
  /** Number the vendor texts "VALIDATE <shop name>" to. NULL = coming soon. */
  vendor_validate_phone: string | null;
};

export async function fetchVendorValidateContacts(
  supabase: SupabaseClient,
): Promise<VendorValidateContacts> {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('vendor_validate_email,vendor_validate_phone')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      return {
        vendor_validate_email: DEFAULT_VENDOR_VALIDATE_EMAIL,
        vendor_validate_phone: null,
      };
    }
    const row = data as Partial<VendorValidateContacts>;
    return {
      vendor_validate_email:
        row.vendor_validate_email?.trim() || DEFAULT_VENDOR_VALIDATE_EMAIL,
      vendor_validate_phone: row.vendor_validate_phone?.trim() || null,
    };
  } catch {
    return {
      vendor_validate_email: DEFAULT_VENDOR_VALIDATE_EMAIL,
      vendor_validate_phone: null,
    };
  }
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

/**
 * Whether the couple referral program is active (owner master toggle). Reads
 * platform_settings via the admin client so the signup + qualify engine (which
 * run in anonymous / service-role contexts) can gate on it. Returns FALSE on
 * any error or when unset — the program stays inert unless an admin turns it on.
 */
export async function isReferralProgramEnabled(): Promise<boolean> {
  try {
    const { createAdminClient } = await import('./supabase/admin');
    const admin = createAdminClient();
    const s = await fetchPlatformSettings(admin);
    return s.referral_program_enabled === true;
  } catch {
    return false;
  }
}

/**
 * The VAT rate Setnayan actually charges, from `platform_settings.default_vat_rate_pct`.
 *
 * ⚠️ This exists because that setting was WRITE-ONLY. The admin settings page has always let the
 * owner set it — and it is set to **0**, correctly, since Setnayan is non-VAT registered (sole
 * prop under ICASA ENTERPRISE, 8% flat; VAT only at the ₱3M combined-gross tripwire). But no
 * pricing code ever read it: `orders.ts` and the checkout imported a hardcoded `12` instead. Every
 * customer SKU was grossed by 12% — a ₱2,500 SKU billed at ₱2,800 — presenting as VAT a tax
 * Setnayan is not registered to collect.
 *
 * FALLS BACK TO 0, never to 12. If the settings row is unreadable, charging nothing extra is both
 * the legally safe answer for a non-VAT taxpayer and the honest one: an unreachable database must
 * never invent a tax on a customer's invoice. When the ₱3M threshold is crossed, the fix is to set
 * the field — not to change code.
 */
export async function getEffectiveVatRatePct(supabase: SupabaseClient): Promise<number> {
  try {
    const settings = await fetchPlatformSettings(supabase);
    const rate = Number(settings?.default_vat_rate_pct);
    return Number.isFinite(rate) && rate >= 0 ? rate : 0;
  } catch {
    return 0;
  }
}
