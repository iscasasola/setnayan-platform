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
