import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import { BADGE_EARNED_NAME } from '@/lib/badge-earned';
import { SHOP_BADGE_KEYS, TIER_KEYS, tierName, type ShopBadgeKey, type TierKey } from '@/lib/badge-tiers';
import type { AwardItem, FlowProgress } from '@/lib/award-queue';

/**
 * 🎬 The award queue's reads and its one write (DECISION_LOG e5ec685d picks 7 + 8). Every read answers NULL when it
 * fails — never an empty list, which would read as "nothing earned" (the lib/guests.ts pattern).
 *
 *   readAwardQueue(admin, shop)          the awards that play: Setnayan Verified (a seal, pick 4) and every tier of the
 *                                        five shop badges the shop was given. Retired badges' rewards stay in the
 *                                        shop's gifts but never play (4b8cc3a3).
 *   readAwardFlowProgress(client, shop)  where the shop is in each flow.
 *   saveAwardFlowProgress(admin, …)      the exact step — written only by POST /api/vendor/badges after its own-shop gate.
 */

/** A playable award from a reward key, or null for a key that does not play (retired, monthly, unknown). */
export function awardItemFromReward(key: string, grantedAt: string): AwardItem | null {
  if (key === 'verified') return { kind: 'seal', key, title: BADGE_EARNED_NAME.verified, earnedAt: grantedAt };
  const [badge, tier] = key.split(':');
  if (!badge || !tier || !(SHOP_BADGE_KEYS as readonly string[]).includes(badge)) return null;
  if (!(TIER_KEYS as readonly string[]).includes(tier)) return null;
  return {
    kind: 'badge',
    key,
    title: `${tierName(tier as TierKey)} ${BADGE_EARNED_NAME[badge as ShopBadgeKey]}`,
    earnedAt: grantedAt,
  };
}

/** The shop's awards that play, unordered (order them with `orderAwardQueue`). Null on a refused read. */
export async function readAwardQueue(admin: SupabaseClient, vendorProfileId: string): Promise<AwardItem[] | null> {
  const { data, error } = await admin
    .from('shop_badge_rewards')
    .select('reward_key, granted_at, revoked_at')
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    logQueryError('awardQueue.rewards', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const out: AwardItem[] = [];
  for (const r of (data ?? []) as Array<{ reward_key: string; granted_at: string; revoked_at: string | null }>) {
    if (r.revoked_at) continue;
    const item = awardItemFromReward(r.reward_key, r.granted_at);
    if (item) out.push(item);
  }
  return out;
}

type ProgressRow = {
  flow_key: string;
  step: number;
  total_steps: number | null;
  opened_at: string | null;
  finished_at: string | null;
};

/** Where the shop is in each flow, by flow key. Null on a refused read (never "nothing opened"). */
export async function readAwardFlowProgress(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<Record<string, FlowProgress> | null> {
  const { data, error } = await client
    .from('shop_award_flow_progress')
    .select('flow_key, step, total_steps, opened_at, finished_at')
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    logQueryError('awardQueue.progress', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const out: Record<string, FlowProgress> = {};
  for (const r of (data ?? []) as ProgressRow[]) {
    out[r.flow_key] = {
      flowKey: r.flow_key,
      step: r.step,
      totalSteps: r.total_steps,
      openedAt: r.opened_at,
      finishedAt: r.finished_at,
    };
  }
  return out;
}

/**
 * Save the exact step a shop is on in one flow. `finished` closes the flow (it never plays again). The first save
 * stamps `opened_at` (News → seen). `admin` = service-role, AFTER the caller proved the shop is theirs. Answers false
 * on a refused write — the caller says so, never pretends it saved.
 */
export async function saveAwardFlowProgress(
  admin: SupabaseClient,
  args: { vendorProfileId: string; flowKey: string; step: number; totalSteps: number | null; finished: boolean },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: prior, error: readErr } = await admin
    .from('shop_award_flow_progress')
    .select('opened_at, finished_at')
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('flow_key', args.flowKey)
    .maybeSingle();
  if (readErr) {
    logQueryError('awardQueue.save.read', readErr, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return false;
  }
  const p = prior as { opened_at: string | null; finished_at: string | null } | null;
  const { error } = await admin.from('shop_award_flow_progress').upsert(
    {
      vendor_profile_id: args.vendorProfileId,
      flow_key: args.flowKey,
      step: args.step,
      total_steps: args.totalSteps,
      opened_at: p?.opened_at ?? now,
      // A finished flow stays finished.
      finished_at: p?.finished_at ?? (args.finished ? now : null),
      updated_at: now,
    },
    { onConflict: 'vendor_profile_id,flow_key' },
  );
  if (error) {
    logQueryError('awardQueue.save', error, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return false;
  }
  return true;
}
