'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { Badge } from '@/app/_components/badge';
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
  // Opened after mount: the card is a portal the server cannot draw (a first-render open is a hydration mismatch).
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
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
    <Sheet open={open} onClose={close} labelledById="found-person-name" rise>
      <div className={ps.cardBody} data-person-card="" data-found-person="">
        <div className="flex items-start gap-3.5">
          <span className={ps.cardFace} aria-hidden>
            <PersonAvatar name={hit.name} photoUrl={hit.photoUrl} size="row" />
          </span>
          <div className="min-w-0">
            <p className={ps.eyebrow}>On Setnayan</p>
            <h2 id="found-person-name" className="mt-0.5 text-2xl font-semibold leading-tight text-ink">
              {hit.name}
            </h2>
            {meta ? <p className="mt-1 text-sm text-ink/70">{meta}</p> : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {following ? (
            <span data-following="">
              <Badge tone="ok">Following</Badge>
            </span>
          ) : hit.followable ? (
            <ActionButton tone="neutral" icon={Check} label="Follow" onClick={follow} disabled={pending} />
          ) : null}
          {asked ? (
            <Badge tone="wait">Asked</Badge>
          ) : (
            <ActionButton tone="brand" main icon={Check} label="Add" onClick={add} disabled={pending} />
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[rgb(var(--color-danger))]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-mulberry-600">
            {notice}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
