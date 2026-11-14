'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { BADGE_UPGRADE_CHOICES, BADGE_UPGRADE_NAME, type BadgeUpgradeChoice } from '@/lib/badge-upgrades';
import { startBadgeUpgradeCore } from '@/lib/badge-upgrades.server';
import { SHOP_GIFT_CHOICES, claimedWords, type ShopGiftChoice } from '@/lib/setnayan-shop-gift';
import { claimSetnayanShopGift, goBackFromPlanGift } from '@/lib/setnayan-shop-gift.server';

/**
 * ⏱ START A BADGE UPGRADE (owner approved the table 2026-11-06): the supplier's tap on "Start" beside a ready upgrade
 * on Plan › Your upgrades (beside the add-ons it unlocks; the Shop ⚙'s Plan fold draws the same screen). The four weeks begin NOW — `shop_badge_upgrade_start` extends the add-on's own
 * entitlement (stacking on time already paid for) and stamps the upgrade started, once.
 *
 * The client sends the upgrade id and, for a Top Pick / Most Booked upgrade, the add-on picked — never a period, a
 * product code or a price. The shop is the signed-in supplier's own, and only its owner or an admin may start one
 * (the same rule as buying the add-on). The database re-checks the pick against the row and the shop's plan.
 */

export type StartBadgeUpgradeState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'started'; message: string }
  /** 🎁 A Setnayan gift's press (op=gift_claim) or "Go back" (op=gift_go_back) — see below. */
  | { status: 'gift'; outcome: 'claimed' | 'already' | 'went_back'; message: string };

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

  // 🎁 SETNAYAN GIFTS TO A SHOP (owner 14 Nov 2026) ride this action as two ops rather than new exports (the
  // server-action budget is at its ceiling). The press IS the claim: the database grants once, and a repeat — a
  // retry after a lost connection, a second tab — answers 'already' (`setnayan_shop_gift_claim`).
  const op = String(formData.get('op') ?? '');
  if (op === 'gift_claim' || op === 'gift_go_back') {
    const giftId = String(formData.get('gift_id') ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(giftId)) return err('This gift isn’t on your shop.');
    const admin = createAdminClient();
    if (op === 'gift_go_back') {
      const back = await goBackFromPlanGift(admin, { vendorProfileId, giftId });
      if (back === 'failed') return err('Couldn’t switch back right now. Nothing changed — try again.');
      revalidatePath('/vendor-dashboard');
      revalidatePath('/vendor-dashboard/subscription');
      return { status: 'gift', outcome: 'went_back', message: back === 'returned' ? 'You’re back on your own plan.' : 'Your gift has already ended.' };
    }
    const choice = String(formData.get('choice') ?? '').trim();
    if (!(SHOP_GIFT_CHOICES as readonly string[]).includes(choice)) return err('Pick how to open this gift.');
    const res = await claimSetnayanShopGift(admin, { vendorProfileId, giftId, choice: choice as ShopGiftChoice, actorUserId: user.id });
    switch (res.status) {
      case 'claimed':
      case 'already':
        revalidatePath('/vendor-dashboard');
        revalidatePath('/vendor-dashboard/subscription');
        revalidatePath('/vendor-dashboard/shop');
        return { status: 'gift', outcome: res.status, message: claimedWords(res.choice ?? (choice as ShopGiftChoice), res.tier) };
      case 'bad_choice':
        return err('Your plan changed since this gift opened. Close it and open it again.');
      case 'not_found':
        return err('This gift isn’t on your shop.');
      default:
        return err('Couldn’t open it right now. The gift is still waiting — try again.');
    }
  }

  const upgradeId = String(formData.get('upgrade_id') ?? '').trim();
  const choice = String(formData.get('choice') ?? '').trim();
  if (!upgradeId) return err('Pick an upgrade to start.');
  if (!(BADGE_UPGRADE_CHOICES as readonly string[]).includes(choice)) return err('Pick which upgrade to start.');

  const res = await startBadgeUpgradeCore(createAdminClient(), vendorProfileId, upgradeId, choice as BadgeUpgradeChoice);
  switch (res.status) {
    case 'started':
      revalidatePath('/vendor-dashboard/subscription');
      revalidatePath('/vendor-dashboard/shop');
      return { status: 'started', message: `${BADGE_UPGRADE_NAME[res.choice]} is on until ${day(res.endsAt)}.` };
    case 'already':
      revalidatePath('/vendor-dashboard/subscription');
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
