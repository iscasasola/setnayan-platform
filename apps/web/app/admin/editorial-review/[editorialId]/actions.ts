'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { scanEditorial, type ScanFlag } from '@/lib/editorial-scan';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Notify the couple (every couple-type event member of the editorial's event)
 * that an editorial decision landed (Notification Foundation · Phase B).
 * Best-effort: a failed notification never affects the decision write that
 * already landed.
 */
async function notifyCoupleEditorialDecision(
  admin: ReturnType<typeof createAdminClient>,
  editorialId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const { data: ed } = await admin
      .from('event_editorial')
      .select('event_id')
      .eq('editorial_id', editorialId)
      .maybeSingle();
    const eventId = ed?.event_id as string | undefined;
    if (!eventId) return;

    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const memberIds = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id): id is string => Boolean(id));
    if (memberIds.length === 0) return;

    await Promise.all(
      memberIds.map((userId) =>
        emitNotification({
          userId,
          type: 'editorial_decision',
          title,
          body,
          relatedUrl: `/dashboard/${eventId}/website/editorial`,
        }),
      ),
    );
  } catch (e) {
    console.error('[editorial-review] couple decision notify failed:', e);
  }
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('is_internal')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data?.is_internal) throw new Error('Unauthorized');
  return { user, admin };
}

export async function resolveFlag(
  editorialId: string,
  flagId: string,
  action: 'accept' | 'dismiss' | 'edit',
  adminEdit?: string,
) {
  const { user, admin } = await requireAdmin();

  const { data } = await admin
    .from('event_editorial')
    .select('scan_flags')
    .eq('editorial_id', editorialId)
    .maybeSingle();

  if (!data) throw new Error('Editorial not found');

  const flags = (data.scan_flags as ScanFlag[]).map(f => {
    if (f.id !== flagId) return f;
    return {
      ...f,
      status: action === 'accept' ? 'accepted' : action === 'edit' ? 'edited' : 'dismissed',
      admin_edit: action === 'edit' ? adminEdit : undefined,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    } satisfies ScanFlag;
  });

  await admin
    .from('event_editorial')
    .update({ scan_flags: flags })
    .eq('editorial_id', editorialId);

  revalidatePath(`/admin/editorial-review/${editorialId}`);
}

export async function unlockForCouple(editorialId: string) {
  const { admin } = await requireAdmin();

  const { data } = await admin
    .from('event_editorial')
    .select('scan_flags')
    .eq('editorial_id', editorialId)
    .maybeSingle();

  if (!data) throw new Error('Editorial not found');

  const flags = data.scan_flags as ScanFlag[];
  const unresolvedRed = flags.filter(
    f => f.severity === 'red' && f.status === 'pending',
  );
  if (unresolvedRed.length > 0) {
    throw new Error(`${unresolvedRed.length} red flag(s) still pending`);
  }

  await admin
    .from('event_editorial')
    .update({
      scan_status: 'admin_cleared',
      unlocked_for_couple_at: new Date().toISOString(),
    })
    .eq('editorial_id', editorialId);

  // Tell the couple their editorial cleared review and is unlocked (approve).
  await notifyCoupleEditorialDecision(
    admin,
    editorialId,
    'Your editorial is approved',
    'Setnayan reviewed your wedding editorial and it’s cleared — it can now go live on your event website.',
  );

  revalidatePath(`/admin/editorial-review/${editorialId}`);
  revalidatePath('/admin/editorial-review');
}

export async function triggerRescan(editorialId: string) {
  const { admin } = await requireAdmin();

  await admin
    .from('event_editorial')
    .update({
      scan_status: 'pending',
      scan_flags: [],
      scan_completed_at: null,
    })
    .eq('editorial_id', editorialId);

  after(() => scanEditorial(editorialId));

  revalidatePath(`/admin/editorial-review/${editorialId}`);
  revalidatePath('/admin/editorial-review');
}
