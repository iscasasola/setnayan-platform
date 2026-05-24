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

// `revalidatePath(path, 'layout')` is used for every wizard action below
// (not the default 'page' mode) so the dashboard LAYOUT invalidates too.
// The OuterDashboardHeader chrome reads `primaryEvent.monogram_text` +
// `monogram_color` from the layout's events fetch; without the 'layout'
// flag, the chrome monogram stays stale after Card 11 save (owner-reported
// 2026-05-24). Same principle protects any future layout-cached field
// (event name, primary flag, etc.) from silent staleness — the flag is
// harmless when an action doesn't touch layout data, and load-bearing
// when it does.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
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
  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
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
  // Phase 3 batch — 9 standard vendor-pick cards.
  stylist: 'reception_decor',
  lights_sound: 'lights_and_sound',
  music_entertainment: 'band_dj',
  host_mc: 'host_emcee',
  // 2026-05-24 PR (b) stage 1 · `gown_designer` renamed to `bridal_gown`
  // per migration 20260621000000. Lock action writes the new canonical to
  // event_vendors.category. Stage 2 (multi-pick) will let host pick which
  // of the 6 sub-categories (bridal_gown / groom_suit / bridal_shoes /
  // groom_shoes / entourage_attire / parents_attire) the lock applies to
  // via a custom server action that doesn't auto-advance the wizard
  // until ≥2 sub-categories are locked.
  attire: 'bridal_gown',
  hair_makeup: 'makeup_artist',
  cake: 'cake_maker',
  accommodation: 'accommodation',
  bridal_car: 'transportation',
} as const;

const VENDOR_PICK_TASK_IDS: ReadonlyArray<WizardTaskId> = [
  'reception_venue',
  'ceremony_venue',
  'officiant',
  'photography',
  'catering',
  'stylist',
  'lights_sound',
  'music_entertainment',
  'host_mc',
  'attire',
  'hair_makeup',
  'cake',
  'accommodation',
  'bridal_car',
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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

// ============================================================================
// WAVE 2 · Per-card actions for Phases 3-5 inline editors
// ============================================================================

/**
 * Card 09 Set Mood Board · saves the host's chosen palette to
 * events.role_palette and stamps events.palette_finalized_at + wizard
 * state. The client serializes the active palette as JSON.
 */
export async function completeMoodBoardTask(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const paletteJsonRaw = formData.get('palette_json');
  const paletteNameRaw = formData.get('palette_name');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }
  if (typeof paletteJsonRaw !== 'string' || !paletteJsonRaw) {
    throw new Error('Pick a palette before saving');
  }

  let paletteObj: unknown;
  try {
    paletteObj = JSON.parse(paletteJsonRaw);
  } catch {
    throw new Error("That palette didn't save cleanly. Try again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state, role_palette')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) throw new Error('Event not found');

  // Merge into role_palette JSONB · key the host's wizard pick under a
  // 'wizard_default' slot so downstream per-role palettes (bride/groom/
  // entourage/etc. tracked separately in 0010) aren't clobbered.
  const priorPalette =
    typeof priorRow.role_palette === 'object' && priorRow.role_palette !== null
      ? (priorRow.role_palette as Record<string, unknown>)
      : {};
  const nextPalette = {
    ...priorPalette,
    wizard_default: {
      colors: paletteObj,
      name:
        typeof paletteNameRaw === 'string' && paletteNameRaw.length > 0
          ? paletteNameRaw
          : null,
      picked_at: new Date().toISOString(),
    },
  };

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskComplete(priorWizardState, 'mood_board', {
    palette_name:
      typeof paletteNameRaw === 'string' ? paletteNameRaw : undefined,
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({
      role_palette: nextPalette,
      palette_finalized_at: new Date().toISOString(),
      wizard_state: newWizardState,
    })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 11 Design Monogram · saves the host's initials + style + color to
 * events.monogram_text (concatenated initials) and events.monogram_color.
 * Style is stamped onto wizard_state.monogram.meta_style so the
 * monogram-render pipeline (0037 Bespoke Monogram + invitation widgets)
 * can read it later.
 */
export async function completeMonogramTask(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const initial1Raw = formData.get('initial_1');
  const initial2Raw = formData.get('initial_2');
  const styleRaw = formData.get('style');
  const colorRaw = formData.get('color');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }
  if (typeof initial1Raw !== 'string' || initial1Raw.length === 0) {
    throw new Error('At least one initial is required');
  }
  if (typeof styleRaw !== 'string' || !styleRaw) {
    throw new Error('Pick a style before saving');
  }

  const initial1 = initial1Raw.trim().slice(0, 2).toUpperCase();
  const initial2 =
    typeof initial2Raw === 'string' && initial2Raw.length > 0
      ? initial2Raw.trim().slice(0, 2).toUpperCase()
      : '';
  const monogramText = initial2 ? `${initial1}&${initial2}` : initial1;

  const color =
    typeof colorRaw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colorRaw)
      ? colorRaw
      : '#C97B4B';

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
  const newWizardState = setTaskComplete(priorWizardState, 'monogram', {
    style: styleRaw,
    initials: monogramText,
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({
      monogram_text: monogramText,
      monogram_color: color,
      wizard_state: newWizardState,
    })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 30 Finalize Seatplan · stamps wizard_state with the assigned-count
 * snapshot for audit. Doesn't modify seating data (that's owned by the
 * full seating editor surface · this card just marks the wizard step
 * complete when the host is happy with their plan).
 */
export async function completeFinalizeSeatplanTask(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const assignedRaw = formData.get('assigned_count');
  const totalRaw = formData.get('total_rsvp_count');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }

  const assignedCount =
    typeof assignedRaw === 'string' ? Number.parseInt(assignedRaw, 10) : NaN;
  const totalCount =
    typeof totalRaw === 'string' ? Number.parseInt(totalRaw, 10) : NaN;

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
  const newWizardState = setTaskComplete(priorWizardState, 'finalize_seatplan', {
    assigned_count: Number.isFinite(assignedCount) ? assignedCount : null,
    total_rsvp_count: Number.isFinite(totalCount) ? totalCount : null,
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 16 Create Website · saves the host's chosen slug + landing-page
 * visibility to events.slug + events.landing_page_visibility. Slug
 * validation is checked client-side via /api/slugs/check; this action
 * trusts the client's pre-validated value (a slug conflict at insert
 * time surfaces as a DB error and bubbles back to the host).
 */
export async function completeCreateWebsiteTask(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const slugRaw = formData.get('slug');
  const visibilityRaw = formData.get('visibility');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }
  if (typeof slugRaw !== 'string' || !slugRaw) {
    throw new Error('Slug required');
  }

  const validVisibility = ['public', 'unlisted', 'private'] as const;
  type Visibility = (typeof validVisibility)[number];
  const visibility: Visibility = (validVisibility as readonly string[]).includes(
    visibilityRaw as string,
  )
    ? (visibilityRaw as Visibility)
    : 'public';

  const slug = slugRaw.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) {
    throw new Error('Slug must be 3–32 lowercase letters, numbers, or hyphens');
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
  const newWizardState = setTaskComplete(priorWizardState, 'create_website', {
    slug,
    visibility,
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({
      slug,
      landing_page_visibility: visibility,
      wizard_state: newWizardState,
    })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 14 Photobooths multi-pick · locks a single booth vendor onto the
 * event WITHOUT advancing the wizard. Unlike completeVendorPickFromMarketplace
 * (which stamps wizard_state) this only inserts an event_vendors row so
 * the host can lock multiple booths in a row. The wizard advances when
 * the host explicitly clicks `[I have all the booths I need]` which
 * calls markTaskDone separately.
 *
 * Accepts EITHER a marketplace_vendor_id (lock a Setnayan vendor) OR a
 * vendor_name only (lock a custom off-platform booth). Both write to
 * event_vendors with category in {'photobooth', 'mobile_bar'} per the
 * booth_category formData field.
 */
export async function lockBoothToEvent(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const boothCategoryRaw = formData.get('booth_category');
  // 2026-05-25 · canonical sub-type from the wide-taxonomy Booths card
  // (e.g. 'coffee_booth', 'perfume_bar', 'sorbetes_cart'). When present,
  // it's snapshotted into event_vendors.notes as BOOTH_SUBTYPE:<canonical>
  // so the picked-list grouping + future compare gates can read finer
  // grain than the 2-value `category` enum carries. Backwards-compatible
  // — old call sites that don't pass it land with `notes IS NULL` and
  // bucket into the legacy coarse-category groups (Photobooths / Bars).
  const boothSubtypeRaw = formData.get('booth_subtype');
  const marketplaceVendorIdRaw = formData.get('marketplace_vendor_id');
  const vendorNameRaw = formData.get('vendor_name');
  const contactPhoneRaw = formData.get('contact_phone');
  const contactEmailRaw = formData.get('contact_email');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }
  if (
    boothCategoryRaw !== 'photobooth' &&
    boothCategoryRaw !== 'mobile_bar'
  ) {
    throw new Error('Unknown booth category');
  }
  if (typeof vendorNameRaw !== 'string' || vendorNameRaw.trim().length === 0) {
    throw new Error('Vendor name required');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const insertPayload: Record<string, unknown> = {
    event_id: eventIdRaw,
    vendor_name: vendorNameRaw.trim(),
    category: boothCategoryRaw,
    status: 'contracted',
  };
  if (typeof marketplaceVendorIdRaw === 'string' && marketplaceVendorIdRaw.length > 0) {
    insertPayload.marketplace_vendor_id = marketplaceVendorIdRaw;
  }
  if (typeof contactPhoneRaw === 'string' && contactPhoneRaw.trim().length > 0) {
    insertPayload.contact_phone = contactPhoneRaw.trim();
  }
  if (typeof contactEmailRaw === 'string' && contactEmailRaw.trim().length > 0) {
    insertPayload.contact_email = contactEmailRaw.trim();
  }
  // Snapshot the canonical sub-type into notes when supplied. Defensive
  // input cleanup — only accept lowercase alphanumeric + underscore (the
  // canonical_service shape across the platform) to avoid injecting
  // arbitrary text into the notes column.
  if (
    typeof boothSubtypeRaw === 'string' &&
    /^[a-z0-9_]{1,64}$/i.test(boothSubtypeRaw)
  ) {
    insertPayload.notes = `BOOTH_SUBTYPE:${boothSubtypeRaw.toLowerCase()}`;
  }

  const { error: insertErr } = await supabase
    .from('event_vendors')
    .insert(insertPayload);
  if (insertErr) throw new Error(insertErr.message);

  // Critical: do NOT advance wizard_state. Card 14 advances only when
  // host clicks [I have all the booths I need] which fires markTaskDone.
  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 20 Principal Sponsors · adds a ninong + ninang pair into
 * event_sponsors. Computes pair_index as MAX(existing)+1 for this event.
 * Does NOT advance wizard_state — the host explicitly clicks [Mark
 * sponsors done] which fires markTaskDone separately.
 */
export async function addPrincipalSponsorPair(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const ninongNameRaw = formData.get('ninong_full_name');
  const ninangNameRaw = formData.get('ninang_full_name');
  const ninongSideRaw = formData.get('ninong_side');
  const ninangSideRaw = formData.get('ninang_side');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }
  if (typeof ninongNameRaw !== 'string' || ninongNameRaw.trim().length === 0) {
    throw new Error('Ninong name required');
  }
  if (typeof ninangNameRaw !== 'string' || ninangNameRaw.trim().length === 0) {
    throw new Error('Ninang name required');
  }

  const validSides = ['groom', 'bride', 'neutral'] as const;
  const ninongSide = (validSides as readonly string[]).includes(ninongSideRaw as string)
    ? (ninongSideRaw as 'groom' | 'bride' | 'neutral')
    : 'groom';
  const ninangSide = (validSides as readonly string[]).includes(ninangSideRaw as string)
    ? (ninangSideRaw as 'groom' | 'bride' | 'neutral')
    : 'bride';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Compute next pair_index. Read existing principal sponsors to find max.
  const { data: existing, error: existingErr } = await supabase
    .from('event_sponsors')
    .select('pair_index')
    .eq('event_id', eventIdRaw)
    .eq('sponsor_tier', 'principal');
  if (existingErr) throw new Error(existingErr.message);

  const maxPairIndex = (existing ?? []).reduce<number>((max, row) => {
    const pi = (row as { pair_index: number | null }).pair_index;
    return typeof pi === 'number' && pi > max ? pi : max;
  }, -1);
  const nextPairIndex = maxPairIndex + 1;

  // Insert both ninong + ninang as separate rows sharing pair_index.
  const { error: insertErr } = await supabase.from('event_sponsors').insert([
    {
      event_id: eventIdRaw,
      sponsor_tier: 'principal',
      pair_index: nextPairIndex,
      side: ninongSide,
      full_name: ninongNameRaw.trim(),
      invitation_status: 'pending',
    },
    {
      event_id: eventIdRaw,
      sponsor_tier: 'principal',
      pair_index: nextPairIndex,
      side: ninangSide,
      full_name: ninangNameRaw.trim(),
      invitation_status: 'pending',
    },
  ]);
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/**
 * Card 20 Principal Sponsors · removes a ninong + ninang pair from
 * event_sponsors by pair_index. Deletes both rows for that pair.
 */
export async function removePrincipalSponsorPair(
  formData: FormData,
): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const pairIndexRaw = formData.get('pair_index');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    throw new Error('event_id required');
  }

  const pairIndex =
    typeof pairIndexRaw === 'string' ? Number.parseInt(pairIndexRaw, 10) : NaN;
  if (!Number.isFinite(pairIndex)) {
    throw new Error('Invalid pair index');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error: deleteErr } = await supabase
    .from('event_sponsors')
    .delete()
    .eq('event_id', eventIdRaw)
    .eq('sponsor_tier', 'principal')
    .eq('pair_index', pairIndex);
  if (deleteErr) throw new Error(deleteErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
}

/* ────────────────────────────────────────────────────────────────────────
 * 2026-05-24 · VendorPickGridCard server actions
 *
 * Owner directive: Card 02 Reception Venue needs a visual grid with a
 * full-DB search bar (vs the legacy list+top-15-only VendorPickCard).
 * `searchVendorRecommendations` is a thin auth-gated wrapper around
 * fetchWizardVendorRecommendations that the client-side grid invokes
 * on every search submit · returns the same WizardVendorRec[] shape so
 * the grid can paginate the result client-side.
 *
 * Auth + event-membership are validated before hitting the recommendation
 * fetch so an unauthed visitor cannot scrape the DB through this action.
 *
 * Per [[feedback_setnayan_orphan_prevention]] this action is consumed by
 * `apps/web/app/dashboard/[eventId]/_components/wizard-cards/vendor-pick-grid-card.tsx`
 * (the search button's onSubmit handler).
 * ──────────────────────────────────────────────────────────────────────── */

import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';

export type SearchVendorsArgs = {
  eventId: string;
  canonicalServices: ReadonlyArray<string>;
  ceremonyType: string | null;
  venueSetting: string | null;
  excludeVendorIds: ReadonlyArray<string>;
  query: string;
  /** Cap on rows. Grid card uses 100 so its 15-per-page pagination has
   *  multiple pages to walk through for big result sets. */
  limit?: number;
};

export async function searchVendorRecommendations(
  args: SearchVendorsArgs,
): Promise<WizardVendorRec[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Event membership · only hosts of this event can search recs against
  // its filters. Mirrors the auth-gate in every other wizard action above.
  const { data: membership, error: membershipErr } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', args.eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipErr || !membership) {
    throw new Error('Not a host of this event.');
  }

  const admin = createAdminClient();
  return fetchWizardVendorRecommendations(admin, {
    canonicalServices: args.canonicalServices,
    ceremonyType: args.ceremonyType,
    venueSetting: args.venueSetting,
    excludeVendorIds: args.excludeVendorIds,
    searchQuery: args.query,
    limit: args.limit ?? 100,
  });
}

// ============================================================================
// Card 4b · Draft VIP Guest List · inline-completion action.
//
// 2026-05-24 owner directive · the wizard's first guest-list card seeds
// the four-role VIP scaffold (bride · groom · best man · maid of honor)
// plus any additional guests typed via the Continue-Adding chain. One
// submission · roles are tagged per row so seating, invitations, and
// entourage finalization downstream all see the canonical anchors.
//
// Separate from the generic Quick Add at /guests/quick (which inserts
// `role: 'guest'` only) — this action accepts VIP-role-tagged rows AND
// untagged guest rows in the same payload.
//
// Settles the task once a real scaffold lands: bride + groom + at least
// one entourage member. Below that we mark in_flight so the host can
// re-open the card to keep adding without losing wizard progress.
// ============================================================================

const DRAFT_VIP_ROLES = ['bride', 'groom', 'best_man', 'maid_of_honor'] as const;
type DraftVipRole = (typeof DRAFT_VIP_ROLES)[number];
const DRAFT_VIP_ROLES_SET: ReadonlySet<string> = new Set(DRAFT_VIP_ROLES);

function isDraftVipRole(value: unknown): value is DraftVipRole {
  return typeof value === 'string' && DRAFT_VIP_ROLES_SET.has(value);
}

type ParsedVip = { role: DraftVipRole; firstName: string; lastName: string };
type ParsedGuest = { firstName: string; lastName: string };

export type DraftGuestListResult =
  | { ok: true; addedVips: number; addedGuests: number; skipped: number }
  | { ok: false; error: string };

export async function completeDraftGuestListTask(
  formData: FormData,
): Promise<DraftGuestListResult> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { ok: false, error: 'event_id required' };
  }

  const vipsRaw = formData.get('vips');
  const guestsRaw = formData.get('guests');

  let vips: ParsedVip[] = [];
  let guests: ParsedGuest[] = [];

  if (typeof vipsRaw === 'string' && vipsRaw.length > 0) {
    try {
      const parsed = JSON.parse(vipsRaw);
      if (!Array.isArray(parsed)) throw new Error('not array');
      vips = parsed
        .map((row): ParsedVip | null => {
          if (!isDraftVipRole(row?.role)) return null;
          const first =
            typeof row?.firstName === 'string' ? row.firstName.trim() : '';
          const last =
            typeof row?.lastName === 'string' ? row.lastName.trim() : '';
          if (first.length === 0 && last.length === 0) return null;
          return { role: row.role, firstName: first, lastName: last };
        })
        .filter((row): row is ParsedVip => row !== null);
    } catch {
      return { ok: false, error: 'parse_vips' };
    }
  }

  if (typeof guestsRaw === 'string' && guestsRaw.length > 0) {
    try {
      const parsed = JSON.parse(guestsRaw);
      if (!Array.isArray(parsed)) throw new Error('not array');
      guests = parsed
        .map((row): ParsedGuest => ({
          firstName: typeof row?.firstName === 'string' ? row.firstName.trim() : '',
          lastName: typeof row?.lastName === 'string' ? row.lastName.trim() : '',
        }))
        .filter((row) => row.firstName.length > 0 || row.lastName.length > 0);
    } catch {
      return { ok: false, error: 'parse_guests' };
    }
  }

  if (vips.length === 0 && guests.length === 0) {
    return { ok: false, error: 'empty' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Defense · if the host re-submits and bride/groom already exist for
  // the event, skip those rows so the partial-unique index doesn't reject
  // the whole batch. Best man + maid of honor are not singleton at the
  // DB level (a wedding can have two best men) so they always insert.
  const { data: existingVips } = await supabase
    .from('guests')
    .select('role')
    .eq('event_id', eventIdRaw)
    .in('role', ['bride', 'groom']);
  const existingRoles = new Set(
    (existingVips ?? []).map((r) => (r as { role: string }).role),
  );

  const vipRows = vips
    .filter(
      (v) =>
        !(v.role === 'bride' && existingRoles.has('bride')) &&
        !(v.role === 'groom' && existingRoles.has('groom')),
    )
    .map((v) => ({
      event_id: eventIdRaw,
      first_name: v.firstName,
      last_name: v.lastName,
      side:
        v.role === 'bride' || v.role === 'maid_of_honor'
          ? ('bride' as const)
          : v.role === 'groom' || v.role === 'best_man'
            ? ('groom' as const)
            : ('both' as const),
      group_category: 'family' as const,
      role: v.role,
      rsvp_status: 'pending' as const,
      meal_preference: 'no_preference' as const,
      invited_to_blocks: ['ceremony', 'reception', 'cocktails'],
      custom_tags: [] as string[],
    }));

  const guestRows = guests.map((g) => ({
    event_id: eventIdRaw,
    first_name: g.firstName,
    last_name: g.lastName,
    side: 'both' as const,
    group_category: 'other' as const,
    role: 'guest' as const,
    rsvp_status: 'pending' as const,
    meal_preference: 'no_preference' as const,
    invited_to_blocks: ['ceremony', 'reception'],
    custom_tags: [] as string[],
  }));

  const skipped = vips.length - vipRows.length;
  const allRows = [...vipRows, ...guestRows];

  if (allRows.length === 0) {
    // Everything submitted was already on file (bride/groom dupes only).
    // Treat that as a no-op success so the form clears, but don't settle
    // the wizard task unnecessarily — let the resolver re-render with
    // the current state of the world.
    revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
    return { ok: true, addedVips: 0, addedGuests: 0, skipped };
  }

  const { error: insertErr } = await supabase.from('guests').insert(allRows);
  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  // Read the event's wizard_state once so we can decide between
  // in_flight (still iterating) and complete (scaffold landed).
  const { data: eventRow, error: eventErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (eventErr) throw new Error(eventErr.message);
  if (!eventRow) throw new Error('Event not found');

  const priorState = parseWizardState(eventRow.wizard_state);

  // Auto-settle only when both anchors are present + at least one
  // entourage member · matches the spec's "real scaffold from here"
  // gate. Counts existing rows so a host who added bride+groom in a
  // prior save and best_man this save still gets the settle.
  const hasBride =
    vipRows.some((r) => r.role === 'bride') || existingRoles.has('bride');
  const hasGroom =
    vipRows.some((r) => r.role === 'groom') || existingRoles.has('groom');
  const hasEntourageFromThisSubmission = vipRows.some(
    (r) => r.role === 'best_man' || r.role === 'maid_of_honor',
  );
  let hasEntourage = hasEntourageFromThisSubmission;
  if (!hasEntourage) {
    const { count } = await supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventIdRaw)
      .in('role', ['best_man', 'maid_of_honor']);
    hasEntourage = (count ?? 0) > 0;
  }

  const newState =
    hasBride && hasGroom && hasEntourage
      ? setTaskComplete(priorState, 'draft_guest_list', {
          last_added_at: new Date().toISOString(),
          last_added_count: allRows.length,
        })
      : setTaskInFlight(priorState, 'draft_guest_list', {
          last_added_at: new Date().toISOString(),
          last_added_count: allRows.length,
        });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newState })
    .eq('event_id', eventIdRaw);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  revalidatePath(`/dashboard/${eventIdRaw}/guests`);

  return {
    ok: true,
    addedVips: vipRows.length,
    addedGuests: guestRows.length,
    skipped,
  };
}

// ============================================================================
// Card 15 · Set inspiration mood board · INSPIRATION INTAKE actions.
//
// Owner directive 2026-05-25 — the host pastes photo inspirations + uploads
// photos of how they want the wedding to look. The card was a curated palette
// picker before; pivoting to an inspiration-intake surface that captures
// real-world references and auto-extracts each photo's 6-color palette
// client-side via Canvas API.
//
// Two write paths:
//   addInspirationFromUrl    — host pastes an image URL (Pinterest, Instagram,
//                              vendor portfolio, friend's wedding photo). The
//                              image_url is stored as-is; r2_key stays NULL.
//   addInspirationFromUpload — host uploads a file. We hand it to
//                              uploadPublicAsset() which writes to R2 (or
//                              falls back to Supabase Storage when R2 isn't
//                              configured), and persist the public URL +
//                              r2_key.
//
// Palette extraction is client-side (Canvas histogram) so the action just
// validates + stores the 6 hex values. Keeps the server stateless re: image
// decoding (no server-side image lib dependency).
//
// Per CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars" +
// 2026-05-24 row "V1 SCOPE EXPANSION · Moodboard becomes multi-source",
// this is the V1 couple-inspiration foothold. The broader multi-source
// architecture (stylist push-share, finalize-then-broadcast) lands V1.x
// post-pilot.
// ============================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validatePalette6(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length !== 6) {
    throw new Error("Couldn't read the palette — try a different photo.");
  }
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !HEX_RE.test(v)) {
      throw new Error("Couldn't read the palette — try a different photo.");
    }
    out.push(v.toUpperCase());
  }
  return out;
}

function isLikelyImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Insert an inspiration row from a pasted image URL. The client has already
 * extracted the 6-color palette via Canvas; we just validate + persist.
 */
export async function addInspirationFromUrl(formData: FormData): Promise<{
  status: 'ok' | 'error';
  inspiration_id?: string;
  message?: string;
}> {
  const eventIdRaw = formData.get('event_id');
  const imageUrlRaw = formData.get('image_url');
  const paletteRaw = formData.get('palette_json');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    return { status: 'error', message: 'event_id required' };
  }
  if (typeof imageUrlRaw !== 'string' || !imageUrlRaw) {
    return { status: 'error', message: 'Paste a photo URL to continue.' };
  }
  if (!isLikelyImageUrl(imageUrlRaw)) {
    return {
      status: 'error',
      message:
        "That doesn't look like a direct image URL. Try right-clicking the photo and copying its image address.",
    };
  }
  if (typeof paletteRaw !== 'string') {
    return { status: 'error', message: 'Palette extraction failed — try again.' };
  }

  let paletteParsed: unknown;
  try {
    paletteParsed = JSON.parse(paletteRaw);
  } catch {
    return { status: 'error', message: 'Palette extraction failed — try again.' };
  }

  let palette: string[];
  try {
    palette = validatePalette6(paletteParsed);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Palette invalid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'error', message: 'Sign back in to keep adding inspiration.' };
  }

  const { data: inserted, error } = await supabase
    .from('event_inspiration_assets')
    .insert({
      event_id: eventIdRaw,
      added_by_user_id: user.id,
      source_kind: 'url_paste',
      image_url: imageUrlRaw,
      r2_key: null,
      sampled_hex_1: palette[0],
      sampled_hex_2: palette[1],
      sampled_hex_3: palette[2],
      sampled_hex_4: palette[3],
      sampled_hex_5: palette[4],
      sampled_hex_6: palette[5],
    })
    .select('inspiration_id')
    .maybeSingle();
  if (error) {
    return { status: 'error', message: error.message };
  }
  if (!inserted) {
    return { status: 'error', message: 'Save failed — try again.' };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  return { status: 'ok', inspiration_id: inserted.inspiration_id };
}

/**
 * Insert an inspiration row from an uploaded file. Hands the file to
 * uploadPublicAsset (R2 with Supabase Storage fallback) and stores the
 * public URL + r2_key. Palette is extracted client-side same as URL paste.
 */
export async function addInspirationFromUpload(formData: FormData): Promise<{
  status: 'ok' | 'error';
  inspiration_id?: string;
  message?: string;
}> {
  const eventIdRaw = formData.get('event_id');
  const fileEntry = formData.get('file');
  const paletteRaw = formData.get('palette_json');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    return { status: 'error', message: 'event_id required' };
  }
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return { status: 'error', message: 'Drop a photo or pick a file to upload.' };
  }
  if (typeof paletteRaw !== 'string') {
    return { status: 'error', message: 'Palette extraction failed — try again.' };
  }

  let paletteParsed: unknown;
  try {
    paletteParsed = JSON.parse(paletteRaw);
  } catch {
    return { status: 'error', message: 'Palette extraction failed — try again.' };
  }

  let palette: string[];
  try {
    palette = validatePalette6(paletteParsed);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Palette invalid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'error', message: 'Sign back in to keep adding inspiration.' };
  }

  const uploadResult = await uploadPublicAsset({
    pathPrefix: `inspiration/${eventIdRaw}`,
    file: fileEntry,
  });
  if (!uploadResult.ok) {
    return { status: 'error', message: uploadResult.error };
  }

  const { data: inserted, error } = await supabase
    .from('event_inspiration_assets')
    .insert({
      event_id: eventIdRaw,
      added_by_user_id: user.id,
      source_kind: 'file_upload',
      image_url: uploadResult.publicUrl,
      r2_key: uploadResult.key ?? null,
      sampled_hex_1: palette[0],
      sampled_hex_2: palette[1],
      sampled_hex_3: palette[2],
      sampled_hex_4: palette[3],
      sampled_hex_5: palette[4],
      sampled_hex_6: palette[5],
    })
    .select('inspiration_id')
    .maybeSingle();
  if (error) {
    return { status: 'error', message: error.message };
  }
  if (!inserted) {
    return { status: 'error', message: 'Save failed — try again.' };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  return { status: 'ok', inspiration_id: inserted.inspiration_id };
}

/**
 * Soft-delete an inspiration row (stamps removed_at). Any co-host on the
 * event can remove any item — pilot couples co-curate.
 */
export async function removeInspirationAsset(formData: FormData): Promise<{
  status: 'ok' | 'error';
  message?: string;
}> {
  const eventIdRaw = formData.get('event_id');
  const inspirationIdRaw = formData.get('inspiration_id');

  if (typeof eventIdRaw !== 'string' || !eventIdRaw) {
    return { status: 'error', message: 'event_id required' };
  }
  if (typeof inspirationIdRaw !== 'string' || !inspirationIdRaw) {
    return { status: 'error', message: 'inspiration_id required' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'error', message: 'Sign back in to keep curating.' };
  }

  const { error } = await supabase
    .from('event_inspiration_assets')
    .update({ removed_at: new Date().toISOString() })
    .eq('inspiration_id', inspirationIdRaw)
    .eq('event_id', eventIdRaw)
    .is('removed_at', null);
  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  return { status: 'ok' };
}

/**
 * Server-action variant used by the Card 15 client to list its own
 * inspiration items. Returns at most 50 active rows for the event, newest
 * first. RLS enforces host scoping; we still pass event_id as a defense
 * filter so a leak in RLS doesn't widen the surface.
 */
export async function listEventInspiration(
  eventId: string,
): Promise<
  Array<{
    inspiration_id: string;
    image_url: string;
    source_kind: 'url_paste' | 'file_upload';
    sampled_hex_1: string;
    sampled_hex_2: string;
    sampled_hex_3: string;
    sampled_hex_4: string;
    sampled_hex_5: string;
    sampled_hex_6: string;
  }>
> {
  if (typeof eventId !== 'string' || !eventId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_inspiration_assets')
    .select(
      'inspiration_id, image_url, source_kind, sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6',
    )
    .eq('event_id', eventId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as Array<{
    inspiration_id: string;
    image_url: string;
    source_kind: 'url_paste' | 'file_upload';
    sampled_hex_1: string;
    sampled_hex_2: string;
    sampled_hex_3: string;
    sampled_hex_4: string;
    sampled_hex_5: string;
    sampled_hex_6: string;
  }>;
}
