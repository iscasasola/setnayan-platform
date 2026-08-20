'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isChapterKind,
  normalizeChapterBody,
  normalizeEmbed,
  type ChapterKind,
} from '@/lib/creator-chapters';
import { buildChapterTeaserPlan, type TeaserPlan } from '@/lib/creator-teaser';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { R2_BUCKETS } from '@/lib/r2';
import { notifyFollowersOfNewChapter } from '@/lib/creator-notify';
import { resolveEventTie } from '@/lib/chapter-event-participation';

const SURFACE = '/dashboard/creator';

function fail(message: string): never {
  redirect(`${SURFACE}?error=${encodeURIComponent(message)}`);
}

/**
 * Turn a database refusal into a sentence a person can act on.
 *
 * `chapter_event_not_yours` is raised by the `set_chapter_host_inclusion`
 * trigger when a write names a celebration the account has no tie to. The
 * composer already checks that before writing, so in practice this fires only
 * for a request that did not come from our own form — but a raw
 * `chapter_event_not_yours` on screen would be the product speaking SQL to
 * somebody, and a legitimate race (the tie ending between the page load and the
 * save) lands here too.
 */
function failWithDbMessage(message: string): never {
  if (message.includes('chapter_event_not_yours')) {
    fail('You can only attach a celebration you host or worked on.');
  }
  fail(message);
}

/**
 * Resolve the signed-in user. Chapter authoring is USER-NATIVE (owner
 * 2026-07-16): ANY authenticated account may create + publish chapters — there
 * is no `is_creator` gate anymore. Writes go through the authenticated Supabase
 * client, whose RLS is pure Pattern A (`user_id = auth.uid()`), so a user only
 * ever touches THEIR OWN rows.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

function readKind(formData: FormData): ChapterKind {
  const kind = formData.get('kind');
  if (!isChapterKind(kind)) fail('Pick a chapter type.');
  return kind;
}

function readTitle(formData: FormData): string {
  const raw = formData.get('title');
  const title = typeof raw === 'string' ? raw.trim().slice(0, 160) : '';
  if (title.length === 0) fail('A chapter needs a title.');
  return title;
}

/**
 * Resolve the embed field to a normalized {embed_url, embed_provider} pair, or
 * an explicit clear ({null, null}) when the field was submitted empty. Returns
 * `undefined` when the caller should leave the columns untouched.
 */
function readEmbed(
  formData: FormData,
  { allowEmpty }: { allowEmpty: boolean },
): { embed_url: string; embed_provider: string } | { embed_url: null; embed_provider: null } | undefined {
  if (!formData.has('embed_url')) return undefined;
  const raw = formData.get('embed_url');
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value.length === 0) {
    if (allowEmpty) return { embed_url: null, embed_provider: null };
    fail('Paste a YouTube, Instagram, or TikTok link for the embed.');
  }
  const normalized = normalizeEmbed(value);
  if (!normalized) {
    fail('That link is not an embeddable YouTube, Instagram, or TikTok video.');
  }
  return { embed_url: normalized.embedUrl, embed_provider: normalized.provider };
}

/**
 * The chapter's EDITORIAL — the story itself. Returns `undefined` when the form
 * did not carry the field at all (leave the column alone), '' when it was
 * submitted empty (an explicit clear, legal on a draft).
 *
 * Formerly `substrate.itinerary`. See migration 20271140092009 for why the
 * value was renamed rather than documented around.
 */
function readBody(formData: FormData): string | undefined {
  if (!formData.has('body')) return undefined;
  return normalizeChapterBody(formData.get('body'));
}

/**
 * Substrate = the raw moat behind the chapter (Papic gallery id / booked vendor
 * ids). Stored now, surfaced publicly in CP-3/CP-4. We keep a conservative,
 * explicit shape and drop anything else.
 *
 * ⚠ `itinerary` is GONE from this bag — it became the first-class `body` column
 * (the story), and leaving a second home for the same value is how the old
 * travel-shaped name comes back.
 */
function readSubstrate(
  formData: FormData,
  eventId: string | null | undefined,
): Record<string, unknown> | undefined {
  const vendorsRaw = formData.get('vendor_ids');
  const hasVendors = typeof vendorsRaw === 'string' && vendorsRaw.trim().length > 0;
  if (eventId === undefined && !hasVendors) return undefined;

  const substrate: Record<string, unknown> = {};

  // 🔑 ONE HOME FOR THE DAY, DERIVED — NEVER ASKED FOR TWICE.
  // `papic_gallery_id` used to be its own text box asking the author to paste a
  // raw event id. It is now WRITTEN FROM `event_id`, so the author answers the
  // question once, in a picker, and both consumers stay fed: the shoppable
  // vendor cards read the column, and the teaser generator reads this.
  // Two homes for one fact is exactly how the shipped feature ended up half
  // working — the box the author could fill drove "shop this event", while the
  // real column drove the cross-links and was never written at all.
  if (eventId) substrate.papic_gallery_id = eventId;

  if (hasVendors) {
    const ids = (vendorsRaw as string)
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length > 0) substrate.vendor_ids = ids;
  }
  return substrate;
}

/**
 * Which celebration is this chapter about?
 *
 * Returns the event id when the author picked one, `null` when they explicitly
 * chose "not about one of my celebrations", and `undefined` when the field was
 * not submitted at all (leave the column untouched).
 *
 * 🔑 THE PICKER REPLACED A BOX THAT ASKED FOR A MACHINE ID. To put a real day
 * behind their story an author previously had to paste a raw event id, and
 * comma-separated vendor ids beside it. Nobody ever did: the one published
 * chapter in production carries neither, so "the real event underneath" — the
 * whole reason a chapter beats a bare video link — was a door that opened for
 * nobody.
 *
 * 🔒 THE SUBMITTED VALUE IS NEVER TRUSTED. The form is a list, but a form can be
 * posted with anything, so the id is re-checked against the celebrations this
 * account actually HOSTS before it is stored. Attaching a chapter to a day
 * surfaces that day's name, date, venue and booked suppliers on a public page —
 * a stranger must not be able to hang their page off somebody else's wedding.
 *
 * ⚠ HOSTS ONLY, FOR NOW, AND DELIBERATELY. A guest or a booked supplier
 * legitimately wants to tell the story of a day they attended, but that needs
 * the couple's yes — a request-and-approve step that does not exist yet. Until
 * it does, the honest behaviour is that their list is empty rather than a
 * silent grant over somebody else's celebration.
 */
async function readEventLink(
  formData: FormData,
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
): Promise<string | null | undefined> {
  if (!formData.has('event_id')) return undefined;
  const raw = formData.get('event_id');
  const picked = typeof raw === 'string' ? raw.trim() : '';
  if (!picked) return null; // "Not about one of my celebrations."

  // 🔒 The tie is proven server-side — a form can be posted with any id, and
  // attaching surfaces that day's name, date, venue and booked suppliers.
  const tie = await resolveEventTie(userId, picked);
  if (!tie) fail('You can only attach a celebration you host or worked on.');
  return picked;
}

export async function createChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const title = readTitle(formData);
  const kind = readKind(formData);
  const embed = readEmbed(formData, { allowEmpty: true });
  const eventId = await readEventLink(formData, supabase, userId);
  const substrate = readSubstrate(formData, eventId);

  const body = readBody(formData);

  const insert: Record<string, unknown> = { user_id: userId, title, kind };
  if (embed) {
    insert.embed_url = embed.embed_url;
    insert.embed_provider = embed.embed_provider;
  }
  if (body !== undefined) insert.body = body;
  // 🔴 THE WRITER THIS COLUMN NEVER HAD. `creator_chapters.event_id` was
  // selected, joined and commented about in three files, and set by NOTHING —
  // so the cross-links between a couple's own chapter and Setnayan's editorial
  // about the same day could never once appear. Production: one published
  // chapter, event_id NULL.
  if (eventId !== undefined) insert.event_id = eventId;
  if (substrate) insert.substrate = substrate;

  const { error } = await supabase.from('creator_chapters').insert(insert);
  if (error) failWithDbMessage(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?created=1`);
}

export async function updateChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const chapterId = formData.get('chapter_id');
  if (typeof chapterId !== 'string' || !chapterId) fail('Missing chapter.');

  const update: Record<string, unknown> = {
    title: readTitle(formData),
    kind: readKind(formData),
    updated_at: new Date().toISOString(),
  };
  const embed = readEmbed(formData, { allowEmpty: true });
  if (embed) {
    update.embed_url = embed.embed_url;
    update.embed_provider = embed.embed_provider;
  }
  const body = readBody(formData);
  if (body !== undefined) update.body = body;
  const eventId = await readEventLink(formData, supabase, userId);
  // Unlinking is a real answer, so `null` must be written, not skipped —
  // `undefined` (field absent) is the only case that leaves the column alone.
  if (eventId !== undefined) update.event_id = eventId;
  const substrate = readSubstrate(formData, eventId);
  if (substrate) update.substrate = substrate;

  const { error } = await supabase
    .from('creator_chapters')
    .update(update)
    .eq('chapter_id', chapterId)
    .eq('user_id', userId);
  if (error) failWithDbMessage(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?saved=1`);
}

export async function publishChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const chapterId = formData.get('chapter_id');
  if (typeof chapterId !== 'string' || !chapterId) fail('Missing chapter.');

  // A chapter's core is the WRITING (owner 2026-08-12) — never publish an empty
  // one. Also read status + identity so we only fan out to followers on a
  // genuine draft→published transition (re-publishing an already-live chapter
  // must not re-notify).
  const { data: row } = await supabase
    .from('creator_chapters')
    .select('body, embed_url, status, public_id, title')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) fail('Chapter not found.');

  // THE GATE, REPLACED. It used to be `if (!row.embed_url)` — "Add the embedded
  // edit before publishing" — which made an external video account a
  // precondition for telling your own story, and was the measured reason prod
  // held 0 chapters. A video is now optional; the story is not.
  if (typeof row.body !== 'string' || row.body.trim().length === 0) {
    fail('Write your story before publishing — a title and the story itself. The video is optional.');
  }

  // Only fan out to followers on a genuine draft→published transition;
  // re-publishing an already-live chapter must not re-notify.
  const wasDraft = row.status !== 'published';

  // ⚠ PUBLISHING IS NOT ENOUGH ON ITS OWN, AND SILENCE HERE WOULD BE THE WHOLE
  // BUG AGAIN. A published chapter is only reachable when the author also has
  // (a) a public web address and (b) their public page switched on. Both are
  // OFF/absent by default and 8 of 9 prod accounts had no address at all
  // (measured 2026-08-12) — so a publish that ignored them would report success
  // and put the story precisely nowhere. Same family as every other
  // rejected-not-thrown defect in this repo: the only symptom is an absence.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('slug, public_profile_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  // Fail CLOSED on a read error: publishing into an unknown profile state is
  // exactly the silent-nowhere outcome this block exists to prevent.
  if (profileError || !profile) {
    fail('We could not check your public page just now. Please try again in a moment.');
  }
  if (!profile.slug) {
    // Deliberately NOT auto-minted. A person's handle is their permanent public
    // address — the forwarding ledger exists because renames break links people
    // already printed — so it is chosen, never assigned by a side effect.
    fail('Pick your web address first (Profile → Your address), then publish. That address is where people will read your story.');
  }

  const { error } = await supabase
    .from('creator_chapters')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('chapter_id', chapterId)
    .eq('user_id', userId);
  if (error) fail(error.message);

  // ONE PRESS. Publishing IS the decision to be read, so it also opens the
  // public page rather than leaving the story stranded behind a switch the
  // author never knew about. The button's copy states this before the press
  // (see the creator surface) — a privacy-relevant change is never silent.
  if (profile.public_profile_enabled !== true) {
    const { error: openError } = await supabase
      .from('users')
      .update({ public_profile_enabled: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (openError) fail(openError.message);
    revalidatePath('/u', 'layout');
  }

  // Notify followers — only on the first publish, fire-and-forget (never blocks
  // the redirect). No-op when the author has no followers or a hidden profile.
  if (wasDraft) {
    after(() =>
      notifyFollowersOfNewChapter({
        authorUserId: userId,
        chapterPublicId: row.public_id as string,
        chapterTitle: (row.title as string) ?? '',
      }),
    );
  }

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?published=1`);
}

export async function unpublishChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const chapterId = formData.get('chapter_id');
  if (typeof chapterId !== 'string' || !chapterId) fail('Missing chapter.');

  const { error } = await supabase
    .from('creator_chapters')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('chapter_id', chapterId)
    .eq('user_id', userId);
  if (error) fail(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?unpublished=1`);
}

// ---------------------------------------------------------------------------
// Owned-music TEASER (CP-2) — client-side render, server bookends the plan +
// the finalize write. See lib/creator-teaser.ts for the owned-music guarantee.
// ---------------------------------------------------------------------------

/**
 * Build the teaser render PLAN for a chapter (which photos, which owned track).
 * Returns the plan to the client — the encode itself runs in the browser. Never
 * redirects on the "can't build yet" case; it hands back `canRender:false` + a
 * reason so the client can show it inline.
 */
export async function prepareChapterTeaser(chapterId: string): Promise<TeaserPlan> {
  const { supabase, userId } = await requireUser();
  if (typeof chapterId !== 'string' || !chapterId) {
    return {
      canRender: false,
      reason: 'Missing chapter.',
      photos: [],
      musicUrl: null,
      beatGrid: null,
      musicLabel: null,
      targetSec: 0,
    };
  }

  const { data: row } = await supabase
    .from('creator_chapters')
    .select('substrate')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) {
    return {
      canRender: false,
      reason: 'Chapter not found.',
      photos: [],
      musicUrl: null,
      beatGrid: null,
      musicLabel: null,
      targetSec: 0,
    };
  }

  return buildChapterTeaserPlan(
    supabase,
    (row.substrate ?? null) as Record<string, unknown> | null,
  );
}

/**
 * Persist a rendered teaser: point the chapter's `teaser_r2_key` at the blob the
 * browser just PUT to R2 (via /api/creator/teaser-upload). Returns a presigned
 * GET so the client can preview/download the saved copy.
 */
export async function finalizeChapterTeaser(args: {
  chapterId: string;
  bucket: string;
  key: string;
}): Promise<{ downloadUrl: string | null }> {
  const { supabase, userId } = await requireUser();
  const { chapterId, bucket, key } = args;
  if (!chapterId || !bucket || !key) fail('Missing teaser upload result.');

  // SEC-1: `bucket` + `key` were trusted verbatim — ANY signed-in account (the
  // creator surface has no is_creator gate) could pass an arbitrary bucket/key
  // and get it signed. Worse, the ownership UPDATE below matches on
  // (chapter_id, user_id) but PostgREST returns NO error when it matches ZERO
  // rows, so the presign ran even for a chapter the caller does not own.
  //
  // Fix: derive the key exactly as /api/creator/teaser-upload mints it
  // (`creator/teasers/{chapterId}.{ext}`, media bucket) — taking only the file
  // extension from the client — and make the ownership write PROVE it matched.
  // chapterId is interpolated into an object key, so it must be a UUID — a
  // value with a `/` would escape the `creator/teasers/` prefix. (The UPDATE
  // below would also reject a non-uuid against the uuid column, but a key is
  // being built here, so guard it before that.)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId)) {
    fail('Chapter not found.');
  }
  const ext = String(key).split('.').pop() ?? '';
  if (!/^[a-z0-9]{2,5}$/.test(ext)) fail('Missing teaser upload result.');
  const ref = `r2://${R2_BUCKETS.media}/creator/teasers/${chapterId}.${ext}`;

  const { data: updated, error } = await supabase
    .from('creator_chapters')
    .update({ teaser_r2_key: ref, updated_at: new Date().toISOString() })
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .select('chapter_id');
  if (error) fail(error.message);
  // Zero rows = not the caller's chapter (or no such chapter). Refuse BEFORE
  // presigning — this is the check the original `if (error)` never performed.
  if (!updated || updated.length === 0) fail('Chapter not found.');

  let downloadUrl: string | null = null;
  try {
    downloadUrl = await displayUrlForStoredAsset(ref);
  } catch {
    downloadUrl = null;
  }

  revalidatePath(SURFACE);
  return { downloadUrl };
}

export async function deleteChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const chapterId = formData.get('chapter_id');
  if (typeof chapterId !== 'string' || !chapterId) fail('Missing chapter.');

  const { error } = await supabase
    .from('creator_chapters')
    .delete()
    .eq('chapter_id', chapterId)
    .eq('user_id', userId);
  if (error) fail(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?deleted=1`);
}
