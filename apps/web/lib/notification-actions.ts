'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
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

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}
