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
import { anchorForType } from '../event-anchor';

export type GenericInsertOpts = {
  slug: string;
  now: string;
  userId: string;
  isAnonymous: boolean;
  /** NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED — guards the experience_* columns so the
   *  insert never references them before migration 20270208703382 is applied. */
  experienceEnabled: boolean;
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
    // Date-anchor model (2026-07-12): per-type default anchor_kind from the
    // authored map. Keeps the generic path consistent with createWeddingEvent.
    anchor_kind: anchorForType(payload.eventType).kind,
    event_date: null,
    venue_name: null,
    venue_address: null,
    slug: opts.slug,
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
