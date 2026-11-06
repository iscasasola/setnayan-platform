import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readBadgeUpgrades } from '@/lib/badge-upgrades.server';
import type { BadgeUpgradesSectionData } from './badge-upgrades-section';

/**
 * ⏱ YOUR UPGRADES' READ (owner approved the table 2026-11-06): the shop's badge upgrades and its plan — the plan decides
 * whether a 3D Booth upgrade starts as the booth (Solo+) or as Papic Challenges (`startableChoices`). Service role, keyed
 * on the shop the page already proved is the signed-in supplier's. An unread plan resolves as below Solo (the booth is
 * never offered on a guess); an unread list is `null`, and the section says so.
 */
export async function loadBadgeUpgradesSection(vendorProfileId: string): Promise<BadgeUpgradesSectionData> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) logQueryError('badgeUpgrades.tier', error, { vendorProfileId }, 'graceful_degrade');
  const tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
  return { rows: await readBadgeUpgrades(admin, vendorProfileId, tier), nowMs: Date.now() };
}
