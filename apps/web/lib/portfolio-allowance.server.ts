import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The shop's own portfolio allowance (`vendor_profiles.portfolio_photo_allowance`, migration
 * `the_personal_invite_carries_its_offer`) — a personal invite's 100, kept after the gifted plan ends.
 *
 * ⚠ ITS OWN READ, DELIBERATELY: naming a column a database does not have yet refuses the WHOLE select, and the
 * gallery save's select carries the shop id and the stored photo list. Kept apart, a database running behind this
 * migration answers null here — the every-plan base, which is the truth there — and the save still works. A refused
 * read is logged and also answers null (the base): it can only ever withhold the extra photos, never grant them.
 */
export async function readPortfolioAllowance(supabase: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  if (!vendorProfileId) return null;
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('portfolio_photo_allowance')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      logQueryError('portfolio-allowance', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
    const v = (data as { portfolio_photo_allowance?: number | null } | null)?.portfolio_photo_allowance;
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}
