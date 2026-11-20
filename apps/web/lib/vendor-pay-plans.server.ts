import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedScheduleRow } from '@/lib/service-card-save-parts';
import { planItemsFromRows, type PlanIntent } from '@/lib/vendor-pay-plans';

/**
 * 💳 The card's save, the pay-plan part (Payment Strategies, DECISION_LOG 2026-11-17). Runs AFTER the card's own
 * rows are written by `save_vendor_service`, owner-scoped, through `apply_vendor_pay_plan` (migration
 * 20271350884376), which copies a plan's rows onto each card in one transaction and checks the shop itself.
 *
 * Returns `null` on success, else the words for "your card was saved, but … could not be" — the card itself is
 * already saved, so a failure here is SAID, never a bounce that invites a second card.
 */
export async function writeCardPayPlan(
  supabase: SupabaseClient,
  vendorProfileId: string,
  cardId: string,
  intent: PlanIntent,
  rows: readonly ParsedScheduleRow[],
): Promise<string | null> {
  const detach = async () => {
    const { error } = await supabase
      .from('vendor_services')
      .update({ pay_plan_id: null })
      .eq('vendor_service_id', cardId)
      .eq('vendor_profile_id', vendorProfileId);
    if (error) console.error('[supabase-error] lib/vendor-pay-plans.server.ts · from:vendor_services.update (detach)', error);
    return error ? 'its pay plan' : null;
  };
  const apply = async (planId: string, ids: string[]) => {
    const { error } = await supabase.rpc('apply_vendor_pay_plan', {
      p_vendor_profile_id: vendorProfileId,
      p_pay_plan_id: planId,
      p_service_ids: Array.from(new Set(ids)),
    });
    if (error) console.error('[supabase-error] lib/vendor-pay-plans.server.ts · rpc:apply_vendor_pay_plan', error);
    return error ? 'the pay plan on your other cards' : null;
  };

  if (intent.kind === 'own' || intent.kind === 'detach') return detach();

  if (intent.kind === 'save') {
    if (rows.length === 0) return 'your plan (it has no payments yet)';
    const { data, error } = await supabase
      .from('vendor_pay_plans')
      .insert({ vendor_profile_id: vendorProfileId, name: intent.name, items: planItemsFromRows(rows) })
      .select('pay_plan_id')
      .single();
    if (error) {
      if (error.code !== '23505') console.error('[supabase-error] lib/vendor-pay-plans.server.ts · from:vendor_pay_plans.insert', error);
      return error.code === '23505' ? `your plan (you already have one named “${intent.name}”)` : 'your plan';
    }
    return apply((data as { pay_plan_id: string }).pay_plan_id, [cardId, ...intent.applyTo]);
  }

  if (intent.kind === 'follow') return apply(intent.planId, [cardId, ...intent.applyTo]);

  // 'all' — the plan takes this card's rows, and every card on it follows.
  if (rows.length === 0) return detach();
  const { data: updated, error: upErr } = await supabase
    .from('vendor_pay_plans')
    .update({ items: planItemsFromRows(rows), updated_at: new Date().toISOString() })
    .eq('pay_plan_id', intent.planId)
    .eq('vendor_profile_id', vendorProfileId)
    .is('retired_at', null)
    .select('pay_plan_id');
  if (upErr || !updated || updated.length === 0) {
    if (upErr) console.error('[supabase-error] lib/vendor-pay-plans.server.ts · from:vendor_pay_plans.update', upErr);
    return 'the change to your plan';
  }
  const { data: followers, error: fErr } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('pay_plan_id', intent.planId);
  if (fErr) {
    console.error('[supabase-error] lib/vendor-pay-plans.server.ts · from:vendor_services.select (plan followers)', fErr);
    return 'the pay plan on your other cards';
  }
  return apply(intent.planId, [cardId, ...((followers ?? []) as { vendor_service_id: string }[]).map((f) => f.vendor_service_id), ...intent.applyTo]);
}
