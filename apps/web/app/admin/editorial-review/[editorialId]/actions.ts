'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
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

/**
 * Admin gate for this surface.
 *
 * FIXED 2026-07-27 (divergence fix): this file used to declare its own
 * `requireAdmin` that selected `is_internal` ONLY — dropping the two other
 * clauses of the canonical predicate (`is_team_member`, `account_type ===
 * 'admin'`). It was the single outlier among ~43 local copies. A Setnayan team
 * member (`is_team_member = true`, `is_internal = false`) could approve payouts
 * and verify vendors but hit a hard "Unauthorized" on the editorial moderation
 * queue — unreachable for exactly the staff hired to work it.
 *
 * Authorization now runs through `requireAdminAction()`
 * (`lib/admin/require-admin.ts`), which resolves the caller through the USER's
 * own RLS-scoped Supabase client. The old local copy did its authorization
 * lookup through `createAdminClient()` — the RLS-bypassing service-role client
 * — which is the wrong client to let decide who you are.
 *
 * The service-role client is still obtained here and still does all the WORK:
 * `event_editorial` reads/writes and the `event_members` fan-out in
 * `notifyCoupleEditorialDecision` genuinely need to bypass RLS (admins are not
 * members of the couple's event). It just no longer decides authorization.
 */
async function requireAdmin() {
  const { userId } = await requireAdminAction();
  return { userId, admin: createAdminClient() };
}

export async function resolveFlag(
  editorialId: string,
  flagId: string,
  action: 'accept' | 'dismiss' | 'edit',
  adminEdit?: string,
) {
  const { userId, admin } = await requireAdmin();

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
      resolved_by: userId,
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
