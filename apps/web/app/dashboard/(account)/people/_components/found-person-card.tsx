'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock } from 'lucide-react';
import { GuestPopup } from '@/app/dashboard/[eventId]/guests/_components/guest-popup';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { ActionButton } from '@/components/action-button';
import type { PersonHit } from '@/lib/people-search-query';
import { PEOPLE_PATH, PERSON_PARAM } from '@/lib/people-person-link';
import { addPersonByPublicId, setFollowByPublicId } from '../actions';
import { PersonAvatar } from './person-avatar';
import ps from './people-screen.module.css';

/**
 * found-person-card.tsx — the card `/dashboard/people?person=S89U-…` opens for somebody who is NOT on your
 * list yet: a person result from the shell's search (owner 2026-10-22, "a person result opens that person's
 * CARD on the People page").
 *
 * 🔒 IT SHOWS EXACTLY WHAT A SEARCH ROW SHOWS, NOTHING MORE. The hit comes from `findPersonByPublicId`, the
 * same fence and the same four fields as the People search (name · face · @tag / full name · why you might
 * know them) — never an email, their events or their connections. Its two verbs are the search row's own:
 * Follow (only toward a public profile) and Add (the request). The card's bones are the roster card's —
 * face · eyebrow · name — so somebody you found and somebody you know open the same shape.
 */
export function FoundPersonCard({ hit }: { hit: PersonHit }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [asked, setAsked] = useState(false);
  const [following, setFollowing] = useState(hit.following);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!open) return null;

  const close = () => {
    setOpen(false);
    // Drop the param, so a reload does not reopen it; Back still returns to the results.
    const url = new URL(window.location.href);
    url.searchParams.delete(PERSON_PARAM);
    const qs = url.searchParams.toString();
    router.replace(`${url.pathname || PEOPLE_PATH}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const add = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const res = await addPersonByPublicId({ publicId: hit.publicId });
      if (!res.ok) return setError(res.error);
      setAsked(true);
      setNotice(`Asked ${hit.name}. You're connected when they say yes.`);
    });
  const follow = () =>
    startTransition(async () => {
      setError(null);
      const res = await setFollowByPublicId({ publicId: hit.publicId, follow: true });
      if (!res.ok) return setError(res.error);
      setFollowing(true);
    });

  const meta = [hit.handle, hit.fullName, hit.hint].filter(Boolean).join(' · ');
  return (
    <GuestPopup
      onClose={close}
      rootClassName="fixed inset-0 z-[80]"
      panelClassName="gl-drawer absolute inset-x-0 bottom-0 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-paper px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2 shadow-xl tab:inset-y-0 tab:left-auto tab:right-0 tab:max-h-none tab:w-[min(27.5rem,calc(100vw-3.5rem))] tab:rounded-none tab:rounded-l-2xl"
      labelledById="found-person-name"
      panelData={{ 'data-person-card': '', 'data-found-person': '' }}
    >
      <div className={ps.cardBody}>
        <span aria-hidden className="mx-auto mb-3.5 mt-1.5 block h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-start gap-3.5">
          <span className={ps.cardFace} aria-hidden>
            <PersonAvatar name={hit.name} photoUrl={hit.photoUrl} size="row" />
          </span>
          <div className="min-w-0">
            <p className={ps.eyebrow}>On Setnayan</p>
            <h2 id="found-person-name" className="mt-0.5 text-[26px] font-semibold leading-tight text-ink">
              {hit.name}
            </h2>
            {meta ? <p className="mt-1 text-[14px] text-ink/60">{meta}</p> : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {following ? (
            <span className={`${gs.pill} ${gs.pillOk} ${ps.pillRow}`} data-following>
              <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
              Following
            </span>
          ) : hit.followable ? (
            <ActionButton tone="neutral" icon={Check} label="Follow" onClick={follow} disabled={pending} />
          ) : null}
          {asked ? (
            <span className={`${gs.pill} ${gs.pillWine} ${ps.pillRow}`}>
              <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
              Asked
            </span>
          ) : (
            <ActionButton tone="brand" main icon={Check} label="Add" onClick={add} disabled={pending} />
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-mulberry-600">
            {notice}
          </p>
        ) : null}
      </div>
    </GuestPopup>
  );
}
