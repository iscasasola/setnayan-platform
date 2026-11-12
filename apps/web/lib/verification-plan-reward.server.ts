import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ULTRA_SETS, ultraRewardWrite, type VerificationDoor } from './verification-plan-reward';

/** The audit action that marks a shop's verification plan reward as paid — and the once-per-shop check reads. */
export const PLAN_REWARD_AUDIT_ACTION = 'vendor_verification_plan_reward';

export type PlanRewardOutcome =
  | { kind: 'granted'; until: string }
  | { kind: 'already' }
  | { kind: 'skipped'; why: 'paid_plan' | 'open_ended_ultra' }
  | { kind: 'failed'; error: string };

/**
 * 🏅 Give a newly verified shop its Ultra weeks (`lib/verification-plan-reward.ts`) — ONCE per shop, ever.
 *
 * Runs AFTER the verification itself is written, on the admin (service-role) client the grant already holds. It never
 * undoes or blocks the verification: a failure here is returned and logged, and the badge stands. A refused read of
 * the earlier-reward check is treated as "already paid" — the safe direction for money-shaped gifts (an admin can
 * still set the plan by hand on the shop's Plan page).
 */
export async function grantVerificationPlanReward(
  admin: SupabaseClient,
  args: { vendorProfileId: string; door: VerificationDoor; actorUserId: string; now?: Date },
): Promise<PlanRewardOutcome> {
  const now = args.now ?? new Date();
  const { data: earlier, error: earlierErr } = await admin
    .from('admin_audit_log')
    .select('action')
    .eq('action', PLAN_REWARD_AUDIT_ACTION)
    .eq('target_id', args.vendorProfileId)
    .limit(1);
  if (earlierErr) {
    console.error('[grantVerificationPlanReward] earlier-reward read refused', earlierErr.message);
    return { kind: 'already' };
  }
  if ((earlier ?? []).length > 0) return { kind: 'already' };

  const { data: row, error: readErr } = await admin
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, tier_source, business_name, public_id')
    .eq('vendor_profile_id', args.vendorProfileId)
    .maybeSingle();
  if (readErr || !row) return { kind: 'failed', error: readErr?.message ?? 'Supplier not found.' };

  const write = ultraRewardWrite(row, args.door, now);
  if (!write) {
    const comped = (row as { tier_source?: string | null }).tier_source === 'admin_comp';
    return { kind: 'skipped', why: comped ? 'open_ended_ultra' : 'paid_plan' };
  }

  const { error: updErr } = await admin.from('vendor_profiles').update(write).eq('vendor_profile_id', args.vendorProfileId);
  if (updErr) {
    console.error('[grantVerificationPlanReward] plan write refused', updErr.message);
    return { kind: 'failed', error: updErr.message };
  }

  const r = row as { tier_state?: string | null; tier_expires_at?: string | null; business_name?: string | null; public_id?: string | null };
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: PLAN_REWARD_AUDIT_ACTION,
    target_id: args.vendorProfileId,
    actor_user_id: args.actorUserId,
    metadata: {
      business_name: r.business_name ?? null,
      public_id: r.public_id ?? null,
      door: args.door,
      ultra_sets: ULTRA_SETS[args.door],
      from_tier: r.tier_state ?? null,
      from_expires_at: r.tier_expires_at ?? null,
      to_tier: write.tier_state,
      to_expires_at: write.tier_expires_at,
    },
  });
  if (auditErr) console.error('[grantVerificationPlanReward] audit insert failed', auditErr.message);
  return { kind: 'granted', until: write.tier_expires_at };
}
