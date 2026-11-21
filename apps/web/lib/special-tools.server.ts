import 'server-only';
/**
 * 🎂 The special tools' start date — `platform_settings.special_tools_paid_from` (rule in ./special-tools.ts).
 * A refused read is `unread`, never "open": the caller decides what an unknown date means for its own surface (the
 * editor shows the tool and the save re-checks; the save refuses rather than guess).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { specialToolsAllowed } from '@/lib/special-tools';
import { asVendorTier } from '@/lib/vendor-tier-caps';

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
export async function readSpecialToolsLocked(supabase: SupabaseClient, vendorProfileId: string): Promise<boolean> {
  const [paid, shop] = await Promise.all([
    readSpecialToolsPaidFrom(supabase),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
  ]);
  if (paid.status !== 'ok' || shop.error) return false;
  const tier = asVendorTier((shop.data as { tier_state?: string | null } | null)?.tier_state ?? 'free');
  return !specialToolsAllowed(tier, paid.paidFrom, Date.now());
}
