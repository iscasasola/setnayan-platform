'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Invite/Join v2 reconcile actions (0000 ADDENDUM 2026-06-25).
 *
 * Unlisted joiners are optimistically admitted as `guests` rows tagged
 * `entry_source = 'self_added_unlisted'`. This surface lets the couple reconcile
 * them: KEEP (promote to a normal list member) or REMOVE (soft-delete + revoke
 * the account membership). LINK (merge into an existing guest) is a fast-follow.
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
