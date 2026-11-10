import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import { siteUrl } from '@/lib/social/urls';
import {
  BADGE_SHOP_COLUMNS,
  badgePostCopy,
  badgePostIsNamed,
  badgeSourceRef,
  isBadgeShopPostable,
  pickBadgeToPost,
  type BadgeShopRow,
} from '@/lib/social/lane-s';

/**
 * apps/web/lib/social/badge-post.ts — BUILD 6 · LANE S (owner 2026-11-10): compose ONE Setnayan-owned social post when
 * a supplier newly earns a badge. A copy of the recap pattern (`lib/social/recap-post.ts`):
 *
 *   • COMPOSE ONLY. It inserts one social_posts row, source_type='supplier_badge', with the deterministic
 *     source_ref '<vendor_profile_id>:<reward_key>' — the partial-unique index (source_type, source_ref) makes it
 *     compose-ONCE per (supplier, badge step). Everything downstream is the EXISTING pipeline: the cadence governor
 *     assigns the § 8.3b slot and `lib/social/flush.ts` dispatches it. No parallel posting path.
 *   • WHEN: "earning" a badge is the moment `shop_badge_reward_grant` answers 'granted' for its reward key (badges are
 *     worked out live, so the grant IS the earning — `lib/badge-rewards.server.ts`). The two doors that run the grant
 *     sweep (GET /api/vendor/badges?view=facts and the admin's manual award) hand the keys they just paid to this
 *     composer from `after()`, off the request's path. Of several keys paid in one sweep, ONE is posted
 *     (`pickBadgeToPost`).
 *   • GATED: its own switch `badge_autopost_enabled` (default ON), and the shop must be published (live in the
 *     marketplace), never a sample shop, never owned by an internal account, never opted out of social features
 *     (`isBadgeShopPostable`). Dispatch re-asks the same gate (`isBadgeSocialShareAllowed`), so a shop unlisted or
 *     opted out after compose is pulled, not posted.
 *   • NEVER THROWS. Every failure logs and returns quietly — a badge reward (the caller's real job) can never be broken
 *     by a social-share hiccup.
 */

type Admin = SupabaseClient | ReturnType<typeof createAdminClient>;

/** True when badge auto-post is on (per-type switch · default ON when the column is unreadable — matches the
 *  migration's DEFAULT TRUE, exactly as recap_autopost_enabled is read). */
export async function isBadgeAutopostEnabled(admin: Admin): Promise<boolean> {
  try {
    const { data } = await admin
      .from('social_publish_settings')
      .select('badge_autopost_enabled')
      .eq('id', true)
      .maybeSingle();
    return (data as { badge_autopost_enabled?: boolean | null } | null)?.badge_autopost_enabled !== false;
  } catch {
    return true;
  }
}

/** The shop row and whether its owner is internal. Null shop on any read failure; `ownerIsInternal` null = unread. */
async function readBadgeShop(
  admin: Admin,
  vendorProfileId: string,
): Promise<{ shop: BadgeShopRow | null; ownerIsInternal: boolean | null }> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select(BADGE_SHOP_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    logQueryError('badgePost.shop', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { shop: null, ownerIsInternal: null };
  }
  const shop = (data as BadgeShopRow | null) ?? null;
  if (!shop?.user_id) return { shop, ownerIsInternal: null };
  const { data: owner, error: ownerErr } = await admin
    .from('users')
    .select('is_internal')
    .eq('user_id', shop.user_id)
    .maybeSingle();
  if (ownerErr) {
    logQueryError('badgePost.owner', ownerErr, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { shop, ownerIsInternal: null };
  }
  const flag = (owner as { is_internal?: boolean | null } | null)?.is_internal;
  return { shop, ownerIsInternal: typeof flag === 'boolean' ? flag : null };
}

/**
 * The share gate, shared by COMPOSE (here) and DISPATCH (`lib/social/flush.ts`). Fail-CLOSED: any read error or
 * missing row → not allowed. Never throws.
 */
export async function isBadgeSocialShareAllowed(admin: Admin, vendorProfileId: string): Promise<boolean> {
  try {
    const { shop, ownerIsInternal } = await readBadgeShop(admin, vendorProfileId);
    return isBadgeShopPostable(shop, ownerIsInternal);
  } catch {
    return false;
  }
}

/**
 * Compose the badge post for the reward keys ONE grant sweep just paid this shop. Fire from `after()`. Idempotent
 * (deterministic source_ref + partial-unique index). Never throws.
 */
export async function composeBadgeSocialPost(
  vendorProfileId: string,
  grantedKeys: readonly string[],
  opts: { admin?: Admin; now?: Date } = {},
): Promise<void> {
  try {
    const rewardKey = pickBadgeToPost(grantedKeys);
    if (!rewardKey) return;

    const admin = opts.admin ?? createAdminClient();
    if (!(await isBadgeAutopostEnabled(admin))) return;

    const { shop, ownerIsInternal } = await readBadgeShop(admin, vendorProfileId);
    if (!shop || !isBadgeShopPostable(shop, ownerIsInternal)) return;

    const sourceRef = badgeSourceRef(vendorProfileId, rewardKey);
    const category = shop.services?.[0] ? displayServiceLabel(shop.services[0]) : 'Supplier';
    const copy = badgePostCopy({
      rewardKey,
      named: badgePostIsNamed(shop, opts.now ?? new Date()),
      businessName: shop.business_name ?? '',
      businessSlug: shop.business_slug,
      categoryLabel: category,
      region: shop.hq_region ?? shop.location_city ?? 'the Philippines',
      origin: siteUrl(),
    });

    const { error } = await admin.from('social_posts').insert({
      source_type: 'supplier_badge',
      source_ref: sourceRef,
      title: copy.title,
      body: copy.body,
      link_url: copy.linkUrl,
    });
    // 23505 = already composed (a concurrent sweep, or a re-grant) — expected, ignore.
    if (error && error.code !== '23505') {
      logQueryError('composeBadgeSocialPost (insert)', error, { vendor_profile_id: vendorProfileId, reward_key: rewardKey });
    }
  } catch (err) {
    logQueryError('composeBadgeSocialPost (unexpected)', err, { vendor_profile_id: vendorProfileId });
  }
}
