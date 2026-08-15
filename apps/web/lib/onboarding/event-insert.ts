/**
 * Iteration 0053 Phase 3 — the events INSERT row builder for a GENERIC
 * (non-wedding) onboarding commit. Pure + deterministic so it is unit-testable
 * (the safety-critical invariant: every wedding-only CHECK column is NULL/false,
 * which is exactly what `events_wedding_fields_consistency` requires for a
 * non-wedding type — mirrors createWeddingEvent's proven non-wedding branch).
 * Mirrors `commitOnboardingWedding`'s generic onboarding-v2 + style_preferences
 * columns. The wedding commit is NOT touched.
 */
import type { GenericOnboardingPayload } from './types';
import { anchorForType, isAnchorOrigin, resolveCadence } from '../event-anchor';
import { initialLandingVisibility } from './initial-visibility';

export type GenericInsertOpts = {
  slug: string;
  now: string;
  userId: string;
  isAnonymous: boolean;
  /** NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED — guards the experience_* columns so the
   *  insert never references them before migration 20270208703382 is applied. */
  experienceEnabled: boolean;
  /** The `home_activity_signals` data-privacy control (RA 10173). When false,
   *  the per-type SPI signal (signature_details — e.g. a christening honoree's
   *  DOB/gender) is stripped to NULL. Fail-closed: the event is still created. */
  homeSignalsEnabled: boolean;
};

export function buildGenericEventInsert(
  payload: GenericOnboardingPayload,
  opts: GenericInsertOpts,
): Record<string, unknown> {
  const dateMode = payload.dateMode === 'window' ? 'window' : 'specific';
  const candidates = dateMode === 'specific' ? (payload.dateCandidates ?? []).filter(Boolean) : [];
  const windowStart = dateMode === 'window' ? payload.windowStart : null;
  const windowEnd = dateMode === 'window' ? payload.windowEnd : null;
  // Normalize legacy 'nolimit' → DB canonical 'no_limit' (matches the wedding commit).
  const budgetBand = payload.budgetBand === 'nolimit' ? 'no_limit' : payload.budgetBand;

  // Anon couples: outbound inquiry intent is HELD, not fired, until they secure
  // the account (a reply would bounce to the placeholder email). Same shape +
  // replay path as the wedding commit (lib/pending-inquiries.ts).
  const pendingInquiryDispatch =
    opts.isAnonymous && payload.sendTopInquiries
      ? { perCategory: Math.max(1, Math.min(5, Math.round(payload.inquiriesPerCategory ?? 3))) }
      : null;

  return {
    event_type: payload.eventType,
    display_name: payload.displayName,
    // Life-event gate (2026-07-17): the cardinality key. The generic onboarding
    // did not collect this until 2026-07-31, so every gated life event it
    // created was UNLABELED and contended for the same per-type singleton slot.
    honoree_label: payload.honoreeLabel?.trim() || null,
    // …and WHICH alaga that is, when the create step's who question named one
    // (2026-08-01). Until then this column was written by NOTHING — only
    // event-recurrence copied it forward — so the gate's strongest branch could
    // never fire and the cap always keyed on the label STRING, which meant
    // renaming an alaga silently changed which events it capped against.
    //
    // ⚠ This builder is PURE: it writes what it is handed. The ownership check
    // lives in the caller (commitOnboardingEvent → resolveHonoreeDependentId),
    // because verifying it needs a DB read. A new caller of this function MUST
    // resolve the id the same way — passing a raw client value here would write
    // an unowned dependent_id.
    honoree_dependent_id: payload.honoreeDependentId?.trim() || null,
    // Date-anchor model (2026-07-12): per-type default anchor_kind from the
    // authored map. Keeps the generic path consistent with createWeddingEvent.
    anchor_kind: anchorForType(payload.eventType).kind,
    // Date-anchor model — the generic flow did not write these until
    // 2026-07-31, so an anniversary created here landed with no commemorated
    // date and no yearly flag and NEVER appeared on the Year view, with no
    // screen anywhere to fix it afterwards.
    //
    // ⚠ COUNSEL GATE, enforced HERE and not only in the UI: an anchor kind of
    // `person_birthdate` (birthday · debut · christening) must never carry a
    // date, because that date IS a person's birthdate and events do not store
    // those. A future screen that starts asking cannot leak through this path.
    anchor_date:
      anchorForType(payload.eventType).kind === 'person_birthdate'
        ? null
        : (payload.anchorDate || null),
    // Positive origins only — mirrors the DB CHECK. An unrecognized value is
    // dropped rather than passed through to fail the insert.
    anchor_origin: isAnchorOrigin(payload.anchorOrigin) ? payload.anchorOrigin : null,
    recurs: payload.recurs === true,
    // The cadence beside the switch. `resolveCadence` is the ONE decider — the
    // create path and the edit path call the same function, which is what stops
    // the three-way disagreement that left birthdays invisible on the Year view.
    recur_cadence: resolveCadence(payload.eventType, payload.recurCadence ?? payload.recurs),
    event_date: null,
    venue_name: null,
    venue_address: null,
    slug: opts.slug,
    // Visible by link from the moment it exists — unless this is still an
    // anonymous draft, which stays private until the account is secured.
    // See initial-visibility.ts: the RLS anon-publish guard does NOT fire on
    // this path, because the insert runs as service-role.
    landing_page_visibility: initialLandingVisibility({ isAnonymous: opts.isAnonymous }),
    is_primary: true,
    // -- Wedding-only CHECK columns: NULL/false by construction for a non-wedding
    //    type. events_wedding_fields_consistency (migration 20260521080000)
    //    requires these populated IFF event_type='wedding', NULL otherwise.
    ceremony_type: null,
    venue_setting: null,
    ceremony_sub_type: null,
    is_mixed_ceremony: false,
    secondary_ceremony_type: null,
    ceremony_type_locked_at: null,
    ceremony_type_locked_by: null,
    // Generic events carry no bride/groom identity.
    bride_name: null,
    groom_name: null,
    // -- onboarding-v2 columns (migration 20260719000000 · nullable, not wedding-gated) --
    region: payload.region,
    venue_latitude: payload.venueLatitude,
    venue_longitude: payload.venueLongitude,
    date_mode: dateMode,
    date_candidates: candidates.length ? candidates : null,
    date_window_start: windowStart,
    date_window_end: windowEnd,
    budget_band: budgetBand,
    estimated_budget_centavos:
      typeof payload.budgetAmountCentavos === 'number' ? payload.budgetAmountCentavos : null,
    monogram_frame_key: null,
    monogram_font_key: null,
    monogram_style: null,
    mood_feel_key: payload.moodFeelKey,
    music_playlist_seed: null,
    estimated_pax: typeof payload.pax === 'number' ? payload.pax : null,
    // A generic event has no "Our Love Story" (PR1) — empty/NULL, never wedding-shaped.
    love_story: {},
    story_tone: null,
    story_language: null,
    special_message: null,
    together_since: null,
    // Per-type signature answers (the generalised love_story). NULL when nothing
    // was captured, so the Brief's specialty richness gate reads "not
    // personalised yet" rather than "answered with {}". Gated by the
    // home_activity_signals control — stripped to NULL when it isn't Active.
    signature_details:
      opts.homeSignalsEnabled &&
      payload.signatureDetails &&
      Object.keys(payload.signatureDetails).length > 0
        ? payload.signatureDetails
        : null,
    // Experience-persona intent — flag-guarded (absent before the migration lands).
    ...(opts.experienceEnabled
      ? {
          experience_persona: payload.experiencePersona,
          experience_for_whom: payload.experienceForWhom,
          experience_axes: payload.experienceAxes ?? {},
        }
      : {}),
    // Display blob for the dashboard "Personalized for you" card (migration
    // 20260724000000) — NOT vendor matching.
    style_preferences: {
      guidance_opt_in: payload.guidanceOptIn ?? true,
      interested_services: payload.interestedServices ?? [],
      search_areas: payload.places ?? [],
      interested_categories: payload.picks ?? [],
      basic_moodboard: payload.basicMoodboard ?? null,
      refinements: payload.refinements ?? {},
      ...(pendingInquiryDispatch ? { pending_inquiry_dispatch: pendingInquiryDispatch } : {}),
    },
  };
}
