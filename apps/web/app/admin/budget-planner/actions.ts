'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Budget Planner — admin config + benchmark seeding actions.
 *
 * Gated to admins (same requireAdmin pattern as /admin/pricing/actions.ts).
 * budget_allocation_config + budget_leaf_benchmarks both carry an is_admin()
 * RLS write policy, so the authed admin client is sufficient — no service role.
 *
 * Benchmark prices are owner/admin-set, NEVER invented. Empty input clears a
 * leaf's price back to NULL ("not seeded yet").
 *
 * Design: Budget_Planner_Allocation_Engine_2026-06-05.md §3/§7/§10.
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
  return { supabase, adminUserId: user.id };
}

/** Parse a PHP amount field ("₱ 350,000" / "350000" / "" ) → integer pesos or
 *  null. Rejects negatives + non-numeric (returns null = clear). */
function parsePhp(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[₱,\s]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/** Upsert one leaf's benchmark prices. */
export async function updateLeafBenchmark(formData: FormData): Promise<AdminActionResult> {
  const { supabase } = await requireAdmin();
  const planGroupId = String(formData.get('plan_group_id') ?? '').trim();
  if (!planGroupId) return { ok: false, error: 'Missing leaf.' };

  const benchmark = parsePhp(formData.get('benchmark_php'));
  const floor = parsePhp(formData.get('floor_php'));
  const p25 = parsePhp(formData.get('p25_php'));
  const p75 = parsePhp(formData.get('p75_php'));
  const isActive = formData.get('is_active') != null;

  const { error } = await supabase
    .from('budget_leaf_benchmarks')
    .update({
      benchmark_php: benchmark,
      floor_php: floor,
      p25_php: p25,
      p75_php: p75,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('plan_group_id', planGroupId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/budget-planner');
  return { ok: true };
}

/** Update the engine knobs (the singleton config row). */
export async function updateAllocationConfig(formData: FormData): Promise<AdminActionResult> {
  const { supabase } = await requireAdmin();

  const minSampleN = Number(formData.get('min_sample_n'));
  const highN = Number(formData.get('high_confidence_n'));
  const medN = Number(formData.get('med_confidence_n'));
  const bandPct = Number(formData.get('band_pct'));
  const surplusModeRaw = String(formData.get('surplus_mode') ?? 'park');
  const surplusMode = surplusModeRaw === 'distribute' ? 'distribute' : 'park';

  if (
    !Number.isFinite(minSampleN) || minSampleN < 1 ||
    !Number.isFinite(highN) || highN < 1 ||
    !Number.isFinite(medN) || medN < 1 ||
    !Number.isFinite(bandPct) || bandPct < 0 || bandPct > 1
  ) {
    return { ok: false, error: 'Check the values — counts must be ≥ 1 and band must be 0–1.' };
  }

  const { error } = await supabase
    .from('budget_allocation_config')
    .update({
      min_sample_n: Math.round(minSampleN),
      high_confidence_n: Math.round(highN),
      med_confidence_n: Math.round(medN),
      band_pct: bandPct,
      surplus_mode: surplusMode,
      updated_at: new Date().toISOString(),
    })
    .eq('config_key', 'default');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/budget-planner');
  return { ok: true };
}
