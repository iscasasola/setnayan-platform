import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { planItemsToDrafts } from '@/lib/vendor-pay-plans';
import type { PlanTemplate, PlanTemplatesRead } from '@/lib/pay-plan-templates';

/**
 * 💳 The shop's live Payment Strategies, each with how many cards follow it — Shop › Templates (part 4). Two reads in
 * parallel, owner-scoped (RLS `vendor_pay_plans_manage` + an explicit shop filter). A refused read is `unread`, never
 * an empty list (lib/guests.ts, reads-are-honest). A plan whose stored rows do not hold together is left out and logged
 * — the same rule the card maker's picker keeps (`loadCardMakerLibrary`).
 */
export async function readPayPlanTemplates(supabase: SupabaseClient, vendorProfileId: string): Promise<PlanTemplatesRead> {
  const [plansRes, cardsRes] = await Promise.all([
    supabase
      .from('vendor_pay_plans')
      .select('pay_plan_id, name, items')
      .eq('vendor_profile_id', vendorProfileId)
      .is('retired_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('vendor_services').select('pay_plan_id').eq('vendor_profile_id', vendorProfileId).not('pay_plan_id', 'is', null),
  ]);
  if (plansRes.error || cardsRes.error) {
    console.error('[supabase-error] lib/pay-plan-templates.server.ts · vendor_pay_plans / vendor_services', plansRes.error ?? cardsRes.error);
    return { status: 'unread' };
  }
  const counts = new Map<string, number>();
  for (const c of (cardsRes.data ?? []) as { pay_plan_id: string | null }[]) {
    if (c.pay_plan_id) counts.set(c.pay_plan_id, (counts.get(c.pay_plan_id) ?? 0) + 1);
  }
  const plans: PlanTemplate[] = [];
  for (const p of (plansRes.data ?? []) as { pay_plan_id: string; name: string; items: unknown }[]) {
    const items = planItemsToDrafts(p.items);
    if (!items) {
      console.error('[pay-plan-templates] pay plan rows unreadable — left out of Templates', p.pay_plan_id);
      continue;
    }
    plans.push({ id: p.pay_plan_id, name: p.name, items, cardCount: counts.get(p.pay_plan_id) ?? 0 });
  }
  return { status: 'ok', plans };
}
