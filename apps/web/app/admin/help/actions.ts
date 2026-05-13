'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin(): Promise<{ userId: string }> {
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
  return { userId: user.id };
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function setHelpMessageStatus(formData: FormData) {
  const { userId } = await requireAdmin();
  const messageId = formData.get('message_id');
  const statusRaw = formData.get('status');
  const adminNotes = nullIfBlank(formData.get('admin_notes'));
  if (typeof messageId !== 'string' || typeof statusRaw !== 'string') {
    throw new Error('Invalid input');
  }
  if (statusRaw !== 'new' && statusRaw !== 'in_progress' && statusRaw !== 'closed') {
    throw new Error('Invalid status');
  }

  const admin = createAdminClient();
  const payload: Record<string, string | null> = {
    status: statusRaw,
    admin_notes: adminNotes,
    handled_by_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (statusRaw === 'closed') {
    payload.resolved_at = new Date().toISOString();
  } else {
    payload.resolved_at = null;
  }

  const { error } = await admin
    .from('help_messages')
    .update(payload)
    .eq('message_id', messageId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/help');
}
