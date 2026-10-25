'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSafeNext } from '@/lib/safe-next';
import { fetchOwnNotifications, type NotificationRow } from '@/lib/notifications';

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
 * THE BELL'S POP-OVER READS ON OPEN (owner 2026-10-25: "shouldn't it be a pop up to see the notifications and an
 * option to view all?"). The latest eight, through the page's own `fetchOwnNotifications` — nothing new is read on
 * every page load; the bell asks only when it is pressed.
 *
 * 🔒 `null` = COULD NOT READ — never `[]`. A refused read answered with an empty list would draw "You're all caught
 * up" to somebody with unread notices; the pop-over says it could not load instead.
 */
export async function readBellNotifications(): Promise<NotificationRow[] | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await fetchOwnNotifications(supabase, user.id, 8);
  } catch {
    return null;
  }
}
