'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchThreadById, type ChatThreadRow } from '@/lib/chat';
import { resolveCounterpartyUserIds } from '@/lib/chat-block';
import { emitNotification } from '@/lib/notification-emit';
import { resolveThreadCallsEnabled } from '@/lib/thread-calls-gate';

/**
 * Free 1:1 voice/video CALL inside an accepted vendor↔couple thread
 * (Relationship_Workspace_and_Appointments_2026-07-11.md · "Call"; PR 10).
 *
 * These actions ONLY manage the `thread_calls` metadata row (the ring/session
 * log) + the incoming-call notification. The media itself is free peer-to-peer
 * WebRTC over Supabase Realtime broadcast (lib/call-webrtc.ts) — it never
 * touches these actions or any Setnayan server.
 *
 * Authorization is IDENTICAL to the existing thread actions (chat-actions.ts):
 * fetch the thread under the caller's RLS (fetchThreadById), then confirm the
 * caller is the couple OR the vendor on it. We NEVER use the admin client to
 * bypass RLS — the insert/update ride the caller's own session, so the
 * thread_calls member policies are the real gate.
 */

type CallKind = 'voice' | 'video';

export type StartThreadCallResult =
  | { ok: true; callId: string; kind: CallKind }
  | { ok: false; error: string };

/**
 * couple | vendor | null (not a member) — the same probe as
 * chat-actions.ts#resolveThreadRole (that one is not exported, so we mirror it
 * here to keep authorization identical). Uses the caller's RLS-scoped client.
 */
async function resolveThreadRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thread: Pick<ChatThreadRow, 'event_id' | 'vendor_profile_id'>,
  userId: string,
): Promise<'couple' | 'vendor' | null> {
  const [coupleCheck, vendorCheck] = await Promise.all([
    supabase
      .from('event_members')
      .select('event_id')
      .eq('event_id', thread.event_id)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (coupleCheck.data) return 'couple';
  if (vendorCheck.data) return 'vendor';
  return null;
}

/**
 * Start a call: insert a `ringing` thread_calls row for the thread, then notify
 * the OTHER party so their thread page can ring. Returns the new call_id (the
 * client uses it to end the call on hang-up). Gated strictly to ACCEPTED
 * threads — mirrors the composer's accept-gate on both thread pages.
 */
export async function startThreadCall(
  formData: FormData,
): Promise<StartThreadCallResult> {
  const threadId = formData.get('thread_id');
  const kindRaw = formData.get('kind');
  if (typeof threadId !== 'string' || threadId.length === 0) {
    return { ok: false, error: 'Missing thread.' };
  }
  if (kindRaw !== 'voice' && kindRaw !== 'video') {
    return { ok: false, error: 'Invalid call type.' };
  }
  const kind: CallKind = kindRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  // RLS-scoped fetch — a non-member gets null here (not just "not found").
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) return { ok: false, error: 'Conversation not found.' };

  const role = await resolveThreadRole(supabase, thread, user.id);
  if (!role) return { ok: false, error: 'You are not part of this conversation.' };

  // Calls are only available once the vendor has accepted the inquiry (same
  // gate as the message composer). Defense-in-depth on top of the UI gate.
  if (thread.inquiry_status !== 'accepted') {
    return { ok: false, error: 'Calls open once the inquiry is accepted.' };
  }

  // Calls are a PAID-vendor capability (owner 2026-07-13: "a service for the
  // paid"). This is the AUTHORITATIVE chokepoint — both the "Call" tab
  // (ThreadCallLauncher) and the appointment video/voice join call this action,
  // so gating here covers every call-start regardless of the UI. Flag-dark by
  // default (resolveThreadCallsEnabled returns true until the owner flips
  // VENDOR_TIER_FEATURE_GATE), so today's free P2P calling is unchanged.
  if (!(await resolveThreadCallsEnabled(thread.vendor_profile_id))) {
    return {
      ok: false,
      error:
        role === 'vendor'
          ? 'Calling clients is a paid feature — upgrade your plan to start voice & video calls.'
          : 'This vendor hasn’t enabled in-app calling yet.',
    };
  }

  // Insert under the caller's own session — the thread_calls member-insert RLS
  // policy is the authoritative gate. event_id + vendor_profile_id are stamped
  // from the thread so BOTH parties can read/update the row under RLS.
  const { data, error } = await supabase
    .from('thread_calls')
    .insert({
      thread_id: thread.thread_id,
      event_id: thread.event_id,
      vendor_profile_id: thread.vendor_profile_id,
      kind,
      status: 'ringing',
      started_by_user_id: user.id,
    })
    .select('call_id')
    .single();

  if (error || !data) {
    console.error('[thread-call] startThreadCall insert failed:', error?.message);
    return { ok: false, error: 'Could not start the call. Please try again.' };
  }

  // Ring the OTHER party. Best-effort — emitNotification fails soft, and a
  // failed notification must never block the call that already exists.
  try {
    const recipients = (await resolveCounterpartyUserIds(thread, role)).filter(
      (id) => id !== user.id,
    );
    const relatedUrl =
      role === 'couple'
        ? `/vendor-dashboard/messages/${thread.thread_id}`
        : `/dashboard/${thread.event_id}/messages/${thread.thread_id}`;
    const kindLabel = kind === 'video' ? 'video' : 'voice';
    for (const uid of recipients) {
      await emitNotification({
        userId: uid,
        type: 'chat_message',
        title: `Incoming ${kindLabel} call`,
        body: 'Open the conversation to join the call.',
        relatedUrl,
      });
    }
  } catch (e) {
    console.error('[thread-call] ring notification failed (non-blocking):', e);
  }

  return { ok: true, callId: data.call_id as string, kind };
}

/**
 * End a call: flip the row to `ended` + stamp ended_at. RLS-scoped (either
 * thread party may update). Best-effort — the P2P session is already torn down
 * client-side via the transport's leave(); this just closes the metadata row.
 */
export async function endThreadCall(callId: string): Promise<void> {
  if (typeof callId !== 'string' || callId.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('thread_calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('call_id', callId);
  if (error) {
    console.error('[thread-call] endThreadCall update failed:', error.message);
  }
}
