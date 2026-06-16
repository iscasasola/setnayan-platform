'use client';

/**
 * GuestsSectionSubnav — the docked JOURNEY sub-nav for the customer "Guests" tab.
 *
 * Owner direction 2026-06-16: the Guests area is a JOURNEY, not a pile of tools.
 * This shelf is the subordinate companion to the flat 6-tab bottom nav (the same
 * <SubNav> treatment the Explore/Services tab got, #1503) and surfaces the five
 * stages — Build · Invite · Confirm · Seat · Day-of — so a couple can move through
 * the flow without bouncing through the bottom nav. The stages (label · icon ·
 * route · active-match) come from the single source of truth in lib/guest-journey
 * so this mobile shelf and the desktop ribbon (lifecycle-ribbon.tsx) can't drift.
 *
 * (Superseded 2026-06-16 the surface-based shelf — Guests · Seating · Event QR ·
 * Hosts. Event QR is a crew-pairing tool and Hosts is a team surface, neither a
 * journey stage; both stay reachable from the Home tiles grid.)
 *
 * The five stages are SEPARATE ROUTES, so this wires <SubNav> to the router:
 * onSelect → router.push, activeKey ← usePathname (longest-prefix match). Mounted
 * ONCE in the event layout (next to <CustomerBottomNav>) and self-gates: it
 * renders only while the path is inside the journey (/guests* or /seating*), null
 * elsewhere (so it never double-stacks on /vendors, /budget, …). Mounting it stays
 * stable across stage switches, so the lift reveal plays on section ENTRY only.
 *
 * Day-of is TIME-GATED: shown muted ("not yet") until the event window, then it
 * un-mutes. The gate is computed in an effect (default closed) so SSR and client
 * agree on first paint — no hydration flash. Mobile-only (<SubNav> is `lg:hidden`;
 * desktop uses the sidebar + the on-page ribbon). While docked it flags
 * `guests-subnav-docked` on <html> so globals.css pads the page bottom clear of
 * the floating pill.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SubNav } from '@/app/_components/nav/sub-nav';
import {
  buildGuestJourney,
  activeJourneyKey,
  isGuestJourneyPath,
  isDayOfOpen,
} from '@/lib/guest-journey';

export function GuestsSectionSubnav({
  eventId,
  eventDate,
}: {
  eventId: string;
  eventDate: string | null;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const inSection = isGuestJourneyPath(pathname, eventId);

  // Defer the Day-of gate to the client so the muted state matches between SSR
  // (always closed) and the first client paint, then opens on the event day.
  const [dayOfOpen, setDayOfOpen] = useState(false);
  useEffect(() => {
    setDayOfOpen(isDayOfOpen(eventDate, new Date()));
  }, [eventDate]);

  // While the shelf is docked, flag <html> so globals.css pads the page bottom
  // clear of the floating pill. Toggled in an effect (never during render) so it
  // stays SSR-safe and reverses on leaving the journey.
  useEffect(() => {
    if (!inSection) return;
    const el = document.documentElement;
    el.classList.add('guests-subnav-docked');
    return () => el.classList.remove('guests-subnav-docked');
  }, [inSection]);

  if (!inSection) return null;

  const stages = buildGuestJourney(eventId, { dayOfOpen });
  const activeKey = activeJourneyKey(pathname, stages) ?? 'build';

  return (
    <SubNav
      items={stages.map(({ key, label, icon, muted }) => ({ key, label, icon, muted }))}
      activeKey={activeKey}
      onSelect={(key) => {
        const next = stages.find((s) => s.key === key);
        if (next && next.key !== activeKey) router.push(next.href);
      }}
      ariaLabel="Guest journey"
    />
  );
}
