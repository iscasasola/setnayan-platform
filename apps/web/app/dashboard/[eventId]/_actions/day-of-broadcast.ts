'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { fetchBlockRosMeta } from '@/lib/schedule-ros';
import {
  buildCallTimeEmail,
  deriveVendorCallTimes,
  validateBroadcastBody,
  type CallTimeVendor,
} from '@/lib/coordinator-broadcasts';
import {
  isCoordinatorP3Enabled,
  resolveBroadcastAuthority,
} from '@/lib/coordinator-broadcasts-server';

/**
 * Coordinator P3 server actions — day-of broadcast + email call-times
 * (Coordinator_Role_Feature_Spec_2026-07-18 §P3).
 *
 * Both run under the CALLER's authenticated client: the coordinator_broadcasts
 * INSERT policies (couple / schedule-'edit' delegate, migration 20270825364600)
 * are the real gate on the write, and every read (blocks, ros meta, vendors)
 * is RLS-scoped. The flag check makes the actions inert while
 * NEXT_PUBLIC_COORDINATOR_P3_ENABLED is off — flag-off = today's behavior
 * exactly (nothing renders a form at them either).
 *
 * Call-time sends are EMAIL-ONLY (no-SMS V1 lock) and ride lib/email.ts'
 * central gate: RESEND_API_KEY absent → sendEmail() no-ops with
 * `not_configured` — the code lands inert in prod until the owner
 * configures Resend.
 */

export type SendBroadcastResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendCoordinatorBroadcast(
  formData: FormData,
): Promise<SendBroadcastResult> {
  if (!(await isCoordinatorP3Enabled())) {
    return { ok: false, error: 'Broadcasts are not enabled yet.' };
  }
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, error: 'Invalid event.' };
  }
  const validated = validateBroadcastBody(formData.get('body'));
  if (!validated.ok) return { ok: false, error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  // Attribution label only — the INSERT policies re-check real authority.
  const authority = await resolveBroadcastAuthority(supabase, eventId, user.id);
  if (!authority.canSend) {
    return { ok: false, error: 'Only the couple or their coordinator can broadcast.' };
  }

  const { error } = await supabase.from('coordinator_broadcasts').insert({
    event_id: eventId,
    sender_user_id: user.id,
    sender_role: authority.role,
    body: validated.body,
  });
  if (error) {
    // Pre-migration (relation missing) or RLS denial — either way, a calm
    // user-facing message; no internals leak.
    return { ok: false, error: 'Could not send the broadcast. Try again.' };
  }

  // Tell the guests' phones, without telling the channel what was said.
  //
  // Their pages used to resolve the announcement ONCE at render, so "phones
  // down, the ceremony is starting" reached only whoever happened to reload —
  // and nobody reloads a page they are already looking at.
  //
  // The payload is deliberately EMPTY. A `broadcast` channel has no RLS, so
  // anything put on it is readable by anyone who can guess an event id; the
  // words are fetched by each guest through an action that checks their own
  // cookie. What travels here is only "there is something new for this event",
  // which is already implied by the page being live.
  //
  // Best-effort by design: if this send fails, every guest's page still polls,
  // so a coordinator's words arrive late rather than never. It must never fail
  // the write that already succeeded.
  try {
    await supabase.channel(`announce:${eventId}`).send({
      type: 'broadcast',
      event: 'announcement',
      payload: {},
    });
  } catch {
    // Channel unavailable — the poll covers it.
  }

  revalidatePath(`/dashboard/${eventId}`);
  return { ok: true };
}

export type EmailCallTimesResult =
  | { ok: true; sent: number; failed: number; total: number }
  | { ok: false; reason: 'not_enabled' | 'not_authorized' | 'not_configured' | 'nothing_to_send' | 'error' };

/**
 * Email each tagged vendor their call time, derived from the master
 * run-of-show (earliest block the vendor is tagged responsible on via P2's
 * responsible_vendor_ids). Explicitly triggered by the couple/coordinator —
 * that button press is the opt-in; nothing here is scheduled or automatic.
 */
export async function emailVendorCallTimes(
  formData: FormData,
): Promise<EmailCallTimesResult> {
  if (!(await isCoordinatorP3Enabled())) return { ok: false, reason: 'not_enabled' };
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, reason: 'error' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'not_authorized' };

  const authority = await resolveBroadcastAuthority(supabase, eventId, user.id);
  if (!authority.canSend) return { ok: false, reason: 'not_authorized' };

  // No key configured → clean no-op BEFORE any derivation work.
  if (!(await isEmailConfigured())) return { ok: false, reason: 'not_configured' };

  try {
    const [blocks, meta, vendorsRes, eventRes] = await Promise.all([
      fetchScheduleBlocks(supabase, eventId),
      fetchBlockRosMeta(supabase, eventId),
      supabase
        .from('event_vendors')
        .select('vendor_id, vendor_name, contact_email')
        .eq('event_id', eventId)
        .is('archived_at', null),
      supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
    ]);
    const vendors = (vendorsRes.data ?? []) as CallTimeVendor[];
    const callTimes = deriveVendorCallTimes(blocks, meta, vendors);
    if (callTimes.length === 0) return { ok: false, reason: 'nothing_to_send' };

    const eventDisplayName =
      (eventRes.data as { display_name?: string | null } | null)?.display_name ??
      'the event';

    let sent = 0;
    let failed = 0;
    for (const callTime of callTimes) {
      const content = buildCallTimeEmail({ callTime, eventDisplayName });
      const result = await sendEmail({
        to: content.to,
        subject: content.subject,
        text: content.text,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    }
    return { ok: true, sent, failed, total: callTimes.length };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
