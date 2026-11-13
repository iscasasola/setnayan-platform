'use server';

import { isHubDraftWrite, saveHubDraftPatch } from '@/lib/hub-draft-store';

// Every `revalidatePath()` below uses `'layout'` mode (not default 'page')
// so the dashboard layout invalidates too. Event-level writes (date / name /
// venue / settings) change fields the sidebar chrome reads from the layout's
// events fetch (the event-switcher + monogram); without 'layout' they stay
// stale until manual reload. Same canonical fix as wizard-actions.ts
// (PR #514) — see CLAUDE.md 2026-05-24 "Fix: chrome monogram (+ layout-cached
// fields) stay stale after wizard save".
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { resolveCadence } from '@/lib/event-anchor';
import { eventSpanDays, eventSpanRefusal, isCelebrantShape, resolveProfileByEvent } from '@/lib/event-type-profile';
import { dateOptionsRefusal, dateOptionsSavedWords, eventSpanDayList, isIsoDay } from '@/lib/event-date-options';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { eventDateFloorRefusal, eventDatesFloorRefusal } from '@/lib/event-date-floor';
import { eventDateFloorExempt } from '@/lib/event-date-floor.server';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { parsePaxSettingsForm } from '@/lib/pax-settings-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { STEPS, type StepKey } from '@/lib/planner';
import {
  CONFIRMED_VENDOR_STATUSES,
  eventDateChangeIsGoverned,
  eventDateRefusal,
  type EventDatePrecision,
} from '@/lib/events';
import { datePickClash } from '@/lib/date-clash.server';
import type { DateClash } from '@/lib/date-fits-booked';
import { clashStillOpen, dateApplyClearance, afterDateApplied } from '@/lib/date-change.server';
import { moveScheduleWithDate } from '@/lib/ceremony-time.server';
import { exactDayOf } from '@/lib/schedule-datetime-local';
import { revalidateGuestSite } from '@/lib/revalidate-site';
import {
  ALLOWED_FEELS,
  MAX_BUDGET_PESOS,
  MAX_NAME_LEN,
  sanitizeName,
} from '@/lib/match-criteria';
import { coupleNameColumns, joinCoupleNames, nameOrderOf, type NameOrder } from '@/lib/typed-names';
import { resolveRegion } from '@/lib/region-source';
import { baziBirthDataEnabled } from '@/lib/bazi-birthdata';
import { isChineseWedding } from '@/lib/chinese-wedding';
import {
  isAllowedCeremonyValue,
  isAllowedSecondaryCeremonyValue,
  type CeremonyValue,
} from '@/lib/faith-registry';
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
import { formatCount } from '@/lib/format-number';
import { eventDetailsToWrite } from '@/lib/event-details-merge';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { maySwitchEventKind, type EventTypeRequestRow } from '@/lib/event-type-requests';

const ALLOWED_PRECISIONS = ['year', 'month', 'day'] as const;

function isPrecision(value: unknown): value is EventDatePrecision {
  return typeof value === 'string'
    && (ALLOWED_PRECISIONS as readonly string[]).includes(value);
}

/**
 * 🗓 THE EVENT'S DATE — THE ONE DOOR, LIVE AT ONCE (owner 2026-11-05, verbatim: *"it shouldn't rely on the hub."*
 * DECISION_LOG 2026-11-05 "THE DATE SAVES TO THE EVENT"). The date is a fact of the EVENT — it drives suppliers,
 * booking clashes, Home, Papic and Live Watch — not an Event Hub design edit, so it is never drafted and never waits
 * for Apply. Every place a couple sets it posts HERE: Event Settings › Personalization (`GovernedFields`), the
 * Maker's Details › Your date, the Suppliers page's "Your date" sheet, Explore's "Lock this day" and Home's
 * date-change card once every supplier answered.
 *
 * Its gates, each the SHIPPED one (moved here from the Hub's save and Apply, never re-invented):
 *   1. the date floor — no event before December 19, 2026 (`eventDateFloorRefusal`, owner 2026-11-01);
 *   2. A DATE THAT CLASHES WITH A BOOKED SUPPLIER IS REFUSED AT THE PICK (owner 2026-10-01) — `datePickClash`,
 *      FAIL-CLOSED now that nothing stands behind the pick — unless every supplier it clashes with already answered
 *      Move for exactly this date (`clashStillOpen`; "the supplier in conflict decides"). The refusal names who, so
 *      the caller can offer the date-change ask (`hubDraftAction` intent `date_change`);
 *   3. `eventDateRefusal` (lib/events.ts) — never a day gone by; with a booked supplier the precision never widens,
 *      and the day moves only when every booked supplier can do it or answered Move (`dateApplyClearance`, Q8).
 *
 * After the write: an open date-change request closes and every booked supplier is told "The date moved to …"
 * (`afterDateApplied`); the Schedule follows the day (`moveScheduleWithDate`, owner 2026-10-04); the dashboard and
 * the published Event Hub (`revalidateGuestSite` — it reads `events.event_date`, it keeps no copy) are drawn again.
 *
 * Every refusal is RETURNED in words, never thrown (a thrown message is replaced by a generic one in production).
 * The update is the couple's own session — RLS (`couple_can_update_event`) decides who may write it, and a write
 * that reached no row says so instead of answering "saved".
 *
 * Tiered precision (Task #39): year/month store the first day of the range ('2027-01-01', '2027-08-01').
 *
 * 📅 THE LAST DAY (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED — … EXACT DATE CAN BE A RANGE"): a
 * form that POSTS `event_end_date` ('' = "Same day") writes the one main span `event_date` → `event_end_date`, refused
 * past the type's cap with `eventSpanRefusal`'s one line (`event_type_profiles.max_days`), and keeps `event_days` equal
 * to its length. A form that does not post it leaves both untouched — every older caller is unchanged. A form that
 * posts `clear_options=1` (the Suppliers sheet's "I have a date") also clears the options being considered
 * (`date_candidates` / `date_window_*`): "picking one day replaces the options".
 */
export type EventDateSaveResult =
  | { ok: true; date: string | null; precision: EventDatePrecision; note?: string }
  | { ok: false; error: string; clash?: DateClash[] };

const DATE_NOT_SAVED = 'That date did not save. Nothing changed — please try again.';

export async function updateEventDate(formData: FormData): Promise<EventDateSaveResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  const dateRaw = formData.get('event_date');
  const precisionRaw = formData.get('precision');
  if (typeof eventId !== 'string' || !eventId) return { ok: false, error: DATE_NOT_SAVED };

  const newPrecision: EventDatePrecision = isPrecision(precisionRaw) ? precisionRaw : 'day';
  const endPosted = formData.has('event_end_date');
  const endRaw = formData.get('event_end_date');
  const clearOptions = formData.get('clear_options') === '1';

  let eventDate: string | null = null;
  if (typeof dateRaw === 'string' && dateRaw.trim().length > 0) {
    // HTML date inputs emit YYYY-MM-DD which Postgres DATE accepts as-is. Anything else is refused, never stored.
    const trimmed = dateRaw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { ok: false, error: 'That date could not be read.' };
    eventDate = trimmed;
  }

  // 📅 The last day, when posted: a day after (or on) the first, inside the type's cap. "Same day" = no last day.
  let eventEndDate: string | null = null;
  if (endPosted) {
    const trimmed = typeof endRaw === 'string' ? endRaw.trim() : '';
    if (trimmed !== '') {
      if (!isIsoDay(trimmed)) return { ok: false, error: 'That last day could not be read.' };
      if (!eventDate || newPrecision !== 'day') return { ok: false, error: 'Pick the first day before the last day.' };
      if (trimmed !== eventDate) eventEndDate = trimmed;
    }
    if (eventEndDate) {
      const spanRefusal = eventSpanRefusal({
        startDate: eventDate,
        endDate: eventEndDate,
        maxDays: (await resolveProfileByEvent(eventId)).maxDays,
      });
      if (spanRefusal) return { ok: false, error: spanRefusal };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The date as it stands — read FAIL-CLOSED: an unread row is not "no date yet".
  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('event_date, event_date_precision, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (priorErr || !priorRow) return { ok: false, error: DATE_NOT_SAVED };
  const prior = { date: (priorRow.event_date as string | null | undefined) ?? null, precision: priorRow.event_date_precision };
  const next = { date: eventDate, precision: newPrecision };

  // 1 · 💍 No event before December 19, 2026 (owner 2026-11-01, lib/event-date-floor.ts).
  const floorRefusal = eventDateFloorRefusal({
    date: eventDate,
    precision: newPrecision,
    prior,
    exempt: await eventDateFloorExempt(supabase, { eventId }),
  });
  if (floorRefusal) return { ok: false, error: floorRefusal };

  // 2 · A day or month a booked supplier cannot do is refused AT THE PICK, with who (owner 2026-10-01).
  //   A first + last day is asked EVERY day of the span (`eventSpanDayList`), one `datePickClash` per day — the same
  //   rule, never a second check. The first day that clashes refuses, with who; a Move answered for this start clears
  //   it exactly as today (`clashStillOpen` is keyed on the start the couple asked to move to).
  if (eventDate) {
    const admin = createAdminClient();
    for (const day of eventSpanDayList(eventDate, newPrecision === 'day' ? eventEndDate : null)) {
      let picked;
      try {
        picked = await datePickClash({
          supabase,
          admin,
          eventId,
          date: day,
          precision: newPrecision,
          live: prior,
          failClosed: true,
        });
      } catch {
        return { ok: false, error: 'We could not check your suppliers’ calendars. Nothing changed — please try again.' };
      }
      const asked = await clashStillOpen(supabase, eventId, { date: eventDate, precision: newPrecision }, picked);
      if (asked) return { ok: false, error: asked.reason, clash: asked.clash };
    }
  }

  // 3 · ONE rule for the rest (`eventDateRefusal`, lib/events.ts). The booked count is read fail-CLOSED.
  let confirmed = 0;
  let requestId: string | null = null;
  if (eventDateChangeIsGoverned(prior, next)) {
    const { count, error: countErr } = await supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    if (countErr) return { ok: false, error: 'We could not check your booked suppliers. Nothing changed — please try again.' };
    confirmed = count ?? 0;
  }
  let refusal = eventDateRefusal(prior, next, confirmed);
  if (refusal === 'locked' && eventDate) {
    // Q8 (owner 2026-10-02): a day every booked supplier can do — or every one that clashes answered Move — moves.
    const clearance = await dateApplyClearance({ supabase, eventId, prior, next: { date: eventDate, precision: newPrecision } });
    if (!clearance.ok) return { ok: false, error: 'We could not check your booked suppliers’ calendars. Nothing changed — please try again.' };
    refusal = eventDateRefusal(prior, next, confirmed, new Date(), clearance.cleared);
    requestId = clearance.requestId;
  }
  if (refusal === 'in_past') return { ok: false, error: 'That day has already gone by. Pick today or a later date.' };
  if (refusal === 'widens') {
    return {
      ok: false,
      error: `You have ${formatCount(confirmed)} booked supplier${confirmed === 1 ? '' : 's'}, so your date can only get more exact (year → month → day), never broader.`,
    };
  }
  if (refusal === 'locked') {
    return { ok: false, error: 'A booked supplier cannot do that date. Ask them to move first — your date stays as it is.' };
  }

  const { data: wrote, error } = await supabase
    .from('events')
    .update({
      event_date: eventDate,
      event_date_precision: newPrecision,
      // 📅 The span and its day count move together, only when the form posted the last day.
      ...(endPosted
        ? { event_end_date: eventEndDate, event_days: eventDate && eventEndDate ? eventSpanDays(eventDate, eventEndDate) : 1 }
        : {}),
      // "I have a date" replaces the options being considered — the date is exact now.
      ...(clearOptions && eventDate && newPrecision === 'day'
        ? { date_mode: 'specific', date_candidates: null, date_window_start: null, date_window_end: null }
        : {}),
    })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !wrote || wrote.length === 0) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Save wedding date',
      file_path: 'app/dashboard/[eventId]/actions.ts',
      error_message: error?.message ?? 'the update reached no row',
      payload_snapshot: { eventId, eventDate, newPrecision },
    });
    // RLS lets only the couple write the date — a write that reached no row is said, never answered "saved".
    return { ok: false, error: error ? DATE_NOT_SAVED : 'Only the couple can change the date.' };
  }

  // The date moved over booked suppliers — close the request, tell each one (Q8: a notice, no decision).
  if (confirmed > 0 && eventDate && eventDate !== prior.date) {
    await afterDateApplied({ supabase, eventId, next: { date: eventDate, precision: newPrecision }, requestId });
  }

  // 🕒 The whole Schedule follows the day (owner 2026-10-04). The date is already saved, so a Schedule that stayed
  // behind is said beside it — never a reason to call the date unsaved.
  let note: string | undefined;
  const shifted = await moveScheduleWithDate({
    supabase,
    eventId,
    fromDay: exactDayOf(prior.date, prior.precision),
    toDay: exactDayOf(eventDate, newPrecision),
  });
  if (!shifted.ok) {
    console.error('[event-date] the schedule did not follow the date:', shifted.error);
    note = 'Your new date is saved, but your Schedule stayed on the old day. Open your Schedule to move it.';
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidateGuestSite(priorRow.slug as string | null | undefined);
  return note ? { ok: true, date: eventDate, precision: newPrecision, note } : { ok: true, date: eventDate, precision: newPrecision };
}

/**
 * 📅 A FEW DATES — the date as OPTIONS, with a day count (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED —
 * HOW MANY DAYS? FIRST · N-DAY OPTIONS …"; prototype `event_dates_edit_2026-11-13`). The Suppliers "Your date" sheet's
 * third pill and its one writer.
 *
 * Writes the event's OWN option columns — `date_mode`, `date_candidates` (each the START of an N-day option) or
 * `date_window_start/end` (where the N-day block may start), and `event_days` — and leaves the exact date EMPTY
 * (`event_date` / `event_end_date` cleared): options stay options until a booking makes the date exact
 * (DECISION_LOG 2026-11-13 "ONE MAIN DATE SPAN — CANDIDATES ARE OPTIONS UNTIL A VENUE IS BOOKED").
 *
 * Refused, in words, when: somebody is booked (the date is theirs now — a change is the date-change ask, never this);
 * the options break the calendar's own rules (`dateOptionsRefusal` — the same module the calendar draws with: ≤ 4,
 * none sharing a day, a window ≤ 30 days, N inside the type's `max_days`); or a day falls before the first event day
 * (`eventDatesFloorRefusal`). The couple's own session writes it — RLS decides the row, and a write that reached no row
 * says so.
 */
export type EventDateOptionsResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateEventDateOptions(formData: FormData): Promise<EventDateOptionsResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || !eventId) return { ok: false, error: DATE_NOT_SAVED };
  const mode = formData.get('date_mode') === 'window' ? 'window' : 'specific';
  const candidates = formData.getAll('date_candidate').filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim());
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const windowStart = mode === 'window' ? str('date_window_start') : null;
  const windowEnd = mode === 'window' ? str('date_window_end') : null;
  const days = Number(formData.get('event_days') ?? 1);

  const profile = await resolveProfileByEvent(eventId);
  const refusal = dateOptionsRefusal({ mode, candidates, windowStart, windowEnd, days, maxDays: profile.maxDays });
  if (refusal) return { ok: false, error: refusal };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const floor = eventDatesFloorRefusal(
    mode === 'specific' ? candidates : [windowStart, windowEnd],
    await eventDateFloorExempt(supabase, { eventId }),
  );
  if (floor) return { ok: false, error: floor };

  // A booked supplier holds the date — options are for before anyone is booked. Read FAIL-CLOSED.
  const { count, error: countErr } = await supabase
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  if (countErr) return { ok: false, error: 'We could not check your booked suppliers. Nothing changed — please try again.' };
  if ((count ?? 0) > 0) {
    return { ok: false, error: 'A supplier is booked, so your date is set. A change asks them first — use I have a date.' };
  }

  const sorted = [...candidates].sort();
  const { data: wrote, error } = await supabase
    .from('events')
    .update({
      date_mode: mode,
      date_candidates: mode === 'specific' ? sorted : null,
      date_window_start: windowStart,
      date_window_end: windowEnd,
      event_days: Math.floor(days),
      // Options leave the exact date EMPTY — a booking makes it exact.
      event_date: null,
      event_date_precision: 'day',
      event_end_date: null,
    })
    .eq('event_id', eventId)
    .select('event_id, slug');
  if (error || !wrote || wrote.length === 0) {
    if (error) logQueryError('updateEventDateOptions', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: error ? DATE_NOT_SAVED : 'Only the couple can change the date.' };
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidateGuestSite((wrote[0] as { slug?: string | null }).slug ?? null);
  return { ok: true, message: dateOptionsSavedWords(mode, sorted, windowStart, windowEnd, Math.floor(days)) };
}

/**
 * setPlanningMode — flip the event between Guided (default) and Manual.
 *
 * Owner 2026-06-05 (iteration 0021). Manual mode turns OFF Setnayan's
 * automated layer (vendor-match personalization · per-service + statutory
 * deadlines · "Setnayan AI" auto-tasks); the app + a compatibility-scoped
 * vendor directory + messaging stay fully usable. The flag lives on the
 * events row and is read by Home, the Services tab, and the deadline layer.
 * Mirrors updateEventDate's auth + `event_id` update + layout revalidate.
 */
export async function setPlanningMode(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  const modeRaw = formData.get('mode');
  if (typeof eventId !== 'string') throw new Error('event_id required');
  const mode = modeRaw === 'manual' ? 'manual' : 'guided';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Membership gate (user-scoped read RLS): if the caller can READ this event,
  // they're a member and may flip its planning mode.
  const { data: membership } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!membership) throw new Error('not a member of this event');

  // Apply via the admin client AFTER the membership gate above. Why not the
  // user client: the `couple_can_update_event` policy keys on
  // event_members.member_type='couple', which is absent for seeded / host /
  // multi-host events — a user-client UPDATE then silently affects 0 rows (no
  // error), so the "Switch to manual" toggle appeared to do nothing. Gating on
  // read + writing via admin lands the flip for every legitimate member.
  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ planning_mode: mode })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
}

// toggleRoadmapItem (the manual "thing to complete" check-off) was REMOVED
// 2026-07-11 along with its only surface, WeddingRoadmapAsync — both orphaned
// when the 2026-07-10 refactor made `<EventDashboard>` the event Home and
// retired the Progress tab. `events.roadmap_completed` is no longer written;
// the Studio recommendation strip still READS it (existing values stay valid)
// but now runs effectively on auto-signals only. See lib/studio-recommendations.ts.

const MANUAL_KEYS = new Set<StepKey>(
  STEPS.filter((s) => s.source === 'manual').map((s) => s.key),
);

async function toggleJourneyStep(formData: FormData) {
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
    if (error) {
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Mark planning step complete',
        file_path: 'app/dashboard/[eventId]/actions.ts',
        error_message: error.message,
        payload_snapshot: { eventId, stepKey },
      });
      throw new Error(error.message);
    }
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
// Primary + secondary ceremony validation both derive from the faith-registry
// (`ALLOWED_CEREMONY_VALUES` = every registry faith + civil + mixed), the single
// source that mirrors the lowercase `events_ceremony_type_check` DB CHECK (kept
// in lockstep by migration 20261120000000, the faith worldwide expansion). This
// REPLACES the old hardcoded 10-value list, which silently rejected the 8
// worldwide-expansion faiths (aglipayan/lds/sda/jw/hindu/sikh/buddhist/orthodox,
// shipped in PR #1275) even though the modal offers all 18 and the DB accepts
// them. Mirrors the onboarding commit's server-side belt (the picker only EMITS
// launch-active keys; the server accepts anything the owner COULD flip live).
//
// ⚠ This is the LOWERCASE ceremony_type keyspace — NOT the Title-Case
// `faith_vocab` marketplace keyspace. `isAllowedCeremonyValue` is case-sensitive,
// so Title-Case keys (e.g. 'Catholic') are correctly rejected here.
type SetCeremonyResult =
  | { ok: true; ceremony_type: CeremonyValue; updated: boolean }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'vendor_lock' | 'not_wedding' | 'db_error'; message: string };

export async function setEventCeremonyType(formData: FormData): Promise<SetCeremonyResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  const ceremonyRaw = formData.get('ceremony_type');

  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  if (!isAllowedCeremonyValue(ceremonyRaw)) {
    return { ok: false, code: 'invalid_input', message: 'Invalid ceremony type' };
  }
  const ceremony_type = ceremonyRaw;

  // OPTIONAL secondary (overlay) ceremony — the common Tsinoy "church-primary +
  // Chinese tea ceremony" case (secondary_ceremony_type='chinese'). The field is
  // OPTIONAL: callers that don't send it leave the column untouched (the update
  // below stays byte-identical for them). When present:
  //   - '' (empty string) CLEARS the overlay → null.
  //   - any value must pass isAllowedSecondaryCeremonyValue (registry faith or
  //     civil, never 'mixed'), else reject.
  // `undefined` = field absent → don't touch the column; `null`/string = write.
  const secondaryProvided = formData.has('secondary_ceremony_type');
  const secondaryRaw = formData.get('secondary_ceremony_type');
  let secondary_ceremony_type: string | null | undefined = undefined;
  if (secondaryProvided) {
    const s = typeof secondaryRaw === 'string' ? secondaryRaw.trim() : '';
    if (s === '') {
      secondary_ceremony_type = null;
    } else if (isAllowedSecondaryCeremonyValue(s)) {
      secondary_ceremony_type = s;
    } else {
      return { ok: false, code: 'invalid_input', message: 'Invalid secondary ceremony type' };
    }
  }

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
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
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
    .select('event_id, event_type, ceremony_type, secondary_ceremony_type, ceremony_type_locked_at')
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
  const previousSecondary = (eventRow.secondary_ceremony_type as string | null) ?? null;

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

  // No-op short-circuit: same value(s) already saved. Returns ok=true so the
  // modal closes cleanly, but we don't write or audit-log. The secondary leg
  // only counts as "unchanged" when the caller actually sent it (or didn't
  // touch it) AND it matches the stored value — so a secondary-only edit still
  // falls through to the write below.
  const secondaryUnchanged =
    secondary_ceremony_type === undefined || secondary_ceremony_type === previousSecondary;
  if (previousType === ceremony_type && secondaryUnchanged && wasConfirmedBefore) {
    return { ok: true, ceremony_type, updated: false };
  }

  // Write the new value + stamp the lock columns. ceremony_type_locked_at
  // continues to mean "host explicitly confirmed" (vs the silent 'catholic'
  // default from the biconditional CHECK invariant). It is NOT load-bearing
  // for the UI lock — the UI gates on live confirmedVendorCount instead.
  const nowIso = new Date().toISOString();
  const updatePatch: Record<string, unknown> = {
    ceremony_type,
    ceremony_type_locked_at: nowIso,
    ceremony_type_locked_by: user.id,
  };
  // Only touch secondary_ceremony_type when the caller actually sent the field;
  // omitting it keeps the write byte-identical for existing callers (the modal's
  // primary-only "Change" flow).
  if (secondary_ceremony_type !== undefined) {
    updatePatch.secondary_ceremony_type = secondary_ceremony_type;
  }
  const { error: updateError } = await admin
    .from('events')
    .update(updatePatch)
    .eq('event_id', eventId);
  if (updateError) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Save wedding ceremony type',
      file_path: 'app/dashboard/[eventId]/actions.ts',
      error_message: updateError.message,
      payload_snapshot: { eventId, ceremony_type, previousType, confirmed },
    });
    return { ok: false, code: 'db_error', message: updateError.message };
  }

  // Audit log — distinguish set (first time) from updated (Task #43).
  await admin.from('admin_audit_log').insert({
    action: wasConfirmedBefore ? 'ceremony_type_updated' : 'ceremony_type_set',
    target_table: 'events',
    target_id: eventId,
    before_json: {
      ceremony_type: previousType,
      secondary_ceremony_type: previousSecondary,
      ceremony_type_locked_at: eventRow.ceremony_type_locked_at,
      confirmed_vendor_count: confirmed,
    },
    after_json: {
      ceremony_type,
      ceremony_type_locked_at: nowIso,
      // Only record the secondary in the audit when it was part of this write.
      ...(secondary_ceremony_type !== undefined
        ? { secondary_ceremony_type }
        : {}),
    },
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

// PR-G — sentinel returned by the BaZi birth-data parsers to distinguish
// "field cleared" (null) from "field malformed" (INVALID → reject the write).
const INVALID = Symbol('invalid');

export async function updateEventMatchCriteria(
  posted: FormData,
): Promise<UpdateMatchCriteriaResult> {
  await refuseLimitedHelper(posted.get('event_id'), null);
  /* 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18 — `lib/event-details-merge.ts`). A form that says what it
     started from (`MERGE_BASE_FIELD`) is written only where THIS screen changed it: every field it did not change is
     left out, and an absent field is untouched below — the other host's region, feel or budget stands. */
  const toWrite = eventDetailsToWrite(posted);
  const formData = toWrite.fd;
  const based = toWrite.based;
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }

  // Region — '' clears to NULL; otherwise resolve through the canonical region
  // source. ANY of the four spellings (canonical hyphen slug · underscore
  // variant · PSGC code · 'cagayan-valley') is accepted, then NORMALIZED to the
  // canonical hyphen slug so new writes converge on one vocabulary. Existing
  // underscore-stored rows still validate (resolveRegion absorbs them).
  const regionRaw = formData.get('region');
  const regionStr = typeof regionRaw === 'string' ? regionRaw.trim() : '';
  let region: string | null = null;
  if (regionStr !== '') {
    const resolvedRegion = resolveRegion(regionStr);
    if (!resolvedRegion) {
      return { ok: false, code: 'invalid_input', message: 'Invalid region' };
    }
    region = resolvedRegion.slug; // canonical hyphen slug
  }

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
  let brideName: string | null = null;
  let groomName: string | null = null;
  /* 🔀 The page's names are composed AFTER the stored row is read (below), in the ORDER the stored name keeps
     (`nameOrderOf`, owner 2026-10-21 "it should be Indalecio & Claire") — never re-set to the first person first. */
  let postedPeople: [{ first: string; last: string }, { first: string; last: string }] | null = null;
  let legacyNames = false;
  // 🗂 ABSENT ⇒ UNTOUCHED, the rule the budget, the repeat and the celebrant
  // shape below already follow: Your info › Event settings posts this form
  // without the names (they are Your info › Names' own field, drafted until
  // Apply — owner 2026-10-02), and a form that never showed a name box must
  // never clear the names.
  const namesPosted = ['bride_first', 'groom_first', 'bride_name', 'groom_name'].some((k) => formData.has(k));
  if (!namesPosted) {
    // Leave bride_name / groom_name / display_name exactly as they are.
  } else if (formData.has('bride_first') || formData.has('groom_first')) {
    // ONE composition (`coupleNameColumns`, lib/typed-names.ts) — the Maker's
    // Names editor drafts exactly these columns through it (2026-10-01).
    const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');
    postedPeople = [
      { first: str(formData.get('bride_first')), last: str(formData.get('bride_last')) },
      { first: str(formData.get('groom_first')), last: str(formData.get('groom_last')) },
    ];
  } else {
    // Legacy path (pre-split form). Combined names, display from full names.
    const brideRaw = formData.get('bride_name');
    const groomRaw = formData.get('groom_name');
    const brideStr = (typeof brideRaw === 'string' ? sanitizeName(brideRaw).trim() : '').slice(0, MAX_NAME_LEN);
    const groomStr = (typeof groomRaw === 'string' ? sanitizeName(groomRaw).trim() : '').slice(0, MAX_NAME_LEN);
    brideName = brideStr === '' ? null : brideStr;
    groomName = groomStr === '' ? null : groomStr;
    legacyNames = true;
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
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
      .maybeSingle();
    isHost = !!modRow;
  }
  if (!isHost) {
    return { ok: false, code: 'unauthorized', message: 'You are not a host on this event' };
  }

  // ── 🎂 ONE CELEBRANT'S NAME (owner 2026-09-29, DECISION_LOG "OWNER: YES TO
  // ALL FOUR…", item 3) ──────────────────────────────────────────────────────
  // A single-person event (a birthday, a debut, a wake) is named by its
  // `display_name` — the very column the hero, every print and every pass
  // already read. Until now it could only be set at creation. Details › Your
  // event › Name posts `celebrant_name` ALONE, and this writes `display_name`
  // and NOTHING else: never `bride_name` / `groom_name` (a birthday has no
  // bride), and never region, feel, budget or birth data — which this
  // action's full-form path writes whether or not they were posted. +0 actions:
  // the same writer, one more door, the same host check above.
  if (formData.has('celebrant_name')) {
    const raw = formData.get('celebrant_name');
    const name = (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '').slice(0, MAX_NAME_LEN);
    if (!name) {
      return { ok: false, code: 'invalid_input', message: 'Type a name first' };
    }
    const adminForName = createAdminClient();
    const { data: prior } = await adminForName.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
    const { error: nameError } = await adminForName.from('events').update({ display_name: name }).eq('event_id', eventId);
    if (nameError) {
      return { ok: false, code: 'db_error', message: nameError.message };
    }
    // The name is saved; a lost audit row is logged (never silent), not a failed save.
    const { error: auditError } = await adminForName.from('admin_audit_log').insert({
      action: 'event_match_criteria_updated',
      target_table: 'events',
      target_id: eventId,
      before_json: prior ?? null,
      after_json: { display_name: name },
      actor_user_id: user.id,
    });
    if (auditError) logQueryError('updateEventMatchCriteria.celebrantName.audit', auditError, { event_id: eventId }, 'graceful_degrade');
    revalidatePath(`/dashboard/${eventId}`, 'layout');
    return { ok: true };
  }

  // ── 🏷 KIND OF EVENT (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE SPECIFIC") ─────────────────────────────
  // Event settings' one line: a generic `celebration` event picks a specific type (the type decides which suppliers
  // cover it), and a host who asked us to add a type switches to it once it is added. `event_type_switch` is posted
  // ALONE and writes `event_type` and NOTHING else. +0 actions: the same writer, one more door, the same host check.
  // The choice is re-derived HERE from the stored row + the viewer's own asks (`maySwitchEventKind`), never trusted
  // from the client; and the write goes through the viewer's OWN session, so RLS (the couple) and the SEC-5 price-tier
  // trigger (20271007917549) both still apply — the admin client would walk past both.
  if (formData.has('event_type_switch')) {
    const next = String(formData.get('event_type_switch') ?? '').trim();
    const [{ data: row, error: rowError }, creatable, { data: asks, error: asksError }] = await Promise.all([
      supabase.from('events').select('event_type, created_at').eq('event_id', eventId).maybeSingle(),
      getCreatableEventTypes(),
      supabase
        .from('event_type_requests')
        .select('status, event_type, created_at, label')
        .eq('user_id', user.id)
        .eq('status', 'added'),
    ]);
    if (rowError || !row) {
      if (rowError) logQueryError('updateEventMatchCriteria.kind.row', rowError, { event_id: eventId }, 'will_throw');
      return { ok: false, code: 'db_error', message: 'We couldn’t read this event. Nothing was changed.' };
    }
    // Refused, the asks read as none — a generic event still gets every specific type; nothing is ever widened.
    if (asksError) logQueryError('updateEventMatchCriteria.kind.asks', asksError, { event_id: eventId }, 'graceful_degrade');
    const stored = row as { event_type: string | null; created_at: string | null };
    const allowed = maySwitchEventKind(
      {
        eventType: stored.event_type,
        eventCreatedAt: stored.created_at,
        creatable,
        myAsks: (asks ?? []) as Pick<EventTypeRequestRow, 'status' | 'event_type' | 'created_at' | 'label'>[],
      },
      next,
    );
    if (!allowed) {
      return { ok: false, code: 'invalid_input', message: 'That kind isn’t available for this event.' };
    }
    const { data: moved, error: moveError } = await supabase
      .from('events')
      .update({ event_type: next })
      .eq('event_id', eventId)
      .select('event_id');
    if (moveError) {
      logQueryError('updateEventMatchCriteria.kind.update', moveError, { event_id: eventId, next }, 'will_throw');
      return { ok: false, code: 'db_error', message: 'We couldn’t change the kind of this event. Nothing was changed.' };
    }
    // 🪤 A zero-row UPDATE is success-shaped: RLS lets only the couple write `events`, so a coordinator lands here.
    if (!moved || moved.length === 0) {
      return { ok: false, code: 'unauthorized', message: 'Only the couple can change the kind of this event.' };
    }
    const { error: kindAuditError } = await createAdminClient().from('admin_audit_log').insert({
      action: 'event_type_switched',
      target_table: 'events',
      target_id: eventId,
      before_json: { event_type: stored.event_type },
      after_json: { event_type: next },
      actor_user_id: user.id,
    });
    if (kindAuditError) logQueryError('updateEventMatchCriteria.kind.audit', kindAuditError, { event_id: eventId }, 'graceful_degrade');
    revalidatePath(`/dashboard/${eventId}`, 'layout');
    return { ok: true };
  }

  // ── WHOSE MONEY IS THIS? ───────────────────────────────────────────────────
  // 🔴 The host check above admits a coordinator and an accepted delegate, and
  // the patch below wrote `estimated_budget_centavos` through the ADMIN client.
  // So the live external planner in production could not merely READ the
  // couple's ₱930,000 target on this page — she could overwrite it. `'budget'`
  // has been a declared delegate area, DEFAULTED OFF, since migration
  // 20261129000000, and the locked D1 rule is that it never exceeds 'view';
  // this action simply never asked. Same shared resolver as the three screens.
  const budgetAccess = await resolveBudgetVisibility(supabase, eventId, user.id);

  // 🪤 ABSENT ≠ EMPTY, AND GETTING THIS BACKWARDS WIPES THE TARGET. The form no
  // longer posts `budget_pesos` to somebody who may not edit it, and an EMPTY
  // `budget_pesos` legitimately means "clear my budget". Parsing an absent key
  // as empty would have made every save by a delegate silently delete the
  // couple's figure — worse than the leak this closes.
  const budgetPosted = formData.has('budget_pesos');
  if (budgetPosted && !budgetAccess.mayEdit) {
    // A direct POST, not our own form. Refuse the whole write rather than
    // quietly dropping one field: a save that reports success while ignoring
    // what was typed is the shape this repo keeps paying for.
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only the couple can change the budget for this event',
    };
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('events')
    .select(
      'region, mood_feel_key, estimated_budget_centavos, bride_name, groom_name, display_name, ' +
        // event_type: the cadence is resolved against the SERVER's view of what
        // this event IS, never a type posted by the client — the same rule the
        // BaZi gate below follows for ceremony_type.
        'event_type, recurs, recur_cadence, ' +
        // PR-G — read the stored ceremony so the BaZi birth-data write gates on
        // the SERVER's view of the event (never trusts the client), and capture
        // the prior birth fields for the audit before/after.
        'ceremony_type, secondary_ceremony_type, ' +
        'partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, ' +
        'partner_b_birth_time, bazi_birthdata_consent_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  // 🔀 The names, composed in the order the STORED name keeps (`nameOrderOf` over the row as it stands).
  const storedRow = before as unknown as { display_name?: string | null; bride_name?: string | null; groom_name?: string | null } | null;
  const storedOrder: NameOrder = nameOrderOf(storedRow?.display_name, storedRow?.bride_name, storedRow?.groom_name);
  let recomputedDisplay = '';
  if (postedPeople) {
    const cols = coupleNameColumns(postedPeople[0], postedPeople[1], storedOrder);
    brideName = cols.bride_name;
    groomName = cols.groom_name;
    recomputedDisplay = cols.display_name ?? '';
  } else if (legacyNames) {
    recomputedDisplay = joinCoupleNames(brideName, groomName, storedOrder);
  }

  const updatePatch: Record<string, unknown> = {
    // 👥 A based post leaves out what it did not change — absent ⇒ untouched, like the budget. Unbased: written, as before.
    ...(!based || formData.has('region') ? { region } : {}),
    ...(!based || formData.has('mood_feel_key') ? { mood_feel_key: moodFeelKey } : {}),
    ...(namesPosted ? { bride_name: brideName, groom_name: groomName } : {}),
  };
  // Untouched when the key never arrived — the same "absent ⇒ leave it alone"
  // rule `recur_cadence` below already follows, and for the same reason.
  if (budgetPosted) {
    updatePatch.estimated_budget_centavos = budgetCentavos;
  }

  // ── THE REPEAT, EDITABLE AT LAST ────────────────────────────────────────────
  // 🔴 `events.recurs` HAD NO UPDATE PATH ANYWHERE. Every writer was an INSERT
  // (this create action, the onboarding insert, the recurrence clone), so a
  // decision made in one tap at creation was permanent and unreachable — while
  // the onboarding screen said, in as many words, **"You can change this
  // later."** It could not. A test docblock in this repo had already recorded
  // the consequence for the sibling anchor columns: *"There is no screen
  // anywhere to fix that after creation, so the event was permanently invisible
  // to the surface built for it."*
  //
  // This is Band 1 of the Personalization page — governance-free, binds no
  // vendor, so it is edited inline here rather than behind the booked-vendor
  // lock that governs dates and ceremony type.
  //
  // 🔑 `resolveCadence` IS THE SAME DECIDER THE TWO CREATE PATHS USE. A separate
  // rule here is how the three-way disagreement started, and it is why a
  // birthday created one way never appeared on the Year view.
  //
  // Absent from the form ⇒ untouched. A person editing their budget must not
  // silently switch off a repeat they never saw.
  // ── WHO IS BEING CELEBRATED, AND HOW MANY OF THEM ──────────────────────────
  // Owner 2026-08-27: *"the one celebratiing is the celebrant that can be
  // single, couple, or multiple people."* Hosts are not asked about — however
  // many there are is a COUNT of this event's host members, never a stored
  // second copy of a fact the database already holds.
  //
  // Absent from the form ⇒ untouched, the same rule as the budget and the
  // repeat above. An EMPTY value is meaningful and different: it clears back to
  // the event type's own shape.
  if (formData.has('celebrant_shape')) {
    const raw = formData.get('celebrant_shape');
    const shape = typeof raw === 'string' ? raw.trim() : '';
    if (shape !== '' && !isCelebrantShape(shape)) {
      return { ok: false, code: 'invalid_input', message: 'Invalid celebrant shape' };
    }
    updatePatch.celebrant_shape = shape === '' ? null : shape;
  }

  if (formData.has('recur_cadence')) {
    // The SERVER's view of what this event is — never a type posted by the
    // client, the same rule the BaZi gate below follows for ceremony_type.
    const beforeRow = before as Record<string, unknown> | null;
    const storedType = typeof beforeRow?.event_type === 'string' ? beforeRow.event_type : null;
    const cadence = resolveCadence(storedType, formData.get('recur_cadence'));
    updatePatch.recur_cadence = cadence;
    // The DB CHECK refuses a cadence without the switch, so both halves move
    // together — one decider, one write.
    updatePatch.recurs = cadence !== null;
  }
  // Recompute the chrome/display label from the names only when at least one
  // is present — never blank an existing display_name.
  if (recomputedDisplay !== '') {
    updatePatch.display_name = recomputedDisplay;
  }

  // PR-G — opt-in, consent-gated, flag-gated BaZi birth-data write. TRIPLE GATE
  // (all three required to touch any birth column):
  //   1. baziBirthDataEnabled()              — feature flag (default OFF).
  //   2. isChineseWedding(stored ceremony)   — server's view, not the client's.
  //   3. the explicit consent checkbox        — 'bazi_birthdata_consent' === '1'.
  // When the gate is closed we DO NOT add any birth key to updatePatch, so the
  // write is byte-identical to before. The app never computes a clash verdict —
  // these fields exist only to hand to a date specialist (RA 10173 purpose
  // limitation). Sensitive data; never read on any public/guest surface.
  const beforeRow = (before ?? null) as Record<string, unknown> | null;
  if (
    // 👥 A based post that did not change the birth data leaves it (and its consent) exactly as stored.
    (!based || formData.has('bazi_birthdata_consent')) &&
    baziBirthDataEnabled() &&
    isChineseWedding({
      ceremony_type: (beforeRow?.ceremony_type as string | null) ?? null,
      secondary_ceremony_type: (beforeRow?.secondary_ceremony_type as string | null) ?? null,
    })
  ) {
    const consent = formData.get('bazi_birthdata_consent') === '1';
    if (consent) {
      // Parse + validate each field; '' clears that field. Reject malformed
      // values rather than writing garbage. Date = YYYY-MM-DD, time = HH:MM.
      const parseDate = (key: string): string | null | typeof INVALID => {
        const raw = formData.get(key);
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s === '') return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return INVALID;
        // Parse in UTC and round-trip: JS Date rolls impossible days over
        // (2020-02-30 → Mar 1) instead of NaN-ing, so a NaN check alone lets
        // them through to Postgres as a generic db_error. Comparing the
        // reconstructed YYYY-MM-DD (UTC, since the input is date-only) back to
        // the input rejects 2020-02-30 / 2021-04-31 here with a friendly message.
        const d = new Date(`${s}T00:00:00Z`);
        if (Number.isNaN(d.getTime())) return INVALID;
        if (d.toISOString().slice(0, 10) !== s) return INVALID;
        // Reasonable adult-birth bounds: not in the future, not absurdly old.
        const year = Number(s.slice(0, 4));
        if (year < 1900 || d.getTime() > Date.now()) return INVALID;
        return s;
      };
      const parseTime = (key: string): string | null | typeof INVALID => {
        const raw = formData.get(key);
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s === '') return null;
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return INVALID;
        return s;
      };

      const pAD = parseDate('partner_a_birth_date');
      const pAT = parseTime('partner_a_birth_time');
      const pBD = parseDate('partner_b_birth_date');
      const pBT = parseTime('partner_b_birth_time');
      if (pAD === INVALID || pAT === INVALID || pBD === INVALID || pBT === INVALID) {
        return { ok: false, code: 'invalid_input', message: 'Enter a valid birth date and time' };
      }

      updatePatch.partner_a_birth_date = pAD;
      updatePatch.partner_a_birth_time = pAT;
      updatePatch.partner_b_birth_date = pBD;
      updatePatch.partner_b_birth_time = pBT;
      // Stamp a FRESH consent receipt on every consented write — never write the
      // birth fields without one (RA 10173). now() server-side.
      updatePatch.bazi_birthdata_consent_at = new Date().toISOString();
    } else {
      // Consent withdrawn (box unticked) — purge any previously-stored birth
      // data and clear the consent receipt. Right-to-erasure on opt-out.
      updatePatch.partner_a_birth_date = null;
      updatePatch.partner_a_birth_time = null;
      updatePatch.partner_b_birth_date = null;
      updatePatch.partner_b_birth_time = null;
      updatePatch.bazi_birthdata_consent_at = null;
    }
  }

  // 👥 A based save that changed nothing writes nothing (and logs nothing) — the page is already what is stored.
  if (based && Object.keys(updatePatch).length === 0) return { ok: true };

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
    .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
    .maybeSingle();
  return !!modRow;
}

type GovernedFieldResult =
  | { ok: true }
  | { ok: false; code: 'invalid_input' | 'unauthorized' | 'db_error'; message: string };

// events.venue_setting CHECK (latest: migration 20271197508087) — the only
// RECEPTION values the DB accepts for a wedding. The editor offers exactly
// these; the richer VENUE_LABEL keys (hotel_ballroom, etc.) are display-only
// legacy and would violate the CHECK on write.
//
// `civil_registrar` was removed 2026-09-03: it is a CEREMONY venue and now
// lives in ALLOWED_CEREMONY_VENUE_SETTINGS below.
const ALLOWED_VENUE_SETTINGS = [
  'banquet_hall',
  'events_place',
  'restaurant',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
] as const;
type AllowedVenueSetting = (typeof ALLOWED_VENUE_SETTINGS)[number];

// events.ceremony_venue_setting CHECK (migration 20271197508087) — where the
// couple MARRIES, complementing events.ceremony_type (the RITE).
//
// The empty string is accepted by the action below and stored as NULL: unlike
// venue_setting, this column is nullable on purpose, so "I haven't decided"
// is a state a couple can actually return to.
const ALLOWED_CEREMONY_VENUE_SETTINGS = [
  'church',
  'chapel',
  'mosque',
  'temple',
  'civil_registrar',
  'garden',
  'beach',
  'ancestral_house',
  'hotel_venue',
] as const;
type AllowedCeremonyVenueSetting = (typeof ALLOWED_CEREMONY_VENUE_SETTINGS)[number];

export async function updateVenueSetting(formData: FormData): Promise<GovernedFieldResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
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

/**
 * The CEREMONY venue — where the couple marries.
 *
 * Copied from `updateVenueSetting` above, deliberately and almost line for
 * line: same host gate, same admin write, same audit row, same revalidations.
 * The two fields sit side by side on the same card and behave identically, and
 * a second idiom for the same interaction is how they drift apart.
 *
 * THE ONE REAL DIFFERENCE: an empty submission is VALID and clears the field to
 * NULL. `venue_setting` cannot do that (events_wedding_fields_consistency
 * requires it on every wedding row), which is exactly why "banquet_hall" and
 * "never said" became the same bytes over there. Here a couple who has not
 * decided — or who wants to un-decide — has a state to be in.
 *
 * No vendor-confirmed hard gate, matching venue + guest count: the conflict
 * preview is the soft warning and this editor only renders when no vendor is
 * confirmed.
 */
export async function updateCeremonyVenueSetting(
  formData: FormData,
): Promise<GovernedFieldResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  const venueRaw = formData.get('ceremony_venue_setting');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  if (typeof venueRaw !== 'string') {
    return { ok: false, code: 'invalid_input', message: 'Invalid ceremony venue' };
  }
  const trimmed = venueRaw.trim();
  if (
    trimmed !== '' &&
    !ALLOWED_CEREMONY_VENUE_SETTINGS.includes(trimmed as AllowedCeremonyVenueSetting)
  ) {
    return { ok: false, code: 'invalid_input', message: 'Invalid ceremony venue' };
  }
  const ceremony_venue_setting: string | null = trimmed === '' ? null : trimmed;

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
    .select('ceremony_venue_setting')
    .eq('event_id', eventId)
    .maybeSingle();
  const { error } = await admin
    .from('events')
    .update({ ceremony_venue_setting })
    .eq('event_id', eventId);
  if (error) return { ok: false, code: 'db_error', message: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'ceremony_venue_setting_updated',
    target_table: 'events',
    target_id: eventId,
    before_json: before ?? null,
    after_json: { ceremony_venue_setting },
    actor_user_id: user.id,
  });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/details`, 'layout');
  return { ok: true };
}

export async function updateGuestCount(formData: FormData): Promise<GovernedFieldResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
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

/**
 * Adaptive Pax Pricing — couple settings (decisions #5 + #6). Sets the
 * guest-list edit deadline (overrides the default 14-days-before-the-event) and
 * the realtime/final-only pricing-view preference. Both are couple-settable
 * (the finalize LOCK columns guest_count_locked_at/final_pax are NOT — those are
 * guarded to the service-role finalize path). Same host-gate + admin-write +
 * audit pattern as updateGuestCount.
 */
export async function updatePaxSettings(formData: FormData): Promise<GovernedFieldResult> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, code: 'invalid_input', message: 'event_id required' };
  }
  // The two columns are written TOGETHER, so every form posting here carries
  // both (a form that shows one carries the other hidden) — lib/pax-settings-form.ts.
  const parsed = parsePaxSettingsForm(formData);
  if (!parsed.ok) return { ok: false, code: 'invalid_input', message: parsed.message };
  const { deadline, mode } = parsed;

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
    .select('guest_list_edit_deadline, adaptive_pricing_mode')
    .eq('event_id', eventId)
    .maybeSingle();
  /* ⏳ REPLY BY WAITS FOR APPLY IN THE MAKER (owner 2026-10-08, "draft 1-3"): a Maker form
     (`HubDraftField`) puts the DATE into the hub draft — guests' replies close on the live date
     until ✓ Apply (which writes it through the admin client, with this same audit row). The pricing
     view posted beside it is not this ruling's field: it stays live, written only if it changed. */
  if (isHubDraftWrite(formData)) {
    try {
      await saveHubDraftPatch(eventId, { events: { guest_list_edit_deadline: deadline } });
    } catch {
      return { ok: false, code: 'db_error', message: 'Could not save your reply-by date. Please try again.' };
    }
    if (before && (before as { adaptive_pricing_mode?: string | null }).adaptive_pricing_mode !== mode) {
      const { error: modeErr } = await admin.from('events').update({ adaptive_pricing_mode: mode }).eq('event_id', eventId);
      if (modeErr) return { ok: false, code: 'db_error', message: modeErr.message };
    }
    return { ok: true };
  }
  const { error } = await admin
    .from('events')
    .update({ guest_list_edit_deadline: deadline, adaptive_pricing_mode: mode })
    .eq('event_id', eventId);
  if (error) return { ok: false, code: 'db_error', message: error.message };

  await admin.from('admin_audit_log').insert({
    action: 'pax_settings_updated',
    target_table: 'events',
    target_id: eventId,
    before_json: before ?? null,
    after_json: { guest_list_edit_deadline: deadline, adaptive_pricing_mode: mode },
    actor_user_id: user.id,
  });

  /* ⚡ The Maker's RSVP stage saves the date behind the canvas (`maker_quiet`):
     a `revalidatePath` in an action makes its answer carry a whole render of
     the page it was sent from — the Maker (owner 2026-09-30, "no reloads"). The
     two pages below are dynamic and re-read on the next visit anyway. */
  if (formData.get('maker_quiet') !== '1') {
    revalidatePath(`/dashboard/${eventId}/details`, 'layout');
    revalidatePath(`/dashboard/${eventId}/guests`, 'layout');
  }
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
        const guests = Number.isInteger(n) && n > 0 ? `${formatCount(n)} guests` : 'the new guest count';
        conflicts.push({
          ...base,
          reason: `Priced by headcount — may need to re-quote for ${guests}.`,
        });
      }
    }
  }

  return { ok: true, conflicts };
}
