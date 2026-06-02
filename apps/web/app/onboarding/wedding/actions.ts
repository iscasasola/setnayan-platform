'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { unlockCategoryWithInquiry } from '@/app/dashboard/[eventId]/vendors/_actions/unlock-category';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';

/**
 * commitOnboardingWedding — the single lazy DB commit for the /onboarding/wedding
 * V2 flow (CLAUDE.md 2026-06-02 Phase 5 cutover row).
 *
 * WHY a NEW action (not reusing createWeddingEvent): the canonical
 * create-event action (dashboard/create-event/actions.ts) reads a posted
 * <form> and can't persist the 12 onboarding-v2 columns added in migration
 * 20260719000000 (bride_name · groom_name · region · date_mode ·
 * date_candidates · date_window_start/end · budget_band · monogram_frame_key ·
 * monogram_font_key · mood_feel_key · music_playlist_seed). This action takes
 * the accumulated client state object and writes events + event_members in one
 * shot — the prototype's "create the event row at the account gate, all data at
 * once" model. It mirrors createWeddingEvent's insert path exactly (same auth
 * gate → admin-client inserts → slug → event_members couple row → captureEvent)
 * so the row lands in a state valid against the events_wedding_fields_consistency
 * CHECK constraint (migration 20260521080000: wedding events must populate
 * ceremony_type + venue_setting).
 *
 * Persists (CLAUDE.md 2026-06-02 Phase A · "all the data will be preserved"):
 *   - the 12 onboarding-v2 columns + estimated_pax + the wedding-type columns;
 *   - venue_setting DERIVED from the couple's first reception "setting" pick
 *     (screen-10) instead of a blind default — so the marketplace reception
 *     filter is right out of the gate;
 *   - the screen-9 picker selections, AUTO-INQUIRED best-fit per category
 *     (owner: "auto-inquire best-fit per category") — each resolved planning
 *     group fires the dashboard unlock-category flow (best-fit pick →
 *     event_vendors 'considering' → follow → chat thread → first inquiry), so
 *     the couple lands on the dashboard with a started shortlist + inbox.
 *
 * Deferred to Phase A2: the screen-10 STYLE prefs (cuisine / ceremony-where /
 * pv-look / dietary) → event_vendor_preferences. That table's canonical_service
 * FK must be verified against canonical_service_schemas before writing, and the
 * table is FOUNDATION-ONLY (unread by matching yet, CLAUDE.md 2026-06-02), so
 * it's low-urgency vs the certain wins above. mood_feel_key + music_playlist_seed
 * already persist as columns.
 */

const ALLOWED_CEREMONIES = ['catholic', 'civil', 'mixed'] as const;
const ALLOWED_SECONDARY = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
] as const;
// Fallback when the couple skipped the reception "setting" pick. The CHECK
// constraint requires a value for wedding events; the couple refines it later.
const DEFAULT_VENUE = 'banquet_hall';

// Reception "setting" pref (screen-10 multi-pick) → events.venue_setting enum.
// The couple's first reception setting seeds venue_setting (which drives the
// marketplace reception filter). No clean enum for events-place / private-
// restaurant → banquet_hall (an indoor function space).
const RECEPTION_TO_VENUE_SETTING: Record<string, string> = {
  setting_ballroom: 'banquet_hall',
  setting_events_place: 'banquet_hall',
  setting_heritage: 'heritage',
  setting_restaurant: 'banquet_hall',
  setting_garden: 'garden',
  setting_beach: 'beach',
  setting_resort: 'destination',
};

// Picker key (53 fine taxonomy services, screen-9) → PLAN_GROUP id (26 planning
// groups). The auto-inquire loop resolves each pick to its group, then fires
// ONE best-fit inquiry per UNIQUE group (the dashboard unlock-category model).
// Picks with no clean planning group are intentionally omitted so a pick never
// fires a wrong-category inquiry — fireworks · outdoor · livestream · editorial ·
// wellness · escort, and the niche booths (coffee/mocktail/dessert/food_cart/
// food_truck/massage_chair/nail_bar/caricature/tarot/perfume_bar/arcade/henna/
// engraving): the Booths folder only has cocktail_booths[=mobile_bar] +
// photobooth as planning groups. The couple adds those from the dashboard
// Unlock-categories page (same limitation, by design).
const PICK_TO_GROUP: Record<string, string> = {
  reception: 'reception_venue',
  ceremony: 'ceremony_venue',
  coordinator: 'coordinator',
  catering: 'catering',
  stations: 'catering',
  cake: 'cake',
  stylist: 'stylist',
  lights_sound: 'lights_sound',
  florist: 'florals_decor',
  dance_floor: 'florals_decor',
  led_wall: 'led_background',
  host_mc: 'host_mc',
  live_band: 'live_band',
  orchestra: 'live_band',
  choir: 'music_entertainment',
  wedding_singer: 'music_entertainment',
  dj: 'music_entertainment',
  performers: 'music_entertainment',
  choreographer: 'dance_instructor',
  photo_video: 'photography',
  bride_attire: 'attire',
  groom_attire: 'attire',
  women_attire: 'attire',
  men_attire: 'attire',
  filipiniana: 'attire',
  grooming: 'hair_makeup',
  hmua: 'hair_makeup',
  jewelry: 'rings',
  photo_booth: 'photobooth',
  mobile_bar: 'cocktail_booths',
  printing: 'invitations_stationery',
  souvenirs: 'invitations_stationery',
  bridal_car: 'bridal_car',
  guest_shuttle: 'guest_shuttle',
};

export type OnboardingCommitPayload = {
  brideName: string;
  groomName: string;
  kind: 'religious' | 'civil' | 'mixed' | null;
  /** faith picks: [primary] for religious, [primary, secondary] for mixed, [] for civil */
  faith: string[];
  region: string | null;
  pax: number | null;
  budgetBand: string | null;
  dateMode: 'specific' | 'window';
  dateCandidates: string[];
  windowStart: string | null;
  windowEnd: string | null;
  monogramFrameKey: string | null;
  monogramFontKey: string | null;
  moodFeelKey: string | null;
  musicPlaylistSeed: string[];
  /** screen-9 picker selections (data-cat keys) — auto-inquired best-fit per resolved group */
  picks: string[];
  /** screen-10 reception "setting" multi-pick — the first one seeds venue_setting */
  receptionSettings: string[];
};

export type OnboardingCommitResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

export async function commitOnboardingWedding(
  payload: OnboardingCommitPayload,
): Promise<OnboardingCommitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  // -- Map onboarding kind/faith → events.ceremony_type / secondary --
  let ceremonyType: string;
  let isMixed = false;
  let secondary: string | null = null;
  if (payload.kind === 'civil') {
    ceremonyType = 'civil';
  } else if (payload.kind === 'mixed') {
    ceremonyType = 'mixed';
    isMixed = true;
    const sec = payload.faith.find((f) =>
      (ALLOWED_SECONDARY as readonly string[]).includes(f),
    );
    secondary = sec ?? null;
  } else {
    // religious — faith[0]; only 'catholic' is an active ceremony_type today
    // (INC/Christian/Muslim/Cultural ship as Coming Soon, not yet selectable
    // as a committed ceremony_type per iteration 0043).
    const primary = payload.faith[0];
    ceremonyType =
      primary && (ALLOWED_CEREMONIES as readonly string[]).includes(primary)
        ? primary
        : 'catholic';
  }

  const displayName =
    [payload.brideName?.trim(), payload.groomName?.trim()]
      .filter(Boolean)
      .join(' & ') || 'Our Wedding';

  const admin = createAdminClient();
  const slug = await generateUniqueSlug(admin, displayName);
  const now = new Date().toISOString();

  // Normalize the onboarding date capture into the v2 columns.
  const dateMode = payload.dateMode === 'window' ? 'window' : 'specific';
  const candidates =
    dateMode === 'specific'
      ? (payload.dateCandidates ?? []).filter(Boolean)
      : [];
  const windowStart = dateMode === 'window' ? payload.windowStart : null;
  const windowEnd = dateMode === 'window' ? payload.windowEnd : null;

  // venue_setting from the couple's first reception "setting" pick (drives the
  // marketplace reception filter); fall back to banquet_hall if none picked.
  const venueSetting =
    (payload.receptionSettings ?? [])
      .map((k) => RECEPTION_TO_VENUE_SETTING[k])
      .find((v): v is string => Boolean(v)) ?? DEFAULT_VENUE;

  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert({
      event_type: 'wedding',
      display_name: displayName,
      event_date: null,
      venue_name: null,
      venue_address: null,
      slug,
      is_primary: true,
      // Iteration 0043 wedding-type columns (CHECK-constraint-required for weddings)
      ceremony_type: ceremonyType,
      venue_setting: venueSetting,
      ceremony_sub_type: null,
      is_mixed_ceremony: isMixed,
      secondary_ceremony_type: secondary,
      ceremony_type_locked_at: now,
      ceremony_type_locked_by: user.id,
      // -- onboarding-v2 columns (migration 20260719000000) --
      bride_name: payload.brideName?.trim() || null,
      groom_name: payload.groomName?.trim() || null,
      region: payload.region,
      date_mode: dateMode,
      date_candidates: candidates.length ? candidates : null,
      date_window_start: windowStart,
      date_window_end: windowEnd,
      budget_band: payload.budgetBand,
      monogram_frame_key: payload.monogramFrameKey,
      monogram_font_key: payload.monogramFontKey,
      mood_feel_key: payload.moodFeelKey,
      music_playlist_seed: payload.musicPlaylistSeed?.length
        ? payload.musicPlaylistSeed
        : null,
      estimated_pax: typeof payload.pax === 'number' ? payload.pax : null,
    })
    // events.id is BIGSERIAL (internal) — every FK + the dashboard route use
    // events.event_id (UUID). Select + thread event_id, matching the canonical
    // createWeddingEvent. (Selecting 'id' shipped a latent bug: event_members.
    // event_id is UUID, so inserting the bigint crashed the commit.)
    .select('event_id')
    .single();

  if (insertError || !insertedEvent) {
    return {
      ok: false,
      error: insertError?.message ?? 'event_insert_failed',
    };
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple',
    joined_via: 'created_event',
  });
  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  await captureEvent({
    distinctId: user.id,
    event: 'onboarding_wedding_committed',
    properties: {
      event_id: insertedEvent.event_id,
      kind: payload.kind,
      region: payload.region,
      pax: payload.pax,
      budget_band: payload.budgetBand,
    },
  });

  // Auto-inquire a best-fit vendor for each picked category (owner 2026-06-02:
  // "auto-inquire best-fit per category"). Resolve the picker keys → UNIQUE
  // PLAN_GROUP ids, then fire one inquiry per group via the dashboard
  // unlock-category flow (best-fit pick → event_vendors 'considering' →
  // follow → chat thread → first inquiry message). Best-effort + parallel: an
  // inquiry failure must NEVER fail the commit — the event + membership are
  // already saved, and the couple can add categories from the dashboard. The
  // event_members row above is committed, so unlockCategoryWithInquiry's
  // user-scoped RLS membership read resolves.
  const groupIds = Array.from(
    new Set(
      (payload.picks ?? [])
        .map((p) => PICK_TO_GROUP[p])
        .filter((g): g is string => Boolean(g)),
    ),
  );
  if (groupIds.length > 0) {
    await Promise.allSettled(
      groupIds.map((groupId) =>
        unlockCategoryWithInquiry({
          eventId: insertedEvent.event_id,
          groupId,
        }),
      ),
    );
  }

  return { ok: true, eventId: insertedEvent.event_id };
}

/**
 * searchOnboardingReceptionVenues — REAL reception venues for the find-vendor
 * screen (step 12), replacing the prototype's hardcoded demo cards (owner
 * 2026-06-02: "the reception venues listed are still not from the result of our
 * services list of reception venues").
 *
 * Criteria-based — the event doesn't exist yet (it's created at the commit), so
 * this can't take an eventId. It calls fetchWizardVendorRecommendations directly
 * with canonicalServices:['venue'] + the in-flight onboarding criteria (ceremony
 * derived the same way the commit does · venue_setting from the couple's first
 * reception "setting" pick). That's the SAME engine + sort the dashboard reception
 * search (category-search.ts) and the public /vendors marketplace use, so
 * onboarding surfaces the same verified set — not fake demo venues.
 *
 * Reads vendor_market_stats (already public via /vendors) → no auth gate needed.
 * Never throws — returns [] on error so the screen degrades to its empty state +
 * the BYO "add your own". Reception venues are name-exempt from hybrid-anonymity
 * (the venue exception, [[project_setnayan_vendor_hybrid_anonymity]]), so
 * business_name is always safe to surface here.
 */
export type OnboardingVenueResult = {
  vendorId: string;
  name: string;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  verified: boolean;
};

export async function searchOnboardingReceptionVenues(input: {
  kind: 'religious' | 'civil' | 'mixed' | null;
  faith: string[];
  receptionSettings: string[];
}): Promise<OnboardingVenueResult[]> {
  // Derive ceremony_type + secondary the SAME way the commit does, so the
  // NULL-safe ceremony filter admits faith-agnostic reception venues.
  let ceremonyType: string | null = null;
  let secondary: string | null = null;
  if (input.kind === 'civil') {
    ceremonyType = 'civil';
  } else if (input.kind === 'mixed') {
    ceremonyType = 'mixed';
    secondary =
      input.faith.find((f) => (ALLOWED_SECONDARY as readonly string[]).includes(f)) ?? null;
  } else if (input.kind === 'religious') {
    const primary = input.faith[0];
    ceremonyType =
      primary && (ALLOWED_CEREMONIES as readonly string[]).includes(primary)
        ? primary
        : 'catholic';
  }

  // venue_setting from the couple's first reception "setting" pick (screen-10);
  // null → no setting filter, show all reception venues.
  const venueSetting =
    (input.receptionSettings ?? [])
      .map((k) => RECEPTION_TO_VENUE_SETTING[k])
      .find((v): v is string => Boolean(v)) ?? null;

  const admin = createAdminClient();
  try {
    const recs = await fetchWizardVendorRecommendations(admin, {
      canonicalServices: ['venue'],
      ceremonyType,
      secondaryCeremonyType: secondary,
      venueSetting,
      limit: 8,
    });
    return recs.map((r) => ({
      vendorId: r.vendor_profile_id,
      name: r.business_name,
      city: r.location_city,
      rating: r.avg_rating_overall,
      reviewCount: r.review_count,
      photoUrl: r.primary_photo_url ?? r.logo_url,
      verified: r.verification_state === 'verified',
    }));
  } catch {
    return [];
  }
}
