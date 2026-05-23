/**
 * Concierge Active Wizard · server actions.
 *
 * Iteration 0016 · Phase 1 ships the first card-completion action:
 * `completeSetWeddingDateTask`. Future Phases (2-5) add their card-specific
 * actions to this same file so they share validation patterns + the
 * wizard_state merge helper.
 *
 * All wizard actions follow the same shape:
 *   1. Authenticate the host (server-only)
 *   2. Read current event row (vendor-lock gate, ceremony_type, etc.)
 *   3. Compute any derived state (e.g. auspicious reasons from the date)
 *   4. Atomically update events.* domain columns + merge new entry into
 *      events.wizard_state JSONB (so the wizard resolver moves to the
 *      next task on the next render)
 *   5. revalidatePath('/dashboard/[eventId]') · NO redirect (the host
 *      stays on event home; the wizard transitions in-place)
 *
 * Per [[feedback_setnayan_orphan_prevention]] every action is consumed by
 * an entry point — `completeSetWeddingDateTask` is consumed by the inline
 * SetWeddingDateCard's <form> action.
 *
 * Per [[feedback_setnayan_document_changes_with_why]] every action carries
 * an inline WHY block linking back to the canonical decision-log row.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeAuspiciousReasons,
  type CeremonyType,
  type MeaningfulDate,
  type MeaningfulDateKind,
} from '@/lib/auspicious-date';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { parseWizardState, type WizardState, type WizardTaskId } from '@/lib/wizard';

/** Runtime CeremonyType validator · matches the union in auspicious-date.ts.
 *  Inline here (vs imported) because the lib doesn't export a runtime
 *  array · matches the same local-const pattern in
 *  /date-selection/actions.ts line 50. */
const VALID_CEREMONY_TYPES = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
] as const;

function isCeremonyType(value: unknown): value is CeremonyType {
  return (
    typeof value === 'string' &&
    (VALID_CEREMONY_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Helper · merge a single task entry into the wizard_state JSONB and return
 * the new shape. Used by every wizard action that completes a task. App-
 * merge is safe here because (a) the same host typically owns one event at
 * a time, (b) wizard transitions are sequential by design, (c) the worst
 * case of a race is the loser's entry being overwritten which the resolver
 * recovers from on the next render.
 */
function setTaskComplete(
  prior: WizardState,
  taskId: WizardTaskId,
  extra: Record<string, unknown> = {},
): WizardState {
  return {
    ...prior,
    [taskId]: {
      completed_at: new Date().toISOString(),
      ...extra,
    },
  };
}

/**
 * Phase 1 · Card 01 Set Wedding Date.
 *
 * Inline-completion action for the wheel-spinner D/M/Y picker. Receives the
 * three numeric components separately from the wheel-spinner client + the
 * event_id. Composes ISO YYYY-MM-DD + delegates the rest to the existing
 * date-lock data layer (vendor-lock gate, auspicious-reason computation,
 * date_status='locked' write). Then merges set_wedding_date into
 * wizard_state so the resolver advances to Card 02 (Reception Venue) on the
 * next render.
 *
 * WHY a wizard-specific action vs reusing lockEventDate from
 * /date-selection/actions.ts: that action redirects to
 * `/dashboard/[eventId]?date_locked=1` which would yank the host off the
 * focus card mid-flow. The wizard pattern keeps the host on event home and
 * transitions in-place. Same data-layer logic · different post-write
 * navigation. The two actions can share the auspicious-reason computation
 * + the vendor-lock gate via copy-paste convergence in V1 · a Phase 2 PR
 * may extract a shared helper if more wizard-vs-page surfaces appear.
 *
 * Cross-references:
 *   - Phase 0 framework PR #466 · CLAUDE.md Sixth 2026-05-23 row
 *   - [[feedback_setnayan_concierge_wizard_ux]] · UX locks
 *   - /date-selection/actions.ts `lockEventDate` (sibling action for the
 *     full date-selection page flow that this wizard inline variant
 *     supersedes for hosts who just want a quick D/M/Y pick)
 */
export async function completeSetWeddingDateTask(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const dayRaw = formData.get('day');
  const monthRaw = formData.get('month');
  const yearRaw = formData.get('year');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }
  if (
    typeof dayRaw !== 'string' ||
    typeof monthRaw !== 'string' ||
    typeof yearRaw !== 'string'
  ) {
    throw new Error('Pick day, month, and year before saving');
  }

  const day = Number.parseInt(dayRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const year = Number.parseInt(yearRaw, 10);

  if (!Number.isFinite(day) || day < 1 || day > 31) {
    throw new Error('Day must be between 1 and 31');
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12');
  }
  // 6-year window matches the wheel-spinner options. Hosts planning >5
  // years out are rare enough that a future Card 01 enhancement can widen
  // this if usage data shows demand.
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < currentYear || year > currentYear + 5) {
    throw new Error(`Year must be between ${currentYear} and ${currentYear + 5}`);
  }

  // Validate the composed date is real (catches Feb 30 / Apr 31 / etc.).
  // The wheel-spinner client clamps day-of-month based on the picked
  // month + year, but server-side defense-in-depth keeps direct form
  // submissions honest.
  const composed = new Date(year, month - 1, day);
  if (
    composed.getFullYear() !== year ||
    composed.getMonth() !== month - 1 ||
    composed.getDate() !== day
  ) {
    throw new Error('Invalid date — pick a real calendar day');
  }

  // Format as YYYY-MM-DD for events.event_date (existing column shape).
  const isoDate = `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read prior event state for the vendor-lock gate + ceremony_type +
  // current wizard_state (needed for the merge below).
  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('event_date, ceremony_type, wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  const priorDate = (priorRow as { event_date?: string | null }).event_date ?? null;
  const dateChanged = Boolean(priorDate) && priorDate !== isoDate;

  // Vendor-lock gate · same rule as lockEventDate. Once 1+ confirmed
  // vendors exist on the event the date cannot be moved without support.
  if (dateChanged) {
    const { count } = await supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', eventIdRaw)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Date is locked — ${count} confirmed vendor${count === 1 ? '' : 's'}. Contact support to discuss changes.`,
      );
    }
  }

  // Pull meaningful dates so the auspicious-reason computation can
  // include host-personal resonance. Admin client to bypass RLS for this
  // server-side read · the action is already auth-gated above.
  const adminClient = createAdminClient();
  const { data: meaningfulRows } = await adminClient
    .from('event_meaningful_dates')
    .select('meaningful_date, kind, note')
    .eq('event_id', eventIdRaw);

  const ceremonyType: CeremonyType | null = isCeremonyType(priorRow.ceremony_type)
    ? (priorRow.ceremony_type as CeremonyType)
    : null;

  const meaningfulDates: MeaningfulDate[] = (meaningfulRows ?? []).map((r) => ({
    date: r.meaningful_date as string,
    kind: r.kind as MeaningfulDateKind,
    note: (r.note as string | null) ?? null,
  }));

  const reasons = computeAuspiciousReasons(composed, ceremonyType, meaningfulDates);

  // Merge wizard_state.set_wedding_date task entry · the resolver will
  // skip this task on the next render and move to Card 02 Reception Venue.
  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(priorWizardState, 'set_wedding_date', {
    date: isoDate,
    reasons_count: reasons.length,
  });

  // Atomic update · event_date + precision + status + reasons + wizard_state
  // all written in one row update so the resolver and the auspicious chip
  // see consistent state.
  const { error: updateErr } = await supabase
    .from('events')
    .update({
      event_date: isoDate,
      event_date_precision: 'day',
      date_status: 'locked',
      auspicious_reasons: reasons,
      wizard_state: newWizardState,
    })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  // revalidatePath · NOT redirect. The host stays on event home and the
  // WizardHero re-renders to show the next focus card (Reception Venue
  // until Phase 2 lands its inline UI · placeholder card until then).
  revalidatePath(`/dashboard/${eventIdRaw}`);
}
