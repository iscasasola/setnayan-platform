/**
 * 🎂 SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP (owner ruling, 2026-11-21 — replaces every unlock-fee idea:
 * no fee, no SKU, no purchase). The Cake Maker is the first special tool.
 *
 * One rule, read by the editor (locked state) and the server (the save refuses): until the admin's start date
 * (`platform_settings.special_tools_paid_from`, set on /admin/launch-offer) the tool is open to every plan; from it,
 * only the plans whose `TIER_CAPS[tier].specialTools` is true — Pro and up (`special-tools-plan.test.ts` walks the
 * ladder). Below Pro the tool LOCKS: saved options and sent designs are kept, never deleted.
 */
import { TIER_CAPS, type VendorTier } from './vendor-tier-caps';

/** Where "Upgrade" goes — the shipped plan page. */
export const SPECIAL_TOOLS_UPGRADE_HREF = '/vendor-dashboard/subscription';
export const SPECIAL_TOOLS_LOCKED_WORDS = 'Included in Pro';

/** Open to everyone until the start date; `null` (never set) or a future date = open. */
export function specialToolsOpenToAll(paidFrom: string | null, nowMs: number): boolean {
  if (!paidFrom) return true;
  const at = Date.parse(paidFrom);
  return Number.isNaN(at) ? true : nowMs < at;
}

/** May this plan use the special tools right now? */
export function specialToolsAllowed(tier: VendorTier, paidFrom: string | null, nowMs: number): boolean {
  return specialToolsOpenToAll(paidFrom, nowMs) || TIER_CAPS[tier].specialTools;
}
