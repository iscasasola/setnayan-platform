'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchThreadById } from './chat';
import { emitNotification } from './notification-emit';

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

  // Notify the OTHER party. The couple side notifies the vendor user;
  // the vendor side notifies every couple member on the event. Use the
  // admin client so the lookup bypasses RLS without leaking auth scope.
  await notifyOtherParty({
    threadId: thread.thread_id,
    eventId: thread.event_id,
    vendorProfileId: thread.vendor_profile_id,
    senderRole,
    senderUserId: user.id,
    body: trimmed,
  });

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}

async function notifyOtherParty(args: {
  threadId: string;
  eventId: string;
  vendorProfileId: string;
  senderRole: 'couple' | 'vendor';
  senderUserId: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();

  // Look up labels for the notification title (event name vs. vendor name).
  const [eventRes, vendorRes] = await Promise.all([
    admin
      .from('events')
      .select('display_name')
      .eq('event_id', args.eventId)
      .maybeSingle(),
    admin
      .from('vendor_profiles')
      .select('business_name, user_id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle(),
  ]);

  const eventName = eventRes.data?.display_name ?? 'your event';
  const vendorName = vendorRes.data?.business_name?.trim() || 'a vendor';
  const preview = args.body.slice(0, 140);

  if (args.senderRole === 'couple') {
    // The vendor user is the recipient.
    if (!vendorRes.data?.user_id) return;
    await emitNotification({
      userId: vendorRes.data.user_id,
      type: 'chat_message',
      title: `New message from ${eventName}`,
      body: preview,
      relatedUrl: `/vendor-dashboard/messages/${args.threadId}`,
    });
    return;
  }

  // sender is vendor — notify every couple user on the event.
  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');
  for (const m of members ?? []) {
    if (m.user_id === args.senderUserId) continue;
    await emitNotification({
      userId: m.user_id,
      type: 'chat_message',
      title: `New message from ${vendorName}`,
      body: preview,
      relatedUrl: `/dashboard/${args.eventId}/messages/${args.threadId}`,
    });
  }
}
