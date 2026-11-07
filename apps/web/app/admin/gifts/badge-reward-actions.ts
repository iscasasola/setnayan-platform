'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 🏅 ADMIN › GIFTS › BADGE REWARDS — take back a free booking fee (owner 2026-11-05: *"the admin can see it and revoke
 * it"*). Only an UNUSED one: a used one already made its booking's fee ₱0. The row stays, so the badge step that
 * earned it never pays again (`shop_badge_fee_waiver_revoke`). Audited in `admin_audit_log`.
 */
export async function revokeBadgeFeeWaiver(formData: FormData): Promise<void> {
  const { userId } = await requireAdminAction();
  const rewardId = String(formData.get('reward_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(rewardId)) throw new Error('Pick a free booking fee to take back.');
  if (reason.length < 10) throw new Error('Write a short reason (at least 10 characters) for taking it back.');

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('shop_badge_fee_waiver_revoke', {
    p_reward_id: rewardId,
    p_admin_id: userId,
    p_note: reason,
  });
  if (error) throw new Error(`Couldn’t take it back: ${error.message}`);
  const status = (data as { status?: string } | null)?.status;
  if (status === 'used') throw new Error('That free booking fee was already used on a booking — it cannot be taken back.');
  if (status === 'not_found') throw new Error('That free booking fee was not found.');

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: status === 'already_revoked' ? 'revoke_badge_fee_waiver_idempotent' : 'revoke_badge_fee_waiver',
    target_id: rewardId,
    actor_user_id: userId,
    metadata: { reason },
  });
  if (auditErr) console.error('[revokeBadgeFeeWaiver] audit log insert failed', auditErr.message);

  revalidatePath('/admin/gifts');
}
