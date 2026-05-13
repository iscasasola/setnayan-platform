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
  updated_at: string;
};

const SELECT =
  'id,business_name,business_tin,business_address,business_email,bdo_account_name,bdo_account_number,bdo_qr_url,gcash_account_name,gcash_number,gcash_qr_url,default_vat_rate_pct,updated_at';

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
