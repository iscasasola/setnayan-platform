'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchThreadById } from './chat';

/**
 * Decides whether the current user is the couple or the vendor on a thread,
 * then inserts a message tagged with that role. Used by both /dashboard and
 * /vendor-dashboard so message creation is consistent across surfaces.
 */
export async function sendChatMessage(formData: FormData) {
  const threadId = formData.get('thread_id');
  const body = formData.get('body');
  const returnTo = formData.get('return_to');
  if (typeof threadId !== 'string' || typeof body !== 'string') {
    throw new Error('Invalid input');
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    if (typeof returnTo === 'string' && returnTo.startsWith('/')) redirect(returnTo);
    return;
  }
  if (trimmed.length > 4000) {
    throw new Error('Message too long — max 4,000 characters');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');

  // Determine the user's role on this thread.
  const [coupleCheck, vendorCheck] = await Promise.all([
    supabase
      .from('event_members')
      .select('event_id')
      .eq('event_id', thread.event_id)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  let senderRole: 'couple' | 'vendor';
  if (coupleCheck.data) {
    senderRole = 'couple';
  } else if (vendorCheck.data) {
    senderRole = 'vendor';
  } else {
    throw new Error('Not a member of this thread');
  }

  const { error } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: user.id,
    sender_role: senderRole,
    body: trimmed,
  });
  if (error) throw new Error(error.message);

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}
