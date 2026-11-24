/**
 * 🧰 PAID WIDGETS: BOUGHT AND SUBSCRIBED (DECISION_LOG a02673ac, owner 23 Nov 2026). A paid widget (Cake Maker · Song
 * bank · Papic challenge · 3D plan) opens only when the shop BOUGHT it in the Toolkit AND is on Plus, Pro or Ultra.
 * The plan alone no longer includes it (was "SPECIAL TOOLS STAY INSIDE THE PLANS", 22 Nov), and the admin's old
 * open-to-all start date (`platform_settings.special_tools_paid_from`) no longer opens a paid widget either.
 *
 * The ONE answer is the database's `vendor_store_tool_open` (bought AND `vendor_pro_tools_included`), read through
 * `readShopSpecialToolOpen` (lib/cake-maker.server.ts). This file holds the subscription half's plan list —
 * `TIER_CAPS[tier].specialTools` — and the words every lock reads, so a ladder change moves the words.
 * Free and Verified LOCK: saved options and sent designs are kept, never deleted.
 */
import { TIER_CAPS, TIER_LABEL, VENDOR_TIERS, type VendorTier } from './vendor-tier-caps';

/** Where "See plans" goes — the shipped plan page. */
export const SPECIAL_TOOLS_UPGRADE_HREF = '/vendor-dashboard/subscription';

/** The plans a bought widget works on, from the plan table (Plus · Pro · Ultra today). */
export const PAID_WIDGET_PLANS: readonly VendorTier[] = VENDOR_TIERS.filter((t) => TIER_CAPS[t].specialTools);

/** "Plus, Pro or Ultra" — read from the table. */
export const PAID_WIDGET_PLAN_WORDS = (() => {
  const names = PAID_WIDGET_PLANS.map((t) => TIER_LABEL[t]);
  return names.length <= 1 ? (names[0] ?? 'a paid plan') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
})();

/** Before payment, on the Buy sheet and every price: a bought widget works only on a paid plan (a02673ac). */
export const PAID_WIDGET_NEEDS_PLAN_WORDS = `Works only while your shop is on ${PAID_WIDGET_PLAN_WORDS}`;

/** An OWNED widget on Free or Verified: locked, kept, with the plans door and no second Buy (a02673ac). */
export const PAID_WIDGET_RESUBSCRIBE_WORDS = 'Works again when you subscribe';

/** The lock line of a paid widget the shop does not have open. */
export const SPECIAL_TOOLS_LOCKED_WORDS = PAID_WIDGET_NEEDS_PLAN_WORDS;

/** The subscription half: does this plan let a BOUGHT widget work? It never opens a widget on its own. */
export function specialToolsAllowed(tier: VendorTier): boolean {
  return TIER_CAPS[tier].specialTools;
}
