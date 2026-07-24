'use server';

// ============================================================================
// app/_components/negotiation-actions.ts
//
// Negotiation auto-reader Phase 1 — turn a chat message into a SCHEDULE REQUEST.
// The couple/vendor taps the "set up this meeting" chip under a message the
// reader flagged (lib/chat-negotiation-detect.ts); this action inserts an
// event_appointments row (the EXISTING propose→confirm/decline/propose-new
// machine, migration 20270713200000) AND posts a chat_messages card pointing at
// it (chat_messages.appointment_id, migration 20270920827160) so it renders
// inline in the thread. The counterparty then Accepts / Proposes-new-time /
// Declines via the existing respondAppointment action.
//
// AUTHORIZATION IS RLS. The appointment insert + card insert run under the
// caller's OWN session client, so the event_appointments / chat_messages
// policies are the boundary (event member OR booked vendor on the thread). The
// admin client is used ONLY to fan out the best-effort notification. Gated
// behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1 — a no-op when the flag is off.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchThreadById } from '@/lib/chat';
import { emitNotification } from '@/lib/notification-emit';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';

function str(v: FormDataEntryValue | null, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function toIso(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function safeReturn(v: FormDataEntryValue | null): string | null {
  const p = str(v, 300);
  return p && p.startsWith('/') ? p : null;
}

/**
 * Create a schedule request from a chat message. Inserts a 'proposed'
 * event_appointments row and posts a chat_messages card linking to it. No-op
 * (redirect back) when the flag is off, the thread isn't accepted, or the caller
 * isn't a member. Best-effort notification to the other party.
 */
export async function createScheduleRequestFromChat(formData: FormData): Promise<void> {
  const threadId = str(formData.get('thread_id'), 64);
  const back = safeReturn(formData.get('return_to'));
  const dest = back ?? '/dashboard';

  if (!chatNegotiationEnabled() || !threadId) redirect(dest);

  const kindRaw = formData.get('kind');
  const kind =
    kindRaw === 'in_person' || kindRaw === 'video' || kindRaw === 'voice' ? kindRaw : null;
  const scheduledAt = toIso(formData.get('scheduled_at'));
  const title = str(formData.get('title'), 120);
  if (!kind || !scheduledAt) redirect(dest);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  // Schedule requests only make sense on an OPEN (accepted) relationship.
  if (!thread || thread.inquiry_status !== 'accepted') redirect(dest);

  // Resolve the caller's role on this thread. RLS independently enforces write
  // access, so a mis-derived role can never grant access — this only stamps
  // initiated_by truthfully.
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
  const role: 'couple' | 'vendor' | null = coupleCheck.data
    ? 'couple'
    : vendorCheck.data
      ? 'vendor'
      : null;
  if (!role) redirect(dest);

  const label = title ?? 'Meeting';

  // Insert the appointment (RLS-scoped) and read back its id for the card FK.
  const { data: appt, error: apptErr } = await supabase
    .from('event_appointments')
    .insert({
      event_id: thread.event_id,
      vendor_profile_id: thread.vendor_profile_id,
      thread_id: thread.thread_id,
      kind,
      type: 'custom',
      custom_label: label,
      scheduled_at: scheduledAt,
      status: 'proposed',
      initiated_by: role,
      proposed_by_user_id: user.id,
    })
    .select('appointment_id')
    .maybeSingle();
  if (apptErr || !appt) {
    console.error('[negotiation] appointment insert failed:', apptErr?.message);
    if (back) redirect(`${back}${back.includes('?') ? '&' : '?'}error=1`);
    redirect(dest);
  }
  const appointmentId = (appt as { appointment_id: string }).appointment_id;

  // Post the in-thread card. body satisfies the 1-4000 char CHECK and is the
  // graceful fallback if the card ever renders before the appointment loads.
  const { error: cardErr } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: user.id,
    sender_role: role,
    body: `📅 Meeting request: ${label}`,
    appointment_id: appointmentId,
  });
  if (cardErr) {
    // The appointment exists; only the card failed. Log + continue (the
    // appointment is still visible on the Schedule surface).
    console.error('[negotiation] appointment card insert failed:', cardErr.message);
  }

  // Notify the OTHER party best-effort (admin client only fans out; it never
  // authorized the writes above). Never blocks the request.
  try {
    const admin = createAdminClient();
    if (role === 'couple') {
      const { data: prof } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', thread.vendor_profile_id)
        .maybeSingle();
      const vendorUserId = (prof as { user_id?: string | null } | null)?.user_id ?? null;
      if (vendorUserId) {
        await emitNotification({
          userId: vendorUserId,
          type: 'schedule_suggestion',
          title: `Meeting requested: ${label}`,
          body: 'Open the chat to accept, propose a new time, or decline.',
          relatedUrl: `/vendor-dashboard/messages/${thread.thread_id}`,
        });
      }
    } else {
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', thread.event_id)
        .eq('member_type', 'couple');
      for (const m of (members ?? []) as Array<{ user_id: string | null }>) {
        if (!m.user_id || m.user_id === user.id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: `Meeting requested: ${label}`,
          body: 'Open the chat to accept, propose a new time, or decline.',
          relatedUrl: `/dashboard/${thread.event_id}/messages/${thread.thread_id}`,
        });
      }
    }
  } catch (e) {
    console.error('[negotiation] notify failed:', e);
  }

  if (back) {
    revalidatePath(back);
    redirect(back);
  }
  redirect(dest);
}
