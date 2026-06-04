'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEventSongPicks } from '@/lib/songs';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { unlockCategoryWithInquiry } from '@/app/dashboard/[eventId]/vendors/_actions/unlock-category';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import { recomputeReceptionAnchor } from '@/lib/events';
import { defaultInvitedToForRole } from '@/lib/guests';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { canonicalServicesForTile, canonicalServicesForFolder } from '@/lib/vendor-counts';
import { regionForCity } from '@/lib/regions';

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

// All faiths unlocked (owner-directed 2026-06-03 "unlock all religions").
// Previously ['catholic','civil','mixed'] — any other primary pick was silently
// coerced to 'catholic' on commit. muslim/cultural also require a non-null
// ceremony_sub_type (DB CHECK events_sub_type_required_when_muslim_or_cultural);
// the onboarding flow has no sub-type step, so it defaults below.
const ALLOWED_CEREMONIES = [
  'catholic',
  'civil',
  'mixed',
  'christian',
  'inc',
  'muslim',
  'cultural',
  'chinese',
  'jewish',
  'born_again',
] as const;
// Default tradition for the two sub-type-requiring faiths, since onboarding
// doesn't collect a specific tradition (create-event does). The couple can
// refine the exact tradition later from the dashboard.
const DEFAULT_SUB_TYPE: Record<string, string> = {
  muslim: 'general_muslim',
  cultural: 'other',
};
const ALLOWED_SECONDARY = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'chinese',
  'jewish',
  'born_again',
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

// Onboarding region slug (screen-6 · onboarding-shell REGLABEL keys) → PSGC
// region code (vendor_profiles.hq_region · lib/regions.ts PH_REGIONS). The
// shell's own slug set ('c-visayas', 'n-mindanao', 'abroad' …) differs from
// match-criteria.ts REGION_OPTIONS, so this map is keyed to what the wizard
// actually stores in state.region. `abroad` → null = no region scope (couple
// marrying overseas · show the full pool). Unknown slug → null (no scope) so a
// future region addition degrades to "everywhere" rather than zero results.
const ONBOARDING_REGION_TO_PSGC: Record<string, string> = {
  ncr: 'NCR',
  calabarzon: 'IV-A',
  'c-visayas': 'VII',
  'w-visayas': 'VI',
  'c-luzon': 'III',
  ilocos: 'I',
  cagayan: 'II',
  bicol: 'V',
  mimaropa: 'IV-B',
  'e-visayas': 'VIII',
  zamboanga: 'IX',
  'n-mindanao': 'X',
  davao: 'XI',
  soccsksargen: 'XII',
  caraga: 'XIII',
  barmm: 'BARMM',
  car: 'CAR',
  // abroad → (absent) → null → no region scope
};

/** Onboarding region slug → PSGC code, or null when the couple has no
 *  region-scopable pick (unset · `abroad` · unrecognized slug). */
function onboardingRegionToPsgc(region: string | null | undefined): string | null {
  if (!region) return null;
  return ONBOARDING_REGION_TO_PSGC[region] ?? null;
}

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
  /** bride/groom first + last (screen 4) → events.bride_name/groom_name (joined) + the first two guest-list rows */
  brideFirstName: string;
  brideLastName: string;
  groomFirstName: string;
  groomLastName: string;
  kind: 'religious' | 'civil' | 'mixed' | null;
  /** faith picks: [primary] for religious, [primary, secondary] for mixed, [] for civil */
  faith: string[];
  region: string | null;
  pax: number | null;
  budgetBand: string | null;
  /** working-budget amount in centavos (band MAX for pax unless the couple typed/dragged a value) → events.estimated_budget_centavos */
  budgetAmountCentavos: number | null;
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
  /**
   * screen-12 find-vendor shortlist — the REAL reception venues the couple tapped
   * (vendor_profiles.vendor_profile_id + display name). Persisted at commit as
   * event_vendors 'considering' picks so they show on the dashboard Services tab
   * (owner 2026-06-02: "i shortlisted 3 ... only shows 1" / "what happened to my
   * services list"). Each is a verified marketplace reception → name-exempt.
   */
  shortlist: { vendorId: string; name: string }[];
  /**
   * screen-10 style sub-stepper prefs blob (reception · ceremony · cuisine ·
   * serviceStyle · dietary · pvLook · pvNeed · pvIncluded · music · feel).
   * Persisted to events.style_preferences (migration 20260724000000) for
   * DISPLAY on the Home "Personalized for you" card (owner 2026-06-02: "we want
   * everything there ... the features that matter for the different services").
   * NOT a vendor-match write — that's event_vendor_preferences, gated on the
   * canonical_service FK + vendor facet-tagging (CLAUDE.md 2026-06-02 Phase A2
   * BLOCKED). This is a free-form blob, no FK, display-only.
   */
  stylePreferences: Record<string, unknown>;
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

  // Names: first names drive the warm display ("Maria & Juan"); first + last
  // join into events.bride_name/groom_name AND seed the guest list below.
  const brideFirst = payload.brideFirstName?.trim() ?? '';
  const brideLast = payload.brideLastName?.trim() ?? '';
  const groomFirst = payload.groomFirstName?.trim() ?? '';
  const groomLast = payload.groomLastName?.trim() ?? '';
  const brideFullName = [brideFirst, brideLast].filter(Boolean).join(' ');
  const groomFullName = [groomFirst, groomLast].filter(Boolean).join(' ');
  const displayName =
    [brideFirst, groomFirst].filter(Boolean).join(' & ') || 'Our Wedding';

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
      // muslim/cultural require a non-null sub_type per the DB CHECK; onboarding
      // has no tradition picker, so default and let the couple refine later.
      ceremony_sub_type: DEFAULT_SUB_TYPE[ceremonyType] ?? null,
      is_mixed_ceremony: isMixed,
      secondary_ceremony_type: secondary,
      ceremony_type_locked_at: now,
      ceremony_type_locked_by: user.id,
      // -- onboarding-v2 columns (migration 20260719000000) --
      bride_name: brideFullName || null,
      groom_name: groomFullName || null,
      region: payload.region,
      date_mode: dateMode,
      date_candidates: candidates.length ? candidates : null,
      date_window_start: windowStart,
      date_window_end: windowEnd,
      budget_band: payload.budgetBand,
      estimated_budget_centavos:
        typeof payload.budgetAmountCentavos === 'number' ? payload.budgetAmountCentavos : null,
      monogram_frame_key: payload.monogramFrameKey,
      monogram_font_key: payload.monogramFontKey,
      mood_feel_key: payload.moodFeelKey,
      music_playlist_seed: payload.musicPlaylistSeed?.length
        ? payload.musicPlaylistSeed
        : null,
      estimated_pax: typeof payload.pax === 'number' ? payload.pax : null,
      // Display-only style blob for the Home "Personalized for you" card
      // (migration 20260724000000). NOT vendor matching — see the payload doc.
      style_preferences: payload.stylePreferences ?? {},
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

  // Couple's music picks → event_song_picks (the couple side of the music
  // compatibility overlap · Vendor_Compatibility_and_Master_Songlist_2026-06-03).
  // Non-fatal: if the master-songlist tables aren't migrated yet (20260731000000)
  // this throws — swallow it; the onboarding commit must never fail on it.
  try {
    await syncEventSongPicks(admin, insertedEvent.event_id, payload.musicPlaylistSeed ?? []);
  } catch (songPickErr) {
    console.error('[onboarding] event_song_picks sync failed (non-fatal)', songPickErr);
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

  // Persist the find-vendor shortlist — the REAL reception venues the couple
  // tapped on screen 12 — as event_vendors 'considering' picks so they show on
  // the dashboard Services tab (owner 2026-06-02: "i shortlisted 3 ... only
  // shows 1" / "what happened to my services list"). Admin-client insert
  // (matches the events/members inserts above + saveVendorToPicks' shape);
  // dedup by vendor id; best-effort — a shortlist failure must NEVER fail the
  // commit (the event + membership are already saved). Inserted BEFORE the
  // auto-inquire loop so a 'reception' pick short-circuits as already_active
  // (no duplicate reception). Then recompute the reception distance anchor
  // (directive 3 · "reception = ground 0").
  const shortlistSeen = new Set<string>();
  const shortlistRows = (payload.shortlist ?? [])
    .filter((v) => v && typeof v.vendorId === 'string' && v.vendorId.length > 0)
    .filter((v) => (shortlistSeen.has(v.vendorId) ? false : (shortlistSeen.add(v.vendorId), true)))
    .map((v) => ({
      event_id: insertedEvent.event_id,
      marketplace_vendor_id: v.vendorId,
      category: 'venue' as const,
      vendor_name: v.name || 'Reception venue',
      status: 'considering' as const,
      source: 'host_manual' as const,
    }));
  if (shortlistRows.length > 0) {
    // Best-effort: the event + membership are already committed, so a shortlist
    // insert or anchor-recompute failure must NEVER reject the action. Without
    // this try/catch a throw here (recomputeReceptionAnchor is not error-checked)
    // rejected the whole commit AFTER the event row existed — the client saw a
    // failure and a retry created a DUPLICATE event (owner report 2026-06-03).
    try {
      const { error: shortlistError } = await admin
        .from('event_vendors')
        .insert(shortlistRows);
      if (!shortlistError) {
        await recomputeReceptionAnchor(admin, insertedEvent.event_id);
      }
    } catch (shortlistErr) {
      console.error('[onboarding] shortlist/anchor seed failed (non-fatal)', shortlistErr);
    }
  }

  // Seed the guest list with the bride + groom as the first two entries
  // (owner 2026-06-02: "this will also be used as the first inputs on the
  // guest list"). They're the two singleton guest roles (iteration 0001 + the
  // one-per-event partial unique indexes, migration 20260531010000) — a fresh
  // event has no conflict. Best-effort: a guest-seed failure must NEVER fail
  // the commit (the event + membership are already saved). guests.last_name is
  // NOT NULL → fall back to '' (the couple fills it on the guest list). Each
  // side seeds only when its first name is present (canContinue requires ≥1).
  // Mirrors the canonical quickAddGuest insert shape.
  if (brideFirst) {
    const { error: brideErr } = await admin.from('guests').insert({
      event_id: insertedEvent.event_id,
      first_name: brideFirst,
      last_name: brideLast,
      side: 'bride',
      group_category: 'other',
      role: 'bride',
      rsvp_status: 'pending',
      photo_consent: true,
      invited_to_blocks: defaultInvitedToForRole('bride'),
      custom_tags: [],
    });
    if (brideErr) {
      console.error(
        '[commitOnboardingWedding] bride guest seed failed:',
        brideErr.message,
        '| event_id:',
        insertedEvent.event_id,
      );
    }
  }
  if (groomFirst) {
    const { error: groomErr } = await admin.from('guests').insert({
      event_id: insertedEvent.event_id,
      first_name: groomFirst,
      last_name: groomLast,
      side: 'groom',
      group_category: 'other',
      role: 'groom',
      rsvp_status: 'pending',
      photo_consent: true,
      invited_to_blocks: defaultInvitedToForRole('groom'),
      custom_tags: [],
    });
    if (groomErr) {
      console.error(
        '[commitOnboardingWedding] groom guest seed failed:',
        groomErr.message,
        '| event_id:',
        insertedEvent.event_id,
      );
    }
  }

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
  /** Onboarding region slug (screen-6 · state.region). Scopes venues to the
   *  couple's area — a reception venue IS its location, so an out-of-region
   *  venue can't serve the wedding. null/abroad/unset → no region scope. */
  region?: string | null;
  /** Couple's guest count (screen · state.pax). Drops venues that can't seat
   *  the wedding (capacity_max < pax). null/0 → no pax scope. */
  pax?: number | null;
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
      region: onboardingRegionToPsgc(input.region),
      eventType: 'wedding',
      pax: input.pax ?? null,
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

/* Resolve a planning-group id → its canonical services, the SAME way the
   Services-tab Category Search does (category-search.ts canonicalsForGroup):
   subcategoryHint → catalogTile → catalogFolder. Kept in lock-step so the
   onboarding count and the dashboard's "vendors in your categories" agree. */
function canonicalsForOnboardingGroup(groupId: string): string[] {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  if (g.subcategoryHint) return [g.subcategoryHint];
  if (g.catalogTile) return canonicalServicesForTile(g.catalogTile);
  return canonicalServicesForFolder(g.catalogFolder);
}

export type OnboardingVendorCounts = { matched: number; total: number };

/**
 * getOnboardingVendorCounts — REAL marketplace counts for the congrats screen's
 * third stat tile (step 13), replacing the fabricated `max(categories×5, 12)` +
 * the hardcoded "2,400+" label (owner 2026-06-03: "15 out of 2400+ vendors is
 * fake. we want real numbers only." → AskUserQuestion "Real marketplace counts").
 *
 * Criteria-based (NO eventId — the event row isn't created until the commit, and
 * congrats renders before it), so it counts straight off vendor_market_stats
 * using the SAME published-pool + NULL-safe ceremony/venue compat filters
 * fetchWizardVendorRecommendations uses, scoped to the canonical services of the
 * couple's PICKED categories — i.e. the same pool definition the Services tab's
 * marketPoolCount uses:
 *
 *   total   = published vendors (verified + coming_soon, real business_name)
 *             across the couple's picked categories. Empty picks → the whole
 *             published marketplace (still a real pool, not a category scope).
 *   matched = of those, the ones that FIT the wedding — couple's ceremony_type
 *             (+ secondary for interfaith) AND venue setting AND region (city
 *             fallback) AND event_type='wedding', Hybrid NULL-safe admit-unknown
 *             / exclude-known-mismatch (same predicates as the marketplace). So
 *             region/event-type narrow `matched` below `total` — a real "N of M".
 *
 * Returns null — and the tile AUTO-HIDES, never fabricates — when a count can't
 * be computed (query error) or there is no real pool to narrow (total ≤ 0, or
 * matched ≤ 0 so we never show a discouraging "0 fit you"). Reads
 * vendor_market_stats (public via /vendors) → no auth gate. Never throws.
 */
export async function getOnboardingVendorCounts(input: {
  kind: 'religious' | 'civil' | 'mixed' | null;
  faith: string[];
  receptionSettings: string[];
  picks: string[];
  /** Onboarding region slug (screen-6 · state.region). Narrows `matched` to
   *  the couple's area (effective region w/ city fallback). `total` stays the
   *  full category pool, so region shows as a real narrowing in "N of M".
   *  null/abroad/unset → no region narrowing. */
  region?: string | null;
  /** Couple's guest count (state.pax). Narrows `matched` further — venues that
   *  can't seat the wedding (capacity_max < pax) drop out. null/0 → no pax
   *  narrowing. */
  pax?: number | null;
}): Promise<OnboardingVendorCounts | null> {
  // Derive ceremony_type + secondary the SAME way the commit + reception search
  // do, so the NULL-safe ceremony filter admits faith-agnostic vendors.
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
  const venueSetting =
    (input.receptionSettings ?? [])
      .map((k) => RECEPTION_TO_VENUE_SETTING[k])
      .find((v): v is string => Boolean(v)) ?? null;

  // Picked categories → canonical service union (same resolver the Services-tab
  // Category Search uses). Empty union → count the whole published marketplace.
  const canonicalUnion = Array.from(
    new Set(
      (input.picks ?? [])
        .map((p) => PICK_TO_GROUP[p])
        .filter((g): g is string => Boolean(g))
        .flatMap((groupId) => canonicalsForOnboardingGroup(groupId)),
    ),
  );

  const ceremonyValues = Array.from(
    new Set([ceremonyType, secondary].filter((v): v is string => typeof v === 'string' && v.length > 0)),
  );

  const psgcRegion = onboardingRegionToPsgc(input.region);

  const admin = createAdminClient();
  // Pull the published pool (verified + coming_soon · real business_name ·
  // scoped to the couple's picked categories) ONCE, then compute total +
  // matched in JS. We fetch rows rather than two head-counts because the region
  // dimension needs the regionForCity(location_city) fallback that SQL can't
  // express for the demo + legacy rows whose hq_region backfill is NULL. total +
  // matched share the one fetched set so `matched ⊆ total` holds by construction.
  // Sourced from vendor_profiles (not the market_stats view) because capacity_max
  // for the pax filter lives there; rows are identical (the view is just
  // vendor_profiles + LEFT JOINs) and the admin client bypasses RLS.
  type PoolRow = {
    hq_region: string | null;
    location_city: string | null;
    compatible_ceremony_types: string[] | null;
    compatible_venue_settings: string[] | null;
    event_types: string[] | null;
    capacity_max: number | null;
  };
  try {
    let q = admin
      .from('vendor_profiles')
      .select(
        'hq_region,location_city,compatible_ceremony_types,compatible_venue_settings,event_types,capacity_max',
      )
      .in('public_visibility', ['verified', 'coming_soon'])
      .not('business_name', 'is', null)
      .neq('business_name', '')
      .limit(5000); // ceiling well above the V1 pool · keeps `total` exact
    if (canonicalUnion.length > 0) q = q.overlaps('services', canonicalUnion);
    const { data, error } = await q;
    if (error || !data) return null;
    const rows = data as PoolRow[];

    // Hybrid fit predicates · NULL-safe admit-unknown, exclude-known-mismatch —
    // identical semantics to fetchWizardVendorRecommendations, so this count and
    // the step-12 venue list agree on what "fits".
    const ceremonyFit = (cer: string[] | null) =>
      ceremonyValues.length === 0 ||
      cer == null ||
      ceremonyValues.some((v) => cer.includes(v));
    const venueFit = (ven: string[] | null) =>
      !venueSetting || ven == null || ven.includes(venueSetting);
    const regionFit = (hq: string | null, city: string | null) => {
      if (!psgcRegion) return true;
      const eff = hq ?? regionForCity(city);
      return eff === null || eff === psgcRegion;
    };
    const eventFit = (ets: string[] | null) => ets == null || ets.includes('wedding');
    const pax = input.pax && input.pax > 0 ? input.pax : null;
    const paxFit = (cap: number | null) => pax === null || cap === null || cap >= pax;

    const total = rows.length; // full category pool · region-agnostic denominator
    const matched = rows.filter(
      (r) =>
        ceremonyFit(r.compatible_ceremony_types) &&
        venueFit(r.compatible_venue_settings) &&
        regionFit(r.hq_region, r.location_city) &&
        eventFit(r.event_types) &&
        paxFit(r.capacity_max),
    ).length;
    if (total <= 0 || matched <= 0) return null; // never fabricate / never discourage
    return { matched, total };
  } catch {
    return null;
  }
}
