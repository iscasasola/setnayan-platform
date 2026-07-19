'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Creator "Adventure Chapter" — AUDIENCE server actions (owner 2026-07-16).
//
// Two audience primitives, both invoked from small client islands so the public
// /u profile + chapter pages stay ISR-cacheable (they never read cookies/auth on
// the hot render path — these actions do, out of band):
//
//   • VIEW BEACON — recordChapterView / recordProfileView bump the aggregate,
//     PRIVACY-SAFE view counters (no per-viewer row, no PII). Light dedup via a
//     first-party httpOnly rolling cookie avoids refresh-spam. The increment is
//     an atomic, self-gated SECURITY DEFINER RPC (never inflates a draft/hidden
//     target), reached through the service-role admin client. CRON-FREE.
//
//   • FOLLOW — getFollowState / followUser / unfollowUser drive the Follow
//     button. Writes go through the AUTHENTICATED client, so RLS Pattern A
//     (follower_user_id = auth.uid()) keeps a caller on their OWN follow rows;
//     the follow GRAPH is never exposed. users.followers_count (the only public
//     audience number) is maintained by the DB trigger on user_follows.

// Rolling dedup cookies: a capped, comma-joined FIFO list of the ids this
// browser has already counted. First-party + httpOnly + the viewer's own device
// — it's the viewer's private "already seen" list, never transmitted anywhere.
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const VIEW_DEDUP_CAP = 60;
const CHAPTER_VIEW_COOKIE = 'sn_vc';
const PROFILE_VIEW_COOKIE = 'sn_vp';

function parseSeen(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

/**
 * Record ONE public view of a target id under `cookieName`, deduped against the
 * rolling cookie. Returns true when this was a fresh view (caller should then
 * run the increment) or false when it was a repeat within the dedup window.
 * Best-effort: any cookie error falls through to "fresh" (better to slightly
 * over-count than to lose a genuine view).
 */
async function claimFreshView(cookieName: string, id: string): Promise<boolean> {
  try {
    const jar = await cookies();
    const seen = parseSeen(jar.get(cookieName)?.value);
    if (seen.includes(id)) return false;
    const next = [...seen, id].slice(-VIEW_DEDUP_CAP);
    jar.set(cookieName, next.join(','), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VIEW_COOKIE_MAX_AGE,
    });
    return true;
  } catch {
    return true;
  }
}

/** Beacon: +1 a published chapter's aggregate view_count (deduped). */
export async function recordChapterView(publicId: string): Promise<void> {
  if (typeof publicId !== 'string' || !publicId) return;
  if (!(await claimFreshView(CHAPTER_VIEW_COOKIE, publicId))) return;
  try {
    const admin = createAdminClient();
    await admin.rpc('increment_chapter_view' as never, {
      p_public_id: publicId,
    } as never);
  } catch {
    /* best-effort — a lost view never breaks the render */
  }
}

/** Beacon: +1 an account's aggregate profile_view_count (deduped). */
export async function recordProfileView(userId: string): Promise<void> {
  if (typeof userId !== 'string' || !userId) return;
  if (!(await claimFreshView(PROFILE_VIEW_COOKIE, userId))) return;
  try {
    const admin = createAdminClient();
    await admin.rpc('increment_profile_view' as never, {
      p_user_id: userId,
    } as never);
  } catch {
    /* best-effort */
  }
}

export type FollowState = {
  signedIn: boolean;
  isSelf: boolean;
  following: boolean;
};

/**
 * The Follow button's state for the signed-in viewer vs. `followedUserId`.
 * Reads the viewer's OWN follow row via the authenticated client (Pattern A —
 * a caller can only ever see their own follows). Never discloses whether anyone
 * ELSE follows the target.
 */
export async function getFollowState(
  followedUserId: string,
): Promise<FollowState> {
  const base: FollowState = { signedIn: false, isSelf: false, following: false };
  if (typeof followedUserId !== 'string' || !followedUserId) return base;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return base;
    if (user.id === followedUserId) {
      return { signedIn: true, isSelf: true, following: false };
    }
    const { data } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_user_id', user.id)
      .eq('followed_user_id', followedUserId)
      .maybeSingle();
    return { signedIn: true, isSelf: false, following: !!data };
  } catch {
    return base;
  }
}

export type FollowResult = { ok: boolean; following: boolean };

/**
 * Guard: a Follow is only meaningful toward a PUBLIC profile (that's the only
 * place the button appears). Verifying the target is public via the admin
 * client also blocks a hand-crafted request from inflating a private account's
 * followers_count.
 */
async function targetIsPublic(followedUserId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('users')
      .select('public_profile_enabled')
      .eq('user_id', followedUserId)
      .maybeSingle();
    return data?.public_profile_enabled === true;
  } catch {
    return false;
  }
}

/** Follow `followedUserId`. Idempotent (unique constraint → repeat is a no-op). */
export async function followUser(followedUserId: string): Promise<FollowResult> {
  if (typeof followedUserId !== 'string' || !followedUserId) {
    return { ok: false, following: false };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, following: false };
  if (user.id === followedUserId) return { ok: false, following: false };
  if (!(await targetIsPublic(followedUserId))) {
    return { ok: false, following: false };
  }
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_user_id: user.id, followed_user_id: followedUserId });
  // 23505 = unique violation (already following) → treat as success.
  if (error && error.code !== '23505') {
    return { ok: false, following: false };
  }
  return { ok: true, following: true };
}

/** Unfollow `followedUserId`. Idempotent (deleting a non-row is a no-op). */
export async function unfollowUser(
  followedUserId: string,
): Promise<FollowResult> {
  if (typeof followedUserId !== 'string' || !followedUserId) {
    return { ok: false, following: false };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, following: true };
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_user_id', user.id)
    .eq('followed_user_id', followedUserId);
  if (error) return { ok: false, following: true };
  return { ok: true, following: false };
}
