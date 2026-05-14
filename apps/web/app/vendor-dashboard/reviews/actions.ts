'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitVendorReply } from '@/lib/reviews';

/**
 * One-time vendor reply. RLS + the lock_vendor_reply trigger guarantee a
 * second attempt raises a DB error; the form itself disables the textarea
 * once a reply exists.
 */
export async function postVendorReply(formData: FormData) {
  const reviewId = formData.get('review_id');
  const reply = formData.get('reply');
  if (typeof reviewId !== 'string' || typeof reply !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await submitVendorReply(supabase, reviewId, reply);

  revalidatePath('/vendor-dashboard/reviews');
}
