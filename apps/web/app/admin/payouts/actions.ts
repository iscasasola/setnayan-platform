'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPayoutPaid, holdPayout } from '@/lib/payouts';

/**
 * Server actions backing the admin Vendor Payouts queue.
 * Gated by is_admin() (account_type='admin' OR is_internal OR is_team_member).
 *
 * Per the 2026-05-16 lock, releasing a payout is a privileged operational
 * action — single-admin authority is fine for V1 (rollback via audit_log if
 * a rail returns a failure). Two-admin gating is queued for V1.5 once Finance
 * is in the loop.
 */

type AdminUser = { user_id: string };

async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { user_id: user.id };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function markPayoutPaidAction(formData: FormData) {
  const actor = await requireAdmin();
  const payoutId = readFormString(formData, 'payout_id');
  if (!payoutId) throw new Error('Missing payout_id.');

  const rawMethod = readFormString(formData, 'payment_method') || 'maya';
  const paymentMethod = (
    ['maya', 'gcash', 'bdo_transfer', 'check'] as const
  ).includes(rawMethod as 'maya' | 'gcash' | 'bdo_transfer' | 'check')
    ? (rawMethod as 'maya' | 'gcash' | 'bdo_transfer' | 'check')
    : 'maya';

  const ref = readFormString(formData, 'payout_reference') || null;

  const result = await markPayoutPaid(createAdminClient(), {
    payoutId,
    actorUserId: actor.user_id,
    paymentMethod,
    payoutReference: ref,
    reason: readFormString(formData, 'reason') || null,
  });

  if (!result.ok) {
    redirect(`/admin/payouts?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/payouts');
  revalidatePath('/vendor-dashboard/earnings');
  redirect(`/admin/payouts?flash=${encodeURIComponent('Payout marked paid.')}`);
}

export async function holdPayoutAction(formData: FormData) {
  const actor = await requireAdmin();
  const payoutId = readFormString(formData, 'payout_id');
  const reason = readFormString(formData, 'reason');
  if (!payoutId) throw new Error('Missing payout_id.');
  if (!reason) throw new Error('Hold reason required.');

  const result = await holdPayout(createAdminClient(), {
    payoutId,
    actorUserId: actor.user_id,
    reason,
  });

  if (!result.ok) {
    redirect(`/admin/payouts?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/payouts');
  redirect(`/admin/payouts?flash=${encodeURIComponent('Payout placed on hold.')}`);
}
