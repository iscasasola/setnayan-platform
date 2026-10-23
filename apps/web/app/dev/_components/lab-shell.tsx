'use client';

/**
 * LabShell — the REAL One Shell (rail + bar + the event's own menu) around a
 * lab page, with no sign-in and no database. DEV-ONLY: it is mounted only by
 * the `/dev/*` labs, which production builds 404.
 *
 * Why it exists (couple dashboard desktop + tablet, owner 2026-10-19): the
 * labs drew a stand-in bar and no rail, because the rail needs a sign-in —
 * so the tablet band (701–1023), where the rail's 72-px strip now replaces the
 * phone's bottom bar, could not be walked at all. This draws the shipped
 * `FrontDoorShell` in its app variant with `boundary="tab"` (exactly what
 * `dashboard/[eventId]/layout.tsx` hands it), the shipped `EventRailContext`
 * rows, the layout's own content wrappers (`.sn-ambient` · `<main
 * className="sn-vt-page">` · `[data-shell-main]`) and the real anchored
 * `BottomDock` with the same boundary. Only the account and the five tab
 * labels are fixtures. Opt in with `&shell=1` on a lab that supports it.
 *
 * The bar's cluster carries the REAL Messages and bell badges the event layout
 * mounts (`UnreadMessagesBadge` · `UnreadBellBadge`), seeded with fixture counts,
 * so what a plain page asks of the network — and whether it holds a live socket
 * (2026-10-21, live connections only where live) — can be measured in a lab.
 * With no database their reads fail, and a failed read must leave the seeded
 * count standing, never draw a false 0.
 */
import type { ReactNode } from 'react';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import { labEventBarItems, type LabEventBar } from '@/app/dev/bar-lab/lab-bar';
import { EventRailContext } from '@/app/dashboard/[eventId]/_components/event-rail-context';
import { eventRailMatchRows } from '@/app/dashboard/[eventId]/_components/event-rail-match-rows';
import type { EventMenuChild } from '@/lib/customer-menu';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { UnreadMessagesBadge } from '@/app/_components/unread-messages-badge';

/** A fixture account id — the lab has no sign-in, so every read the badges make is refused. */
const LAB_USER = '00000000-0000-4000-8000-0000000000aa';

const SERVICES: EventMenuChild[] = [
  { key: 'setnayan-ai', label: 'Setnayan AI', href: '#ai', icon: 'ai' },
  { key: 'papic', label: 'Papic', href: '#papic', icon: 'papic' },
  { key: 'live-studio', label: 'Live Watch', href: '#live', icon: 'live' },
  { key: 'music-maker', label: 'Music Maker', href: '#music', icon: 'pakanta' },
  { key: 'patiktok', label: 'Patiktok', href: '#patiktok', icon: 'patiktok' },
];

export function LabShell({
  eventId,
  children,
  gutter = true,
  eventBar,
  homeAt,
}: {
  /** The lab address that stands for the event's Home — lit as Home on the real bar. */
  homeAt?: string;
  eventId: string;
  children: ReactNode;
  /** The REAL event tab list for a type's gates (`/dev/bar-lab`'s `labEventBar`) in place of the stand-in labels. */
  eventBar?: LabEventBar;
  /** Draw the event layout's own content gutter (`px-4 sm:px-6 lg:px-8`). Off for a lab that draws it itself. */
  gutter?: boolean;
}) {
  const inputs = { eventId, guestCount: 32, services: SERVICES, websiteEnabled: true };
  return (
    <>
      <FrontDoorShell
        variant="app"
        boundary="tab"
        account={{ signedIn: true, initials: 'AM', shopName: null, isAdmin: false }}
        navLabels={{}}
        topBarSlot={
          <div className="flex items-center gap-3" data-lab-cluster="">
            <UnreadMessagesBadge userId={LAB_USER} initialUnread={2} href="#messages" />
            <UnreadBellBadge
              userId={LAB_USER}
              initialUnread={3}
              href="#notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">AM</span>
          </div>
        }
        railContext={<EventRailContext {...inputs} eventName="Ana & Miguel" />}
        contextMatchRows={eventRailMatchRows(inputs)}
      >
        <div className="sn-ambient min-h-screen">
          <main className="sn-vt-page">
            <div data-shell-main>
              {gutter ? <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">{children}</div> : children}
            </div>
          </main>
        </div>
      </FrontDoorShell>
      <BottomDock boundary="tab">
        {eventBar ? (
          <BottomNav
            items={labEventBarItems(eventId, eventBar).map((i) =>
              /* The lab draws Home at its own address (`/dev/home-lab`), so Home lights there too. */
              i.key === 'home' && homeAt ? { ...i, activeMatchAlsoExact: [...(i.activeMatchAlsoExact ?? []), homeAt] } : i,
            )}
          />
        ) : (
        <nav className="flex h-16 items-center justify-around text-xs text-ink/70" data-lab-dock="">
          <span>Home</span>
          <span>Guests</span>
          <span>Suppliers</span>
          <span>Hub</span>
        </nav>
        )}
      </BottomDock>
    </>
  );
}
