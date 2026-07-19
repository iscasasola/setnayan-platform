'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * /admin/price-bands — "recompute now" trigger for the Price-Position Meter
 * (Wave 6). Bands are an admin-cadence rollup (no polling cron — see
 * [[project_setnayan_cron_free]]); this server action calls the admin-gated
 * SECURITY DEFINER RPC recompute_market_price_bands() and revalidates the page.
 *
 * The RPC itself re-checks is_console_admin(), but we gate here too so a
 * non-admin gets a clean redirect rather than a thrown RPC error.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return supabase;
}

export async function recomputePriceBands() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc('recompute_market_price_bands');
  if (error) throw new Error(error.message);
  const written = typeof data === 'number' ? data : 0;
  revalidatePath('/admin/pricing');
  redirect(`/admin/pricing?tab=price-bands&recomputed=${written}`);
}
