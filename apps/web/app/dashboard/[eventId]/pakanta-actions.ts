/**
 * Pakanta · server action for the music-preference intake.
 *
 * Iteration 0036 Pakanta. REWORKED 2026-06-13: the retired wizard card that
 * re-asked the couple's love story was deleted (#1320); the song is now
 * composed from the ONBOARDING love story (events.love_story → lib/pakanta-
 * brief.ts). So this intake only collects the MUSIC top-up the love story
 * doesn't have — what they call each other, each side's favourite singer, the
 * music type (+ optional extra wishes). Consumed by the dedicated couple page
 * at /dashboard/[eventId]/studio/pakanta (PakantaMusicForm).
 *
 * Both CTAs persist the same draft row in `pakanta_intake_drafts` keyed by
 * event_id (admin reads it on the /admin/pakanta queue):
 *
 *   [Save for later] → status='draft' · stays on the page.
 *   [Continue to payment] → status='purchase_pending' · returns the redirect
 *                       URL to /dashboard/[eventId]/orders/new?service=pakanta_basic
 *
 * Table: supabase/migrations/20260626000000_iteration_0036_pakanta_intake_
 * drafts.sql (status enum + host/admin RLS). No new migration — the responses
 * JSONB shape is unchanged; only which fields are required changed.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type PakantaIntakeResponses = {
  how_you_met: string;
  engagement_story: string;
  memorable_story: string;
  pet_names: string;
  story_to_add: string;
  groom_favorite_singer: string;
  bride_favorite_singer: string;
  music_type: string;
};

export type SavePakantaIntakeResult =
  | { ok: true; redirectTo: string | null }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof PakantaIntakeResponses, string>> };

// The love story (how they met, the proposal, milestones, tone) now comes
// from the onboarding `events.love_story` — the song is composed from that one
// interview (see lib/pakanta-brief.ts). So this intake only collects the
// MUSIC top-up: what they call each other + each side's favourite singer +
// the music type. All four are required on purchase; the two free-text "extra
// story" fields are optional sugar the composer folds in when present.
const REQUIRED_FIELDS: ReadonlyArray<keyof PakantaIntakeResponses> = [
  'pet_names',
  'groom_favorite_singer',
  'bride_favorite_singer',
  'music_type',
];
const OPTIONAL_FIELDS: ReadonlyArray<keyof PakantaIntakeResponses> = [
  'memorable_story',
  'story_to_add',
];

function readResponses(
  formData: FormData,
): {
  responses: PakantaIntakeResponses;
  fieldErrors: Partial<Record<keyof PakantaIntakeResponses, string>>;
} {
  function readField(name: keyof PakantaIntakeResponses): string {
    const raw = formData.get(name);
    return typeof raw === 'string' ? raw.trim() : '';
  }

  const responses: PakantaIntakeResponses = {
    how_you_met: readField('how_you_met'),
    engagement_story: readField('engagement_story'),
    memorable_story: readField('memorable_story'),
    pet_names: readField('pet_names'),
    story_to_add: readField('story_to_add'),
    groom_favorite_singer: readField('groom_favorite_singer'),
    bride_favorite_singer: readField('bride_favorite_singer'),
    music_type: readField('music_type'),
  };

  const fieldErrors: Partial<Record<keyof PakantaIntakeResponses, string>> = {};
  for (const field of REQUIRED_FIELDS) {
    if (responses[field].length === 0) {
      fieldErrors[field] = 'Please fill this in.';
    }
  }

  return { responses, fieldErrors };
}

/**
 * Save the host's 8-question Pakanta intake. `intent='skip'` saves the
 * draft + marks the wizard task in_flight so the host can revisit later.
 * `intent='purchase'` saves with status='purchase_pending' AND returns a
 * redirect URL to the orders/new page pre-filling the Basic tier SKU.
 */
export async function savePakantaIntake(
  formData: FormData,
): Promise<SavePakantaIntakeResult> {
  const eventIdRaw = formData.get('event_id');
  const intentRaw = formData.get('intent');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { ok: false, error: 'event_id required' };
  }
  if (intentRaw !== 'skip' && intentRaw !== 'purchase') {
    return { ok: false, error: 'intent must be skip or purchase' };
  }
  const intent = intentRaw;

  const { responses, fieldErrors } = readResponses(formData);

  // On Skip we still require ≥1 question with real content so the draft
  // is meaningful (no all-blank rows); the owner spec doesn't make Skip
  // a zero-validation path — it's "Save & continue later", not "Cancel".
  if (intent === 'skip') {
    const anyContent = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].some(
      (f) => responses[f].length > 0,
    );
    if (!anyContent) {
      return {
        ok: false,
        error: "Nothing saved yet — add a detail or two before stepping away.",
      };
    }
  } else {
    // Purchase intent · the four music fields must validate (the story comes
    // from the onboarding love_story, so it isn't re-collected here).
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: 'Some answers need a little more.', fieldErrors };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Upsert keyed on event_id · matches the unique index on the table.
  // The host can re-submit to overwrite their draft without piling up
  // stale rows.
  const status = intent === 'purchase' ? 'purchase_pending' : 'draft';
  const { error: upsertErr } = await supabase
    .from('pakanta_intake_drafts')
    .upsert(
      {
        event_id: eventIdRaw,
        responses,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' },
    );
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  revalidatePath(`/dashboard/${eventIdRaw}/studio/pakanta`);

  const redirectTo =
    intent === 'purchase'
      ? `/dashboard/${eventIdRaw}/orders/new?service=pakanta_basic`
      : null;

  return { ok: true, redirectTo };
}
