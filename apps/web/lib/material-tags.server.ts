import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { shopOnUltraNow } from '@/lib/material-tags';

/**
 * 💳 The shop's plan AT THE MOMENT OF THE INQUIRY, for the Ultra-only own rule (owner 2026-11-16, DECISION_LOG "ONLY
 * SUPPLIER ULTRA'S PRINTS ARE THE SHOP'S OWN"). One primary-key read of the shop's own `tier_state, tier_expires_at`
 * on the service-role client (the row is the shop's, not the couple's). A failed read is NOT Ultra — the couple pays
 * the fee rather than the fee being waived on a read nobody saw fail; the failure is logged.
 */
export async function readShopOnUltraNow(admin: SupabaseClient, vendorProfileId: string, nowMs: number = Date.now()): Promise<boolean> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    logQueryError('materialTags.readShopOnUltraNow', error, { vendorProfileId }, 'graceful_degrade');
    return false;
  }
  return shopOnUltraNow(data as { tier_state?: string | null; tier_expires_at?: string | null } | null, nowMs);
}
