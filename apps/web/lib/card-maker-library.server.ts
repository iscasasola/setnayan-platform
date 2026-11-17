import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { planItemsToDrafts, type PayPlanOption } from '@/lib/vendor-pay-plans';
import { readTemplateRows } from '@/lib/included-templates';
import type { CardMakerLibrary } from '@/lib/card-maker-library';

/**
 * 📚 WHAT THE CARD MAKER LOADS FROM — Card Maker HYBRID part 2 (DECISION_LOG 2026-11-17; built onto the one-page
 * maker per 2026-11-18 "extend it"):
 *   • payPlans          — the shop's saved pay plans ("Payment Strategies"), each with the cards following it;
 *   • shopCards         — the shop's cards, for "Use on other cards…" (name + which plan each follows);
 *   • includedTemplates — Setnayan's starting What's included for THIS service ("Quick Forms" — Load › From Setnayan).
 *
 * 🔒 Each part is `null` when its read was REFUSED, never `[]` (lib/guests.ts, reads-are-honest): an empty plan list
 * would say "you have no saved plans" to a shop that has them, and the maker would offer to save a duplicate. The
 * maker SAYS a part could not be read, and the card's own Save is never held by it (the card keeps its own rows).
 * Owner-scoped (RLS + an explicit vendor filter). Three requests, in parallel.
 */
export type { CardMakerLibrary };


export async function loadCardMakerLibrary(
  supabase: SupabaseClient,
  vendorProfileId: string,
  service: string | null,
): Promise<CardMakerLibrary> {
  const [plansRes, cardsRes, tplRes] = await Promise.all([
    supabase
      .from('vendor_pay_plans')
      .select('pay_plan_id, name, items')
      .eq('vendor_profile_id', vendorProfileId)
      .is('retired_at', null)
      .order('name'),
    supabase
      .from('vendor_services')
      .select('vendor_service_id, title, category, pay_plan_id')
      .eq('vendor_profile_id', vendorProfileId)
      .order('title'),
    service
      ? supabase
          .from('service_included_templates')
          .select('template_id, name, rows, is_proposal, sort_order')
          .eq('canonical_service', service)
          .order('sort_order')
          .order('name')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (plansRes.error) console.error('[supabase-error] lib/card-maker-library.server.ts · from:vendor_pay_plans.select', plansRes.error);
  if (cardsRes.error) console.error('[supabase-error] lib/card-maker-library.server.ts · from:vendor_services.select (shop cards)', cardsRes.error);
  if (tplRes.error) console.error('[supabase-error] lib/card-maker-library.server.ts · from:service_included_templates.select', tplRes.error);

  const cards = cardsRes.error
    ? null
    : ((cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string; pay_plan_id: string | null }[]).map((c) => ({
        id: c.vendor_service_id,
        title: c.title?.trim() || c.category,
        payPlanId: c.pay_plan_id ?? null,
      }));

  let payPlans: PayPlanOption[] | null = null;
  if (!plansRes.error && cards) {
    payPlans = [];
    for (const p of (plansRes.data ?? []) as { pay_plan_id: string; name: string; items: unknown }[]) {
      const items = planItemsToDrafts(p.items);
      // A stored plan that does not hold together is left out of the picker, never shown with a payment missing.
      if (!items) {
        console.error('[card-maker-library] pay plan rows unreadable — left out of the picker', p.pay_plan_id);
        continue;
      }
      payPlans.push({ id: p.pay_plan_id, name: p.name, items, cardIds: cards.filter((c) => c.payPlanId === p.pay_plan_id).map((c) => c.id) });
    }
  }

  const includedTemplates = tplRes.error
    ? null
    : ((tplRes.data ?? []) as { template_id: string; name: string; rows: unknown; is_proposal: boolean }[])
        .map((t) => ({ id: t.template_id, name: t.name, rows: readTemplateRows(t.rows), isProposal: t.is_proposal === true }))
        .filter((t) => t.rows.length > 0);

  return { payPlans, shopCards: cards, includedTemplates };
}
