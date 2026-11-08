import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import type { BadgeRewardFacts } from '@/lib/badge-rewards';
import { VENDOR_ADDON_BAND_SKU_CODES } from '@/lib/vendor-addon-tier-pricing';
import {
  BADGE_UPGRADE_CHOICES,
  BADGE_UPGRADE_PRODUCT,
  startableChoices,
  upgradesOwed,
  type BadgeUpgradeChoice,
  type BadgeUpgradeRow,
} from '@/lib/badge-upgrades';

/**
 * 🏅⏱ BADGE UPGRADES — the I/O half of `lib/badge-upgrades.ts` (owner approved the table 2026-11-06).
 *
 *   grantOwedBadgeUpgrades  gives every earned upgrade not yet given, through the ONE door `shop_badge_upgrade_grant`
 *                           — run inside `grantOwedBadgeRewards`, so every place that pays a badge's gift-stock reward
 *                           (the badge-facts door after Today · Shop · Performance draw, the admin's manual award) also gives its upgrade
 *   readBadgeUpgrades       the shop's upgrades, each resolved for its plan (what Start may begin today)
 *   startBadgeUpgradeCore   Start: the catalogue product must be on sale, then `shop_badge_upgrade_start` extends the
 *                           add-on's own entitlement by its own period
 *   fetchBadgeUpgradeLedger every upgrade across shops (Admin › Gifts)
 *
 * Every function takes the SERVICE-ROLE client, called only after the caller proved `vendorProfileId` is the signed-in
 * supplier's own shop (or the caller is an admin).
 */

const isChoice = (v: unknown): v is BadgeUpgradeChoice => typeof v === 'string' && (BADGE_UPGRADE_CHOICES as readonly string[]).includes(v);

export type UpgradeSweep = { granted: number; already: number; failed: number };

/** Give every earned upgrade not yet given. Never throws. */
export async function grantOwedBadgeUpgrades(
  admin: SupabaseClient,
  vendorProfileId: string,
  facts: BadgeRewardFacts,
): Promise<UpgradeSweep> {
  const out: UpgradeSweep = { granted: 0, already: 0, failed: 0 };
  try {
    const owed = upgradesOwed(facts);
    if (owed.length === 0) return out;
    const { data, error } = await admin.from('shop_badge_upgrades').select('reward_key').eq('vendor_profile_id', vendorProfileId);
    if (error) {
      logQueryError('badgeUpgrades.grant.keys', error, { vendorProfileId }, 'graceful_degrade');
      return out;
    }
    const have = new Set(((data ?? []) as Array<{ reward_key: string }>).map((r) => r.reward_key));
    for (const o of owed) {
      if (have.has(o.key)) {
        out.already += 1;
        continue;
      }
      const { data: res, error: gErr } = await admin.rpc('shop_badge_upgrade_grant', {
        p_vendor_profile_id: vendorProfileId,
        p_reward_key: o.key,
        p_badge: o.badge,
        p_choices: o.choices,
        p_note: o.note,
      });
      const status = (res as { status?: string } | null)?.status;
      if (gErr || !status) {
        if (gErr) logQueryError('badgeUpgrades.grant', gErr, { vendorProfileId, key: o.key }, 'graceful_degrade');
        out.failed += 1;
      } else if (status === 'granted') out.granted += 1;
      else if (status === 'already') out.already += 1;
      else out.failed += 1;
    }
  } catch (e) {
    console.error('[badge-upgrades] grant sweep failed', e);
    out.failed += 1;
  }
  return out;
}

type UpgradeDbRow = {
  upgrade_id: string;
  reward_key: string;
  choices: string[] | null;
  granted_at: string;
  started_choice: string | null;
  started_at: string | null;
  ends_at: string | null;
};

const SELECT = 'upgrade_id, reward_key, choices, granted_at, started_choice, started_at, ends_at';

function toRow(r: UpgradeDbRow, tier: string | null | undefined): BadgeUpgradeRow {
  const choices = (r.choices ?? []).filter(isChoice);
  return {
    upgradeId: r.upgrade_id,
    key: r.reward_key,
    grantedAt: r.granted_at,
    startable: r.started_at ? [] : startableChoices(choices, tier),
    startedChoice: isChoice(r.started_choice) ? r.started_choice : null,
    startedAt: r.started_at,
    endsAt: r.ends_at,
  };
}

/**
 * The shop's upgrades, ready ones first then newest. Null on a read failure (never "none").
 * `tier` may be a promise: the rows are read at once, BESIDE the plan read, and the plan only shapes them after —
 * so a caller still reading the plan pays one round trip, not two (Shop render, 8 Nov).
 */
export async function readBadgeUpgrades(
  admin: SupabaseClient,
  vendorProfileId: string,
  tierIn: string | null | undefined | PromiseLike<string | null | undefined>,
): Promise<BadgeUpgradeRow[] | null> {
  const [{ data, error }, tier] = await Promise.all([
    admin.from('shop_badge_upgrades').select(SELECT).eq('vendor_profile_id', vendorProfileId).order('granted_at', { ascending: false }),
    tierIn,
  ]);
  if (error) {
    logQueryError('badgeUpgrades.read', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const rows = ((data ?? []) as UpgradeDbRow[]).map((r) => toRow(r, tier));
  return [...rows.filter((r) => !r.startedAt), ...rows.filter((r) => r.startedAt)];
}

export type StartBadgeUpgradeResult =
  | { status: 'started'; choice: BadgeUpgradeChoice; endsAt: string }
  | { status: 'already'; choice: BadgeUpgradeChoice | null; endsAt: string | null }
  | { status: 'not_found' | 'bad_choice' | 'not_on_sale' | 'failed' };

/**
 * Start one ready upgrade. The product must still be on the catalogue (`vendor_billing_catalog.is_active` for the
 * add-on's price rows, `VENDOR_ADDON_BAND_SKU_CODES` — the AI Chatbot has two); a product taken off sale leaves the upgrade
 * READY, never spent. The period is the add-on's own (`BADGE_UPGRADE_PRODUCT`), the one a paid purchase gets.
 */
export async function startBadgeUpgradeCore(
  admin: SupabaseClient,
  vendorProfileId: string,
  upgradeId: string,
  choice: BadgeUpgradeChoice,
): Promise<StartBadgeUpgradeResult> {
  const product = BADGE_UPGRADE_PRODUCT[choice];
  const codes = [...new Set([product.skuCode, ...Object.values(VENDOR_ADDON_BAND_SKU_CODES[product.addon])])];
  const { data: cat, error: catErr } = await admin.from('vendor_billing_catalog').select('sku_code, is_active').in('sku_code', codes);
  if (catErr) {
    logQueryError('badgeUpgrades.start.catalog', catErr, { vendorProfileId, choice }, 'graceful_degrade');
    return { status: 'failed' };
  }
  if (!((cat ?? []) as Array<{ is_active: boolean | null }>).some((c) => c.is_active)) return { status: 'not_on_sale' };

  const { data, error } = await admin.rpc('shop_badge_upgrade_start', {
    p_upgrade_id: upgradeId,
    p_vendor_profile_id: vendorProfileId,
    p_choice: choice,
    p_period_days: product.periodDays,
  });
  if (error) {
    logQueryError('badgeUpgrades.start', error, { vendorProfileId, upgradeId, choice }, 'graceful_degrade');
    return { status: 'failed' };
  }
  const res = (data ?? {}) as { status?: string; choice?: string | null; ends_at?: string | null };
  if (res.status === 'started' && isChoice(res.choice) && res.ends_at) return { status: 'started', choice: res.choice, endsAt: res.ends_at };
  if (res.status === 'already') return { status: 'already', choice: isChoice(res.choice) ? res.choice : null, endsAt: res.ends_at ?? null };
  if (res.status === 'not_found' || res.status === 'bad_choice') return { status: res.status };
  return { status: 'failed' };
}

/* ── admin ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export type BadgeUpgradeLedgerRow = BadgeUpgradeRow & { vendorProfileId: string; shopName: string | null };

/** Every badge upgrade across shops, newest first (Admin › Gifts). Null on a read failure. */
export async function fetchBadgeUpgradeLedger(admin: SupabaseClient, limit = 200): Promise<BadgeUpgradeLedgerRow[] | null> {
  const { data, error } = await admin
    .from('shop_badge_upgrades')
    .select(`${SELECT}, vendor_profile_id, vendor_profiles(business_name, tier_state)`)
    .order('granted_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[supabase-error] badge-upgrades: admin ledger', error);
    return null;
  }
  const rows = (data ?? []) as unknown as Array<
    UpgradeDbRow & { vendor_profile_id: string; vendor_profiles: { business_name: string | null; tier_state: string | null } | null }
  >;
  return rows.map((r) => ({
    ...toRow(r, r.vendor_profiles?.tier_state ?? null),
    vendorProfileId: r.vendor_profile_id,
    shopName: r.vendor_profiles?.business_name ?? null,
  }));
}
