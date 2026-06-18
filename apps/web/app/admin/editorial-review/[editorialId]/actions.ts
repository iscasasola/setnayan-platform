'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { ScanFlag } from '@/lib/editorial-scan';

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

  revalidatePath(`/admin/editorial-review/${editorialId}`);
  revalidatePath('/admin/editorial-review');
}
