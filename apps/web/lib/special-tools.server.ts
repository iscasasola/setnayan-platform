import 'server-only';
/**
 * 🎂 The special tools' start date — `platform_settings.special_tools_paid_from` (rule in ./special-tools.ts).
 * A refused read is `unread`, never "open": the caller decides what an unknown date means for its own surface (the
 * editor shows the tool and the save re-checks; the save refuses rather than guess).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { specialToolsAllowed } from '@/lib/special-tools';
import { asVendorTier, type VendorTier } from '@/lib/vendor-tier-caps';
import { applyVendorTierPromotion, getPromotedVendorTierFor, type VendorDealFacts } from '@/lib/promo-free-windows';

export async function readSpecialToolsPaidFrom(supabase: SupabaseClient): Promise<{ status: 'ok'; paidFrom: string | null } | { status: 'unread' }> {
  const { data, error } = await supabase.from('platform_settings').select('special_tools_paid_from').eq('id', 1).maybeSingle();
  if (error) {
    logQueryError('readSpecialToolsPaidFrom', error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', paidFrom: (data as { special_tools_paid_from?: string | null } | null)?.special_tools_paid_from ?? null };
}

/**
 * Is the Cake Maker LOCKED for this shop right now (a plan below Pro, after the start date)? A refused read answers
 * `false` — the editor stays open and the save asks the same question again and refuses, so nothing is decided on an
 * unread plan.
 */
/**
 * The shop's plan AS IT ACTS — its tier with any admin promo deal applied (`applyVendorTierPromotion`, the same rule
 * `resolveVendorTier` uses), so a shop on a free-Pro deal is never locked out. One read; a refused read is `unread`,
 * never "free".
 */
export async function readShopTierWithDeals(client: SupabaseClient, vendorProfileId: string): Promise<{ status: 'ok'; tier: VendorTier } | { status: 'none' } | { status: 'unread' }> {
  const { data, error } = await client
    .from('vendor_profiles')
    .select('tier_state, verification_state, created_at, last_verified_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    logQueryError('readShopTierWithDeals', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const row = data as { tier_state?: string | null } & Partial<VendorDealFacts>;
  const facts: VendorDealFacts = { verification_state: row.verification_state ?? null, created_at: row.created_at ?? null, last_verified_at: row.last_verified_at ?? null };
  return { status: 'ok', tier: applyVendorTierPromotion(asVendorTier(row.tier_state ?? 'free'), await getPromotedVendorTierFor(facts)) };
}

export async function readSpecialToolsLocked(supabase: SupabaseClient, vendorProfileId: string): Promise<boolean> {
  const [paid, shop] = await Promise.all([readSpecialToolsPaidFrom(supabase), readShopTierWithDeals(supabase, vendorProfileId)]);
  if (paid.status !== 'ok' || shop.status !== 'ok') return false;
  return !specialToolsAllowed(shop.tier, paid.paidFrom, Date.now());
}
