'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { formatCount } from '@/lib/format-number';
import { supplierQuestionsHref } from '@/lib/supplier-questions-href';

/**
 * ❓ SEND YOUR QUESTIONS INTO THIS EVENT — the chat ＋ row "Questions for the couple" (owner 2026-11-04, verbatim
 * "Yes, every supplier"; DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY").
 *
 * What it does, in order:
 *   1. records the ask — `event_question_requests` (one row per event × supplier; RLS: own row, and only into an
 *      event this supplier already has a conversation with). A re-send moves `sent_at` only.
 *   2. posts one line in the conversation, under the supplier's own session (so `tg_chat_messages_derive_sender`
 *      stamps it as theirs — same rule as `offerServiceCore`).
 *   3. tells each host of the event IN THE APP (`supplier_questions_sent` — NOT on the email allowlist; no new
 *      emails without the owner's word), linking to where they answer: that supplier's room in their event.
 *
 * 🔑 THE ASK IS THE SUCCESS. If (1) fails the supplier is told and nothing else happens. (2) and (3) are the
 * news about it; a failed line or notice is logged, never reported as a failed send — the couple still finds the
 * questions in their event.
 *
 * A save never resets the screen: this returns a state for the button, no redirect.
 */

export type SendQuestionsState =
  | { status: 'idle' }
  | { status: 'sent'; count: number }
  | { status: 'error'; message: string };

export async function sendQuestionsToEvent(
  _prev: SendQuestionsState,
  formData: FormData,
): Promise<SendQuestionsState> {
  const threadId = String(formData.get('thread_id') ?? '');
  if (!threadId) return { status: 'error', message: 'Missing conversation.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'error', message: 'Only a shop can send questions.' };

  // The conversation must be this shop's (defence in depth; the INSERT policy checks it again).
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return { status: 'error', message: 'That conversation is not yours.' };
  }

  const { data: asked, error: askedError } = await supabase
    .from('vendor_questions')
    .select('question_id')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .is('form_id', null)
    .eq('is_asked', true);
  if (askedError) return { status: 'error', message: 'We couldn’t read your questions. Please try again.' };
  const count = (asked ?? []).length;
  if (count === 0) return { status: 'error', message: 'Write your questions first.' };

  // 1 · the ask. `.select()` so a write RLS refused to zero rows is not reported as sent.
  const now = new Date().toISOString();
  const { data: rows, error: askError } = await supabase
    .from('event_question_requests')
    .upsert(
      {
        event_id: thread.event_id,
        vendor_profile_id: profile.vendor_profile_id,
        thread_id: thread.thread_id,
        sent_at: now,
      },
      { onConflict: 'event_id,vendor_profile_id' },
    )
    .select('event_id');
  if (askError || !rows || rows.length !== 1) {
    if (askError) console.error('[sendQuestionsToEvent] ask failed:', askError.message);
    return { status: 'error', message: 'We couldn’t send your questions. Please try again.' };
  }

  const shopName = profile.business_name?.trim() || 'Your supplier';
  const questions = `${formatCount(count)} question${count === 1 ? '' : 's'}`;

  // 2 · one line in the conversation, as the supplier.
  const { error: msgError } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    body: `A few questions so we plan this right — ${questions} for you to answer in your event.`,
  });
  if (msgError) console.error('[sendQuestionsToEvent] line failed:', msgError.message);

  // 3 · tell the hosts, in the app only.
  try {
    const admin = createAdminClient();
    const [{ data: members }, { data: booking }] = await Promise.all([
      admin.from('event_members').select('user_id').eq('event_id', thread.event_id).eq('member_type', 'couple'),
      admin
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', thread.event_id)
        .eq('marketplace_vendor_id', profile.vendor_profile_id)
        .limit(1)
        .maybeSingle(),
    ]);
    const relatedUrl = supplierQuestionsHref(
      thread.event_id,
      (booking as { vendor_id: string } | null)?.vendor_id ?? null,
      thread.thread_id,
    );
    for (const m of (members ?? []) as { user_id: string | null }[]) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: 'supplier_questions_sent',
        title: `${shopName} sent you ${questions}`,
        body: 'Answer them in your event — only you and they read your answers.',
        relatedUrl,
      });
    }
  } catch (e) {
    console.error('[sendQuestionsToEvent] notice failed:', e);
  }

  revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  return { status: 'sent', count };
}
