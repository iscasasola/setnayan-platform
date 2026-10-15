'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Creator "Adventure Chapter" — AUDIENCE server actions (owner 2026-07-16).
//
// Two audience primitives, both invoked from small client islands so the public
// /u profile + chapter pages stay ISR-cacheable (they never read cookies/auth on
// the hot render path — these actions do, out of band):
//
//   • VIEW BEACON — MOVED to the route `app/api/u/view/route.ts` (2026-10-13):
//     as a server action it set a cookie, which re-rendered the page mid-
//     hydration (React #418 on every first /u visit). Same cookie, same RPCs.
//
//   • FOLLOW — getFollowState / followUser / unfollowUser drive the Follow
//     button. Writes go through the AUTHENTICATED client, so RLS Pattern A
//     (follower_user_id = auth.uid()) keeps a caller on their OWN follow rows;
//     the follow GRAPH is never exposed. users.followers_count (the only public
//     audience number) is maintained by the DB trigger on user_follows.

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
  if (error) {
    console.error(
      '[supabase-error] app/u/_actions/audience-actions.ts · from:user_follows.delete',
      error,
    );
    return { ok: false, following: true };
  }
  return { ok: true, following: false };
}
