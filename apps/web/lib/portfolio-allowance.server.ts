import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The shop's own portfolio allowance (`vendor_profiles.portfolio_photo_allowance`, migration
 * `the_personal_invite_carries_its_offer`) — a personal invite's 100, kept after the gifted plan ends.
 *
 * ⚠ ITS OWN READ, DELIBERATELY: naming a column a database does not have yet refuses the WHOLE select, and the
 * gallery save's select carries the shop id and the stored photo list. Kept apart, a refused read cannot take the
 * save down with it.
 *
 * 🔑 A REFUSED READ IS NOT "NO ALLOWANCE". It answers `{ ok: false }`, never the base: the screens then say
 * `PORTFOLIO_ALLOWANCE_UNREAD` ("Couldn't read your photo allowance") instead of "50 free" — which, for a shop holding
 * a personal invite's 100, would be a smaller number that is not true. A save still caps at the base while unread
 * (withholding, never granting) and refuses in those words. `{ ok: true, allowance: null }` = read, and none given.
 */
export type PortfolioAllowanceRead = { ok: true; allowance: number | null } | { ok: false };

export async function readPortfolioAllowance(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<PortfolioAllowanceRead> {
  if (!vendorProfileId) return { ok: false };
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('portfolio_photo_allowance')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      logQueryError('portfolio-allowance', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return { ok: false };
    }
    if (!data) return { ok: false };
    const v = (data as { portfolio_photo_allowance?: number | null }).portfolio_photo_allowance;
    return { ok: true, allowance: typeof v === 'number' && v > 0 ? v : null };
  } catch {
    return { ok: false };
  }
}

/** The allowance to cap with: the read one, or none (the base) while it is unread — never more than was read. */
export function allowanceForCap(read: PortfolioAllowanceRead): number | null {
  return read.ok ? read.allowance : null;
}
