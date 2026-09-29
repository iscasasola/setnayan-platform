'use client';

import { useState, useTransition } from 'react';
import type { FollowList, FollowRow } from '@/lib/people-follows';
import { formatCount } from '@/lib/format-number';
import { setFollowByPublicId } from '../actions';
import { FindOrInvite } from './find-or-invite';
import { PersonAvatar } from './person-avatar';
import { PEOPLE_SECTION_HEADING } from './people-roster-view';

/**
 * follow-list-view.tsx — the Following and Followers views (owner 2026-09-28,
 * people-redesign.html frames D and E).
 *
 * Owner: *"there are followers but there are people connected to them"* ·
 * *"the Followers list is visible ONLY to the account owner"* · *"you can
 * unfollow a connected person and stay connected"* (the Facebook model).
 *
 *   FOLLOWING — name · how it stands · Unfollow. A connected person wears a
 *   "Connected" chip, and Unfollow is still offered on the row, quieter — it
 *   is allowed, not the primary thing.
 *   FOLLOWERS — name · how it stands · Follow back, or "You follow each
 *   other". No button when their profile is not public: `followUser` refuses
 *   a private profile, so a button there would be a door that does not open.
 *
 * 🔴 A REFUSED READ IS NOT AN EMPTY LIST. `list.unavailable` renders its own
 * sentence. The empty line says what the view is FOR, and is only ever said
 * about a list that was read and really is empty.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Sep", or "12 Sep 2025" outside this year — Manila's calendar, so the
 *  server render and the phone agree. */
function sinceLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const manila = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const nowYear = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();
  const day = `${manila.getUTCDate()} ${MONTHS[manila.getUTCMonth()]}`;
  return manila.getUTCFullYear() === nowYear ? day : `${day} ${manila.getUTCFullYear()}`;
}

const COPY = {
  following: {
    intro:
      'Following is one-way and needs no request. Connect with someone and you follow each other; say yes to an event and you follow its hosts. Unfollow any time.',
    empty:
      'Everyone you follow shows up here — hosts of events you said yes to, people you’re connected with, and anyone you chose to follow. Unfollow any time.',
    refused: 'We couldn’t load who you follow just now. Nothing has changed — refresh in a moment.',
  },
  followers: {
    intro:
      'Guests who say yes to your event follow you on their own. Connect with someone and you follow each other.',
    empty:
      'Whoever follows you shows up here. Guests who say yes to your events follow you on their own — creating events grows this list.',
    refused: 'We couldn’t load your followers just now. Nothing has changed — refresh in a moment.',
  },
} as const;

export function FollowListView({
  which,
  list,
  total,
}: {
  which: 'following' | 'followers';
  list: FollowList;
  /** The real count (the picker's number); the list may show fewer. */
  total: number | null;
}) {
  const copy = COPY[which];
  const more = typeof total === 'number' ? total - list.rows.length : 0;
  return (
    <div className="space-y-5" data-people-view={which}>
      <FindOrInvite />
      {which === 'followers' ? (
        <p className="text-xs font-medium text-ink/70" data-followers-private>
          Only you can see this list. Anyone else sees the count on your public page.
        </p>
      ) : null}
      <p className="text-xs text-ink/55">{copy.intro}</p>

      {list.unavailable ? (
        <p role="status" className="py-6 text-sm text-ink/60" data-follow-refused>
          {copy.refused}
        </p>
      ) : list.rows.length === 0 ? (
        <p className="py-6 text-sm text-ink/55" data-follow-empty>
          {copy.empty}
        </p>
      ) : (
        <section aria-label={which === 'following' ? 'People you follow' : 'People who follow you'}>
          <h2 className={`mb-1.5 ${PEOPLE_SECTION_HEADING}`}>
            {which === 'following' ? 'Following' : 'Followers'}{' '}
            <span className="tabular-nums text-ink/35">{formatCount(total ?? list.rows.length)}</span>
          </h2>
          <ul className="flex list-none flex-col divide-y divide-ink/[0.07]">
            {list.rows.map((r) => (
              <FollowRowItem key={r.publicId} row={r} which={which} />
            ))}
          </ul>
          {more > 0 ? (
            <p className="mt-2 text-xs text-ink/50">
              And {formatCount(more)} more — the most recent are shown first.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function FollowRowItem({ row, which }: { row: FollowRow; which: 'following' | 'followers' }) {
  const [pending, startTransition] = useTransition();
  // Following view: do I still follow them? Followers view: do I follow back?
  const [iFollow, setIFollow] = useState(which === 'following' ? true : row.mutual);
  const [error, setError] = useState<string | null>(null);

  function set(follow: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setFollowByPublicId({ publicId: row.publicId, follow });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setIFollow(res.following);
    });
  }

  const followsMe = which === 'followers' ? true : row.mutual;
  const why = row.connected
    ? iFollow && followsMe
      ? 'Connected · you follow each other'
      : 'Connected'
    : which === 'following'
      ? followsMe
        ? `Follows you too · since ${sinceLabel(row.since)}`
        : `Since ${sinceLabel(row.since)}`
      : `Follows you since ${sinceLabel(row.since)}`;

  return (
    <li className="flex items-center gap-3 py-3" data-follow-row>
      <PersonAvatar name={row.name} photoUrl={row.photoUrl} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-ink">{row.name}</span>
        <span className="truncate text-[11.5px] text-ink/55">{why}</span>
        {error ? <span className="text-[11.5px] text-red-700">{error}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {which === 'following' ? (
          iFollow ? (
            row.connected ? (
              <>
                <span className="rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-medium text-success-800">
                  Connected
                </span>
                <button
                  type="button"
                  onClick={() => set(false)}
                  disabled={pending}
                  className="min-h-11 px-1 text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
                >
                  Unfollow
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => set(false)}
                disabled={pending}
                className="button-secondary min-h-11 text-xs disabled:opacity-50"
              >
                Unfollow
              </button>
            )
          ) : row.publicProfile ? (
            <button
              type="button"
              onClick={() => set(true)}
              disabled={pending}
              className="button-secondary min-h-11 text-xs disabled:opacity-50"
            >
              Follow again
            </button>
          ) : (
            <span className="text-[11.5px] text-ink/45">Unfollowed</span>
          )
        ) : iFollow ? (
          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium text-ink/60">
            You follow each other
          </span>
        ) : row.publicProfile ? (
          <button
            type="button"
            onClick={() => set(true)}
            disabled={pending}
            className="button-secondary min-h-11 text-xs disabled:opacity-50"
          >
            Follow back
          </button>
        ) : null}
      </span>
    </li>
  );
}
