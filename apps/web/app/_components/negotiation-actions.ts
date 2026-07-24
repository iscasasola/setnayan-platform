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
  // A picked DATE (yyyy-mm-dd) + a TIME slot (HH:MM), combined at Manila (+08:00).
  const date = str(formData.get('date'), 10);
  const time = str(formData.get('time'), 5);
  const title = str(formData.get('title'), 120);
  const shapeOk =
    !!date && !!time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!kind || !shapeOk) redirect(dest);
  const scheduledAt = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(scheduledAt.getTime())) redirect(dest);

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

  // Window rule (owner 2026-07-24): a meeting must fall between TODAY and the day
  // BEFORE the event. Compare Manila calendar dates as strings (tz-correct, no
  // clock math). Server-authoritative — the client date input also bounds it.
  const todayManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(
    new Date(),
  );
  const { data: evRow } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', thread.event_id)
    .maybeSingle();
  const eventDate = (evRow as { event_date?: string | null } | null)?.event_date ?? null;
  const failWindow = (msg: string): never => {
    if (back) {
      redirect(`${back}${back.includes('?') ? '&' : '?'}error=1&msg=${encodeURIComponent(msg)}`);
    }
    redirect(dest);
  };
  if ((date as string) < todayManila) failWindow('Pick a meeting date from today onward.');
  if (eventDate && (date as string) >= eventDate) {
    failWindow('Meetings must be scheduled before the event day.');
  }

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
      scheduled_at: scheduledAt.toISOString(),
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

// ============================================================================
// Phase 2 — DISCOUNT + INCLUSION requests as in-chat CHANGE ORDERS.
//
// A discount/inclusion message the reader flagged becomes a couple-raised (or
// vendor-countered) vendor_change_orders row (the existing propose→accept/
// decline machine + single-winner RPCs, migration 20270320861005) posted inline
// via chat_messages.change_order_id (migration 20270921698789). The counterparty
// Accepts (settles the signed delta into the budget ledger) / Declines /
// Counters (raises the opposite-role change order). Change orders require a
// BOOKED vendor (an event_vendors row) — a request before booking no-ops with an
// error flag. All writes run under the caller's OWN session (RLS + the RPCs are
// the boundary); the admin client only fans out notifications.
// ============================================================================

function money(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string') return null;
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

type ThreadRole = { userId: string; thread: NonNullable<Awaited<ReturnType<typeof fetchThreadById>>>; role: 'couple' | 'vendor' };

/** Load the thread + resolve the caller's role, or null if unauthenticated /
 *  not an accepted thread / not a member. */
async function loadThreadRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
): Promise<ThreadRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.inquiry_status !== 'accepted') return null;
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
  if (!role) return null;
  return { userId: user.id, thread, role };
}

/** The booked event_vendors row id for (event, vendor profile), or null. */
async function resolveEventVendorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  vendorProfileId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .maybeSingle();
  return (data as { vendor_id?: string } | null)?.vendor_id ?? null;
}

/** Insert a change order (RLS-gated) + post the in-thread card + notify. Returns
 *  the change_order_id or null. */
async function insertChangeRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: ThreadRole,
  eventVendorId: string,
  fields: { title: string; description: string | null; delta: number },
  fallbackBody: string,
): Promise<string | null> {
  const { thread, role, userId } = ctx;
  const { data, error } = await supabase
    .from('vendor_change_orders')
    .insert({
      event_vendor_id: eventVendorId,
      event_id: thread.event_id,
      vendor_profile_id: thread.vendor_profile_id,
      raised_by: role,
      title: fields.title.slice(0, 120),
      description: fields.description ? fields.description.slice(0, 2000) : null,
      delta_amount_php: fields.delta,
      status: 'proposed',
      proposed_by_user_id: userId,
    })
    .select('change_order_id')
    .maybeSingle();
  if (error || !data) {
    console.error('[negotiation] change-order insert failed:', error?.message);
    return null;
  }
  const changeOrderId = (data as { change_order_id: string }).change_order_id;

  const { error: cardErr } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: userId,
    sender_role: role,
    body: fallbackBody,
    change_order_id: changeOrderId,
  });
  if (cardErr) console.error('[negotiation] change-order card insert failed:', cardErr.message);

  await notifyChangeCounterparty(ctx, fields.title, 'raised');
  return changeOrderId;
}

/** Best-effort notification to the party who did NOT act. */
async function notifyChangeCounterparty(
  ctx: ThreadRole,
  title: string,
  kind: 'raised' | 'accepted' | 'declined',
): Promise<void> {
  const { thread, role } = ctx;
  const verb =
    kind === 'raised' ? 'sent a request' : kind === 'accepted' ? 'accepted' : 'declined';
  try {
    const admin = createAdminClient();
    if (role === 'couple') {
      // notify the vendor
      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', thread.vendor_profile_id)
        .maybeSingle();
      const vendorUserId = (vp as { user_id?: string | null } | null)?.user_id ?? null;
      if (vendorUserId) {
        await emitNotification({
          userId: vendorUserId,
          type: 'schedule_suggestion',
          title: `Couple ${verb}: ${title.slice(0, 60)}`,
          body: 'Open the chat to respond.',
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
        if (!m.user_id || m.user_id === ctx.userId) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: `Vendor ${verb}: ${title.slice(0, 60)}`,
          body: 'Open the chat to respond.',
          relatedUrl: `/dashboard/${thread.event_id}/messages/${thread.thread_id}`,
        });
      }
    }
  } catch (e) {
    console.error('[negotiation] change notify failed:', e);
  }
}

/** Resolve the signed delta + a title from the request form. */
function changeFieldsFrom(formData: FormData): { title: string; description: string | null; delta: number } | null {
  const requestKind = formData.get('request_kind');
  const note = str(formData.get('note'), 2000);
  const amount = money(formData.get('amount'));
  if (requestKind === 'discount') {
    if (!amount) return null; // a discount needs an amount off
    return { title: `Discount: ₱${amount.toLocaleString('en-PH')} off`, description: note, delta: -amount };
  }
  if (requestKind === 'inclusion') {
    const item = str(formData.get('title'), 120);
    if (!item) return null; // an inclusion needs the item
    // Optional offer; 0 = "please include" (vendor accepts free or counters).
    return {
      title: item,
      description: note,
      delta: amount ?? 0,
    };
  }
  return null;
}

/** createChangeRequestFromChat — the sender raises a discount/inclusion request. */
export async function createChangeRequestFromChat(formData: FormData): Promise<void> {
  const threadId = str(formData.get('thread_id'), 64);
  const back = safeReturn(formData.get('return_to'));
  const dest = back ?? '/dashboard';
  if (!chatNegotiationEnabled() || !threadId) redirect(dest);

  const fields = changeFieldsFrom(formData);
  if (!fields) redirect(dest);

  const supabase = await createClient();
  const ctx = await loadThreadRole(supabase, threadId);
  if (!ctx) redirect(dest);

  const eventVendorId = await resolveEventVendorId(supabase, ctx.thread.event_id, ctx.thread.vendor_profile_id);
  if (!eventVendorId) {
    // Change orders settle into the budget ledger — only meaningful once the
    // vendor is BOOKED. Surface a friendly reason instead of a silent no-op.
    if (back) redirect(`${back}${back.includes('?') ? '&' : '?'}error=1&msg=${encodeURIComponent('Book this vendor first to send a discount or inclusion request.')}`);
    redirect(dest);
  }

  const body =
    fields!.delta < 0
      ? `💸 ${fields!.title}`
      : `➕ Inclusion request: ${fields!.title}${fields!.delta > 0 ? ` (offering ₱${fields!.delta.toLocaleString('en-PH')})` : ''}`;
  await insertChangeRequest(supabase, ctx!, eventVendorId!, fields!, body);

  if (back) {
    revalidatePath(back);
    redirect(back);
  }
  redirect(dest);
}

/** respondChangeRequestFromChat — the counterparty accepts / declines. */
export async function respondChangeRequestFromChat(formData: FormData): Promise<void> {
  const threadId = str(formData.get('thread_id'), 64);
  const changeOrderId = str(formData.get('change_order_id'), 64);
  const back = safeReturn(formData.get('return_to'));
  const dest = back ?? '/dashboard';
  const decisionRaw = formData.get('decision');
  const decision = decisionRaw === 'accept' || decisionRaw === 'decline' ? decisionRaw : null;
  if (!chatNegotiationEnabled() || !threadId || !changeOrderId || !decision) redirect(dest);

  const supabase = await createClient();
  const ctx = await loadThreadRole(supabase, threadId);
  if (!ctx) redirect(dest);

  // The single-winner RPCs enforce counterparty ownership + idempotency.
  const { error } =
    decision === 'accept'
      ? await supabase.rpc('accept_change_order', { p_change_order_id: changeOrderId })
      : await supabase.rpc('decline_change_order', {
          p_change_order_id: changeOrderId,
          p_reason: str(formData.get('reason'), 500),
        });
  if (error) {
    console.error('[negotiation] change respond failed:', error.message);
    if (back) redirect(`${back}${back.includes('?') ? '&' : '?'}error=1`);
    redirect(dest);
  }

  const { data: co } = await supabase
    .from('vendor_change_orders')
    .select('title')
    .eq('change_order_id', changeOrderId)
    .maybeSingle();
  await notifyChangeCounterparty(ctx!, (co as { title?: string } | null)?.title ?? 'Request', decision === 'accept' ? 'accepted' : 'declined');

  if (back) {
    revalidatePath(back);
    redirect(back);
  }
  redirect(dest);
}

/** counterChangeRequestFromChat — the counterparty declines the current request
 *  AND raises their own (opposite-role) change order in one step. */
export async function counterChangeRequestFromChat(formData: FormData): Promise<void> {
  const threadId = str(formData.get('thread_id'), 64);
  const originalId = str(formData.get('change_order_id'), 64);
  const back = safeReturn(formData.get('return_to'));
  const dest = back ?? '/dashboard';
  if (!chatNegotiationEnabled() || !threadId || !originalId) redirect(dest);

  const fields = changeFieldsFrom(formData);
  if (!fields) redirect(dest);

  const supabase = await createClient();
  const ctx = await loadThreadRole(supabase, threadId);
  if (!ctx) redirect(dest);

  const eventVendorId = await resolveEventVendorId(supabase, ctx.thread.event_id, ctx.thread.vendor_profile_id);
  if (!eventVendorId) redirect(dest);

  // Decline the original (single-winner; the actor is its counterparty), then
  // raise the counter. If the decline no-ops (already resolved) we still don't
  // raise a counter — surface it and stop.
  const { error: declErr } = await supabase.rpc('decline_change_order', {
    p_change_order_id: originalId,
    p_reason: 'Countered',
  });
  if (declErr) {
    console.error('[negotiation] counter decline failed:', declErr.message);
    if (back) redirect(`${back}${back.includes('?') ? '&' : '?'}error=1`);
    redirect(dest);
  }

  const body =
    fields!.delta < 0
      ? `💸 Counter: ${fields!.title}`
      : `➕ Counter: ${fields!.title}${fields!.delta > 0 ? ` (₱${fields!.delta.toLocaleString('en-PH')})` : ''}`;
  await insertChangeRequest(supabase, ctx!, eventVendorId!, fields!, body);

  if (back) {
    revalidatePath(back);
    redirect(back);
  }
  redirect(dest);
}
