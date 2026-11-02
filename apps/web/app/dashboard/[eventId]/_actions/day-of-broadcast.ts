'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { liveDayTag } from '@/lib/live-day-cache';
import { createClient } from '@/lib/supabase/server';
import { readCoupleBookingStandings } from '@/lib/couple-booked-and-settled.server';
import { createAdminClient } from '@/lib/supabase/admin';
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
import { refuseLimitedHelper, limitedHelperRefusal } from '@/lib/host-gate';
import { RELEASE_NOTICE_TYPE, releasePro } from '@/lib/schedule-release.server';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Coordinator P3 server actions — day-of broadcast + email call-times
 * (Coordinator_Role_Feature_Spec_2026-07-18 §P3).
 *
 * Both run under the CALLER's authenticated client: the coordinator_broadcasts
 * INSERT policies (couple / schedule-'edit' delegate, migration 20270825364600)
 * are the real gate on the write, and every read (blocks, ros meta, vendors)
 * is RLS-scoped. The gate is the Data Privacy board control
 * 'coordinator_day_of_broadcast' (isCoordinatorP3Enabled), NOT an env var —
 * this line used to name NEXT_PUBLIC_COORDINATOR_P3_ENABLED, which nothing
 * reads. That control is `active` in prod, so these actions are LIVE.
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
): Promise<SendBroadcastResult | ReleaseScheduleResult> {
  // 📣 The 🔊 sheet's other press — Release (plan §4 "Release + announce") — rides this one action, so the sheet costs
  // no second server-action route (`lint-server-action-budget`: every export is a Vercel route).
  if (formData.get('intent') === RELEASE_INTENT) return releaseFullSchedule(formData);
  const helperRefusal = await limitedHelperRefusal(formData.get('event_id'), 'schedule');
  if (helperRefusal) return { ok: false, error: helperRefusal };
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

  // Decides whether we let them compose at all, and which refusal they see.
  // It no longer decides the attribution: this comment used to say
  // "Attribution label only — the INSERT policies re-check real authority",
  // which was true of WHETHER you may write and false of WHOSE NAME goes on
  // it. The policies never constrained sender_role, so a couple could sign
  // their own announcement as the coordinator and vice versa. Migration
  // 20271132843141 derives both sender columns in the database from
  // auth.uid(), using the same couple-then-schedule-delegate order this
  // resolver uses, and revokes the browser's privilege to name either.
  const authority = await resolveBroadcastAuthority(supabase, eventId, user.id);
  if (!authority.canSend) {
    return { ok: false, error: 'Only the couple or their coordinator can broadcast.' };
  }

  // sender_user_id / sender_role are NOT sent — `authenticated` holds no INSERT
  // privilege on either, so naming one is a hard permission failure rather than
  // a silent ignore.
  const { error } = await supabase.from('coordinator_broadcasts').insert({
    event_id: eventId,
    body: validated.body,
  });
  if (error) {
    // Pre-migration (relation missing) or RLS denial — either way, a calm
    // user-facing message; no internals leak.
    return { ok: false, error: 'Could not send the broadcast. Try again.' };
  }

  // The guests' read of the latest announcement is remembered per event for a few seconds
  // (`app/[slug]/_lib/latest-announcement.server.ts` · lib/live-day-cache.ts). Forget it NOW, so the next ask of every
  // phone reads these words, not the remembered previous ones. The cached Event Hub copies of this event wear the same
  // tag (`app/[slug]/cached/[key]/page.tsx`), so they are drawn afresh on their next open too.
  //
  // 📵 NO PING ANY MORE (EV1, 2026-10-28 — DECISION_LOG "NO EVENT HUB MAY CRASH": guests never hold a live
  // connection). The `announce:<event>` broadcast channel this used to send on had exactly one kind of listener — a
  // Realtime socket on every guest's phone — and those are gone: each phone asks `GET /{slug}/announcement` every
  // ~30 s while it is looked at, and the moment it is looked at again. A coordinator's words arrive within one ask.
  revalidateTag(liveDayTag(eventId));

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
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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
        .select('vendor_id, vendor_name, contact_email, marketplace_vendor_id')
        .eq('event_id', eventId)
        .is('archived_at', null),
      supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
    ]);
    // ⚖ NO HANDSHAKE, NO ACCESS (owner 2026-10-07; audit F3, item 13). A
    // Setnayan supplier is sent the day's call times only once booked and
    // settled as the couple sees it. A supplier the couple added by hand is
    // their own contact and is sent them as before.
    const rawVendors = (vendorsRes.data ?? []) as Array<
      CallTimeVendor & { marketplace_vendor_id?: string | null }
    >;
    const standings = await readCoupleBookingStandings(
      createAdminClient(),
      rawVendors.filter((v) => v.marketplace_vendor_id).map((v) => v.vendor_id),
    );
    const vendors: CallTimeVendor[] = rawVendors.filter(
      (v) => !v.marketplace_vendor_id || standings.get(v.vendor_id)?.standing === 'booked',
    );
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

/** The `intent` a FormData carries to ask `sendCoordinatorBroadcast` for Release instead of an announcement. */
const RELEASE_INTENT = 'release';

export type ReleaseScheduleResult =
  | { ok: true; releasedAt: string; told: number; already: boolean }
  | { ok: false; error: string };

/**
 * 📣 RELEASE THE FULL SCHEDULE (owner 2026-11-01: *"Coordinator or host presses release"* · *"Just norifications
 * please"*; plan §3, §3b). A host, or a coordinator with Edit on the Schedule, presses it in the Schedule's 🔊 sheet.
 *
 *   · 💎 PRO ONLY (§3b) — a Free event is refused here, before anything is written (`releasePro`, the real answer,
 *     never the "view as free" one). The sheet shows Free its ◆ Pro door instead of a working button.
 *   · The ONE writer is the database (`release_full_schedule`, 20271302139506): it re-checks who may, stamps
 *     `events.schedule_released_at` once, and writes ONE in-app notice to every guest account on the event. No email.
 *     A second press is a no-op that notifies nobody.
 *   · The event's stamp moves with the write, and the live-day tag is cleared, so every cached Event Hub copy is drawn
 *     afresh on its next open — guests hold no live connection, nothing is pushed to them.
 */
async function releaseFullSchedule(formData: FormData): Promise<ReleaseScheduleResult> {
  const helperRefusal = await limitedHelperRefusal(formData.get('event_id'), 'schedule');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return { ok: false, error: 'Invalid event.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const authority = await resolveBroadcastAuthority(supabase, eventId, user.id);
  if (!authority.canSend) return { ok: false, error: 'Only a host or your coordinator can release the schedule.' };
  if (!(await releasePro(eventId))) {
    return { ok: false, error: 'Release is part of Pro. On Free, guests keep their chapters and an estimated call time.' };
  }

  const { data, error } = await supabase.rpc('release_full_schedule', { p_event_id: eventId });
  if (error) {
    logQueryError('releaseFullSchedule', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: 'Could not release the schedule. Try again.' };
  }
  const out = (data ?? {}) as { released_at?: string; told?: number; already?: boolean; notice?: string };
  if (!out.already && out.notice !== RELEASE_NOTICE_TYPE) {
    // Released, but the database wrote a notice the app's union does not name — said in the log, never hidden.
    logQueryError('releaseFullSchedule.notice', { message: `unexpected notice type ${String(out.notice)}` }, { event_id: eventId }, 'graceful_degrade');
  }
  revalidateTag(liveDayTag(eventId));
  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
  return { ok: true, releasedAt: out.released_at ?? new Date().toISOString(), told: out.told ?? 0, already: out.already === true };
}
