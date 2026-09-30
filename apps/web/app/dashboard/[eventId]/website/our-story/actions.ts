'use server';

/**
 * Server action for the Our Story editor — the post-onboarding doorway for
 * events.love_story (the wayfinding fix: onboarding's "Add it later" finally
 * has a later; owner 2026-07-23, corpus DECISION_LOG).
 *
 * Writes the SAME v2 LoveStory JSONB the onboarding love stage commits
 * (app/onboarding/wedding/types.ts LoveStory — spark/obstacle/proposal braid,
 * anchors{}, milestones[]), read by composeOurStory (app/[slug]/_components/
 * our-story.tsx) on STD/RSVP/Event and reused downstream (kept story-shaped —
 * the covert naming rule from the onboarding types holds here too).
 *
 * MERGE, never clobber: keys this form doesn't edit (spark_anchor, plus any
 * future additions) are preserved from the stored blob. Milestones are
 * replaced wholesale from the repeater rows and auto-sorted chronologically
 * (the canonical "auto-sorted" behavior from the type doc). Runs with the
 * host's JWT — couple_can_update_event RLS is the gate (mirrors
 * updateSpecialMessage). NOT gated on the home_activity_signals privacy
 * control: that control governs covert signal COLLECTION at onboarding; this
 * is the couple explicitly authoring their own public website section (like
 * special_message, which has no such gate). Surfaced for DPO visibility in
 * the corpus DECISION_LOG row.
 */
import { landAfterWrite } from '@/lib/maker-land.server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { revalidateGuestSite } from '@/lib/revalidate-site';
import { requireHostMembership } from '@/lib/host-gate';
import { draftEventsAndReturn, draftedEventColumn, isHubDraftWrite } from '@/lib/hub-draft-store';
import { screenNewPhotoRefs } from '@/lib/love-story-screen';
import { ourEventPhotoRefs } from './_components/our-events-read';
import {
  chapterOf,
  formatMomentDate,
  LOVE_STORY_CHAPTER_LABEL,
  momentCapRefusal,
  readMomentMedia,
  resolveMoments,
  storableMoments,
  type LoveStoryMoment,
} from '@/lib/love-story-moments';
import { mergeStoryWords, storyStr as str } from '@/lib/love-story-words';
import { applyMomentIntent } from '@/lib/love-story-moment-intent';

/* The questions' caps, the timeline rows and the merge live in
   `lib/love-story-words.ts` — ONE reading, shared with the Maker's instant
   words panel, so a keystroke saved behind the page and this Save write the
   same blob. */

export async function updateOurStory(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  // 💾 From the Event Hub Maker (`<HubDraftField />`) the story goes into the
  // couple's draft, built on what they already drafted (a moment added in the
  // scrapbook must survive a words save) — guests keep the live story until Apply.
  const drafting = isHubDraftWrite(formData);
  if (drafting) await requireHostMembership(eventId);

  // Read the stored blob first so unedited/unknown keys survive the merge.
  const { data: current } = await supabase
    .from('events')
    .select('love_story')
    .eq('event_id', eventId)
    .maybeSingle();
  const draftedStory = drafting ? await draftedEventColumn(eventId, 'love_story') : null;
  const base: unknown = draftedStory?.drafted ? draftedStory.value : current?.love_story;
  // MERGE, never clobber (`mergeStoryWords`): keys this form does not edit survive.
  // together_since is DUAL-STORED: onboarding writes both the blob and the
  // events.together_since column, and public readers PREFER the column
  // (editorial data.ts, event-brief). Keep both in sync or edits are no-ops.
  const { story: merged, togetherSince } = mergeStoryWords(base, formData);

  if (drafting) {
    return draftEventsAndReturn(
      eventId,
      { love_story: merged, together_since: togetherSince },
      formData,
      `/dashboard/${eventId}/website/our-story?saved=1&drafted=1`,
    );
  }

  const { data: event, error } = await supabase
    .from('events')
    .update({ love_story: merged, together_since: togetherSince })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  // A 0-row update (RLS-blocked or wrong event) surfaces as !event with no
  // error — treat it as a failure, never a false "Saved".
  if (error || !event) {
    redirect(
      `/dashboard/${eventId}/website/our-story?error=${encodeURIComponent(
        'Could not save your story. Please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website`);
  if (event.slug) revalidatePath(`/${event.slug}`);
  return landAfterWrite(formData, `/dashboard/${eventId}/website/our-story?saved=1`, '?saved=1');
}

/* ══════════════════════════════════════════════════════════════════════════
   OUR LOVE STORY — THE ONE MOMENT ACTION (Event Hub Maker Phase 7, +1 export)
   ══════════════════════════════════════════════════════════════════════════
   Owner 2026-09-25: *"each love story is a scene"* · *"Max of 5 for free. no
   media files. Place more, add media files, Go Event Hub Pro?"*. One action,
   five intents — `add · edit · delete · arrange · pick` — so the cap lives in
   exactly ONE place a request can reach:

   🔒 THE SERVER COUNTS. `momentCapRefusal` (lib/love-story-moments.ts) compares
   the list before and after the intent: a free event may not grow past five and
   may not gain ANY photo ref; removing is never refused. Pro is read with the
   ACTIVE gate (`eventCoupleWebsiteProActive`), never inferred from the form.
   A refusal writes nothing and returns to the scrapbook with `?pro=` so the page
   draws the one line — "Add more stories and your photos · Go Event Hub Pro".

   Writes `events.love_story.moments` BESIDE the legacy keys (merge, never
   clobber — the same rule as `updateOurStory`). The first write materialises
   the seed (`resolveMoments`) so the couple's onboarding words become moments
   with the ids the scrapbook already showed.

   🔴 NEW PHOTO REFS ARE SCREENED BEFORE THE WRITE, fail-closed — the
   `updateOurPhotos` rule, for the same reason: `love_story` has no moderation
   state, so a ref in the list IS on the public page.

   ⏭ SEAMS: Phase 2's draft path (`hub-draft-actions.ts`) is not on main — this
   writes live, like `updateOurStory` always has. Phase 4's upload path + 100 MB
   meter take over the photo input when they land; clips wait on them. */

const MOMENT_INTENTS = ['add', 'edit', 'delete', 'arrange', 'pick'] as const;
type MomentIntent = (typeof MOMENT_INTENTS)[number];

/* add · edit · delete · arrange are applied by `applyMomentIntent`
   (`lib/love-story-moment-intent.ts`) — the SAME function the Maker's instant
   scrapbook applies at the tap, so the two can never disagree. */

export async function loveStoryMomentAction(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const back = `/dashboard/${eventId}/website/our-story`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const intentRaw = String(formData.get('intent') ?? '');
  if (!(MOMENT_INTENTS as readonly string[]).includes(intentRaw)) fail('That did not save. Please try again.');
  const intent = intentRaw as MomentIntent;

  const supabase = await createClient();
  /* 💾 THE DRAFT DOOR (2026-09-25). From the scrapbook the moments go into the
     couple's draft — guests keep the live story until Apply in the Maker. The
     edit builds on the DRAFTED moments (a second drafted moment must not drop
     the first), and the cap and the photo screen below run exactly as live:
     both are the server's, whichever way the save is going. */
  const drafting = isHubDraftWrite(formData);
  if (drafting) await requireHostMembership(eventId);
  const { data: current, error: readError } = await supabase
    .from('events')
    .select('love_story')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError || !current) return fail('Could not open your story. Please try again.');
  let draftedStory: Awaited<ReturnType<typeof draftedEventColumn>> | null = null;
  if (drafting) {
    try {
      draftedStory = await draftedEventColumn(eventId, 'love_story');
    } catch {
      return fail('Could not open your draft. Nothing changed — please try again.');
    }
  }
  const stored: unknown = draftedStory?.drafted ? draftedStory.value : current.love_story;
  const existing: Record<string, unknown> =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};

  const before = resolveMoments(existing);
  const id = str(formData.get('id'), 40);
  const prior = before.find((m) => m.id === id) ?? null;
  let after: LoveStoryMoment[] = before;
  let touched: LoveStoryMoment | null = null;

  if (intent !== 'pick') {
    const r = applyMomentIntent(before, intent, formData);
    if (!r.ok) return fail(r.error);
    after = r.after;
    touched = r.touched;
  } else {
    // 'pick' — "Pick from our events": refs an event the pair HOSTS already
    // shows. The SAME read the page offers from (`readOurEvents`), so the two
    // cannot disagree. Nothing is copied; a ref from anywhere else is dropped.
    if (!prior) return fail('Choose the moment to add these to.');
    const mine = await ourEventPhotoRefs(user.id, eventId);
    const allowed = readMomentMedia(formData.getAll('media')).filter((ref) => mine.has(ref));
    const media = readMomentMedia([...(prior.media ?? []), ...allowed]);
    const m: LoveStoryMoment = { ...prior, ...(media.length ? { media } : {}) };
    touched = m;
    after = before.map((x) => (x.id === id ? m : x));
  }

  // ── THE CAP, ON THE SERVER ─────────────────────────────────────────────────
  /* 💎 TRIED IN THE MAKER, PAID AT APPLY (owner 2026-09-28, verbatim: *"they
     can edit it with pro features. but need to upgrade to pro when clicked on
     apply"*). Into the DRAFT the free cap does not refuse: Apply asks the same
     `momentCapRefusal` of live → drafted as a couple without Pro
     (`eventItemIsPro`, 'love_story') and holds the story until Pro — the sheet
     names it. The hundred-moment ceiling still refuses either way; a live
     write is capped exactly as before. */
  const ownsPro = drafting || (await eventCoupleWebsiteProActive(supabase, eventId));
  const refusal = momentCapRefusal({ before, after, ownsPro });
  if (refusal === 'max') return fail('Your story holds 100 moments — the most one Event Hub can show.');
  if (refusal) redirect(`${back}?pro=${refusal === 'photos_pro' ? 'photos' : 'stories'}`);

  // ── NEW PHOTOS ARE SCREENED BEFORE THEY ARE WRITTEN (fail-closed) ─────────
  const held = new Set(before.flatMap((m) => m.media ?? []));
  const newRefs = [...new Set(after.flatMap((m) => m.media ?? []))].filter((r) => !held.has(r));
  if (newRefs.length > 0) {
    const blocked = await screenNewPhotoRefs(newRefs);
    if (blocked.length > 0) {
      after = after.map((m) => (m.media ? { ...m, media: m.media.filter((r) => !blocked.includes(r)) } : m));
    }
  }

  let slotted = '';
  if (touched && (intent === 'add' || intent === 'edit')) {
    const chapter = chapterOf(touched, after);
    slotted = `&slotted=${encodeURIComponent(
      `${formatMomentDate(touched.date)} · ${LOVE_STORY_CHAPTER_LABEL[chapter]}`,
    )}#moment-${touched.id}`;
  }

  // The ONE place the moments are written — the draft and the live row get the same value.
  const nextStory = { ...existing, moments: storableMoments(after) };

  if (drafting) {
    return draftEventsAndReturn(
      eventId,
      { love_story: nextStory },
      formData,
      `${back}?saved=1&drafted=1${slotted}`,
    );
  }

  const { data: saved, error } = await supabase
    .from('events')
    .update({ love_story: nextStory })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();
  // A 0-row update (RLS) reads as !saved with no error — a failure, never "Saved".
  if (error || !saved) return fail('Could not save your story. Please try again.');

  revalidatePath(back);
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidateGuestSite(saved.slug);

  redirect(`${back}?saved=1${slotted}`);
}
