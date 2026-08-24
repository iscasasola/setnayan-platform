import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob } from '@/lib/periodic-jobs';
import { isR2Configured, r2Delete, type R2BucketName } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { displayUrlForStoredAsset } from '@/lib/uploads';

// Samahan Stories (owner 2026-08-24 — "the same setlog concept"): a member
// shares one short clip an hour into their samahan, and it is gone after 24
// hours. The 24-hour VISIBILITY promise lives in the RLS read policy
// (expires_at > now()); this module is the read helper plus the storage
// sweep that makes the deletion physical — R2 objects first, row last, so a
// failed file delete leaves the row behind for the next sweep to retry
// instead of orphaning bytes nothing can name any more.

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** One sweep pass deletes at most this many stories (bounded work per request). */
export const STORY_SWEEP_LIMIT = 200;
/** Minimum gap between sweep runs — the claim key's window. */
export const STORY_SWEEP_GAP_MS = 60 * 60 * 1000;

export type SamahanStory = {
  story_id: string;
  user_id: string;
  author_name: string;
  is_self: boolean;
  duration_ms: number;
  created_at: string;
  expires_at: string;
  clip_url: string | null;
  poster_url: string | null;
};

/**
 * Live stories of one community, newest first, with presigned display URLs.
 * Reads through the CALLER'S client so RLS does the scoping (member-only,
 * expired-hidden) — the admin client is used ONLY for display names, the
 * exact split fetchCommunityRoster already uses.
 */
export async function fetchSamahanStories(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  communityId: string,
  viewerId: string,
): Promise<SamahanStory[]> {
  const { data, error } = await supabase
    .from('samahan_stories')
    .select('story_id, user_id, duration_ms, created_at, expires_at, r2_object_key, poster_r2_key')
    .eq('community_id', communityId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(96);
  if (error || !data) return [];
  const rows = data as Array<{
    story_id: string;
    user_id: string;
    duration_ms: number;
    created_at: string;
    expires_at: string;
    r2_object_key: string;
    poster_r2_key: string;
  }>;
  if (rows.length === 0) return [];

  const names = new Map<string, string>();
  const { data: nameRows } = await admin
    .from('users')
    .select('user_id, display_name')
    .in('user_id', [...new Set(rows.map((r) => r.user_id))]);
  for (const r of (nameRows ?? []) as Array<{ user_id: string; display_name: string | null }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.user_id, label);
  }

  return await Promise.all(
    rows.map(async (r) => ({
      story_id: r.story_id,
      user_id: r.user_id,
      author_name: names.get(r.user_id) ?? 'Member',
      is_self: r.user_id === viewerId,
      duration_ms: r.duration_ms,
      created_at: r.created_at,
      expires_at: r.expires_at,
      clip_url: await displayUrlForStoredAsset(r.r2_object_key),
      poster_url: await displayUrlForStoredAsset(r.poster_r2_key),
    })),
  );
}

/**
 * Physically deletes ONE story: R2 objects first, row last. Returns false if
 * any file delete failed (the row stays, a later sweep retries). Shared by
 * the author's own "take it down" path and the expiry sweep — one deleter,
 * one ordering rule.
 */
export async function hardDeleteStory(
  admin: SupabaseClient,
  story: { id?: number; story_id?: string; r2_object_key: string; poster_r2_key: string },
): Promise<boolean> {
  for (const ref of [story.r2_object_key, story.poster_r2_key]) {
    const parsed = parseR2Ref(ref);
    if (!parsed.bucket) continue; // not an r2:// ref — nothing of ours to delete
    try {
      await r2Delete({ bucket: parsed.bucket as R2BucketName, key: parsed.key });
    } catch {
      return false; // keep the row; the sweep retries
    }
  }
  const q = admin.from('samahan_stories').delete();
  const { error } =
    story.id != null ? await q.eq('id', story.id) : await q.eq('story_id', story.story_id ?? '');
  return !error;
}

/**
 * Cron-free expiry sweep (claim_periodic_job pattern): fired from after() on
 * member-facing traffic. RLS already hides expired stories the moment they
 * expire — this pass reclaims the bytes. Never throws.
 */
export async function maybeRunSamahanStorySweep(): Promise<void> {
  try {
    if (!isR2Configured()) return;
    if (!(await claimPeriodicJob('samahan-story-sweep', STORY_SWEEP_GAP_MS))) return;
    const admin = createAdminClient();
    const { data } = await admin
      .from('samahan_stories')
      .select('id, r2_object_key, poster_r2_key')
      .lt('expires_at', new Date().toISOString())
      .limit(STORY_SWEEP_LIMIT);
    for (const row of (data ?? []) as Array<{
      id: number;
      r2_object_key: string;
      poster_r2_key: string;
    }>) {
      await hardDeleteStory(admin, row);
    }
  } catch (e) {
    console.warn('[samahan-story-sweep] pass failed', e);
  }
}
