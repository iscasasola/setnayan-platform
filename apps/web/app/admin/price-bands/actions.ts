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

/**
 * The FUNNEL half of the same peer benchmark. `market_funnel_bands` is read by
 * every supplier's My Performance page (funnel_benchmark_for_vendor → the
 * FunnelBenchmarkCard) and written ONLY by recompute_market_funnel_bands() —
 * which, until this action, nothing called. So the table was empty in
 * production and every supplier was told "not enough peer data yet" whether
 * or not there was: the card could never show a band, by construction.
 *
 * Same shape and same gate as recomputePriceBands above: admin-cadence,
 * cron-free, the RPC re-checks is_console_admin() and applies the min-N floor.
 */
export async function recomputeFunnelBands() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc('recompute_market_funnel_bands');
  if (error) throw new Error(error.message);
  const written = typeof data === 'number' ? data : 0;
  revalidatePath('/admin/pricing');
  revalidatePath('/vendor-dashboard/performance');
  redirect(`/admin/pricing?tab=price-bands&funnelRecomputed=${written}`);
}
