'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function completeTour() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('users')
    .update({
      tour_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/vendor-dashboard', 'layout');
}

export async function restartTour() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('users')
    .update({ tour_completed_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/vendor-dashboard', 'layout');
  redirect('/dashboard/profile?tour_restarted=1');
}
