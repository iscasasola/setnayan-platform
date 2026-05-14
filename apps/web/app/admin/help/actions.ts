'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

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

  // Fetch the prior state so we can detect when the admin has just posted a
  // new reply (admin_notes content changed and is non-empty) vs. simply
  // flipping the status. Only the former should fire a notification.
  const { data: prior } = await admin
    .from('help_messages')
    .select('user_id, admin_notes')
    .eq('message_id', messageId)
    .maybeSingle();

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

  // Iteration 0028 follow-up — when an admin posts a substantive reply on a
  // help ticket (admin_notes content changed and is non-empty), notify the
  // signed-in submitter via in-app + Resend email. Anonymous submitters have
  // user_id NULL and are unreachable without an email-out path. Fire-and-
  // forget; failures never block the status update.
  const repliedNow =
    adminNotes !== null &&
    adminNotes.length > 0 &&
    adminNotes !== (prior?.admin_notes ?? null);
  if (repliedNow && prior?.user_id) {
    await emitNotification({
      userId: prior.user_id,
      type: 'help_ticket_replied',
      title: 'Setnayan replied to your help ticket',
      body: adminNotes.slice(0, 200),
      relatedUrl: '/help',
    });
  }

  revalidatePath('/admin/help');
}
