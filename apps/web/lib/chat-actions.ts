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

  // Iteration 0028 follow-up — count existing messages on this thread so we
  // can distinguish the FIRST couple-to-vendor message (a booking inquiry)
  // from a subsequent reply in an ongoing conversation. The count runs via
  // the admin client below; here we just record whether the recipient should
  // see a "new inquiry" alert instead of the generic "new message" one.
  const admin = createAdminClient();
  let isFirstMessage = false;
  if (senderRole === 'couple') {
    const { count } = await admin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', thread.thread_id);
    isFirstMessage = (count ?? 0) === 0;
  }

  // Accept-gate (CLAUDE.md 2026-06-02) — a couple→vendor chat only opens both
  // ways once the vendor accepts. The couple may post their FIRST message (the
  // inquiry) into a pending thread; everything after waits for acceptance. The
  // vendor cannot post until they have accepted. Defense-in-depth — the UI
  // hides the composer in these states; this also guards the no-JS form path.
  if (senderRole === 'couple') {
    if (thread.inquiry_status === 'declined') {
      throw new Error('This vendor declined the inquiry — browse similar vendors instead.');
    }
    if (thread.inquiry_status === 'pending' && !isFirstMessage) {
      throw new Error('Inquiry sent — waiting for the vendor to accept before you can chat.');
    }
  } else if (thread.inquiry_status !== 'accepted') {
    throw new Error('Accept the inquiry first to reply.');
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
    isFirstMessage,
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
  /**
   * True when the message being sent is the first one in the thread. Only
   * fires for couple-to-vendor direction (a booking inquiry). Used to swap
   * the notification type from chat_message to vendor_inquiry_received.
   */
  isFirstMessage?: boolean;
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
    if (args.isFirstMessage) {
      // First couple-to-vendor message — fire vendor_inquiry_received with a
      // longer preview (200 chars per spec) and a more pointed title.
      await emitNotification({
        userId: vendorRes.data.user_id,
        type: 'vendor_inquiry_received',
        title: `New booking inquiry from ${eventName}`,
        body: args.body.slice(0, 200),
        relatedUrl: `/vendor-dashboard/messages/${args.threadId}`,
      });
      return;
    }
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

// ── Accept-gate vendor actions (CLAUDE.md 2026-06-02) ───────────────────────
// A vendor accepts a pending inquiry (chat opens both ways; the
// reveal_vendor_name_on_thread_accept trigger stamps name_revealed_at) or
// declines it (the couple is told + pointed at alternatives). Only the vendor
// on the thread may respond — a couple calling these fails the vendor check.

async function loadVendorThreadForActor(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!vendor) throw new Error('Only the vendor can respond to this inquiry');

  return { supabase, thread };
}

export async function acceptInquiry(formData: FormData) {
  const threadId = formData.get('thread_id');
  const returnTo = formData.get('return_to');
  if (typeof threadId !== 'string') throw new Error('Invalid input');

  const { supabase, thread } = await loadVendorThreadForActor(threadId);

  if (thread.inquiry_status !== 'accepted') {
    const { error } = await supabase
      .from('chat_threads')
      .update({ inquiry_status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('thread_id', thread.thread_id);
    if (error) throw new Error(error.message);
    // The reveal_vendor_name_on_thread_accept trigger stamps name_revealed_at.
    await notifyCoupleOfInquiryOutcome({
      eventId: thread.event_id,
      vendorProfileId: thread.vendor_profile_id,
      threadId: thread.thread_id,
      type: 'inquiry_accepted',
    });
  }

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
  revalidatePath('/vendor-dashboard/messages');
}

export async function declineInquiry(formData: FormData) {
  const threadId = formData.get('thread_id');
  const returnTo = formData.get('return_to');
  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (typeof threadId !== 'string') throw new Error('Invalid input');

  const { supabase, thread } = await loadVendorThreadForActor(threadId);

  if (thread.inquiry_status === 'pending') {
    const { error } = await supabase
      .from('chat_threads')
      .update({
        inquiry_status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('thread_id', thread.thread_id);
    if (error) throw new Error(error.message);
    await notifyCoupleOfInquiryOutcome({
      eventId: thread.event_id,
      vendorProfileId: thread.vendor_profile_id,
      threadId: thread.thread_id,
      type: 'inquiry_declined',
    });
  }

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
  revalidatePath('/vendor-dashboard/messages');
}

/**
 * Notify every couple member of the inquiry outcome. ACCEPTED reveals the
 * vendor's name (trigger), so it's safe to surface business_name + link to the
 * now-open thread. DECLINED keeps the vendor anonymous (no name leak per
 * hybrid-anonymity) and points the couple at alternatives on the Services tab.
 */
async function notifyCoupleOfInquiryOutcome(args: {
  eventId: string;
  vendorProfileId: string;
  threadId: string;
  type: 'inquiry_accepted' | 'inquiry_declined';
}): Promise<void> {
  const admin = createAdminClient();
  const accepted = args.type === 'inquiry_accepted';

  let vendorName = 'A vendor';
  if (accepted) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    vendorName = data?.business_name?.trim() || 'A vendor';
  }

  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');

  for (const m of members ?? []) {
    await emitNotification({
      userId: m.user_id,
      type: args.type,
      title: accepted
        ? `${vendorName} accepted your inquiry`
        : 'A vendor declined your inquiry',
      body: accepted
        ? 'Your chat is open — send a message to keep planning together.'
        : 'They are not available — browse similar vendors to keep your options open.',
      relatedUrl: accepted
        ? `/dashboard/${args.eventId}/messages/${args.threadId}`
        : `/dashboard/${args.eventId}/vendors`,
    });
  }
}
