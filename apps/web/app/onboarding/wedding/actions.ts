'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';

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
 * Scope note: per-category picks/prefs (picker + style sub-stepper) are NOT
 * persisted here — the event_vendor_preferences table does not exist yet
 * (deferred to a V1.x migration). Only mood_feel_key has a column, so that one
 * preference is committed; everything else stays client-side until the prefs
 * table lands. estimated_pax is an existing column and is committed.
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
// venue_setting has no clean onboarding source — the reception "setting" is a
// style multi-pick (screen 10 prefs), not a single committed venue. The CHECK
// constraint requires a value for wedding events, so we default to the most
// common PH reception type; the couple refines it later from event settings.
const DEFAULT_VENUE = 'banquet_hall';

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
      venue_setting: DEFAULT_VENUE,
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
    .select('id')
    .single();

  if (insertError || !insertedEvent) {
    return {
      ok: false,
      error: insertError?.message ?? 'event_insert_failed',
    };
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.id,
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
      event_id: insertedEvent.id,
      kind: payload.kind,
      region: payload.region,
      pax: payload.pax,
      budget_band: payload.budgetBand,
    },
  });

  return { ok: true, eventId: insertedEvent.id };
}
