'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { BADGE_UPGRADE_CHOICES, BADGE_UPGRADE_NAME, type BadgeUpgradeChoice } from '@/lib/badge-upgrades';
import { startBadgeUpgradeCore } from '@/lib/badge-upgrades.server';
import { PROMOTE_HREF } from '@/lib/supplier-qr-codes';

/**
 * ⏱ START A BADGE UPGRADE (owner approved the table 2026-11-06): the supplier's tap on "Start" beside a ready upgrade
 * in Shop › Promote › Your upgrades. The four weeks begin NOW — `shop_badge_upgrade_start` extends the add-on's own
 * entitlement (stacking on time already paid for) and stamps the upgrade started, once.
 *
 * The client sends the upgrade id and, for a Top Pick / Most Booked upgrade, the add-on picked — never a period, a
 * product code or a price. The shop is the signed-in supplier's own, and only its owner or an admin may start one
 * (the same rule as buying the add-on). The database re-checks the pick against the row and the shop's plan.
 */

export type StartBadgeUpgradeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'started'; message: string };

const err = (message: string): StartBadgeUpgradeState => ({ status: 'error', message });

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

export async function startBadgeUpgrade(_prev: StartBadgeUpgradeState, formData: FormData): Promise<StartBadgeUpgradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) return err('Only the owner or an admin can start an upgrade.');

  const upgradeId = String(formData.get('upgrade_id') ?? '').trim();
  const choice = String(formData.get('choice') ?? '').trim();
  if (!upgradeId) return err('Pick an upgrade to start.');
  if (!(BADGE_UPGRADE_CHOICES as readonly string[]).includes(choice)) return err('Pick which upgrade to start.');

  const res = await startBadgeUpgradeCore(createAdminClient(), vendorProfileId, upgradeId, choice as BadgeUpgradeChoice);
  switch (res.status) {
    case 'started':
      revalidatePath(PROMOTE_HREF);
      revalidatePath('/vendor-dashboard/subscription');
      return { status: 'started', message: `${BADGE_UPGRADE_NAME[res.choice]} is on until ${day(res.endsAt)}.` };
    case 'already':
      revalidatePath(PROMOTE_HREF);
      return err('This upgrade has already started.');
    case 'not_on_sale':
      return err('This add-on isn’t available right now. Your upgrade stays ready — nothing is lost.');
    case 'bad_choice':
      return err('That add-on isn’t one this badge can start on your plan.');
    case 'not_found':
      return err('This upgrade isn’t on your shop.');
    default:
      return err('Couldn’t start it right now. Your upgrade stays ready — try again.');
  }
}
