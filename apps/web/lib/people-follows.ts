import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * people-follows.ts — Following and Followers, the two People views that did
 * not exist (owner 2026-09-28, people-redesign.html frames D and E).
 *
 * Owner, verbatim: *"just like how facebook, instagram and youtube offers.
 * there are followers but there are people connected to them."* Two
 * relationships, both already shipped: FOLLOW (`user_follows`, one-way, no
 * request) and CONNECTED (`person_connections`, a request answered). This file
 * lists the first; the roster lists the second.
 *
 * ── WHO MAY SEE WHAT ───────────────────────────────────────────────────────
 * Owner: *"the Followers list is visible ONLY to the account owner"* —
 * strangers keep the public count on /u. Both reads run under the user's OWN
 * session and are SCOPED to them explicitly (`follower_user_id = me`,
 * `followed_user_id = me`): RLS is a floor, not a scope — `user_follows` also
 * admits `is_admin()`, and production's admin is the owner's own account, so a
 * policy-scoped read would hand him every follow in the database and look fine.
 * Names come through `follow_people_names`, which answers only for an id with a
 * live edge to or from the caller (migration 20271253740454).
 *
 * ── WHAT LEAVES THE SERVER ─────────────────────────────────────────────────
 * A name, a photo, the public handle (`users.public_id`), whether their profile
 * is public, and two booleans. NEVER a user_id: the browser acts on the public
 * handle, and the action resolves it here, server-side.
 *
 * ── A REFUSED READ IS NOT AN EMPTY LIST ───────────────────────────────────
 * `unavailable` travels to the render, which says "we couldn't load" — never
 * the empty line, which would tell somebody with 200 followers they have none.
 */

export type FollowRow = {
  /** `users.public_id` — the handle Follow back / Unfollow act on. */
  publicId: string;
  name: string;
  photoUrl: string | null;
  /** Their profile is public — the only case `followUser` accepts a follow. */
  publicProfile: boolean;
  /** A confirmed connection as well as a follow. */
  connected: boolean;
  /** Following: they follow me back. Followers: I follow them back. */
  mutual: boolean;
  /** When the follow began (ISO). */
  since: string;
};

export type FollowList = { rows: FollowRow[]; unavailable: boolean };

/** A list, not a dataset — the view shows this many and says how many more. */
export const FOLLOW_LIST_LIMIT = 300;

type Edge = { other: string; since: string };

/** The two view counts for the picker. Null = could not be read. */
export async function getFollowCounts(
  userId: string,
): Promise<{ following: number | null; followers: number | null }> {
  const supabase = await createClient();
  const [following, followers] = await Promise.all([
    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_user_id', userId),
    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('followed_user_id', userId),
  ]);
  if (following.error) logQueryError('getFollowCounts.following', following.error, {}, 'graceful_degrade');
  if (followers.error) logQueryError('getFollowCounts.followers', followers.error, {}, 'graceful_degrade');
  return {
    following: following.error ? null : (following.count ?? 0),
    followers: followers.error ? null : (followers.count ?? 0),
  };
}

/** Everyone I follow — hosts of events I said yes to, people I'm connected
 *  with, and anyone I chose to follow. */
export async function getFollowing(userId: string): Promise<FollowList> {
  return followList(userId, 'following');
}

/** Everyone who follows me. Visible to me alone. */
export async function getFollowers(userId: string): Promise<FollowList> {
  return followList(userId, 'followers');
}

async function followList(userId: string, which: 'following' | 'followers'): Promise<FollowList> {
  const supabase = await createClient();

  const [outgoing, incoming] = await Promise.all([
    supabase
      .from('user_follows')
      .select('followed_user_id, created_at')
      .eq('follower_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(FOLLOW_LIST_LIMIT),
    supabase
      .from('user_follows')
      .select('follower_user_id, created_at')
      .eq('followed_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(FOLLOW_LIST_LIMIT),
  ]);
  if (outgoing.error) logQueryError(`followList.${which}.outgoing`, outgoing.error, {}, 'graceful_degrade');
  if (incoming.error) logQueryError(`followList.${which}.incoming`, incoming.error, {}, 'graceful_degrade');

  const iFollow: Edge[] = ((outgoing.data ?? []) as Array<{ followed_user_id: string; created_at: string }>).map(
    (r) => ({ other: r.followed_user_id, since: r.created_at }),
  );
  const followMe: Edge[] = ((incoming.data ?? []) as Array<{ follower_user_id: string; created_at: string }>).map(
    (r) => ({ other: r.follower_user_id, since: r.created_at }),
  );

  // The list this view is ABOUT must have been read; the other one only feeds
  // "you follow each other", so its failure costs a chip, not the list.
  const mainFailed = which === 'following' ? Boolean(outgoing.error) : Boolean(incoming.error);
  if (mainFailed) return { rows: [], unavailable: true };

  const main = which === 'following' ? iFollow : followMe;
  const otherSide = new Set((which === 'following' ? followMe : iFollow).map((e) => e.other));
  if (main.length === 0) return { rows: [], unavailable: false };

  const ids = main.map((e) => e.other);
  const { data: names, error: namesError } = await supabase.rpc('follow_people_names', {
    p_user_ids: ids,
  });
  if (namesError) {
    logQueryError(`followList.${which}.names`, namesError, {}, 'graceful_degrade');
    return { rows: [], unavailable: true };
  }
  const byId = new Map(
    ((names ?? []) as Array<{
      user_id: string;
      public_id: string | null;
      display_name: string | null;
      photo_url: string | null;
      public_profile: boolean | null;
    }>).map((n) => [n.user_id, n]),
  );

  const connected = await connectedUserIds(userId);

  const rows: FollowRow[] = [];
  for (const e of main) {
    const n = byId.get(e.other);
    // No name and no handle = nothing honest to draw and nothing to act on.
    if (!n?.public_id) continue;
    rows.push({
      publicId: n.public_id,
      name: (n.display_name ?? '').trim() || 'Someone on Setnayan',
      photoUrl: n.photo_url,
      publicProfile: n.public_profile === true,
      connected: connected.has(e.other),
      mutual: otherSide.has(e.other),
      since: e.since,
    });
  }
  return { rows, unavailable: false };
}

/**
 * The accounts I share a CONFIRMED connection with. My edges are read under my
 * session; the person → account step runs on the admin client because another
 * person's row is invisible to me pre-connection — only the id mapping is
 * used, nothing from it is rendered. A failure degrades to "no Connected chip",
 * which is a quieter row, never a disclosure.
 */
async function connectedUserIds(userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) logQueryError('connectedUserIds.me', meError, {}, 'graceful_degrade');
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return out;

  const { data: edges, error: edgesError } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .eq('status', 'confirmed')
    .is('deleted_at', null);
  if (edgesError) logQueryError('connectedUserIds.edges', edgesError, {}, 'graceful_degrade');
  const others = [
    ...new Set(
      ((edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>).map((e) =>
        e.from_person_id === myPerson ? e.to_person_id : e.from_person_id,
      ),
    ),
  ];
  if (others.length === 0) return out;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('people')
      .select('claimed_by_user_id')
      .in('person_id', others)
      .not('claimed_by_user_id', 'is', null);
    if (error) logQueryError('connectedUserIds.accounts', error, {}, 'graceful_degrade');
    for (const r of (data ?? []) as Array<{ claimed_by_user_id: string | null }>) {
      if (r.claimed_by_user_id) out.add(r.claimed_by_user_id);
    }
  } catch {
    // An admin client that cannot be built must not empty the list.
  }
  return out;
}
