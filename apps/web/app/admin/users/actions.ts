'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
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

export async function toggleTeamMember(formData: FormData) {
  await requireAdmin();
  const targetUserId = formData.get('user_id');
  const desiredRaw = formData.get('desired');
  if (typeof targetUserId !== 'string' || typeof desiredRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ is_team_member: desired, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}
