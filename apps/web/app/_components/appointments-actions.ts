'use server';

// ============================================================================
// app/_components/appointments-actions.ts
//
// Server actions for the two-sided Appointments scheduler (Relationship
// Workspace + Appointments, PR 12). Shared by BOTH entry pages — the vendor's
// Customer Card (/vendor-dashboard/clients/[eventId]) and the couple's Vendor
// Workspace (/dashboard/[eventId]/vendors/[vendorId]/workspace).
//
// AUTHORIZATION IS RLS, NEVER AN ADMIN CLIENT. Every write runs under the
// caller's OWN session client, so the event_appointments policies are the
// boundary: a booked vendor can only touch rows for its own profile on a booked
// event; a couple/host/coordinator can only touch rows on their own event. This
// mirrors suggestScheduleChange / vendorRaiseChangeOrder exactly. The admin
// client appears ONLY to FAN OUT the best-effort notification to the other
// party (resolving recipient user ids across a table the caller can't read) —
// it never authorizes or performs the appointment write.
//
// SINGLE-WINNER: confirm / decline / propose-new update WHERE status='proposed'
// so a race resolves once (the loser updates 0 rows). No RPC/state-machine was
// added — the WHERE precondition is the guard.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import type { AppointmentInitiator } from '@/lib/appointments';

function str(v: FormDataEntryValue | null, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function toIso(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDuration(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1440) return null;
  return Math.round(n);
}

function safeReturnPath(v: FormDataEntryValue | null): string {
  // Only ever revalidate/redirect to an in-app absolute path — never an
  // attacker-controlled external URL.
  const p = str(v, 300);
  return p && p.startsWith('/') ? p : '/dashboard';
}

/**
 * Best-effort fan-out to the OTHER party. `party='couple'` → every couple
 * member of the event (deep-linked to their vendor workspace); `party='vendor'`
 * → the vendor org's owner account (deep-linked to their Customer Card). Reuses
 * the generic `schedule_suggestion` notification type — the same "the other
 * side posted something schedule-related, open it" register the Suggest and
 * change-order flows use. Never blocks the appointment write.
 */
async function notifyOtherParty(opts: {
  party: AppointmentInitiator;
  eventId: string;
  vendorProfileId: string | null;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    if (opts.party === 'couple') {
      let relatedUrl = `/dashboard/${opts.eventId}/vendors`;
      if (opts.vendorProfileId) {
        const { data: evRow } = await admin
          .from('event_vendors')
          .select('vendor_id')
          .eq('event_id', opts.eventId)
          .eq('marketplace_vendor_id', opts.vendorProfileId)
          .maybeSingle();
        const eventVendorId = (evRow as { vendor_id?: string } | null)?.vendor_id ?? null;
        if (eventVendorId) {
          relatedUrl = `/dashboard/${opts.eventId}/vendors/${eventVendorId}/workspace`;
        }
      }
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', opts.eventId)
        .eq('member_type', 'couple');
      for (const m of (members ?? []) as Array<{ user_id: string | null }>) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: opts.title,
          body: opts.body,
          relatedUrl,
        });
      }
    } else {
      if (!opts.vendorProfileId) return;
      const { data: prof } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', opts.vendorProfileId)
        .maybeSingle();
      const vendorUserId = (prof as { user_id?: string | null } | null)?.user_id ?? null;
      if (vendorUserId) {
        await emitNotification({
          userId: vendorUserId,
          type: 'schedule_suggestion',
          title: opts.title,
          body: opts.body,
          relatedUrl: `/vendor-dashboard/clients/${opts.eventId}`,
        });
      }
    }
  } catch (e) {
    console.error('[appointments] notify failed:', e);
  }
}

/**
 * Resolve the caller's role in THIS relationship. A caller who owns / is a team
 * member of the vendor org (fetchOwnVendorProfile resolves to that profile) is
 * the 'vendor'; anyone else acting on the event is the 'couple'. Purely to set
 * initiated_by truthfully — RLS independently enforces which rows each side may
 * write, so a mis-derived role can never grant access.
 */
async function resolveRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  vendorProfileId: string | null,
): Promise<AppointmentInitiator> {
  if (!vendorProfileId) return 'couple';
  const profile = await fetchOwnVendorProfile(supabase, userId);
  return profile?.vendor_profile_id === vendorProfileId ? 'vendor' : 'couple';
}

/**
 * proposeAppointment — either side proposes a meeting on a booked relationship.
 * RLS-gated insert (booked vendor ∩ own profile, OR event member); status
 * 'proposed'; initiated_by = the caller's resolved role; proposed_by_user_id =
 * auth.uid(). Notifies the OTHER party best-effort.
 */
export async function proposeAppointment(formData: FormData): Promise<void> {
  const eventId = str(formData.get('event_id'), 64);
  const vendorProfileId = str(formData.get('vendor_profile_id'), 64);
  const returnPath = safeReturnPath(formData.get('return_path'));
  const kindRaw = formData.get('kind');
  const kind =
    kindRaw === 'in_person' || kindRaw === 'video' || kindRaw === 'voice' ? kindRaw : null;
  const type = str(formData.get('type'), 60);
  if (!eventId || !kind || !type) redirect(returnPath);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const initiatedBy = await resolveRole(supabase, user.id, vendorProfileId);

  // Custom meetings require a free-text name.
  const customLabel = type === 'custom' ? str(formData.get('custom_label'), 120) : null;
  if (type === 'custom' && !customLabel) redirect(returnPath);

  const { error } = await supabase.from('event_appointments').insert({
    event_id: eventId,
    vendor_profile_id: vendorProfileId,
    thread_id: str(formData.get('thread_id'), 64),
    kind,
    type,
    custom_label: customLabel,
    location: kind === 'in_person' ? str(formData.get('location'), 300) : null,
    scheduled_at: toIso(formData.get('scheduled_at')),
    duration_min: toDuration(formData.get('duration_min')),
    status: 'proposed',
    initiated_by: initiatedBy,
    proposed_by_user_id: user.id,
    note: str(formData.get('note'), 1000),
  });

  if (!error) {
    const label = str(formData.get('label'), 120) ?? customLabel ?? type;
    await notifyOtherParty({
      party: initiatedBy === 'vendor' ? 'couple' : 'vendor',
      eventId,
      vendorProfileId,
      title: `Meeting proposed: ${label}`,
      body: 'Open the relationship page to confirm or propose a new time.',
    });
  }

  revalidatePath(returnPath);
  redirect(returnPath);
}

/**
 * respondAppointment — the COUNTERPARTY confirms / declines / proposes a new
 * time on a 'proposed' row. Single-winner via the status='proposed' WHERE
 * precondition. Only the party who did NOT propose may respond (propose_new
 * flips initiated_by to the responder and keeps the row proposed). Notifies the
 * other side best-effort.
 */
export async function respondAppointment(formData: FormData): Promise<void> {
  const appointmentId = str(formData.get('appointment_id'), 64);
  const eventId = str(formData.get('event_id'), 64);
  const vendorProfileId = str(formData.get('vendor_profile_id'), 64);
  const returnPath = safeReturnPath(formData.get('return_path'));
  const decisionRaw = formData.get('decision');
  const decision =
    decisionRaw === 'confirm' || decisionRaw === 'decline' || decisionRaw === 'propose_new'
      ? decisionRaw
      : null;
  if (!appointmentId || !eventId || !decision) redirect(returnPath);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const actorRole = await resolveRole(supabase, user.id, vendorProfileId);

  // Read the current row (RLS-scoped) to enforce the counterparty rule + the
  // single-winner precondition, and to build a readable notification label.
  const { data: apptRow } = await supabase
    .from('event_appointments')
    .select('status, initiated_by, type, custom_label')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  const appt = apptRow as
    | { status: string; initiated_by: string | null; type: string; custom_label: string | null }
    | null;
  // Act only on a live proposal you did NOT author.
  if (!appt || appt.status !== 'proposed' || appt.initiated_by === actorRole) {
    revalidatePath(returnPath);
    redirect(returnPath);
  }

  const label =
    str(formData.get('label'), 120) ??
    (appt!.type === 'custom' ? appt!.custom_label ?? 'appointment' : appt!.type);

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (decision === 'confirm') {
    update.status = 'confirmed';
  } else if (decision === 'decline') {
    update.status = 'cancelled';
  } else {
    // propose_new — carry a fresh time, flip authorship to the responder, and
    // keep the row proposed so the original proposer confirms next.
    const newAt = toIso(formData.get('scheduled_at'));
    if (!newAt) redirect(returnPath);
    update.scheduled_at = newAt;
    update.initiated_by = actorRole;
    update.proposed_by_user_id = user.id;
    update.status = 'proposed';
    const newDuration = toDuration(formData.get('duration_min'));
    if (newDuration) update.duration_min = newDuration;
  }

  const { data: updated } = await supabase
    .from('event_appointments')
    .update(update)
    .eq('appointment_id', appointmentId)
    .eq('status', 'proposed')
    .select('appointment_id');

  // Only notify on a real transition (single-winner: the loser updated 0 rows).
  if (updated && updated.length > 0) {
    const otherParty: AppointmentInitiator = actorRole === 'vendor' ? 'couple' : 'vendor';
    const title =
      decision === 'confirm'
        ? `Meeting confirmed: ${label}`
        : decision === 'decline'
          ? `Meeting declined: ${label}`
          : `New time proposed: ${label}`;
    const body =
      decision === 'propose_new'
        ? 'Open the relationship page to confirm the new time.'
        : 'Open the relationship page for details.';
    await notifyOtherParty({ party: otherParty, eventId, vendorProfileId, title, body });
  }

  revalidatePath(returnPath);
  redirect(returnPath);
}

/**
 * cancelAppointment — either side cancels a proposed or confirmed meeting.
 * RLS scopes the update to the caller's relationship; the status IN (...) guard
 * keeps done/cancelled rows immutable. Notifies the other side best-effort.
 */
export async function cancelAppointment(formData: FormData): Promise<void> {
  const appointmentId = str(formData.get('appointment_id'), 64);
  const eventId = str(formData.get('event_id'), 64);
  const vendorProfileId = str(formData.get('vendor_profile_id'), 64);
  const returnPath = safeReturnPath(formData.get('return_path'));
  if (!appointmentId || !eventId) redirect(returnPath);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const actorRole = await resolveRole(supabase, user.id, vendorProfileId);
  const label = str(formData.get('label'), 120) ?? 'appointment';

  const { data: updated } = await supabase
    .from('event_appointments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('appointment_id', appointmentId)
    .in('status', ['proposed', 'confirmed'])
    .select('appointment_id');

  if (updated && updated.length > 0) {
    await notifyOtherParty({
      party: actorRole === 'vendor' ? 'couple' : 'vendor',
      eventId,
      vendorProfileId,
      title: `Meeting cancelled: ${label}`,
      body: 'The other party cancelled this meeting.',
    });
  }

  revalidatePath(returnPath);
  redirect(returnPath);
}
