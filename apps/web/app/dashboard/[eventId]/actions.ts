'use server';

// Every `revalidatePath()` below uses `'layout'` mode (not default 'page')
// so the dashboard layout invalidates too. Event-level writes (date / name /
// venue / settings) change fields the OuterDashboardHeader chrome reads via
// `primaryEvent.*`; without 'layout' the chrome event-switcher + monogram
// stay stale until manual reload. Same canonical fix as wizard-actions.ts
// (PR #514) — see CLAUDE.md 2026-05-24 "Fix: chrome monogram (+ layout-cached
// fields) stay stale after wizard save".
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
import {
  ALLOWED_REGIONS,
  ALLOWED_FEELS,
  MAX_BUDGET_PESOS,
  MAX_NAME_LEN,
  sanitizeName,
} from '@/lib/match-criteria';
import {
  computeCompatibilityIssue,
  type EventVendorRowInput,
} from '@/lib/wedding-plan-groups';
import { getVendorAvailableDays } from '@/lib/vendor-availability';
import {
  type ConflictField,
  type ConflictService,
  isCapacityBound,
} from '@/lib/personalization-conflicts';

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

  revalidatePath(`/dashboard/${eventId}`, 'layout');
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

  revalidatePath(`/dashboard/${eventId}`, 'layout');
}

// Task #37 (2026-05-22) — host explicitly confirms wedding ceremony_type.
// Task #43 (2026-05-22 evening) — REVERSES the set-once-immutable rule.
// Religion chip now follows the same gate as the wedding-date editor:
// editable while confirmedVendorCount === 0, locked when ≥1 vendor has
// confirmed. Removed the `already_locked` rejection so a host can correct
// a typo or change their mind during early planning. The vendor-confirmed
// gate still fires server-side as defence-in-depth even if the chip's UI
// state drifts.
const ALLOWED_CEREMONY_TYPES = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'chinese',
  'mixed',
] as const;
type AllowedCeremonyType = (typeof ALLOWED_CEREMONY_TYPES)[number];

type SetCeremonyResult =
  | { ok: true; ceremony_type: AllowedCeremonyType; updated: boolean }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'vendor_lock' | 'not_wedding' | 'db_error'; message: string };

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

  const wasConfirmedBefore = Boolean(eventRow.ceremony_type_locked_at);
  const previousType = eventRow.ceremony_type ?? null;

  // Vendor-confirmed gate — once any vendor is at-or-past `contracted`,
  // the wedding type locks at its current default. Mirrors the 2026-05-17
  // § 10 date-edit gate + 2026-05-15 row 449 self-delete pattern.
  // This is the SOLE remaining gate post-Task-#43 — the prior
  // ceremony_type_locked_at "set once" rule is removed; hosts can correct
  // typos or change their mind freely until the first vendor commits.
  const { count: confirmedCount, error: countError } = await admin
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  if (countError) {
    return { ok: false, code: 'db_error', message: countError.message };
  }
  const confirmed = confirmedCount ?? 0;
  if (confirmed > 0) {
    // Audit-log the blocked attempt so we can see misuse / drift.
    await admin.from('admin_audit_log').insert({
      action: 'ceremony_type_update_blocked',
      target_table: 'events',
      target_id: eventId,
      before_json: { ceremony_type: previousType, confirmed_vendor_count: confirmed },
      after_json: { attempted: ceremony_type },
      actor_user_id: user.id,
    });
    return {
      ok: false,
      code: 'vendor_lock',
      message: `Wedding type is locked — ${confirmed} confirmed ${confirmed === 1 ? 'vendor' : 'vendors'}. Contact support to discuss a change.`,
    };
  }

  // No-op short-circuit: same value already saved. Returns ok=true so the
  // modal closes cleanly, but we don't write or audit-log.
  if (previousType === ceremony_type && wasConfirmedBefore) {
    return { ok: true, ceremony_type, updated: false };
  }

  // Write the new value + stamp the lock columns. ceremony_type_locked_at
  // continues to mean "host explicitly confirmed" (vs the silent 'catholic'
  // default from the biconditional CHECK invariant). It is NOT load-bearing
  // for the UI lock — the UI gates on live confirmedVendorCount instead.
  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from('events')
    .update({
      ceremony_type,
      ceremony_type_locked_at: nowIso,
      ceremony_type_locked_by: user.id,
    })
    .eq('event_id', eventId);
  if (updateError) {
    return { ok: false, code: 'db_error', message: updateError.message };
  }

  // Audit log — distinguish set (first time) from updated (Task #43).
  await admin.from('admin_audit_log').insert({
    action: wasConfirmedBefore ? 'ceremony_type_updated' : 'ceremony_type_set',
    target_table: 'events',
    target_id: eventId,
    before_json: {
      ceremony_type: previousType,
      ceremony_type_locked_at: eventRow.ceremony_type_locked_at,
      confirmed_vendor_count: confirmed,
    },
    after_json: { ceremony_type, ceremony_type_locked_at: nowIso },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  return { ok: true, ceremony_type, updated: wasConfirmedBefore };
}

// ============================================================================
// Edit match criteria (CLAUDE.md 2026-06-02 "do both" · step 1)
//
// The Home "Personalized" block shows the couple's curated match criteria;
// this action lets them correct/refine the GOVERNANCE-FREE ones: region,
// mood/feel, and budget. Date + ceremony + venue + guest-count are NOT here —
// they carry the booked-vendor change-flow governance (the setEventCeremonyType
// vendor-confirmed gate above + updateEventDate + iteration 0021 §10/§11/§12),
// so they keep their own governed editors. These three bind no vendor, so no
// vendor gate is needed.
//
// Host-auth mirrors setEventCeremonyType (event_members couple/coordinator OR
// an accepted event_moderators row · iteration 0048 multi-host). Admin client
// for the write because RLS can strip columns on narrowed reads; the explicit
// host check is the authorization.
// ============================================================================
type UpdateMatchCriteriaResult =
  | { ok: true }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'db_error'; message: string };

export async function updateEventMatchCriteria(
  formData: FormData,
): Promise<UpdateMatchCriteriaResult> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }

  // Region — '' clears to NULL; otherwise must be a canonical slug.
  const regionRaw = formData.get('region');
  const regionStr = typeof regionRaw === 'string' ? regionRaw.trim() : '';
  if (regionStr !== '' && !ALLOWED_REGIONS.has(regionStr)) {
    return { ok: false, code: 'invalid_input', message: 'Invalid region' };
  }
  const region = regionStr === '' ? null : regionStr;

  // Feel — '' clears to NULL; otherwise must be one of the 8 CHECK values.
  const feelRaw = formData.get('mood_feel_key');
  const feelStr = typeof feelRaw === 'string' ? feelRaw.trim() : '';
  if (feelStr !== '' && !ALLOWED_FEELS.has(feelStr)) {
    return { ok: false, code: 'invalid_input', message: 'Invalid feel' };
  }
  const moodFeelKey = feelStr === '' ? null : feelStr;

  // Budget — peso amount → centavos. '' clears to NULL. Non-negative integer
  // within the ₱100M ceiling.
  const budgetRaw = formData.get('budget_pesos');
  const budgetStr = typeof budgetRaw === 'string' ? budgetRaw.trim().replace(/[, ]/g, '') : '';
  let budgetCentavos: number | null = null;
  if (budgetStr !== '') {
    const pesos = Number(budgetStr);
    if (!Number.isFinite(pesos) || pesos < 0 || pesos > MAX_BUDGET_PESOS || !Number.isInteger(pesos)) {
      return { ok: false, code: 'invalid_input', message: 'Enter a whole peso amount' };
    }
    budgetCentavos = pesos === 0 ? null : Math.round(pesos * 100);
  }

  // Couple names (governance-free identity, edited on the Personalization page,
  // CLAUDE.md 2026-06-02 Phase B). Names bind no vendor → no change-flow gate.
  // Bride/groom each capture First + Last; bride_name/groom_name store the
  // combined "First Last" (matching commitOnboardingWedding PR #796) and
  // display_name is the FIRST names only ("{brideFirst} & {groomFirst}") — the
  // warm chrome label, again matching onboarding. Server-side sanitizeName is
  // defense-in-depth (the form sanitizes live; a direct POST can't smuggle
  // digits/symbols). When at least one first name is present we recompute
  // display_name; if everything clears we leave the existing display_name
  // untouched (don't blank the chrome label).
  //
  // Falls back to the legacy single bride_name/groom_name fields if the split
  // first/last keys aren't present (protects a stale client during the deploy
  // window from wiping names).
  let brideName: string | null;
  let groomName: string | null;
  let recomputedDisplay: string;
  if (formData.has('bride_first') || formData.has('groom_first')) {
    const cap = (v: FormDataEntryValue | null) =>
      (typeof v === 'string' ? sanitizeName(v).trim() : '').slice(0, MAX_NAME_LEN);
    const brideFirst = cap(formData.get('bride_first'));
    const brideLast = cap(formData.get('bride_last'));
    const groomFirst = cap(formData.get('groom_first'));
    const groomLast = cap(formData.get('groom_last'));
    brideName = [brideFirst, brideLast].filter(Boolean).join(' ') || null;
    groomName = [groomFirst, groomLast].filter(Boolean).join(' ') || null;
    recomputedDisplay = [brideFirst, groomFirst].filter(Boolean).join(' & ');
  } else {
    // Legacy path (pre-split form). Combined names, display from full names.
    const brideRaw = formData.get('bride_name');
    const groomRaw = formData.get('groom_name');
    const brideStr = (typeof brideRaw === 'string' ? sanitizeName(brideRaw).trim() : '').slice(0, MAX_NAME_LEN);
    const groomStr = (typeof groomRaw === 'string' ? sanitizeName(groomRaw).trim() : '').slice(0, MAX_NAME_LEN);
    brideName = brideStr === '' ? null : brideStr;
    groomName = groomStr === '' ? null : groomStr;
    recomputedDisplay = [brideName, groomName].filter(Boolean).join(' & ');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  }

  // Host check — member (couple/coordinator) OR accepted moderator.
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

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('events')
    .select('region, mood_feel_key, estimated_budget_centavos, bride_name, groom_name, display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  const updatePatch: Record<string, unknown> = {
    region,
    mood_feel_key: moodFeelKey,
    estimated_budget_centavos: budgetCentavos,
    bride_name: brideName,
    groom_name: groomName,
  };
  // Recompute the chrome/display label from the names only when at least one
  // is present — never blank an existing display_name.
  if (recomputedDisplay !== '') {
    updatePatch.display_name = recomputedDisplay;
  }

  const { error: updateError } = await admin
    .from('events')
    .update(updatePatch)
    .eq('event_id', eventId);
  if (updateError) {
    return { ok: false, code: 'db_error', message: updateError.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_match_criteria_updated',
    target_table: 'events',
    target_id: eventId,
    before_json: before ?? null,
    after_json: updatePatch,
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/details`, 'layout');
  return { ok: true };
}

// ============================================================================
// Governed-field editors + conflict preview (CLAUDE.md 2026-06-02 directive 4)
//
// Owner: "When the data are changed on their personalization. we must notify
// which vendors will be in conflict if they proceed with these changes. show
// the cards of each services picked." Scope answer: "All four fields now" —
// ceremony · venue · guest-count · date.
//
// ceremony + date already had governed editors (setEventCeremonyType above +
// updateEventDate above), both vendor-lock-gated at confirmed>0. This adds the
// two MISSING editors (venue + guest-count) plus a single conflict-preview
// action the Personalization page's client editor calls BEFORE committing any
// of the four. The preview is read-only; the field actions are the write.
//
// venue + guest-count carry NO hard vendor-lock gate here (no booking model
// ties a confirmed vendor to a specific venue_setting/headcount). The
// Personalization page itself only exposes these editors when
// confirmedVendorCount === 0 (mirroring the ceremony/date gates), so a
// confirmed-vendor event keeps every governed field locked-to-support. The
// conflict preview is the soft warning for the editable (0-confirmed) state.
// ============================================================================

/** Shared host check — member (couple/coordinator) OR accepted moderator. */
async function isEventHost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { data: memberRow } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (memberRow) return true;
  const { data: modRow } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('removed_at', null)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  return !!modRow;
}

type GovernedFieldResult =
  | { ok: true }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'db_error'; message: string };

// events.venue_setting CHECK (migration 20260521000000) — the only 7 values
// the DB accepts for a wedding. The editor offers exactly these; the richer
// VENUE_LABEL keys (hotel_ballroom, etc.) are display-only legacy and would
// violate the CHECK on write.
const ALLOWED_VENUE_SETTINGS = [
  'banquet_hall',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
  'civil_registrar',
] as const;
type AllowedVenueSetting = (typeof ALLOWED_VENUE_SETTINGS)[number];

export async function updateVenueSetting(formData: FormData): Promise<GovernedFieldResult> {
  const eventId = formData.get('event_id');
  const venueRaw = formData.get('venue_setting');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  if (
    typeof venueRaw !== 'string' ||
    !ALLOWED_VENUE_SETTINGS.includes(venueRaw as AllowedVenueSetting)
  ) {
    return { ok: false, code: 'invalid_input', message: 'Invalid venue setting' };
  }
  const venue_setting = venueRaw as AllowedVenueSetting;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  if (!(await isEventHost(supabase, eventId, user.id))) {
    return { ok: false, code: 'unauthorized', message: 'You are not a host on this event' };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('events')
    .select('venue_setting')
    .eq('event_id', eventId)
    .maybeSingle();
  const { error } = await admin
    .from('events')
    .update({ venue_setting })
    .eq('event_id', eventId);
  if (error) return { ok: false, code: 'db_error', message: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'venue_setting_updated',
    target_table: 'events',
    target_id: eventId,
    before_json: before ?? null,
    after_json: { venue_setting },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/details`, 'layout');
  return { ok: true };
}

export async function updateGuestCount(formData: FormData): Promise<GovernedFieldResult> {
  const eventId = formData.get('event_id');
  const paxRaw = formData.get('estimated_pax');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  const paxStr = typeof paxRaw === 'string' ? paxRaw.trim().replace(/[, ]/g, '') : '';
  let pax: number | null = null;
  if (paxStr !== '') {
    const n = Number(paxStr);
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      return { ok: false, code: 'invalid_input', message: 'Enter a whole number of guests (1–100,000)' };
    }
    pax = n;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  if (!(await isEventHost(supabase, eventId, user.id))) {
    return { ok: false, code: 'unauthorized', message: 'You are not a host on this event' };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('events')
    .select('estimated_pax')
    .eq('event_id', eventId)
    .maybeSingle();
  const { error } = await admin
    .from('events')
    .update({ estimated_pax: pax })
    .eq('event_id', eventId);
  if (error) return { ok: false, code: 'db_error', message: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'guest_count_updated',
    target_table: 'events',
    target_id: eventId,
    before_json: before ?? null,
    after_json: { estimated_pax: pax },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/details`, 'layout');
  return { ok: true };
}

type PreviewConflictsResult =
  | { ok: true; conflicts: ConflictService[] }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'db_error'; message: string };

/**
 * Compute which currently-picked services would be in conflict if the host
 * changes a governed field to `proposed_value`. Read-only — no write.
 *
 *   ceremony / venue → computeCompatibilityIssue() run against the PROPOSED
 *     value (the unchanged axis stays current). Only the issue the change
 *     introduces is reported (a ceremony change reports religion/directory
 *     issues; a venue change reports venue_setting issues).
 *   date → the vendor-availability engine for the proposed day; a marketplace
 *     pick is in conflict when it has zero available days in the [day, day]
 *     window (blocked). Off-platform picks can't be checked → not flagged.
 *   pax → best-effort: capacity-bound categories (caterers, food stations,
 *     bars, cakes) get a "may need to re-quote" note. No capacity model exists,
 *     so this is an approximate warning, not a precise per-vendor conflict.
 */
export async function previewPersonalizationConflicts(
  formData: FormData,
): Promise<PreviewConflictsResult> {
  const eventId = formData.get('event_id');
  const fieldRaw = formData.get('field');
  const proposedRaw = formData.get('proposed_value');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  const field = fieldRaw as ConflictField;
  if (field !== 'ceremony' && field !== 'venue' && field !== 'date' && field !== 'pax') {
    return { ok: false, code: 'invalid_input', message: 'Invalid field' };
  }
  const proposed = typeof proposedRaw === 'string' ? proposedRaw.trim() : '';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  if (!(await isEventHost(supabase, eventId, user.id))) {
    return { ok: false, code: 'unauthorized', message: 'You are not a host on this event' };
  }

  const admin = createAdminClient();

  const { data: eventRow } = await admin
    .from('events')
    .select('ceremony_type, venue_setting')
    .eq('event_id', eventId)
    .maybeSingle();
  const currentCeremony = (eventRow?.ceremony_type as string | null) ?? null;
  const currentVenue = (eventRow?.venue_setting as string | null) ?? null;

  const { data: picksRaw, error: picksErr } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, vendor_name, category, status, marketplace_vendor_id, source_venue_directory_id',
    )
    .eq('event_id', eventId);
  if (picksErr) return { ok: false, code: 'db_error', message: picksErr.message };
  const picks = (picksRaw ?? []) as Array<{
    vendor_id: string;
    vendor_name: string | null;
    category: string | null;
    status: string | null;
    marketplace_vendor_id: string | null;
    source_venue_directory_id: string | null;
  }>;
  if (picks.length === 0) return { ok: true, conflicts: [] };

  const marketplaceIds = Array.from(
    new Set(picks.map((p) => p.marketplace_vendor_id).filter((id): id is string => !!id)),
  );
  const directoryIds = Array.from(
    new Set(picks.map((p) => p.source_venue_directory_id).filter((id): id is string => !!id)),
  );

  const marketMap = new Map<
    string,
    { ceremony: string[] | null; venue: string[] | null; logo: string | null; name: string | null }
  >();
  if (marketplaceIds.length > 0) {
    const { data } = await admin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id, compatible_ceremony_types, compatible_venue_settings, logo_url, business_name',
      )
      .in('vendor_profile_id', marketplaceIds);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      marketMap.set(r.vendor_profile_id as string, {
        ceremony: (r.compatible_ceremony_types as string[] | null) ?? null,
        venue: (r.compatible_venue_settings as string[] | null) ?? null,
        logo: (r.logo_url as string | null) ?? null,
        name: (r.business_name as string | null) ?? null,
      });
    }
  }

  const directoryMap = new Map<string, { ceremony: string[] | null }>();
  if (directoryIds.length > 0) {
    const { data } = await admin
      .from('venue_directory')
      .select('venue_directory_id, compatible_ceremony_types')
      .in('venue_directory_id', directoryIds);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      directoryMap.set(r.venue_directory_id as string, {
        ceremony: (r.compatible_ceremony_types as string[] | null) ?? null,
      });
    }
  }

  // Date availability — for a single-day [day, day] window, getVendorAvailableDays
  // returns a 1-element set when free and an empty set when blocked, so set.size
  // is the membership test (no day-key format-matching needed).
  const availabilityByVendor = new Map<string, boolean>();
  let proposedDateLabel = '';
  if (field === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(proposed)) {
    const day = new Date(`${proposed}T00:00:00`);
    if (!Number.isNaN(day.getTime())) {
      proposedDateLabel = day.toLocaleDateString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const results = await Promise.all(
        marketplaceIds.map(async (id) => {
          try {
            const set = await getVendorAvailableDays(admin, id, day, day);
            return [id, set.size > 0] as const;
          } catch {
            return [id, true] as const; // fail-open on a calendar read error
          }
        }),
      );
      for (const [id, available] of results) availabilityByVendor.set(id, available);
    }
  }

  const conflicts: ConflictService[] = [];
  for (const p of picks) {
    const market = p.marketplace_vendor_id ? marketMap.get(p.marketplace_vendor_id) : undefined;
    const dir = p.source_venue_directory_id ? directoryMap.get(p.source_venue_directory_id) : undefined;
    const displayName =
      market?.name ??
      (p.vendor_name && p.vendor_name.trim() !== '' ? p.vendor_name : 'This service');
    const base = {
      vendor_id: p.vendor_id,
      vendor_name: displayName,
      category: p.category ?? 'service',
      raw_status: p.status,
      logo_url: market?.logo ?? null,
    };

    if (field === 'ceremony' || field === 'venue') {
      const row: EventVendorRowInput = {
        vendor_id: p.vendor_id,
        vendor_name: displayName,
        category: (p.category ?? 'other') as EventVendorRowInput['category'],
        status: p.status,
        marketplace_vendor_id: p.marketplace_vendor_id,
        source_venue_directory_id: p.source_venue_directory_id,
        marketplace_compatible_ceremony_types: market?.ceremony ?? null,
        marketplace_compatible_venue_settings: market?.venue ?? null,
        directory_compatible_ceremony_types: dir?.ceremony ?? null,
      };
      const proposedCeremony = field === 'ceremony' ? proposed || null : currentCeremony;
      const proposedVenue = field === 'venue' ? proposed || null : currentVenue;
      const issue = computeCompatibilityIssue(row, proposedCeremony, proposedVenue);
      if (issue) {
        const relevant =
          (field === 'ceremony' && (issue.kind === 'religion' || issue.kind === 'directory')) ||
          (field === 'venue' && issue.kind === 'venue_setting');
        if (relevant) conflicts.push({ ...base, reason: issue.label });
      }
    } else if (field === 'date') {
      if (
        p.marketplace_vendor_id &&
        availabilityByVendor.get(p.marketplace_vendor_id) === false
      ) {
        conflicts.push({
          ...base,
          reason: `Not available on ${proposedDateLabel || 'the new date'}.`,
        });
      }
    } else if (field === 'pax') {
      if (isCapacityBound(p.category)) {
        const n = Number(proposed);
        const guests = Number.isInteger(n) && n > 0 ? `${n} guests` : 'the new guest count';
        conflicts.push({
          ...base,
          reason: `Priced by headcount — may need to re-quote for ${guests}.`,
        });
      }
    }
  }

  return { ok: true, conflicts };
}
