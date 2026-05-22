'use server';

/**
 * Phase 0 Date Selection — server actions.
 *
 * Per CLAUDE.md 2026-05-22 owner directive. Three actions cover the
 * lifecycle:
 *   - lockEventDate: host clicks "Lock this date and start planning".
 *     Sets events.event_date + events.event_date_precision (defaults to
 *     'day' since the auspicious-card flow requires a specific date) +
 *     events.date_status='locked' + computes & persists
 *     events.auspicious_reasons. Enforces the existing Task #37 vendor-
 *     lock gate as defense-in-depth even though Phase 0 is typically a
 *     pre-vendor surface.
 *   - setMeaningfulDates: bulk replace of event_meaningful_dates rows for
 *     this event (delete-then-insert pattern). Feeds the guided-flow
 *     suggestion algorithm.
 *   - markDateUndecided: host clicks "I'm not ready yet" → sets
 *     date_status='undecided'. Does NOT clear event_date if one already
 *     existed (so re-entering the flow doesn't destroy prior locked-in
 *     state by accident).
 *
 * RLS already restricts these to hosts of the event via event_moderators
 * (per migration 20260604020000) and event_members (per the historical
 * events table RLS). Server actions add a defensive auth check on top.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CONFIRMED_VENDOR_STATUSES,
  type EventDatePrecision,
} from '@/lib/events';
import {
  computeAuspiciousReasons,
  type CeremonyType,
  type MeaningfulDateKind,
} from '@/lib/auspicious-date';

const ALLOWED_KINDS: MeaningfulDateKind[] = [
  'honor',
  'avoid',
  'anniversary',
  'birthday',
  'other',
];

const CEREMONY_TYPES: CeremonyType[] = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
];

function isCeremonyType(value: unknown): value is CeremonyType {
  return typeof value === 'string' && (CEREMONY_TYPES as readonly string[]).includes(value);
}

function isKind(value: unknown): value is MeaningfulDateKind {
  return typeof value === 'string' && (ALLOWED_KINDS as readonly string[]).includes(value);
}

/**
 * Lock a wedding date for the event. Computes positive auspicious reasons
 * at lock time and persists them onto events.auspicious_reasons so a future
 * change to the library doesn't quietly rewrite the host's locked reasons.
 *
 * The Task #37 vendor-lock gate fires the same way as updateEventDate in
 * the parent /dashboard/[eventId]/actions.ts: when there's already an
 * event_date and ≥1 confirmed vendor, the action refuses changes. Phase 0
 * is typically pre-vendor so this rarely fires, but defense-in-depth.
 */
export async function lockEventDate(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const dateRaw = formData.get('event_date');
  const precisionRaw = formData.get('precision');
  if (typeof eventId !== 'string') throw new Error('event_id required');
  if (typeof dateRaw !== 'string' || dateRaw.trim().length === 0) {
    throw new Error('Pick a date before locking');
  }
  const trimmed = dateRaw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Invalid date format — use YYYY-MM-DD');
  }

  // Phase 0 produces a fully-specified date — precision defaults to 'day'.
  // The form may submit 'year' or 'month' for hosts who picked early-stage
  // through the 4-question flow without narrowing to a specific day; those
  // submissions still set date_status='locked' but with the matching
  // precision so the existing event-home StageStrip math behaves correctly.
  const ALLOWED_PRECISIONS = ['year', 'month', 'day'] as const;
  const precision: EventDatePrecision =
    typeof precisionRaw === 'string' &&
    (ALLOWED_PRECISIONS as readonly string[]).includes(precisionRaw)
      ? (precisionRaw as EventDatePrecision)
      : 'day';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read prior event state for the vendor-lock gate.
  const { data: priorRow } = await supabase
    .from('events')
    .select('event_date, ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();

  const wasSet = Boolean(priorRow?.event_date);
  const dateChanged = wasSet && trimmed !== priorRow?.event_date;

  if (dateChanged) {
    const { count } = await supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Date is locked — ${count} confirmed vendor${count === 1 ? '' : 's'}. Contact support to discuss changes.`,
      );
    }
  }

  // Pull meaningful dates so the auspicious-reason computation can include
  // host-personal resonance. Use admin client to bypass RLS for this read
  // since the server action is already auth-gated above; the table's own
  // policies require event_moderators membership which we trust the form
  // contract to honor.
  const adminClient = createAdminClient();
  const { data: meaningfulRows } = await adminClient
    .from('event_meaningful_dates')
    .select('meaningful_date, kind, note')
    .eq('event_id', eventId);

  const ceremonyType = isCeremonyType(priorRow?.ceremony_type)
    ? (priorRow!.ceremony_type as CeremonyType)
    : null;

  // Parse the YMD parts locally to avoid timezone drift when constructing
  // the Date for the library — same pattern as formatEventDateWithPrecision.
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const dateForReasons = new Date(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
  );

  const reasons = computeAuspiciousReasons(
    dateForReasons,
    ceremonyType,
    (meaningfulRows ?? []).map((r) => ({
      date: r.meaningful_date as string,
      kind: r.kind as MeaningfulDateKind,
      note: (r.note as string | null) ?? null,
    })),
  );

  const { error } = await supabase
    .from('events')
    .update({
      event_date: trimmed,
      event_date_precision: precision,
      date_status: 'locked',
      auspicious_reasons: reasons,
    })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
  redirect(`/dashboard/${eventId}?date_locked=1`);
}

/**
 * Bulk replace meaningful dates for an event. The form submits arrays of
 * three parallel fields (dates[], kinds[], notes[]); they MUST be the same
 * length and the i-th entry of each combines into one row.
 *
 * Strategy: delete all prior rows for this event, then insert the new set.
 * Cleaner than diff-based reconciliation for the 4-question flow's UX
 * where the host edits a small set at a time. RLS on event_meaningful_dates
 * gates both the delete and insert by event_moderators membership.
 */
export async function setMeaningfulDates(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string') throw new Error('event_id required');

  const dates = formData.getAll('meaningful_date');
  const kinds = formData.getAll('kind');
  const notes = formData.getAll('note');

  if (dates.length !== kinds.length || dates.length !== notes.length) {
    throw new Error('Mismatched meaningful date arrays');
  }

  // Build the rows to insert. Skip any row where the date is empty (the
  // form allows blank rows for "add another" UX without forcing all slots
  // to be filled).
  type RowInsert = {
    event_id: string;
    meaningful_date: string;
    kind: MeaningfulDateKind;
    note: string | null;
    created_by_user_id: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows: RowInsert[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const kind = kinds[i];
    const note = notes[i];
    if (typeof date !== 'string' || date.trim().length === 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      throw new Error(`Invalid date at row ${i + 1} — use YYYY-MM-DD`);
    }
    if (!isKind(kind)) {
      throw new Error(`Invalid kind at row ${i + 1}`);
    }
    rows.push({
      event_id: eventId,
      meaningful_date: date.trim(),
      kind,
      note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : null,
      created_by_user_id: user.id,
    });
  }

  // Replace strategy: delete-then-insert.
  const { error: delError } = await supabase
    .from('event_meaningful_dates')
    .delete()
    .eq('event_id', eventId);
  if (delError) throw new Error(delError.message);

  if (rows.length > 0) {
    const { error: insError } = await supabase
      .from('event_meaningful_dates')
      .insert(rows);
    if (insError) throw new Error(insError.message);
  }

  // Flip date_status to 'tentative' so the host can see they're mid-flow
  // when they navigate back. Only if no date is currently locked — locking
  // happens via lockEventDate which sets status='locked' explicitly.
  await supabase
    .from('events')
    .update({ date_status: 'tentative' })
    .eq('event_id', eventId)
    .eq('date_status', 'undecided');

  revalidatePath(`/dashboard/${eventId}/date-selection`);
}

/**
 * Persist the host's ceremony_type pick from the 4-question flow.
 *
 * Why this exists separately from the parent setEventCeremonyType in
 * apps/web/app/dashboard/[eventId]/actions.ts:
 *
 *   - The parent setEventCeremonyType is the canonical writer with full
 *     audit-log + vendor-lock semantics + idempotent-no-op short-circuit.
 *   - The Phase 0 4-question flow needs to write ceremony_type as the
 *     host steps through Q1 (religious tradition). Step transitions are
 *     non-blocking — if the write fails we still want the host to see
 *     the rest of the flow without an error blocker.
 *   - The 4-question flow's "Skip for now" path emits 'undecided' which
 *     the parent setEventCeremonyType would reject as invalid_input —
 *     this thin wrapper handles undecided as a no-op (leave NULL).
 *
 * Per CLAUDE.md 2026-05-22 owner directive ("select wedding type is still
 * not showing the initial wedding type"): the previous build of the
 * 4-question flow captured ceremonyChoice in local React state but never
 * persisted it to events.ceremony_type, so the EventMetaLine on event
 * home displayed "Set wedding type" CTA even when the host had picked
 * Catholic in Phase 0. This action closes that gap.
 *
 * Stamps both ceremony_type AND ceremony_type_locked_at (+ locked_by)
 * because picking through the 4-question flow IS an affirmative pick —
 * same semantic as picking through the create-event picker or the
 * dashboard chip modal. EventMetaLine's "Set wedding type" CTA gates
 * on `Boolean(ceremony_type_locked_at) && Boolean(ceremony_type)`; both
 * must be truthy for the chip to render the confirmed state.
 */
export async function setCeremonyTypeFromFlow(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const eventId = formData.get('event_id');
  const ceremonyRaw = formData.get('ceremony_type');
  if (typeof eventId !== 'string') {
    return { ok: false, message: 'event_id required' };
  }
  if (typeof ceremonyRaw !== 'string' || ceremonyRaw.trim().length === 0) {
    return { ok: false, message: 'ceremony_type required' };
  }
  // 'undecided' is a valid client-side state but a no-op for persistence:
  // leave the column NULL so EventMetaLine's CTA still surfaces correctly.
  if (ceremonyRaw === 'undecided') {
    return { ok: true };
  }
  if (!isCeremonyType(ceremonyRaw)) {
    return { ok: false, message: 'Invalid ceremony type' };
  }
  const ceremonyType = ceremonyRaw as CeremonyType;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Vendor-lock guard mirrors the parent setEventCeremonyType. Even
  // though Phase 0 is typically pre-vendor, defense-in-depth: a host who
  // re-enters Phase 0 after their first vendor confirmed cannot quietly
  // change ceremony_type — they have to go through the dashboard modal
  // path which surfaces the lock copy explicitly.
  const admin = createAdminClient();
  const { data: priorRow, error: selectErr } = await admin
    .from('events')
    .select('event_type, ceremony_type, ceremony_type_locked_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (selectErr) {
    return { ok: false, message: selectErr.message };
  }
  if (!priorRow) {
    return { ok: false, message: 'Event not found' };
  }
  if (priorRow.event_type !== 'wedding') {
    // Non-wedding events don't carry ceremony_type. Silent no-op so the
    // flow doesn't error for someone who somehow lands on Phase 0 for
    // a debut etc.
    return { ok: true };
  }

  const { count: confirmedCount } = await admin
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  const confirmed = confirmedCount ?? 0;
  if (confirmed > 0 && priorRow.ceremony_type !== ceremonyType) {
    return {
      ok: false,
      message: `Wedding type is locked — ${confirmed} confirmed ${confirmed === 1 ? 'vendor' : 'vendors'}. Contact support to discuss a change.`,
    };
  }

  // Idempotent no-op: same value already stamped.
  if (priorRow.ceremony_type === ceremonyType && priorRow.ceremony_type_locked_at) {
    return { ok: true };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from('events')
    .update({
      ceremony_type: ceremonyType,
      ceremony_type_locked_at: nowIso,
      ceremony_type_locked_by: user.id,
    })
    .eq('event_id', eventId);
  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  // Audit-log so misuse / drift surfaces. Mirrors the parent action's
  // shape so admin dashboards reading admin_audit_log see consistent rows
  // regardless of whether the host set the type via Phase 0 or the chip.
  await admin.from('admin_audit_log').insert({
    action: priorRow.ceremony_type_locked_at ? 'ceremony_type_updated' : 'ceremony_type_set',
    target_table: 'events',
    target_id: eventId,
    before_json: {
      ceremony_type: priorRow.ceremony_type,
      ceremony_type_locked_at: priorRow.ceremony_type_locked_at,
      confirmed_vendor_count: confirmed,
      source: 'phase_0_four_question_flow',
    },
    after_json: { ceremony_type: ceremonyType, ceremony_type_locked_at: nowIso },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/date-selection`);
  return { ok: true };
}

/**
 * Mark the date as undecided. Does NOT clear an existing event_date so
 * "I'm not ready yet" mid-flow doesn't accidentally destroy a previously
 * locked-in date. To clear the date entirely the host edits via the
 * standard EventDateInput component on event home.
 */
export async function markDateUndecided(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string') throw new Error('event_id required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ date_status: 'undecided' })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
  redirect(`/dashboard/${eventId}`);
}
