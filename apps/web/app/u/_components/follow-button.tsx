'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  followUser,
  getFollowState,
  unfollowUser,
} from '../_actions/audience-actions';

// The Follow control on a public /u profile. A client island so the profile page
// stays ISR-cacheable — it resolves its own state (is the viewer signed in? are
// they the owner? already following?) after hydration, then follows/unfollows.
//
// It only ever RENDERS for a signed-in visitor viewing SOMEONE ELSE'S profile
// (never on your own profile, never signed-out) — until state resolves it shows
// nothing, so there's no flash of a wrong-state button. followedUserId is the
// account being viewed; the follow write is RLS-guarded to the viewer's own
// rows server-side.
//
// E6 — the note under the button is rendered by THIS island, past the `return
// null` gate below, so it is structurally impossible for it to appear where the
// button doesn't. A sibling in the server page would print it to signed-out
// strangers and to the storyteller reading their own profile.
//
// THE SENTENCE MUST STAY TRUE OF THE CODE — and on 2026-09-28 the old one
// stopped being true, so it was retired in the same PR, exactly as this note
// said it must be. It read "Following a storyteller is one-way — they publish
// on purpose." Two things changed under it (the People redesign):
//   · a FOLLOWER LIST now exists — People → Followers shows each account who
//     follows it (visible to that account ALONE: `user_follows_followed_reads_own`
//     + the edge-scoped `follow_people_names`, migration 20271253740454);
//   · follows are no longer only chosen here — a guest who says yes to an event
//     follows its hosts, and connected people follow each other.
// What is still true, and what the new sentence says: following needs no
// request, the person you follow can see you among their followers (nobody else
// can — strangers still see only users.followers_count), and you can unfollow
// any time (the unfollow sticks: `user_unfollows`, PR #6077).

export function FollowButton({
  followedUserId,
  className,
  noteClassName,
}: {
  followedUserId: string;
  className?: string;
  noteClassName?: string;
}) {
  const [state, setState] = useState<{
    resolved: boolean;
    show: boolean;
    following: boolean;
  }>({ resolved: false, show: false, following: false });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void getFollowState(followedUserId).then((s) => {
      if (!alive) return;
      setState({
        resolved: true,
        show: s.signedIn && !s.isSelf,
        following: s.following,
      });
    });
    return () => {
      alive = false;
    };
  }, [followedUserId]);

  if (!state.resolved || !state.show) return null;

  const onClick = () => {
    if (pending) return;
    // Optimistic flip; reconcile from the server result.
    const wasFollowing = state.following;
    setState((s) => ({ ...s, following: !wasFollowing }));
    startTransition(async () => {
      const res = wasFollowing
        ? await unfollowUser(followedUserId)
        : await followUser(followedUserId);
      setState((s) => ({ ...s, following: res.following }));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={state.following}
        className={className}
        data-following={state.following ? '1' : '0'}
      >
        {state.following ? 'Following' : 'Follow'}
      </button>
      <span className={noteClassName}>
        No request needed — they’ll see you among their followers. Unfollow any time.
      </span>
    </>
  );
}
