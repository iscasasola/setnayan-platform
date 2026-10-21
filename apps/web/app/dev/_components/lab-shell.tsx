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
 */
import type { ReactNode } from 'react';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { EventRailContext } from '@/app/dashboard/[eventId]/_components/event-rail-context';
import { eventRailMatchRows } from '@/app/dashboard/[eventId]/_components/event-rail-match-rows';
import type { EventMenuChild } from '@/lib/customer-menu';
import { builderRailItems, togetherRailItems } from '@/lib/free-tools-rail';
import { CustomerBottomNav } from '@/app/dashboard/[eventId]/_components/customer-bottom-nav';

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
  storeShell,
}: {
  eventId: string;
  children: ReactNode;
  /** Draw the event layout's own content gutter (`px-4 sm:px-6 lg:px-8`). Off for a lab that draws it itself. */
  gutter?: boolean;
  /**
   * Given → the REAL `CustomerBottomNav` replaces the stand-in dock, and the
   * rail / ☰ rows are built for that shell (true = the iPhone app). In the
   * app the services list is empty, exactly as `layout.tsx` hands it there
   * (`STORE_SHELL_HIDDEN_ADDON_KEYS` drops all five). Omitted → the stand-in.
   */
  storeShell?: boolean;
}) {
  const inputs = {
    eventId,
    guestCount: 32,
    services: storeShell ? [] : SERVICES,
    websiteEnabled: true,
    seatingEnabled: true,
    ...(storeShell ? { storeShell } : {}),
  };
  return (
    <>
      <FrontDoorShell
        variant="app"
        boundary="tab"
        insideEvent
        account={{ signedIn: true, initials: 'AM', shopName: null, isAdmin: false }}
        tools={[]}
        /* The tool groups the event layout hands the shell inside an event
           (`app-rail-shell.tsx`: Studio empty, Planner empty, Builder and
           Together from these two) — so the strip's tool rows can be walked. */
        builderTools={builderRailItems(eventId)}
        togetherTools={togetherRailItems(eventId)}
        navLabels={{}}
        topBarSlot={
          <div className="flex items-center gap-3" data-lab-cluster="">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#A9834B] text-xs font-semibold text-white">AM</span>
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
        {storeShell !== undefined ? (
          <CustomerBottomNav {...inputs} />
        ) : (
        <nav className="flex h-16 items-center justify-around text-xs text-ink/70" data-lab-dock="">
          <span>Home</span>
          <span>Guests</span>
          <span>Suppliers</span>
          <span>Hub</span>
          <span>More</span>
        </nav>
        )}
      </BottomDock>
    </>
  );
}
