import 'server-only';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { PERSONAL_INVITE_TIERS, type PlanPrices } from '@/lib/personal-invite-offer';

/**
 * The 28-day price of each plan a personal invite can give, READ from `vendor_billing_catalog`
 * (`<tier>_vendor_monthly`) — the same rows the supplier's Plan page sells from. A plan with no active row is left
 * out, and the dropdown and the message then name it without a price: never a typed number (the owner's money rule).
 */
export async function readPersonalInvitePlanPrices(): Promise<PlanPrices> {
  const catalog = await fetchV2VendorCatalog();
  const out: PlanPrices = {};
  for (const tier of PERSONAL_INVITE_TIERS) {
    const row = catalog.find((r) => r.sku_code === `${tier}_vendor_monthly` && r.offering_type === 'subscription_monthly');
    if (row && Number.isFinite(row.price_php)) out[tier] = row.price_php;
  }
  return out;
}
