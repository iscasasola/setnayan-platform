import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ProfileHeader, PROFILE_HEADER_CSS, profileInitials } from '@/app/u/_components/profile-header';
import { pictureFrameStyle } from '@/lib/picture-frame';
import { formatCount } from '@/lib/format-number';
import { homeSegHref, type HomeSeg } from '@/lib/home-segments';
import type { HomeHandle } from '@/lib/home-profile.server';
import { HomeSegBody, HomeSegmentBar } from './home-segment-bar';
import hp from './home-profile.module.css';

/**
 * home-profile.tsx — HOME, THE ACCOUNT'S ONE PAGE (owner 11 Nov 2026, "One profile page approve" — v3 of
 * `one-profile-page`, DECISION_LOG "HOME PAGE v3 APPROVED"): *"something like facebook/instagram profile page"*.
 *
 *   the profile header (the SAME component as the public `/u/[slug]`) → the sections (Events · People · Shop ·
 *   Memories) → the picked section's body, which is the shipped page MOVED here, never redrawn.
 *
 * A WRAPPER AROUND THE BOARD, NOT INSIDE IT: `(launcher)/page.tsx` hands the Events board — or People, Shop or
 * Memories — in as `children`. The header's doors are numbers only where a cheap read exists (events; service cards;
 * "asking you"); People and Memories are words (v3 row 7: a number we have not read is worse than none).
 * 🔒 lib/home-is-the-profile.test.ts
 */
export function HomeProfile({
  seg,
  segs,
  me,
  handle,
  eventCount,
  asking,
  cardCount,
  children,
}: {
  seg: HomeSeg;
  segs: readonly HomeSeg[];
  me: Pick<SwitcherData, 'displayName' | 'email' | 'photoUrl' | 'photoFrame'>;
  handle: HomeHandle;
  /** The rail's own count (`resolveRailAccount().eventCount`). null = not read — no number. */
  eventCount: number | null | undefined;
  /** People waiting on you. null/0 = no number. */
  asking: number | null;
  /** The shop's service cards. null = not read, or no shop. */
  cardCount: number | null;
  children: ReactNode;
}) {
  const name = me.displayName?.trim() || me.email.replace(/@.*$/, '') || 'You';
  const door = (s: HomeSeg, words: ReactNode) => (
    <Link
      key={s}
      href={homeSegHref(s)}
      className={hp.door}
      aria-current={s === seg ? 'true' : undefined}
      data-home-door={s}
      scroll={false}
    >
      {words}
    </Link>
  );
  const doors = segs.map((s) =>
    s === 'events'
      ? door(s, typeof eventCount === 'number' ? <><b>{formatCount(eventCount)}</b> {eventCount === 1 ? 'event' : 'events'}</> : 'events')
      : s === 'people'
        ? door(s, asking ? <>people · <b>{formatCount(asking)}</b> asking</> : 'people')
        : s === 'shop'
          ? door(s, typeof cardCount === 'number' ? <><b>{formatCount(cardCount)}</b> {cardCount === 1 ? 'service card' : 'service cards'}</> : 'service cards')
          : door(s, 'memories'),
  );
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8" data-home-profile="">
        <style>{PROFILE_HEADER_CSS}</style>
        <div className="mx-auto w-full max-w-3xl sn-reveal">
          <ProfileHeader
            layout="home"
            photoSrc={me.photoUrl}
            photoStyle={pictureFrameStyle(me.photoFrame ?? null)}
            initials={profileInitials(name)}
            heading={name}
            handle={
              handle.slug ? (
                <>
                  @{handle.slug} ·{' '}
                  <Link href={`/u/${handle.slug}`} data-home-public-page="">
                    {handle.publicOn === false ? 'Public page (hidden)' : 'Public page'}
                  </Link>
                </>
              ) : (
                <Link href="/dashboard/profile" data-home-public-page="">
                  Choose your @handle
                </Link>
              )
            }
            doors={doors}
            rule={false}
          />
          <HomeSegmentBar seg={seg} segs={segs} />
        </div>
      </div>
      <HomeSegBody seg={seg}>{children}</HomeSegBody>
    </>
  );
}
