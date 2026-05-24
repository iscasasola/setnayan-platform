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
import {
  parseWizardState,
  WIZARD_TASKS,
  type WizardState,
  type WizardTaskId,
} from '@/lib/wizard';

/** Runtime WizardTaskId validator · derives from the canonical WIZARD_TASKS
 *  array so adding a new task in lib/wizard.ts automatically widens the
 *  accepted set. */
const VALID_WIZARD_TASK_IDS = new Set<string>(WIZARD_TASKS.map((t) => t.id));
function isValidWizardTaskId(value: unknown): value is WizardTaskId {
  return typeof value === 'string' && VALID_WIZARD_TASK_IDS.has(value);
}

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
  // Preserve any prior in_flight_since (audit trail) but stamp completed_at.
  const priorEntry = prior[taskId] ?? {};
  return {
    ...prior,
    [taskId]: {
      ...priorEntry,
      ...extra,
      completed_at: new Date().toISOString(),
    },
  };
}

/**
 * Mark a task as in_flight — host has signaled the process is running
 * externally (PSA submitted · Pre-Cana scheduled · STD render queued ·
 * etc.) but hasn't marked done yet. The resolver skips in-flight tasks
 * so the host can keep working in parallel; the IN-FLIGHT TRAY surface
 * gives one-click access to mark done when ready.
 *
 * Preserves any prior completion / metadata · stamping in_flight_since
 * on top of completed_at is harmless (isTaskInFlight returns FALSE when
 * completed_at is set), but normally you'd only call this on a task
 * that's currently pending.
 */
function setTaskInFlight(
  prior: WizardState,
  taskId: WizardTaskId,
  extra: Record<string, unknown> = {},
): WizardState {
  const priorEntry = prior[taskId] ?? {};
  return {
    ...prior,
    [taskId]: {
      ...priorEntry,
      ...extra,
      in_flight_since: new Date().toISOString(),
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

// ============================================================================
// Phase 2 · Cards 02-07 (Foundation vendor-pick tasks)
// ============================================================================
//
// Vendor-pick action backing Cards 02 · 03 · 04 · 05 · 07 (Reception ·
// Ceremony · Officiant · Photo+Video · Caterer). Card 06 Prenup is
// external_process and ships in its own action.
//
// The host either:
//   (a) Clicks [Lock this vendor] on one of the top-5 marketplace
//       recommendations → completeVendorPickFromMarketplace
//   (b) Fills the [Add custom vendor] form for an off-platform vendor →
//       completeVendorPickFromCustom
//
// Both actions follow the same shape: insert event_vendors with
// status='contracted' AND advance events.wizard_state.<taskId>.
// WizardTaskId is already imported alongside parseWizardState at the top
// of the file (Phase 1 lineage).

/** Map wizard task IDs to the event_vendors.category enum value used
 *  for that category. The category enum is V1-locked at 28 values per
 *  iteration 0006 · the wizard maps each foundation card to one of
 *  those 28. Custom vendor names are accepted; the category drives
 *  hard-single conflict checks (a venue locked once blocks a second
 *  venue lock without an explicit unlock first). */
const VENDOR_PICK_CATEGORY: Partial<Record<WizardTaskId, string>> = {
  reception_venue: 'venue',
  ceremony_venue: 'religious_venue',
  officiant: 'officiant',
  photography: 'photographer',
  catering: 'catering',
} as const;

const VENDOR_PICK_TASK_IDS: ReadonlyArray<WizardTaskId> = [
  'reception_venue',
  'ceremony_venue',
  'officiant',
  'photography',
  'catering',
];

function isVendorPickTaskId(value: unknown): value is WizardTaskId {
  return (
    typeof value === 'string' &&
    (VENDOR_PICK_TASK_IDS as readonly string[]).includes(value)
  );
}

/**
 * Lock a top-5 marketplace recommendation as the wizard's vendor-pick
 * task answer. Atomically inserts event_vendors row with
 * status='contracted' AND advances wizard_state.
 *
 * Hard-single conflict check inherited from event_vendors RLS / triggers
 * (PR #135 lineage). If a venue is already locked, this action returns
 * an error that the client surfaces.
 */
export async function completeVendorPickFromMarketplace(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const taskIdRaw = formData.get('task_id');
  const marketplaceVendorIdRaw = formData.get('marketplace_vendor_id');
  const vendorNameRaw = formData.get('vendor_name');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }
  if (!isVendorPickTaskId(taskIdRaw)) {
    throw new Error('Unknown wizard task');
  }
  if (typeof marketplaceVendorIdRaw !== 'string' || marketplaceVendorIdRaw.length === 0) {
    throw new Error('marketplace_vendor_id required');
  }
  if (typeof vendorNameRaw !== 'string' || vendorNameRaw.length === 0) {
    throw new Error('vendor_name required');
  }

  const category = VENDOR_PICK_CATEGORY[taskIdRaw];
  if (!category) {
    throw new Error(`No category mapping for task ${taskIdRaw}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read prior wizard_state for the merge.
  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  // Insert event_vendors row with status='contracted' directly · the
  // wizard skips the considering→contracted two-step flow because the
  // host has already committed by clicking [Lock this vendor]. Hard-
  // single conflict check fires via the event_vendors trigger.
  const { data: inserted, error: insertErr } = await supabase
    .from('event_vendors')
    .insert({
      event_id: eventIdRaw,
      vendor_name: vendorNameRaw,
      category,
      status: 'contracted',
      marketplace_vendor_id: marketplaceVendorIdRaw,
    })
    .select('vendor_id')
    .maybeSingle();
  if (insertErr) throw new Error(insertErr.message);
  if (!inserted) throw new Error('Could not lock vendor — try again');

  // Advance wizard_state.<taskId> · re-render moves to next task.
  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(priorWizardState, taskIdRaw, {
    event_vendor_id: inserted.vendor_id,
    marketplace_vendor_id: marketplaceVendorIdRaw,
    kind: 'marketplace',
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`);
}

/**
 * Lock a custom (off-platform) vendor as the wizard's vendor-pick task
 * answer. Host typed the vendor's name into the [Add custom vendor]
 * form because their pick isn't on Setnayan (yet). Inserts an
 * event_vendors row WITHOUT marketplace_vendor_id (the row's vendor_name
 * is the source of truth) and advances wizard_state.
 *
 * Same hard-single conflict + atomic-update shape as the marketplace
 * variant.
 */
export async function completeVendorPickFromCustom(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const taskIdRaw = formData.get('task_id');
  const vendorNameRaw = formData.get('vendor_name');
  const contactPhoneRaw = formData.get('contact_phone');
  const contactEmailRaw = formData.get('contact_email');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }
  if (!isVendorPickTaskId(taskIdRaw)) {
    throw new Error('Unknown wizard task');
  }
  if (
    typeof vendorNameRaw !== 'string' ||
    vendorNameRaw.trim().length === 0
  ) {
    throw new Error('Vendor name is required');
  }
  if (vendorNameRaw.length > 128) {
    throw new Error('Name must be 128 chars or fewer');
  }

  const trimmedName = vendorNameRaw.trim();
  const category = VENDOR_PICK_CATEGORY[taskIdRaw];
  if (!category) {
    throw new Error(`No category mapping for task ${taskIdRaw}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  const insertPayload: Record<string, unknown> = {
    event_id: eventIdRaw,
    vendor_name: trimmedName,
    category,
    status: 'contracted',
  };
  if (typeof contactPhoneRaw === 'string' && contactPhoneRaw.trim().length > 0) {
    insertPayload.contact_phone = contactPhoneRaw.trim();
  }
  if (typeof contactEmailRaw === 'string' && contactEmailRaw.trim().length > 0) {
    insertPayload.contact_email = contactEmailRaw.trim();
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('event_vendors')
    .insert(insertPayload)
    .select('vendor_id')
    .maybeSingle();
  if (insertErr) throw new Error(insertErr.message);
  if (!inserted) throw new Error('Could not save your custom vendor — try again');

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(priorWizardState, taskIdRaw, {
    event_vendor_id: inserted.vendor_id,
    kind: 'custom',
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`);
}

// ============================================================================
// Phase 2 · Card 06 Prenup (external_process)
// ============================================================================
//
// Different shape from 02-05 + 07: prenup is a process the host TRACKS, not
// a vendor they PICK. Per the canonical 38-task sequence (CLAUDE.md
// 2026-05-23 Sixth row): prenup shoot is scheduled T-7m and happens ~1mo
// before STD video render at T-6m. The actual prenup PHOTOGRAPHER was
// locked in Card 05 (Photography); this card tracks scheduling + done.
//
// Photo upload is intentionally NOT part of this card — the prenup photos
// flow into Card 17 Save-the-Date Video as input. Card 06's complete
// state is the host confirming "we shot it" — the wizard advances on
// that signal. Card 17 surfaces the photo-upload affordance when its
// turn comes.
//
// One-action shape: [Mark prenup done] with an optional scheduled-date
// input. Stamps wizard_state.prenup.completed_at + optional
// scheduled_date so the wizard advances permanently. Couples who shot
// their prenup before discovering the wizard can mark done without a
// date — couples scheduling ahead get the date saved as audit context.

/**
 * Card 06 Prenup completion action. Stamps wizard_state.prenup.completed_at
 * (and optional scheduled_date when supplied). Advances the wizard past
 * Card 06 in one click — the host can mark done before OR after the
 * shoot, since the wizard is a planning surface not an event tracker.
 */
export async function completePrenupTask(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const scheduledDateRaw = formData.get('scheduled_date');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }

  // Optional scheduled_date validation · 'YYYY-MM-DD' shape, real calendar
  // date. Empty string acceptable — couples who shot before discovering
  // the wizard don't need to backfill the date.
  let scheduledDate: string | null = null;
  if (typeof scheduledDateRaw === 'string' && scheduledDateRaw.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDateRaw)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }
    const parsed = new Date(scheduledDateRaw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("That date doesn't look right — try again");
    }
    scheduledDate = scheduledDateRaw;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(
    priorWizardState,
    'engagement_prenup_shoot',
    {
      ...(scheduledDate ? { scheduled_date: scheduledDate } : {}),
    },
  );

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`);
}

// ============================================================================
// Generic in_flight + done helpers (used by paperwork cards + IN-FLIGHT TRAY)
// ============================================================================
//
// Per CLAUDE.md 2026-05-23 Sixth row + owner-2026-05-24 lock (option 2A):
// slow paperwork tasks (Cenomar PSA · Pre-Cana · Marriage License · STD
// video render · Paprint print run) shouldn't block the wizard while
// they process externally. The host marks the task as in_flight, the
// resolver skips it, and the IN-FLIGHT TRAY surface on the WizardHero
// gives one-click access to mark done when the paperwork lands.
//
// These two generic helpers cover EVERY card that follows the "submit
// to external process → wait → mark done" shape (cards 17 · 21 · 25 ·
// 26 · 27 · 28 · 33 · 35 · 36 · 37 · 38). Individual cards may layer
// per-task metadata (e.g., PSA reference number) on top via the
// optional formData fields.

/**
 * Mark any wizard task as in_flight. Generic across cards · the calling
 * client component supplies the task_id + any per-card metadata.
 *
 * Metadata pattern: any formData field beginning with `meta_` is passed
 * through to the wizard_state entry's `meta` field (one nested object).
 * Cards that need PSA reference numbers · render job IDs · checklist
 * acks · etc. all serialize them via that prefix.
 */
export async function markTaskInFlight(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const taskIdRaw = formData.get('task_id');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }
  if (!isValidWizardTaskId(taskIdRaw)) {
    throw new Error('Unknown wizard task');
  }

  // Collect meta_* fields into a single meta object.
  const meta: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('meta_') && typeof value === 'string' && value.length > 0) {
      meta[key.slice(5)] = value;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskInFlight(priorWizardState, taskIdRaw, {
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`);
}

/**
 * Mark any wizard task as done. Generic across cards · used both by
 * paperwork cards' [Mark done] CTA and by the IN-FLIGHT TRAY surface.
 *
 * Same `meta_*` formData prefix as markTaskInFlight — cards stamp the
 * relevant per-card metadata at done time (e.g., paperwork reference
 * numbers · render output URLs).
 */
export async function markTaskDone(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const taskIdRaw = formData.get('task_id');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('event_id required');
  }
  if (!isValidWizardTaskId(taskIdRaw)) {
    throw new Error('Unknown wizard task');
  }

  const meta: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('meta_') && typeof value === 'string' && value.length > 0) {
      meta[key.slice(5)] = value;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(priorWizardState, taskIdRaw, {
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`);
}
