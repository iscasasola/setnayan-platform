'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isChapterKind,
  normalizeEmbed,
  type ChapterKind,
} from '@/lib/creator-chapters';
import { notifyFollowersOfNewChapter } from '@/lib/creator-notify';

const SURFACE = '/dashboard/creator';

function fail(message: string): never {
  redirect(`${SURFACE}?error=${encodeURIComponent(message)}`);
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
 * Substrate = the raw moat behind the chapter (Papic gallery id / itinerary /
 * booked vendor ids). Stored now, surfaced publicly in CP-3/CP-4. We keep a
 * conservative, explicit shape and drop anything else.
 */
function readSubstrate(formData: FormData): Record<string, unknown> | undefined {
  if (
    !formData.has('papic_gallery_id') &&
    !formData.has('itinerary') &&
    !formData.has('vendor_ids')
  ) {
    return undefined;
  }
  const galleryRaw = formData.get('papic_gallery_id');
  const itineraryRaw = formData.get('itinerary');
  const vendorsRaw = formData.get('vendor_ids');

  const substrate: Record<string, unknown> = {};
  if (typeof galleryRaw === 'string' && galleryRaw.trim()) {
    substrate.papic_gallery_id = galleryRaw.trim().slice(0, 200);
  }
  if (typeof itineraryRaw === 'string' && itineraryRaw.trim()) {
    substrate.itinerary = itineraryRaw.trim().slice(0, 4000);
  }
  if (typeof vendorsRaw === 'string' && vendorsRaw.trim()) {
    const ids = vendorsRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length > 0) substrate.vendor_ids = ids;
  }
  return substrate;
}

export async function createChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const title = readTitle(formData);
  const kind = readKind(formData);
  const embed = readEmbed(formData, { allowEmpty: true });
  const substrate = readSubstrate(formData);

  const insert: Record<string, unknown> = { user_id: userId, title, kind };
  if (embed) {
    insert.embed_url = embed.embed_url;
    insert.embed_provider = embed.embed_provider;
  }
  if (substrate) insert.substrate = substrate;

  const { error } = await supabase.from('creator_chapters').insert(insert);
  if (error) fail(error.message);

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
  const substrate = readSubstrate(formData);
  if (substrate) update.substrate = substrate;

  const { error } = await supabase
    .from('creator_chapters')
    .update(update)
    .eq('chapter_id', chapterId)
    .eq('user_id', userId);
  if (error) fail(error.message);

  revalidatePath(SURFACE);
  redirect(`${SURFACE}?saved=1`);
}

export async function publishChapter(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const chapterId = formData.get('chapter_id');
  if (typeof chapterId !== 'string' || !chapterId) fail('Missing chapter.');

  // A chapter's core IS the embedded edit — never publish an empty one. Also
  // read status + identity so we only fan out to followers on a genuine
  // draft→published transition (re-publishing an already-live chapter must not
  // re-notify).
  const { data: row } = await supabase
    .from('creator_chapters')
    .select('embed_url, status, public_id, title')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) fail('Chapter not found.');
  if (!row.embed_url) fail('Add the embedded edit before publishing.');
  const wasDraft = row.status !== 'published';

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
