'use server';

/**
 * Admin demo-vendor inquiry responder — server actions.
 *
 * Demo vendors are unclaimed (`user_id = NULL`), so the normal vendor-side
 * chat actions can't act on their threads (RLS scopes by owning user). These
 * admin actions use the SERVICE-ROLE client to accept/decline/reply on behalf
 * of a demo vendor, so the team can role-play vendor responses from /admin.
 *
 * Guardrails:
 *   • Caller must be an admin (defense-in-depth; the /admin layout already
 *     gates the UI, but these wield the service-role client).
 *   • The thread's vendor MUST be `is_demo = TRUE` — this surface never touches
 *     a real vendor's thread (that would be impersonating a real business).
 */

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminProfile } from '@/lib/demo-mode';
import { fetchThreadById } from '@/lib/chat';
import { emitNotification } from '@/lib/notification-emit';
import type { NotificationType } from '@/lib/notifications';

async function assertAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!isAdminProfile(profile as Parameters<typeof isAdminProfile>[0])) {
    throw new Error('Admin only');
  }
}

type DemoThread = {
  thread_id: string;
  event_id: string;
  vendor_profile_id: string;
  inquiry_status: 'pending' | 'accepted' | 'declined';
  vendor_business_name: string;
};

// Load a thread via service-role + assert its vendor is a DEMO vendor.
async function loadDemoThread(admin: SupabaseClient, threadId: string): Promise<DemoThread> {
  const thread = await fetchThreadById(admin, threadId);
  if (!thread) throw new Error('Thread not found');
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('is_demo, business_name')
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .maybeSingle();
  const vendorRow = vendor as { is_demo: boolean; business_name: string | null } | null;
  if (!vendorRow?.is_demo) {
    throw new Error('Not a demo vendor — the responder is demo-only.');
  }
  return {
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    inquiry_status: thread.inquiry_status,
    vendor_business_name: vendorRow.business_name?.trim() || 'A vendor',
  };
}

/**
 * Cross-account notify fan-out (Notification Foundation · Phase B · 2026-06-20).
 *
 * The demo/marketplace founder vendor is unclaimed (`user_id = NULL`), so when
 * the team role-plays its responses from /admin the couple got NOTHING in their
 * tray — every accept/decline/reply was silent. This mirrors
 * chat-actions.ts → notifyCoupleOfInquiryOutcome / notifyOtherParty: fan out
 * over every couple-type event_member and deep-link them to their own messages
 * thread (the couple-side `/dashboard/[eventId]/messages/[threadId]` route,
 * NOT the /vendor-dashboard one).
 *
 * Best-effort: emitNotification already fails soft, and the whole fan-out is
 * wrapped so a notify error can never roll back the admin action that landed.
 */
async function notifyCoupleMembers(
  admin: SupabaseClient,
  thread: DemoThread,
  notice: { type: NotificationType; title: string; body: string; relatedUrl?: string },
): Promise<void> {
  try {
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', thread.event_id)
      .eq('member_type', 'couple');
    const relatedUrl =
      notice.relatedUrl ?? `/dashboard/${thread.event_id}/messages/${thread.thread_id}`;
    for (const m of (members ?? []) as Array<{ user_id: string }>) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: notice.type,
        title: notice.title,
        body: notice.body,
        relatedUrl,
      });
    }
  } catch (e) {
    console.error('[demo-vendors] couple notify fan-out failed:', e);
  }
}

function threadIdFrom(formData: FormData): string {
  const id = String(formData.get('thread_id') ?? '').trim();
  if (!id) throw new Error('Missing thread_id');
  return id;
}

function revalidateThread(threadId: string): void {
  revalidatePath(`/admin/demo-vendors/inquiries/${threadId}`);
  revalidatePath('/admin/demo-vendors/inquiries');
}

export async function adminAcceptInquiry(formData: FormData): Promise<void> {
  await assertAdmin();
  const threadId = threadIdFrom(formData);
  const admin = createAdminClient();
  const thread = await loadDemoThread(admin, threadId);
  if (thread.inquiry_status !== 'accepted') {
    const { error } = await admin
      .from('chat_threads')
      .update({ inquiry_status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('thread_id', threadId);
    if (error) throw new Error(error.message);
    // The reveal_vendor_name_on_accept trigger stamps name_revealed_at so the
    // couple now sees the demo vendor's real (seeded) name.
    // Notify the couple their inquiry was accepted — mirrors the real
    // vendor-side acceptInquiry → inquiry_accepted emit (chat-actions.ts).
    await notifyCoupleMembers(admin, thread, {
      type: 'inquiry_accepted',
      title: `${thread.vendor_business_name} accepted your inquiry`,
      body: 'Your chat is open — send a message to keep planning together.',
    });
  }
  revalidateThread(threadId);
}

export async function adminDeclineInquiry(formData: FormData): Promise<void> {
  await assertAdmin();
  const threadId = threadIdFrom(formData);
  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;
  const admin = createAdminClient();
  const thread = await loadDemoThread(admin, threadId);
  if (thread.inquiry_status === 'pending') {
    const { error } = await admin
      .from('chat_threads')
      .update({
        inquiry_status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('thread_id', threadId);
    if (error) throw new Error(error.message);
    // Notify the couple their inquiry was declined — mirrors the real
    // vendor-side declineInquiry → inquiry_declined emit (chat-actions.ts):
    // no vendor name leak, surface the reason if given, point at alternatives.
    await notifyCoupleMembers(admin, thread, {
      type: 'inquiry_declined',
      title: 'A vendor declined your inquiry',
      body: reason
        ? `Why: “${reason}” — browse similar vendors to keep your options open.`
        : 'They are not available — browse similar vendors to keep your options open.',
      relatedUrl: `/dashboard/${thread.event_id}/vendors`,
    });
  }
  revalidateThread(threadId);
}

export async function adminReplyAsVendor(formData: FormData): Promise<void> {
  await assertAdmin();
  const threadId = threadIdFrom(formData);
  const body = String(formData.get('body') ?? '').trim();
  if (!body) throw new Error('Empty message');
  const admin = createAdminClient();
  const thread = await loadDemoThread(admin, threadId);
  if (thread.inquiry_status !== 'accepted') {
    throw new Error('Accept the inquiry first to reply.');
  }
  const { error } = await admin.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: null,
    sender_role: 'vendor',
    body: body.slice(0, 4000),
  });
  if (error) throw new Error(error.message);
  // Notify the couple of the new (admin-as-demo-vendor) reply — mirrors the
  // vendor-sender branch of chat-actions.ts → notifyOtherParty (chat_message,
  // 140-char preview, deep-link to the couple's own thread).
  await notifyCoupleMembers(admin, thread, {
    type: 'chat_message',
    title: `New message from ${thread.vendor_business_name}`,
    body: body.slice(0, 140),
  });
  revalidateThread(threadId);
}
