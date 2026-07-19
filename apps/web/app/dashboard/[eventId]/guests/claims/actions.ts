'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';

/**
 * Invite/Join v2 reconcile actions (0000 ADDENDUM 2026-06-25).
 *
 * Unlisted joiners are optimistically admitted as `guests` rows tagged
 * `entry_source = 'self_added_unlisted'`. This surface lets the couple reconcile
 * them: KEEP (promote to a normal list member), REMOVE (soft-delete + revoke the
 * account membership), or LINK (merge into an existing guest already on the list).
 */

/** Throw unless the caller is a couple member of this event. */
async function assertCouple(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/** Read + validate the guest_id from the form, scoped to an unlisted row. */
async function readUnlistedGuest(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  formData: FormData,
) {
  const guestId = String(formData.get('guest_id') ?? '');
  if (!guestId) return null;
  const { data } = await admin
    .from('guests')
    .select('guest_id, entry_source, deleted_at')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!data || data.deleted_at || data.entry_source !== 'self_added_unlisted') return null;
  return data.guest_id as string;
}

/** KEEP: promote an unlisted joiner to a normal list member. */
export async function keepGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const guestId = await readUnlistedGuest(admin, eventId, formData);
  if (!guestId) {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  // Promote out of the reconcile queue. Drop the legacy self_joined tag too so
  // the row reads as a clean host-list member.
  const { data: row } = await admin
    .from('guests')
    .select('custom_tags')
    .eq('guest_id', guestId)
    .maybeSingle();
  const tags = ((row?.custom_tags as string[] | null) ?? []).filter((t) => t !== 'self_joined');

  await admin
    .from('guests')
    .update({ entry_source: 'host_seeded', custom_tags: tags, updated_at: new Date().toISOString() })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  // Smart seat-plan Phase 5: a kept joiner is now a real list member — gap-fill
  // them into a provisional seat if they don't have one.
  await applyReconcileForEvent(admin, eventId);

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/** REMOVE: soft-delete the unlisted guest and revoke any account membership. */
export async function removeGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const guestId = await readUnlistedGuest(admin, eventId, formData);
  if (!guestId) {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  // Revoke the account membership (signed-in joiner) — no-op for accountless
  // (cookie-only) joiners, who have no event_members row.
  await admin.from('event_members').delete().eq('event_id', eventId).eq('guest_id', guestId);

  // Soft-delete the guest row (the list + reconcile queue both filter deleted_at).
  await admin
    .from('guests')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/**
 * LINK: the unlisted joiner is actually someone already on the list (a different
 * spelling, a nickname). Merge them — move the joiner's account membership onto
 * the existing guest (inheriting that guest's host-assigned role), carry their
 * email over, then soft-delete the duplicate unlisted row.
 *
 * Guards: the target must be a real, non-deleted guest in this event, and we
 * never merge into a seat already claimed by a DIFFERENT account (the couple can
 * Remove instead). Accountless joiners have no membership to move — we still
 * carry the email + soft-delete the dupe; their device cookie pointed at the old
 * row, so they'd re-scan / use an email link to land on the merged guest.
 */
export async function linkGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const backTo = `/dashboard/${eventId}/guests/claims`;

  const sourceId = await readUnlistedGuest(admin, eventId, formData);
  const targetId = String(formData.get('target_guest_id') ?? '');
  if (!sourceId || !targetId || targetId === sourceId) {
    revalidatePath(backTo);
    return;
  }

  // Target must be a real, non-deleted guest in this event.
  const { data: target } = await admin
    .from('guests')
    .select('guest_id, email, role, deleted_at')
    .eq('guest_id', targetId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!target || target.deleted_at) {
    revalidatePath(backTo);
    return;
  }

  const [{ data: targetBinding }, { data: sourceMember }, { data: source }] = await Promise.all([
    admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('guest_id', targetId)
      .maybeSingle(),
    admin
      .from('event_members')
      .select('member_id, user_id')
      .eq('event_id', eventId)
      .eq('guest_id', sourceId)
      .maybeSingle(),
    admin.from('guests').select('email').eq('guest_id', sourceId).maybeSingle(),
  ]);

  // Don't merge into a seat already claimed by a different account.
  if (targetBinding && sourceMember && targetBinding.user_id !== sourceMember.user_id) {
    revalidatePath(backTo);
    return;
  }

  // Carry the joiner's email onto the target if it has none.
  if (source?.email && !target.email) {
    await admin
      .from('guests')
      .update({ email: source.email, updated_at: new Date().toISOString() })
      .eq('guest_id', targetId)
      .eq('event_id', eventId);
  }

  // Move the joiner's account membership onto the target (inherit its role).
  // event_members carries the (event_id, guest_id) partial-unique backstop; the
  // target-unclaimed check above keeps this from colliding.
  if (sourceMember && !targetBinding) {
    await admin
      .from('event_members')
      .update({ guest_id: targetId, role: (target.role as string) ?? 'guest' })
      .eq('member_id', sourceMember.member_id);
  }

  // Soft-delete the merged-away unlisted row.
  await admin
    .from('guests')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('guest_id', sourceId)
    .eq('event_id', eventId);

  revalidatePath(backTo);
  revalidatePath(`/dashboard/${eventId}/guests`);
}
