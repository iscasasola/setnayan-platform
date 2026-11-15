import Link from 'next/link';
import { PenLine, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { CollapsingTop } from '@/app/_components/collapsing-top/collapsing-top';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ProfileHeader, PROFILE_HEADER_CSS, profileInitials } from '@/app/u/_components/profile-header';
import { pictureFrameStyle } from '@/lib/picture-frame';
import type { HomeSeg } from '@/lib/home-segments';
import type { HomeHandle } from '@/lib/home-profile.server';
import { HomeSegBody, HomeSegMemory, HomeTabs } from './home-segment-bar';
import hp from './home-profile.module.css';

/**
 * home-profile.tsx — HOME, THE ACCOUNT'S ONE PAGE (owner 11 Nov 2026, "One profile page approve" — v3 of
 * `one-profile-page`, DECISION_LOG "HOME PAGE v3 APPROVED"): *"something like facebook/instagram profile page"*.
 *
 *   the profile header (the SAME component as the public `/u/[slug]`) → the sections (Events · People · Shop ·
 *   Memories) → the picked section's body, which is the shipped page MOVED here, never redrawn.
 *
 * A WRAPPER AROUND THE BOARD, NOT INSIDE IT: `(launcher)/page.tsx` hands the Events board — or People, Shop or
 * Memories — in as `children`.
 *
 * ONE ROW OF SECTIONS, NOT TWO (owner 13 Nov 2026, on a screenshot of Home): *"the buttons and the menu events people
 * memories are dupes. we want them to be simple and just 1"*. v3 drew the same four places twice — a row of pill doors
 * under the name ("3 events · people · 3 service cards · memories") and the underlined tabs under "＋ Create an event".
 * The pills are gone; the TABS are the one row. Nothing the pills said is lost: the tabs carry the numbers where a cheap
 * read exists (Events N · Shop N), and People carries "N asking" — the people waiting on you — in the brand colour
 * (`hot`), the one number the pills had that the tabs did not. People's other words and Memories stay words (v3 row 7:
 * a number we have not read is worse than none). The shared `ProfileHeader` still takes `doors` (optional); Home just
 * stops passing them, and the public `/u/[slug]` is untouched.
 *
 * THE TOP (v3 `.segwrap`, row 7 "ONE pinned row"): the shared `CollapsingTop`. At rest it is the header and the
 * underlined tabs; as the header scrolls away it locks, leaving the section's ONE pinned row above the tabs. The row is
 * mounted by the section (it reads that section's state) and portalled into the seat here (`HomePinPortal`).
 *
 * NOT drawn, on purpose (slice 1): v3's one line under the name. There is no column for it — `users` holds only the
 * `public_greeting_opt_in` switch — and a pencil that cannot save would be a control that lies.
 * 🔒 lib/home-is-the-profile.test.ts (5 · one row of sections)
 */

/** The public page's address, as a person would type it — the host the app is served from. */
function publicHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://setnayan.com').host.replace(/^www\./, '');
  } catch {
    return 'setnayan.com';
  }
}

/** A small pencil — a door to where that thing is changed (the profile page's identity tile). */
function Pen({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="uprof-pen" aria-label={label} data-home-pen={label}>
      <PenLine strokeWidth={1.9} aria-hidden />
    </Link>
  );
}

/** The top's pinned row (R) — the section's row seat, then the tabs: 44 + 44 + the tabs' 1-px rule. */
const TOP_ROW_H = 89;
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
  /** People waiting on you — the People tab's number (`hot`). null/0 = no number. */
  asking: number | null;
  /** The shop's service cards. null = not read, or no shop. */
  cardCount: number | null;
  children: ReactNode;
}) {
  const name = me.displayName?.trim() || me.email.replace(/@.*$/, '') || 'You';
  const counts: Partial<Record<HomeSeg, number>> = {
    ...(typeof eventCount === 'number' ? { events: eventCount } : {}),
    ...(typeof cardCount === 'number' ? { shop: cardCount } : {}),
    ...(asking ? { people: asking } : {}),
  };
  // People's number is the people waiting on you — drawn in the brand colour, read as "N asking".
  const hot: Partial<Record<HomeSeg, string>> = asking ? { people: 'asking' } : {};
  const host = publicHost();
  return (
    <>
      <style>{PROFILE_HEADER_CSS}</style>
      <HomeSegMemory />
      <CollapsingTop
        rowHeight={TOP_ROW_H}
        data={{ 'home-top': '' }}
        row={
          <div className={hp.topRow}>
            <div className={hp.slot} data-home-pin-slot="" />
            <HomeTabs seg={seg} segs={segs} counts={counts} hot={hot} copy />
          </div>
        }
      >
        <div className={`${hp.top} pt-3 sn-reveal`} data-home-profile="">
          <ProfileHeader
            layout="home"
            photoSrc={me.photoUrl}
            photoStyle={pictureFrameStyle(me.photoFrame ?? null)}
            initials={profileInitials(name)}
            heading={name}
            photoEdit={<Pen href="/dashboard/profile?tab=profile" label="Change photo and frame" />}
            nameEdit={<Pen href="/dashboard/profile?tab=profile#display_name" label="Edit name" />}
            handle={
              handle.slug ? (
                <>
                  @{handle.slug} ·{' '}
                  <Link href={`/u/${handle.slug}`} data-home-public-page="">
                    {host}/u/{handle.slug}
                  </Link>
                  {handle.publicOn === false ? ' · off' : null}
                </>
              ) : (
                <Link href="/dashboard/profile#url-slug" data-home-public-page="">
                  Choose your @handle
                </Link>
              )
            }
            actions={
              <Link href="/dashboard/create-event" className={hp.cta} data-home-create="">
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                Create an event
              </Link>
            }
            rule={false}
          />
          <HomeTabs seg={seg} segs={segs} counts={counts} hot={hot} />
        </div>
      </CollapsingTop>
      <HomeSegBody seg={seg}>{children}</HomeSegBody>
    </>
  );
}
