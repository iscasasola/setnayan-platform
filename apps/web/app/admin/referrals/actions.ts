'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin(): Promise<void> {
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
}

/**
 * Owner master switch for the couple referral program
 * (platform_settings.referral_program_enabled). An unchecked checkbox doesn't
 * submit, so absence = off. When off, the "Refer a couple" surface is hidden
 * and applyReferralAtSignup / qualifyReferralOnFirstPaidOrder no-op (see
 * lib/platform-settings.isReferralProgramEnabled). Separate from the reward
 * amount (referral_reward_php).
 */
export async function setReferralProgramEnabled(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get('referral_program_enabled') === 'on';
  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({ referral_program_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/referrals?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/admin/referrals');
  redirect('/admin/referrals?saved=1');
}
