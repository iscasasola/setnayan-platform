'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { ALLOWED_CEREMONY_VALUES } from '@/lib/faith-registry';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { resolveProfile } from '@/lib/event-type-profile';
import { safeNext } from '@/lib/auth';
import { getBudgetBands } from '@/lib/budget-bands';
import { resolveCreateCapture } from '@/lib/create-event-capture';
import { anchorForType, isAnchorOrigin, parseISO, canToggleRecur } from '@/lib/event-anchor';
import {
  buildNextYearClonePayload,
  canPlanNextYear,
  type SourceEventForClone,
} from '@/lib/event-recurrence';
import { isGatedLifeType } from '@/lib/life-event-gate';
import { hasInPlanningWeddingForUser } from './wedding-guard';
import { getBlockingLifeEvent } from './life-event-guard';
import { resolvePick } from '@/app/onboarding/wedding/_data/wedding-cities';

/* Retired 2026-05-28 V2 cutover */
// V1 imported startConciergeTrial + CONCIERGE_ENABLED here to route
// "trial" / "paid" choices from the create-event picker into the
// Concierge SKU flow. V2 retires the trial mechanic entirely and
// prices Setnayan AI separately from /pricing — every new event
// lands in DIY by default. Imports removed.

// DB-driven roster (2026-06-13 cutover) — the hardcoded ALLOWED_TYPES array
// is gone. A submitted event_type is accepted iff the `event_type_vocab` row
// is status='active' AND enabled=TRUE (the same set getCreatableEventTypes()
// renders in the picker). Retired or not-yet-launched types are rejected at
// creation time; the DB-side FK on events.event_type is the backstop.
// Non-wedding types still skip the wedding-only ceremony fields via the
// isWedding branch below (events_wedding_fields_consistency CHECK).

/* Retired 2026-05-28 V2 cutover */
// V1 had a DIY / Trial / Paid choice card at the bottom of create-event.
// V2 has no trial mechanic; the hidden form field is retained for cutover-
// period continuity but only accepts 'diy' from this surface. Old enum
// values 'trial' and 'paid' kept in ALLOWED_CONCIERGE_CHOICES so a stale
// browser tab posting the V1 form payload still validates — the choice
// gets coerced to 'diy' downstream regardless.
const ALLOWED_CONCIERGE_CHOICES = ['diy', 'trial', 'paid'] as const;
type ConciergeChoice = (typeof ALLOWED_CONCIERGE_CHOICES)[number];

// Iteration 0043 — wedding-type picker. Ceremonies the create-event form may
// submit — derived from lib/faith-registry (the single faith source,
// 2026-06-12: every registry faith + civil + mixed). The picker is
// data-driven by wedding_type_launch_status (it only shows 'active' faiths
// as selectable and routes coming-soon interest to
// couple_wedding_type_notify_signups via notifyWhenWeddingTypeLaunches), so
// this server list is the belt to that suspender: it accepts any faith the
// owner COULD flip live, and the events CHECK (widened by migration
// 20261120000000) accepts the same set. muslim/cultural tradition sub-type
// is collected + validated by this form already.
const ALLOWED_CEREMONIES = ALLOWED_CEREMONY_VALUES;
const ALLOWED_VENUES = [
  'banquet_hall',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
  'civil_registrar',
] as const;
// Secondary (mixed-wedding) pick — derived from lib/faith-registry like the
// primary list above: any registry faith or civil, never 'mixed'. Without this
// a newly-flipped faith (e.g. Hindu) would commit fine as the PRIMARY ceremony
// but be rejected as the SECONDARY half of a mixed wedding.
const ALLOWED_SECONDARY = ALLOWED_CEREMONY_VALUES.filter((v) => v !== 'mixed');
const ALLOWED_MUSLIM_SUB = [
  'maranao',
  'tausug',
  'maguindanao',
  'sama_bajau',
  'yakan',
  'general_muslim',
] as const;
const ALLOWED_CULTURAL_SUB = [
  'igorot_cordillera',
  'manobo',
  'visayan_folk',
  'tagalog_folk',
  'kapampangan_folk',
  'other',
] as const;

export async function createWeddingEvent(formData: FormData) {
  const display_name = String(formData.get('display_name') ?? '').trim();
  const event_type = String(formData.get('event_type') ?? 'wedding');
  // Optional return path (e.g. the vendor-invite claim flow sends the couple
  // here to create their first event, then back to finish shortlisting the
  // vendor). safeNext() rejects anything that isn't an internal path, so the
  // default dashboard redirect is unchanged when `next` is absent/unsafe.
  const next = safeNext(formData.get('next'));
  const concierge_choice = String(formData.get('concierge_choice') ?? 'diy') as ConciergeChoice;

  // Validate event_type up front so we know whether to read the wedding-
  // type picker fields at all. The DB CHECK constraint
  // `events_wedding_fields_consistency` (migration 20260521080000) enforces
  // that ceremony_type + venue_setting are populated iff event_type='wedding';
  // for non-wedding event_types we must write NULL into all five wedding
  // fields or the insert will fail.
  if (!display_name) {
    return redirect('/dashboard/create-event?error=missing_name');
  }
  const creatable = await getCreatableEventTypes();
  if (!creatable.some((t) => t.key === event_type)) {
    return redirect('/dashboard/create-event?error=invalid_type');
  }
  const isWedding = event_type === 'wedding';

  // Date-anchor model — anniversary capture (PR-A · 2026-07-12). An anniversary
  // is any yearly memorable date: read the celebrated date + typed origin from
  // the form (both optional — the couple can add them later). recurs=true by
  // definition. anchor_date drives the annual reminder (couples_with_anniversary_
  // today reads it) and the Year view's derived next occurrence. anchor_origin is
  // CHECK-constrained to POSITIVE origins only (no memorial — babang-luksa stays
  // out). event_date stays NULL: the anchor is the commemorated date, the "next
  // occurrence" is derived, never a fixed forward event_date.
  const isAnniversary = event_type === 'anniversary';
  const rawAnnivDate = String(formData.get('anniversary_date') ?? '').trim();
  const rawAnnivOrigin = String(formData.get('anniversary_origin') ?? '').trim();
  const anniversaryDate = isAnniversary && parseISO(rawAnnivDate) ? rawAnnivDate : null;
  const anniversaryOrigin = isAnniversary && isAnchorOrigin(rawAnnivOrigin) ? rawAnnivOrigin : null;

  // Date-anchor model (PR-E): the "yearly?" toggle. Anniversary recurs by nature;
  // recur-eligible types (travel/corporate/gala/celebration/reunion/tournament)
  // set recurs from the checkbox. Everything else is one-time.
  const recurs =
    isAnniversary ||
    (canToggleRecur(event_type) && String(formData.get('recurs') ?? '') === 'on');

  // Iteration 0043 + Task #44 (2026-05-22) — picker fields. Read raw values
  // from the form only when the event_type is wedding; non-wedding
  // event_types (debut, future gender_reveal etc.) never render the picker
  // and we write NULL.
  //
  // Task #44 lock: ceremony_type is REQUIRED for weddings. The previous
  // silent-default-to-'catholic' behavior caused new events to land with
  // ceremony_type effectively unset from the host's perspective and forced
  // them to confirm via the dashboard chip CTA afterward. We now reject
  // empty submissions explicitly.
  const raw_ceremony = String(formData.get('ceremony_type') ?? '').trim();
  const raw_venue = String(formData.get('venue_setting') ?? 'banquet_hall');
  const raw_sub_type = String(formData.get('ceremony_sub_type') ?? '').trim();
  const raw_is_mixed = String(formData.get('is_mixed_ceremony') ?? 'false') === 'true';
  const raw_secondary = String(formData.get('secondary_ceremony_type') ?? '').trim();

  if (isWedding && !raw_ceremony) {
    return redirect('/dashboard/create-event?error=missing_ceremony_type');
  }
  if (isWedding && !(ALLOWED_CEREMONIES as readonly string[]).includes(raw_ceremony)) {
    // Picker only emits keys from ALLOWED_CEREMONIES for active faiths.
    // A non-empty value that isn't in the list means either a bad submission
    // (hand-crafted form) or someone managed to submit a Coming Soon faith —
    // either way we send them back with the same error rather than silently
    // coercing to 'catholic'.
    return redirect('/dashboard/create-event?error=missing_ceremony_type');
  }

  const ceremony_type: string | null = isWedding ? raw_ceremony : null;
  const venue_setting: string | null = isWedding
    ? ((ALLOWED_VENUES as readonly string[]).includes(raw_venue) ? raw_venue : 'banquet_hall')
    : null;
  // Sub-type only persisted (and required) for muslim/cultural weddings.
  // Since the picker blocks those today, ceremony_sub_type stays null in
  // V1.1 but the validation is in place for V1.2+ activation.
  const ceremony_sub_type: string | null = !isWedding
    ? null
    : ceremony_type === 'muslim'
      ? ((ALLOWED_MUSLIM_SUB as readonly string[]).includes(raw_sub_type) ? raw_sub_type : null)
      : ceremony_type === 'cultural'
        ? ((ALLOWED_CULTURAL_SUB as readonly string[]).includes(raw_sub_type) ? raw_sub_type : null)
        : null;
  const is_mixed_ceremony = isWedding && ceremony_type === 'mixed' && raw_is_mixed;
  const secondary_ceremony_type: string | null = is_mixed_ceremony
    && (ALLOWED_SECONDARY as readonly string[]).includes(raw_secondary)
    ? raw_secondary
    : null;

  // Conditional integrity guards — mirror the DB CHECK constraints so the
  // user sees a friendly error rather than a Postgres failure string. Only
  // run for wedding event_types; non-wedding event_types never carry these
  // wedding-specific fields (they're NULL by construction above).
  if (isWedding && (ceremony_type === 'muslim' || ceremony_type === 'cultural') && !ceremony_sub_type) {
    return redirect('/dashboard/create-event?error=missing_sub_type');
  }
  if (is_mixed_ceremony && !secondary_ceremony_type) {
    return redirect('/dashboard/create-event?error=missing_secondary');
  }
  /* Retired 2026-05-28 V2 cutover */
  // V1 routed 'trial' / 'paid' choices into Concierge SKU flows here. V2
  // has no trial mechanic and prices Setnayan AI separately from
  // /pricing. Every new event lands in DIY; the hidden form field is
  // still parsed for cutover-period continuity but coerced to 'diy' so
  // the post-create redirect always lands on the dashboard.
  void ALLOWED_CONCIERGE_CHOICES; // suppress unused-var warning
  void concierge_choice;          // suppress unused-var warning
  const choice: ConciergeChoice = 'diy';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  // Wedding cardinality — authoritative gate (owner-locked 2026-07-12; flow-check
  // reconciled). One wedding IN PLANNING at a time. A SETTLED wedding (archived,
  // or completed = event_date passed) does NOT block — so a widow/annulled/
  // remarrying user can create a new wedding without archiving their past one.
  // The picker shows the guided router; this is the real (UI-bypass-proof) gate.
  if (isWedding && (await hasInPlanningWeddingForUser(supabase, user.id))) {
    return redirect('/dashboard/create-event?error=wedding_exists');
  }

  // Life-event cardinality — the wedding guard generalized (council verdict
  // 2026-07-17 § 2, owner "build it now"). ONE life event IN PLANNING per
  // (account × type × honoree). "Para kanino?" is the OPTIONAL honoree first
  // name; unlabeled events contend for the per-type singleton slot, and typing
  // a different celebrant's name opens a new slot. Lifestyle types (travel,
  // corporate, anniversary, …) pass through untouched — zero rules, unlimited.
  const honoree_label_raw = String(formData.get('honoree_label') ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const honoree_label =
    isGatedLifeType(event_type) && honoree_label_raw ? honoree_label_raw : null;
  if (!isWedding && isGatedLifeType(event_type)) {
    const blocking = await getBlockingLifeEvent(supabase, user.id, {
      eventType: event_type,
      honoreeLabel: honoree_label,
    });
    if (blocking) {
      return redirect(
        `/dashboard/create-event?error=life_event_exists&existing=${encodeURIComponent(blocking.eventId)}&event_type=${encodeURIComponent(event_type)}`,
      );
    }
  }

  // Owner 2026-07-12: the iteration-0000 §2.5 "single-field, name-only" lock is
  // RELAXED for the non-wedding inline path — the couple can optionally seed a
  // date + guest count + budget at creation, which lights up the checklist's
  // date-anchored deadlines + budget-health and enriches the Event Brief. All
  // three are OPTIONAL (name-only creation still works). Weddings keep the
  // wizard's candidate/window date model, so capture stays empty for them.
  const capture = isWedding
    ? resolveCreateCapture({}, [])
    : resolveCreateCapture(
        {
          dateModeRaw: formData.get('date_mode'),
          dateCandidatesRaw: formData.getAll('date_candidate'),
          windowStartRaw: formData.get('date_window_start'),
          windowEndRaw: formData.get('date_window_end'),
          paxRaw: formData.get('estimated_pax'),
          budgetBandRaw: formData.get('budget_band'),
          locationAreasRaw: formData.getAll('location_area'),
        },
        await getBudgetBands(),
        { today: new Date().toISOString().slice(0, 10), resolveArea: resolvePick },
      );

  // Both writes go through the admin client because the user-scoped JWT can
  // be stale or the role can resolve to anon at the edge — RLS would then
  // reject the insert even though the action already authenticated the user.
  const admin = createAdminClient();

  // Samahan context (plan §7 · PR-3) — a community-owned event. UI-bypass-
  // proof re-verification (the hidden field can be forged):
  //   (a) the event type's class must be community_eligible — a Samahan can
  //       NEVER own a personal milestone (wedding is 'personal', so wedding +
  //       samahan can't combine by construction); the DB CHECK
  //       events_community_class_consistency is the final backstop.
  //   (b) the caller must be an ORGANIZER of that community, checked via the
  //       admin client (same stale-JWT posture as the writes below), and the
  //       community must be live (not archived).
  const community_id_raw = String(formData.get('community_id') ?? '').trim();
  let community_id: string | null = null;
  if (community_id_raw) {
    const profile = await resolveProfile(event_type);
    if (profile.eventClass !== 'community_eligible') {
      return redirect('/dashboard/create-event?error=samahan_invalid_type');
    }
    const [{ data: membership }, { data: communityRow }] = await Promise.all([
      admin
        .from('community_members')
        .select('role')
        .eq('community_id', community_id_raw)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('communities')
        .select('archived')
        .eq('community_id', community_id_raw)
        .maybeSingle(),
    ]);
    const isLive = (communityRow as { archived?: boolean } | null)?.archived === false;
    const isOrganizer =
      (membership as { role?: string } | null)?.role === 'organizer';
    if (!isLive || !isOrganizer) {
      return redirect('/dashboard/create-event?error=samahan_not_organizer');
    }
    community_id = community_id_raw;
  }

  const slug = await generateUniqueSlug(admin, display_name);

  // Insert the event. The on_event_created trigger mints the join token row.
  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert({
      event_type,
      display_name,
      // Samahan (PR-3): the owning community for community-class events.
      // NULL = personal event (default, unchanged). Validated above; the
      // events_community_class_consistency CHECK is the DB backstop.
      community_id,
      // Date-anchor model (2026-07-12): stamp the per-type default anchor_kind
      // from the authored map (lib/event-anchor.ts). anchor_date/anchor_origin/
      // recurs are captured later by the per-type creation flow (PR-A onward);
      // wedding lands 'none' (it PRODUCES a union date — its own date is an
      // output of venue discovery, never asked here).
      anchor_kind: anchorForType(event_type).kind,
      // Life-event gate (2026-07-17): the optional honoree first name — the
      // cardinality key for life types (NULL for lifestyle types and unlabeled
      // creations). Ordinary PI; never rendered on public/vendor/guest surfaces.
      honoree_label,
      // Anniversary capture (PR-A): the commemorated date + typed origin, and
      // recurs=true (anniversaries return every year). NULL for every other type.
      anchor_date: anniversaryDate,
      anchor_origin: anniversaryOrigin,
      recurs,
      // Optional non-wedding capture (all null for weddings + name-only creation).
      // event_date stays NULL — the LOCKED single date is chosen later (date-as-
      // output; the date-selection lock ceremony). What's captured here is the
      // couple's tentative timing: up to 4 candidate dates OR a range.
      event_date: null,
      date_mode: capture.dateMode,
      date_candidates: capture.dateCandidates.length ? capture.dateCandidates : null,
      date_window_start: capture.dateWindowStart,
      date_window_end: capture.dateWindowEnd,
      estimated_pax: capture.estimatedPax,
      budget_band: capture.budgetBand,
      estimated_budget_centavos: capture.estimatedBudgetCentavos,
      // Location — up to 2 candidate areas (owner 2026-07-12: "location can be in
      // 2 places"): primary → region + venue centroid, all → search_areas.
      // Matches the wedding onboarding's screen-6 model.
      region: capture.region,
      venue_latitude: capture.venueLatitude,
      venue_longitude: capture.venueLongitude,
      ...(capture.searchAreas.length
        ? { style_preferences: { search_areas: capture.searchAreas } }
        : {}),
      venue_name: null,
      venue_address: null,
      slug,
      is_primary: true,
      // Iteration 0043 — wedding-type picker columns. Defaults applied above
      // so a row always lands in a valid state per the events_*_check
      // constraints.
      ceremony_type,
      venue_setting,
      ceremony_sub_type,
      is_mixed_ceremony,
      secondary_ceremony_type,
      // Per CLAUDE.md 2026-05-22 owner directive ("select wedding type
      // is still not showing the initial wedding type"): stamp
      // ceremony_type_locked_at at create-time for weddings.
      //
      // Task #44 (2026-05-22) made ceremony_type a REQUIRED affirmative
      // pick at event creation — the previous silent 'catholic' default
      // is gone. Once the pick is affirmative, the original Task #38
      // rationale for NOT stamping locked_at (the picker was implicitly
      // defaulting and we wanted the dashboard chip to surface the CTA
      // for explicit confirmation) no longer applies.
      //
      // Without this stamp, EventMetaLine's check
      //   ceremonyConfirmed = Boolean(ceremony_type_locked_at) && Boolean(ceremony_type)
      // returns false even though the host picked Catholic at create-time,
      // so event home renders the "Set wedding type" CTA right after a
      // fresh event creation — confusing UX exactly matching the owner
      // bug report.
      //
      // For non-wedding event_types ceremony_type is NULL so we leave
      // locked_at NULL too (the columns travel together by construction).
      ceremony_type_locked_at: isWedding ? new Date().toISOString() : null,
      ceremony_type_locked_by: isWedding ? user.id : null,
      //
      // Task #39 (2026-05-22) — event_date_precision defaults to 'year'
      // via the column default (migration 20260603100000). We intentionally
      // DO NOT set it explicitly here so the DB default applies.
    })
    .select('event_id, slug')
    .single();

  if (insertError || !insertedEvent) {
    return redirect(
      `/dashboard/create-event?error=${encodeURIComponent(insertError?.message ?? 'unknown')}`,
    );
  }

  // Add the creating user as a couple member.
  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple',
    joined_via: 'created_event',
  });

  if (memberError) {
    return redirect(
      `/dashboard/create-event?error=${encodeURIComponent('member_link_failed: ' + memberError.message)}`,
    );
  }

  // Funnel event. Fire-and-forget; never block the redirect to the new
  // event dashboard.
  try {
    await captureEvent({
      distinctId: user.id,
      event: 'event_created',
      properties: {
        event_id: insertedEvent.event_id,
        event_type,
        concierge_choice: choice,
        ceremony_type,
        venue_setting,
        is_mixed_ceremony,
      },
    });
  } catch {
    // analytics never breaks the user-facing flow.
  }

  /* Retired 2026-05-28 V2 cutover */
  // V1 had two extra redirect branches here: 'trial' invoked
  // startConciergeTrial server-side and routed to the dashboard with a
  // banner; 'paid' redirected to Concierge order checkout. V2 lands
  // every new event on the standard dashboard regardless of intent
  // — hosts upgrade to Setnayan AI later from /pricing if they want
  // the daily planner.
  void choice; // suppress unused-var warning

  // Honor an internal return path when one was passed (vendor-invite claim
  // loop). Otherwise land on the freshly-created event's dashboard as before.
  if (next !== '/') {
    return redirect(next);
  }
  return redirect(`/dashboard/${insertedEvent.event_id}`);
}

/**
 * "Plan next year" — clone a recurring event forward (owner-locked 2026-07-12,
 * scope "Details, not the guest list"). Creates next year's fresh planning
 * instance from last year's: identity + captured details + the recurring anchor
 * carry forward (buildNextYearClonePayload); the guest list, schedule, payments,
 * venue, and date start fresh. Mirrors createWeddingEvent's write path exactly —
 * unique slug + admin insert + event_members couple row + on_event_created
 * trigger — so all the CHECK constraints and is_primary behave identically.
 *
 * Access is RLS-gated: the source SELECT runs on the user-scoped client, so a
 * non-member reads NULL and is bounced. Only recurrence-capable, non-wedding
 * types are eligible (canPlanNextYear).
 */
export async function planNextYearEvent(formData: FormData) {
  const sourceIdRaw = formData.get('event_id');
  if (typeof sourceIdRaw !== 'string' || sourceIdRaw.length === 0) {
    return redirect('/dashboard');
  }
  const sourceId = sourceIdRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // RLS-gated read = the membership gate: a non-member reads NULL here.
  const { data: source } = await supabase
    .from('events')
    .select(
      'event_type, display_name, honoree_label, honoree_dependent_id, signature_details, anchor_kind, anchor_date, anchor_origin, estimated_pax, budget_band, estimated_budget_centavos, region, venue_latitude, venue_longitude, style_preferences',
    )
    .eq('event_id', sourceId)
    .maybeSingle();
  if (!source) return redirect('/dashboard');

  if (!canPlanNextYear(source.event_type as string | null)) {
    // Not a recurring-capable event — nothing to clone; back to the event.
    return redirect(`/dashboard/${sourceId}`);
  }

  // Life-event cardinality (council 2026-07-17, PR #3373): the clone is an
  // events insert like any other, so gated life types (birthday, among the
  // recurrence-capable set) contend for the same ONE-in-planning-per
  // (account × type × honoree) slot. Once this year's party date passes the
  // slot frees and "Plan next year" goes through; while it's still in
  // planning the existing-event surface explains the block. Lifestyle types
  // (anniversary, reunion, corporate) return null here — zero rules.
  const blocking = await getBlockingLifeEvent(supabase, user.id, {
    eventType: source.event_type as string,
    honoreeLabel: (source.honoree_label as string | null) ?? null,
    honoreeDependentId: (source.honoree_dependent_id as string | null) ?? null,
  });
  if (blocking) {
    return redirect(
      `/dashboard/create-event?error=life_event_exists&existing=${encodeURIComponent(blocking.eventId)}&event_type=${encodeURIComponent(source.event_type as string)}`,
    );
  }

  const admin = createAdminClient();
  const displayName = (source.display_name as string | null) ?? 'My Event';
  const slug = await generateUniqueSlug(admin, displayName);

  const { data: inserted, error: insertError } = await admin
    .from('events')
    .insert({
      ...buildNextYearClonePayload(source as SourceEventForClone),
      slug,
      is_primary: true,
      // Non-wedding by construction → the ceremony-lock columns travel as NULL.
      ceremony_type_locked_at: null,
      ceremony_type_locked_by: null,
    })
    .select('event_id')
    .single();

  if (insertError || !inserted) {
    return redirect(
      `/dashboard/${sourceId}?error=${encodeURIComponent('plan_next_year_failed: ' + (insertError?.message ?? 'unknown'))}`,
    );
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: inserted.event_id,
    user_id: user.id,
    member_type: 'couple',
    joined_via: 'created_event',
  });
  if (memberError) {
    return redirect(
      `/dashboard/${sourceId}?error=${encodeURIComponent('member_link_failed: ' + memberError.message)}`,
    );
  }

  try {
    await captureEvent({
      distinctId: user.id,
      event: 'event_created',
      properties: {
        event_id: inserted.event_id,
        event_type: source.event_type,
        via: 'plan_next_year',
      },
    });
  } catch {
    // analytics never breaks the user-facing flow.
  }

  return redirect(`/dashboard/${inserted.event_id}`);
}

// Iteration 0043 — email capture for "Coming Soon" ceremony types. Returns a
// plain { ok } object instead of redirecting because the picker calls this
// from a client component over fetch and uses the result to flip the inline
// UI between "submitting → sent → error" states without leaving the form.
const NOTIFY_FAITHS = ['catholic', 'civil', 'inc', 'christian', 'muslim', 'cultural', 'chinese', 'jewish', 'born_again'] as const;

export async function notifyWhenWeddingTypeLaunches(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  const ceremony = String(formData.get('ceremony_type_interested') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'invalid_email' };
  }
  if (!(NOTIFY_FAITHS as readonly string[]).includes(ceremony)) {
    return { ok: false, reason: 'invalid_ceremony' };
  }

  // user_id is optional — the form works pre-account. When the caller IS
  // signed in we attribute the signup so admins can correlate later.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('couple_wedding_type_notify_signups').insert({
    user_id: user?.id ?? null,
    email,
    ceremony_type_interested: ceremony,
    region,
  });

  if (error) {
    console.error('[create-event] notify signup failed:', error);
    return { ok: false, reason: error.message };
  }

  // Funnel signal — recruitment uses this to prioritize vendor sourcing by
  // faith × region demand. Fire-and-forget per the existing pattern.
  try {
    await captureEvent({
      distinctId: user?.id ?? email,
      event: 'wedding_type_notify_signup',
      properties: { ceremony_type: ceremony, region: region ?? undefined },
    });
  } catch {
    // analytics never breaks user-facing flow
  }

  return { ok: true };
}
