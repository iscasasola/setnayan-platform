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
// E6 — the one-way note ("Following a storyteller is one-way — they publish on
// purpose.") is rendered by THIS island, past the `return null` gate below, so
// it is structurally impossible for it to appear where the button doesn't. A
// sibling in the server page would print it to signed-out strangers and to the
// storyteller reading their own profile.
//
// THE SENTENCE MUST STAY TRUE OF THE CODE. Verified 2026-08-08: follow rows are
// written through the AUTHENTICATED client (RLS Pattern A confines a caller to
// their own rows), users.followers_count is the ONLY public audience number,
// the follow GRAPH is never exposed, and the sole fan-out is
// notifyFollowersOfNewChapter — creator → followers, on publish. If anyone ever
// ships a follower LIST or a "X follows you" surface, this line becomes a lie
// and must be retired in the SAME PR.

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
        Following a storyteller is one-way — they publish on purpose.
      </span>
    </>
  );
}
