'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { STEPS, type StepKey } from '@/lib/planner';
import {
  CONFIRMED_VENDOR_STATUSES,
  PRECISION_ORDER,
  isEventDateInPast,
  type EventDatePrecision,
} from '@/lib/events';

const ALLOWED_PRECISIONS = ['year', 'month', 'day'] as const;

function isPrecision(value: unknown): value is EventDatePrecision {
  return typeof value === 'string'
    && (ALLOWED_PRECISIONS as readonly string[]).includes(value);
}

/**
 * Save the wedding date on an event. Empty / null clears the date back to
 * "not set." RLS scopes the update to event_members so non-hosts can't
 * touch other people's events.
 *
 * Task #39 (2026-05-22) — tiered precision support. The form submits a
 * `precision` field (year | month | day) alongside `event_date` and
 * `event_date_precision` is persisted on `events`. For year/month modes,
 * event_date stores the first-day-of-range placeholder ('2027-01-01' for
 * year, '2027-08-01' for month) so downstream consumers that read
 * event_date keep working.
 *
 * Refine-only ratchet (Task #39): when confirmed_vendor_count > 0, the
 * precision can narrow (year → month, month → day, year → day) but never
 * widen (day → month, month → year). Same date value at lower precision
 * IS a widening — gate fires. The UI hides the wider modes when the gate
 * applies; this server action is defense-in-depth.
 *
 * Per the 0021 date-edit gate (Task #37, 2026-05-22): hosts may freely
 * change the date until at least one vendor relationship is at-or-past
 * `contracted`. After that, edits are gated to support — the UI hides
 * the Edit button, and this action enforces the same rule server-side as
 * defense-in-depth against direct form submits.
 */
export async function updateEventDate(formData: FormData) {
  const eventId = formData.get('event_id');
  const dateRaw = formData.get('event_date');
  const precisionRaw = formData.get('precision');
  if (typeof eventId !== 'string') throw new Error('event_id required');

  const newPrecision: EventDatePrecision = isPrecision(precisionRaw) ? precisionRaw : 'day';

  let eventDate: string | null = null;
  if (typeof dateRaw === 'string' && dateRaw.trim().length > 0) {
    // HTML date inputs emit YYYY-MM-DD which Postgres DATE accepts as-is.
    // Reject anything else so we don't store junk.
    const trimmed = dateRaw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('Invalid date format — use YYYY-MM-DD');
    }
    eventDate = trimmed;
  }

  // Task #41 (2026-05-22) — reject past dates. The client `min` attrs
  // restrict the picker, but a direct form-submit could still try to
  // sneak past it; this is defense-in-depth. Precision-aware: year mode
  // accepts the rest of the current calendar year, month mode the rest
  // of the current month, day mode strictly today onwards.
  if (eventDate && isEventDateInPast(eventDate, newPrecision)) {
    throw new Error(
      "Wedding date can't be in the past. Pick today or a future date.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read prior precision + date so we can run both gates: (a) the original
  // Task #37 vendor-lock gate when the day itself changes, and (b) the new
  // Task #39 refine-only ratchet when precision widens.
  const { data: priorRow } = await supabase
    .from('events')
    .select('event_date, event_date_precision')
    .eq('event_id', eventId)
    .maybeSingle();
  const priorPrecision: EventDatePrecision = isPrecision(priorRow?.event_date_precision)
    ? (priorRow!.event_date_precision as EventDatePrecision)
    : 'year';
  const wasSet = Boolean(priorRow?.event_date);
  const dateChanged = wasSet && eventDate !== priorRow?.event_date;
  const precisionWidens = PRECISION_ORDER[newPrecision] < PRECISION_ORDER[priorPrecision];

  if (wasSet && (dateChanged || precisionWidens)) {
    const { count } = await supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    if ((count ?? 0) > 0) {
      // Surface the refine-only message when the violation is a precision
      // widen (this is the new Task #39 path). When the day itself
      // changed at the same precision, surface the original Task #37 lock
      // message so the host sees the more specific guidance.
      if (precisionWidens && !dateChanged) {
        throw new Error(
          `Can't widen precision — you have ${count} confirmed vendor${count === 1 ? '' : 's'}. Narrow your date instead (year → month → day), don't broaden it.`,
        );
      }
      throw new Error(
        `Date is locked — ${count} confirmed vendor${count === 1 ? '' : 's'}. Contact support to discuss changes.`,
      );
    }
  }

  const { error } = await supabase
    .from('events')
    .update({
      event_date: eventDate,
      event_date_precision: newPrecision,
    })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
}

const MANUAL_KEYS = new Set<StepKey>(
  STEPS.filter((s) => s.source === 'manual').map((s) => s.key),
);

export async function toggleJourneyStep(formData: FormData) {
  const eventId = formData.get('event_id');
  const stepKey = formData.get('step_key');
  const action = formData.get('action');

  if (typeof eventId !== 'string' || typeof stepKey !== 'string' || typeof action !== 'string') {
    throw new Error('Invalid input');
  }
  if (!MANUAL_KEYS.has(stepKey as StepKey)) {
    throw new Error('Step is auto-derived');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (action === 'complete') {
    const { error } = await supabase
      .from('event_journey_steps')
      .upsert(
        { event_id: eventId, step_key: stepKey, completed_by: user.id, completed_at: new Date().toISOString() },
        { onConflict: 'event_id,step_key' },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('event_journey_steps')
      .delete()
      .eq('event_id', eventId)
      .eq('step_key', stepKey);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}`);
}

// Task #37 (2026-05-22) — host explicitly confirms wedding ceremony_type.
// One-time set, then immutable (idempotent guard fires on second call).
// Mirrors the event_type lock from iteration 0000.
const ALLOWED_CEREMONY_TYPES = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
] as const;
type AllowedCeremonyType = (typeof ALLOWED_CEREMONY_TYPES)[number];

type SetCeremonyResult =
  | { ok: true; ceremony_type: AllowedCeremonyType }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'already_locked' | 'vendor_lock' | 'not_wedding' | 'db_error'; message: string };

export async function setEventCeremonyType(formData: FormData): Promise<SetCeremonyResult> {
  const eventId = formData.get('event_id');
  const ceremonyRaw = formData.get('ceremony_type');

  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  if (typeof ceremonyRaw !== 'string' ||
      !ALLOWED_CEREMONY_TYPES.includes(ceremonyRaw as AllowedCeremonyType)) {
    return { ok: false, code: 'invalid_input', message: 'Invalid ceremony type' };
  }
  const ceremony_type = ceremonyRaw as AllowedCeremonyType;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  }

  // Auth: caller must be a host on this event. event_members + event_moderators
  // both qualify (per iteration 0048 multi-host model). RLS would already
  // gate the UPDATE below, but we check explicitly so we can return a clean
  // error code rather than a silent zero-row update.
  const { data: memberRow } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  let isHost = !!memberRow;
  if (!isHost) {
    const { data: modRow } = await supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .not('accepted_at', 'is', null)
      .maybeSingle();
    isHost = !!modRow;
  }
  if (!isHost) {
    return { ok: false, code: 'unauthorized', message: 'You are not a host on this event' };
  }

  // Idempotent guard. SELECT current state first so we can return a precise
  // error code for the "already locked" case (used by the modal to refuse
  // the open). Uses the admin client because RLS may strip columns the
  // user-scoped query needs to see (ceremony_type_locked_at can be hidden
  // on RLS-narrowed reads for guests; we want the canonical row).
  const admin = createAdminClient();
  const { data: eventRow, error: selectError } = await admin
    .from('events')
    .select('event_id, event_type, ceremony_type, ceremony_type_locked_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (selectError) {
    return { ok: false, code: 'db_error', message: selectError.message };
  }
  if (!eventRow) {
    return { ok: false, code: 'unauthorized', message: 'Event not found' };
  }
  if (eventRow.event_type !== 'wedding') {
    return { ok: false, code: 'not_wedding', message: 'Wedding type applies to wedding events only' };
  }
  if (eventRow.ceremony_type_locked_at) {
    return { ok: false, code: 'already_locked', message: 'Wedding type is already set and cannot be changed' };
  }

  // Vendor-confirmed gate — once any vendor is at-or-past `contracted`,
  // the wedding type is locked at its current default. Host must contact
  // support to discuss a change (mirrors the 2026-05-15 row 449 self-delete
  // pattern + the 2026-05-17 § 10 date-edit gate).
  const { count: confirmedCount, error: countError } = await admin
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  if (countError) {
    return { ok: false, code: 'db_error', message: countError.message };
  }
  if ((confirmedCount ?? 0) > 0) {
    return {
      ok: false,
      code: 'vendor_lock',
      message: `Wedding type cannot be set after vendors confirm (${confirmedCount} confirmed). Contact support to discuss.`,
    };
  }

  // Race-tolerant write — guard on ceremony_type_locked_at IS NULL so two
  // concurrent hosts hitting Save at the same instant can't both succeed.
  // The DB CHECK (events_ceremony_lock_requires_ceremony_type from
  // 20260603000000) enforces ceremony_type is non-NULL alongside the stamp,
  // which is already true for every wedding row.
  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from('events')
    .update({
      ceremony_type,
      ceremony_type_locked_at: nowIso,
      ceremony_type_locked_by: user.id,
    })
    .eq('event_id', eventId)
    .is('ceremony_type_locked_at', null)
    .select('event_id, ceremony_type, ceremony_type_locked_at')
    .maybeSingle();
  if (updateError) {
    return { ok: false, code: 'db_error', message: updateError.message };
  }
  if (!updated) {
    // Zero-row update means another host locked the slot between our
    // SELECT and UPDATE. Re-fetch to surface the actual locked value.
    const { data: latest } = await admin
      .from('events')
      .select('ceremony_type, ceremony_type_locked_at')
      .eq('event_id', eventId)
      .maybeSingle();
    return {
      ok: false,
      code: 'already_locked',
      message: latest?.ceremony_type
        ? `Wedding type was set to ${latest.ceremony_type} by another host`
        : 'Wedding type was set by another host',
    };
  }

  // Audit log — admin_audit_log is the canonical record per 0023.
  await admin.from('admin_audit_log').insert({
    action: 'ceremony_type_set',
    target_table: 'events',
    target_id: eventId,
    before_json: { ceremony_type: eventRow.ceremony_type, ceremony_type_locked_at: null },
    after_json: { ceremony_type, ceremony_type_locked_at: nowIso },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`);
  return { ok: true, ceremony_type };
}
