'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSafeNext } from '@/lib/safe-next';

export async function markNotificationRead(formData: FormData) {
  const notificationId = formData.get('notification_id');
  const returnTo = formData.get('return_to');
  if (typeof notificationId !== 'string') throw new Error('Invalid input');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', user.id);

  if (isSafeNext(returnTo)) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}

export async function markAllNotificationsRead(formData: FormData) {
  const returnTo = formData.get('return_to');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (isSafeNext(returnTo)) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}

/**
 * 📱 OPENING GUESTS RESETS THE REPLY COUNT (owner 2026-10-31: each RSVP notice
 * replaces the last and counts what is unread — "Maria + 5 others replied" — and
 * opening Guests or reading the bell starts it over). The host has now seen the
 * list, so this event's guest-reply bell rows are read; the next reply's phone
 * notice says "Maria replied" again (lib/rsvp-push.server.ts counts unread rows).
 *
 * RLS-scoped user client: a person only ever marks their own rows. No redirect,
 * no revalidate — it runs quietly from the Guests screen after it opens.
 */
export async function markReplyNoticesSeen(eventId: string): Promise<{ ok: boolean }> {
  if (typeof eventId !== 'string' || eventId.length === 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .eq('type', 'rsvp_received')
    .is('read_at', null);
  if (error) {
    console.error('[notifications] markReplyNoticesSeen refused:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
