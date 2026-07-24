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
  return { adminUserId: user.id };
}

/**
 * Hard-delete an event. Most child tables (guests, event_members, seating,
 * budget, schedule, RSVPs) CASCADE on events.event_id, so they go with it.
 * Orders + payouts have ON DELETE SET NULL on event_id, so their audit
 * trail survives but loses the event link. Not reversible — admins who
 * want recoverability should set archived=TRUE instead via the existing
 * archive flow.
 *
 * V1 admin-only — no soft "0 confirmed vendors" gate like couple-side
 * self-delete (0021 § 10.1). Admin is expected to read the confirm prompt
 * and proceed knowingly.
 */
export async function deleteEvent(formData: FormData) {
  await requireAdmin();
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid event_id');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('events').delete().eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/events');
}
