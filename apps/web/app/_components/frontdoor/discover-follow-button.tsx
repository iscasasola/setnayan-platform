'use client';

import { useState, useTransition } from 'react';
import { setFollowByPublicId } from '@/app/dashboard/(account)/people/actions';

/**
 * Follow, on a "People to follow" card.
 *
 * 🔑 THE SHIPPED FOLLOW, NOT A NEW ONE. It calls `setFollowByPublicId` — the
 * People page's own action (Following / Followers views), which resolves the
 * public handle server-side and then runs `followUser` / `unfollowUser` from
 * `app/u/_actions/audience-actions.ts`: public profiles only, RLS-scoped to
 * the viewer's own rows, idempotent. The browser only ever holds
 * `users.public_id`, never a user id.
 *
 * ⚠ WHY NOT `FollowButton` from `/u`: that island takes the profile's USER ID
 * and resolves its own state per mount. Every card on this shelf is already
 * somebody the viewer does NOT follow (the loader excludes the rest), so the
 * per-card state read is wasted, and a user id on eight cards is eight ids
 * this page would otherwise never send.
 *
 * Rendered only for a signed-in viewer; a stranger's card is a door to `/u`.
 */
export function DiscoverFollowButton({ publicId, name }: { publicId: string; name: string }) {
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    const next = !following;
    setFollowing(next); // optimistic; reconciled from the result
    setError(null);
    startTransition(async () => {
      const res = await setFollowByPublicId({ publicId, follow: next });
      if (res.ok) {
        setFollowing(res.following);
      } else {
        setFollowing(!next);
        setError(res.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className={following ? 'fd-ask quiet' : 'fd-ask'}
        onClick={onClick}
        disabled={pending}
        aria-pressed={following}
        aria-label={following ? `Following ${name}` : `Follow ${name}`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
      {error ? (
        <small role="status" className="fd-act-note">
          {error}
        </small>
      ) : null}
    </>
  );
}
