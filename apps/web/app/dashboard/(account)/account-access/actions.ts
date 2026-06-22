'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Couple force-ends an active takeover of THEIR account (admin account-access
 * model Phase 3d · RA 10173 transparency). The update runs via the couple's OWN
 * RLS-gated client — the `admin_takeover_sessions_target_force_end` policy lets
 * them ONLY set their own OPEN session to `ended_by='user_force_end'`, never
 * touch anyone else's or alter who/why. The audit row is written with the
 * service client (the audit log is admin-write) and tagged with the session id.
 */
export async function forceEndTakeover(formData: FormData) {
  const sessionId = formData.get('session_id');
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Missing session.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('admin_takeover_sessions')
    .update({ ended_at: now, ended_by: 'user_force_end' })
    .eq('session_id', sessionId)
    .eq('target_user_id', user.id)
    .is('ended_at', null);
  if (error) throw new Error(`Could not end the session: ${error.message}`);

  // Audit (service client — admin_audit_log is admin-write). Tag with the
  // session id so the change report reflects the user-initiated end.
  const admin = createAdminClient();
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'takeover_force_ended_by_user',
    target_table: 'admin_takeover_sessions',
    target_id: sessionId,
    actor_user_id: user.id,
    reason: 'user_force_end',
    takeover_session_id: sessionId,
  });
  if (auditErr) {
    console.error('[forceEndTakeover] audit log insert failed', auditErr.message);
  }

  revalidatePath('/dashboard/account-access');
  redirect('/dashboard/account-access?ended=1');
}
