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
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveReturnTo } from '@/lib/editor-return';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { revalidateGuestSite } from '@/lib/revalidate-site';
import {
  MOMENT_BY_MAX,
  MOMENT_LINE_MAX,
  MOMENT_PLACE_MAX,
  chapterOf,
  formatMomentDate,
  LOVE_STORY_CHAPTER_LABEL,
  momentCapRefusal,
  newMomentId,
  readMomentDate,
  readMomentMedia,
  resolveMoments,
  storableMoments,
  type LoveStoryMoment,
} from '@/lib/love-story-moments';

const FIELD_MAX = 600;
const SHORT_MAX = 120;
const YEAR_MAX = 12;

/** The scalar LoveStory keys this form edits, all trimmed + length-capped. */
const TEXT_FIELDS = [
  'how_we_met',
  'spark',
  'spark_why',
  'obstacle',
  'obstacle_kept',
  'proposal',
  'proposal_feel',
] as const;
const SHORT_FIELDS = ['together_since', 'proposal_setting', 'obstacle_kind', 'proposal_voice'] as const;
const YEAR_FIELDS = ['met_year', 'proposal_year'] as const;
const ANCHOR_KEYS = ['song', 'place', 'injoke', 'food'] as const;

function str(v: FormDataEntryValue | null, max: number): string {
  return (typeof v === 'string' ? v.trim() : '').slice(0, max);
}

type MilestoneRow = { year: string; month?: string; day?: string; title: string };

function readMilestones(formData: FormData): MilestoneRow[] {
  const years = formData.getAll('ms_year');
  const months = formData.getAll('ms_month');
  const days = formData.getAll('ms_day');
  const titles = formData.getAll('ms_title');
  const rows: MilestoneRow[] = [];
  for (let i = 0; i < years.length; i++) {
    const year = str(years[i] ?? null, 4);
    const title = str(titles[i] ??
      null, SHORT_MAX);
    if (!year || !title) continue; // a row needs at least a year + a title
    const month = str(months[i] ?? null, 2);
    const day = str(days[i] ?? null, 2);
    rows.push({ year, ...(month ? { month } : {}), ...(day ? { day } : {}), title });
  }
  // Cap the timeline (a couple can't balloon their own blob into every /[slug] render).
  if (rows.length > 100) rows.length = 100;
  // Auto-sorted chronologically — the canonical milestones behavior.
  rows.sort(
    (a, b) =>
      Number(a.year) - Number(b.year) ||
      Number(a.month ?? 0) - Number(b.month ?? 0) ||
      Number(a.day ?? 0) - Number(b.day ?? 0),
  );
  return rows;
}

export async function updateOurStory(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Read the stored blob first so unedited/unknown keys survive the merge.
  const { data: current } = await supabase
    .from('events')
    .select('love_story')
    .eq('event_id', eventId)
    .maybeSingle();
  const existing =
    current?.love_story && typeof current.love_story === 'object'
      ? (current.love_story as Record<string, unknown>)
      : {};
  const existingAnchors =
    existing.anchors && typeof existing.anchors === 'object'
      ? (existing.anchors as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = { ...existing };
  for (const key of TEXT_FIELDS) merged[key] = str(formData.get(key), FIELD_MAX);
  for (const key of SHORT_FIELDS) merged[key] = str(formData.get(key), SHORT_MAX);
  for (const key of YEAR_FIELDS) merged[key] = str(formData.get(key), YEAR_MAX);
  merged.anchors = {
    ...existingAnchors,
    ...Object.fromEntries(ANCHOR_KEYS.map((k) => [k, str(formData.get(`anchor_${k}`), SHORT_MAX)])),
  };
  merged.milestones = readMilestones(formData);

  // together_since is DUAL-STORED: onboarding writes both the blob and the
  // events.together_since column, and public readers PREFER the column
  // (editorial data.ts, event-brief). Keep both in sync or edits are no-ops.
  const togetherSince = str(formData.get('together_since'), SHORT_MAX);

  const { data: event, error } = await supabase
    .from('events')
    .update({ love_story: merged, together_since: togetherSince || null })
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
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/our-story?saved=1`, '?saved=1'),
  );
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

function momentFields(formData: FormData, prior: LoveStoryMoment | null, id: string): LoveStoryMoment | null {
  const date = readMomentDate({
    y: formData.get('date_y'),
    m: formData.get('date_m'),
    d: formData.get('date_d'),
  });
  const line = str(formData.get('line'), MOMENT_LINE_MAX);
  if (!date || !line) return null; // a moment needs at least a year and a line
  const place = str(formData.get('place'), MOMENT_PLACE_MAX);
  const addedBy = str(formData.get('added_by'), MOMENT_BY_MAX);
  const anchorRaw = formData.get('anchor');
  const anchor = anchorRaw === 'met' || anchorRaw === 'yes' ? anchorRaw : undefined;
  const media = readMomentMedia(formData.getAll('media'));
  return {
    id,
    date,
    line,
    ...(place ? { place } : {}),
    ...(media.length ? { media } : {}),
    ...(addedBy ? { added_by: addedBy } : {}),
    ...(anchor ? { anchor } : {}),
    ...(formData.get('hidden') === 'on' ? { hidden: true } : {}),
    canvas: prior?.canvas ?? {},
  };
}

/** One anchor of each kind: tagging a second "How we met" moves the tag. */
function oneAnchorEach(list: LoveStoryMoment[], keeper: LoveStoryMoment): LoveStoryMoment[] {
  if (!keeper.anchor) return list;
  return list.map((m) => {
    if (m.id === keeper.id || m.anchor !== keeper.anchor) return m;
    const { anchor: _drop, ...rest } = m;
    return rest;
  });
}

export async function loveStoryMomentAction(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const back = `/dashboard/${eventId}/website/our-story`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const intentRaw = String(formData.get('intent') ?? '');
  if (!(MOMENT_INTENTS as readonly string[]).includes(intentRaw)) fail('That did not save. Please try again.');
  const intent = intentRaw as MomentIntent;

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from('events')
    .select('love_story')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError || !current) return fail('Could not open your story. Please try again.');
  const stored: unknown = current.love_story;
  const existing: Record<string, unknown> =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};

  const before = resolveMoments(existing);
  const id = str(formData.get('id'), 40);
  const prior = before.find((m) => m.id === id) ?? null;
  let after: LoveStoryMoment[] = before;
  let touched: LoveStoryMoment | null = null;

  if (intent === 'add') {
    const m = momentFields(formData, null, newMomentId(before));
    if (!m) return fail('A moment needs a year and a line — nothing else is required.');
    touched = m;
    after = oneAnchorEach([...before, m], m);
  } else if (intent === 'edit') {
    if (!prior) return fail('That moment is no longer here.');
    const m = momentFields(formData, prior, id);
    if (!m) return fail('A moment needs a year and a line — nothing else is required.');
    touched = m;
    after = oneAnchorEach(before.map((x) => (x.id === id ? m : x)), m);
  } else if (intent === 'delete') {
    after = before.filter((m) => m.id !== id);
  } else if (intent === 'arrange') {
    // Show on / keep off the Event Hub — the Maker's eye, per moment.
    if (!prior) return fail('That moment is no longer here.');
    const hide = formData.get('hidden') === 'on';
    after = before.map((m) => {
      if (m.id !== id) return m;
      const { hidden: _h, ...rest } = m;
      return hide ? { ...rest, hidden: true } : rest;
    });
  } else {
    // 'pick' — "Pick from our events": refs one of THEIR events already holds.
    // Nothing is copied; a ref from anywhere else is dropped.
    if (!prior) return fail('Choose the moment to add these to.');
    const mine = await myEventPhotoRefs(supabase, user.id);
    const allowed = readMomentMedia(formData.getAll('media')).filter((ref) => mine.has(ref));
    const media = readMomentMedia([...(prior.media ?? []), ...allowed]);
    const m: LoveStoryMoment = { ...prior, ...(media.length ? { media } : {}) };
    touched = m;
    after = before.map((x) => (x.id === id ? m : x));
  }

  // ── THE CAP, ON THE SERVER ─────────────────────────────────────────────────
  const ownsPro = await eventCoupleWebsiteProActive(supabase, eventId);
  const refusal = momentCapRefusal({ before, after, ownsPro });
  if (refusal === 'max') return fail('Your story holds 100 moments — the most one Event Hub can show.');
  if (refusal) redirect(`${back}?pro=${refusal === 'photos_pro' ? 'photos' : 'stories'}`);

  // ── NEW PHOTOS ARE SCREENED BEFORE THEY ARE WRITTEN (fail-closed) ─────────
  const held = new Set(before.flatMap((m) => m.media ?? []));
  const newRefs = [...new Set(after.flatMap((m) => m.media ?? []))].filter((r) => !held.has(r));
  if (newRefs.length > 0) {
    const blocked = await screenNewRefs(newRefs);
    if (blocked.length > 0) {
      after = after.map((m) => (m.media ? { ...m, media: m.media.filter((r) => !blocked.includes(r)) } : m));
    }
  }

  const { data: saved, error } = await supabase
    .from('events')
    .update({ love_story: { ...existing, moments: storableMoments(after) } })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();
  // A 0-row update (RLS) reads as !saved with no error — a failure, never "Saved".
  if (error || !saved) return fail('Could not save your story. Please try again.');

  revalidatePath(back);
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidateGuestSite(saved.slug);

  let slotted = '';
  if (touched && (intent === 'add' || intent === 'edit')) {
    const chapter = chapterOf(touched, after);
    slotted = `&slotted=${encodeURIComponent(
      `${formatMomentDate(touched.date)} · ${LOVE_STORY_CHAPTER_LABEL[chapter]}`,
    )}#moment-${touched.id}`;
  }
  redirect(`${back}?saved=1${slotted}`);
}

/** Every public photo ref held by an event this user is a couple on. */
async function myEventPhotoRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Set<string>> {
  const { data: rows } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  const ids = (rows ?? []).map((r) => r.event_id as string);
  if (ids.length === 0) return new Set();
  const { data: events } = await supabase
    .from('events')
    .select('our_photos, landing_page_hero_image_url')
    .in('event_id', ids);
  const out = new Set<string>();
  for (const e of events ?? []) {
    // One at a time: `readMomentMedia` caps a LIST at a moment's four.
    const all: unknown[] = [e.landing_page_hero_image_url, ...(Array.isArray(e.our_photos) ? e.our_photos : [])];
    for (const v of all) for (const ref of readMomentMedia([v])) out.add(ref);
  }
  return out;
}

/** The `updateOurPhotos` screen: any undecidable ref is BLOCKED, never passed. */
async function screenNewRefs(refs: string[]): Promise<string[]> {
  const [{ classifyImageBytes, decideNsfw, parseR2Ref }, { readR2Object }, { R2_BUCKETS }] = await Promise.all([
    import('@/lib/nsfw-screen'),
    import('@/lib/drive-upload'),
    import('@/lib/r2'),
  ]);
  const blocked: string[] = [];
  for (const ref of refs) {
    try {
      const { bucket, key } = parseR2Ref(ref);
      const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);
      if (decideNsfw(await classifyImageBytes(bytes)) === 'nsfw_blocked') blocked.push(ref);
    } catch {
      blocked.push(ref);
    }
  }
  return blocked;
}
