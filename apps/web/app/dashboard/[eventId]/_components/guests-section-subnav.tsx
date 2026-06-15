'use client';

/**
 * GuestsSectionSubnav — the docked SECTION sub-nav for the customer "Guests" tab.
 *
 * The flat 6-tab bottom nav (customer-bottom-nav.tsx, owner-locked 2026-06-16)
 * collapses the whole people-and-day-of cluster behind a single "Guests" tab,
 * whose `activeMatch` enumerates the four sibling surfaces that belong to it:
 *   /guests · /seating · /event-qr · /hosts.
 *
 * This component is the subordinate shelf for that tab — the same treatment the
 * Explore/Services tab got via <SubNav> (be634b04 / #1503, owner 2026-06-16
 * "pin it on top of the bottom nav as its sub nav"). It surfaces those four
 * sub-sections as an icon-over-text pill docked just above the bottom nav so a
 * couple can hop Guests ↔ Seating ↔ Event QR ↔ Hosts without first returning to
 * a parent. Mounting <SubNav> also tells the bottom nav to drop to icons-only
 * (useSubNavDocked), so the two bars stack without crowding.
 *
 * UNLIKE the Services takeover (one page, in-page panels switched via onSelect),
 * the Guests cluster is FOUR SEPARATE ROUTES — so this wires <SubNav> to the
 * router: onSelect → router.push, activeKey ← usePathname. It is mounted ONCE in
 * the event layout (next to <CustomerBottomNav>) and self-gates: it renders the
 * shelf only while the path is inside the Guests cluster, and null everywhere
 * else (so it never double-stacks on /vendors, /budget, …). Child routes of the
 * list (/guests/quick, /guests/import, /guests/claims, /guests/checkin,
 * /guests/new, /guests/[guestId]) light the "Guests" item via prefix match, so
 * the shelf rides along on the guest sub-tools too and offers a path back.
 *
 * Mobile-only — <SubNav> is `lg:hidden`; on desktop the CustomerSidebar already
 * lists all four surfaces. While docked it adds `guests-subnav-docked` to <html>
 * so globals.css can give the page extra bottom room (the floating pill would
 * otherwise cover the last ~50px of scrolling content).
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Users, LayoutGrid, QrCode, UserPlus, type LucideIcon } from 'lucide-react';
import { SubNav } from '@/app/_components/nav/sub-nav';

type GuestsSubnavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Active-state prefix. The four prefixes are mutually exclusive (none is a
   *  prefix of another), so at most one matches any path. */
  match: string;
};

function buildItems(eventId: string): GuestsSubnavItem[] {
  const base = `/dashboard/${eventId}`;
  // Mirrors the Guests bottom-nav tab's `activeMatch` set verbatim — the
  // canonical "what belongs to Guests" decision already lives there, so this
  // shelf stays a single source of truth with the bar above it.
  return [
    { key: 'guests', label: 'Guests', icon: Users, href: `${base}/guests`, match: `${base}/guests` },
    { key: 'seating', label: 'Seating', icon: LayoutGrid, href: `${base}/seating`, match: `${base}/seating` },
    { key: 'event-qr', label: 'Event QR', icon: QrCode, href: `${base}/event-qr`, match: `${base}/event-qr` },
    { key: 'hosts', label: 'Hosts', icon: UserPlus, href: `${base}/hosts`, match: `${base}/hosts` },
  ];
}

export function GuestsSectionSubnav({ eventId }: { eventId: string }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const items = buildItems(eventId);
  const active = items.find(
    (it) => pathname === it.match || pathname.startsWith(`${it.match}/`),
  );
  const inSection = Boolean(active);

  // While the shelf is docked, flag <html> so globals.css pads the page bottom
  // clear of the floating pill (mobile). Toggled in an effect (never during
  // render) so it stays SSR-safe and reverses on leaving the cluster.
  useEffect(() => {
    if (!inSection) return;
    const el = document.documentElement;
    el.classList.add('guests-subnav-docked');
    return () => el.classList.remove('guests-subnav-docked');
  }, [inSection]);

  if (!active) return null;

  return (
    <SubNav
      items={items.map(({ key, label, icon }) => ({ key, label, icon }))}
      activeKey={active.key}
      onSelect={(key) => {
        const next = items.find((it) => it.key === key);
        if (next && next.key !== active.key) router.push(next.href);
      }}
      ariaLabel="Guest sections"
    />
  );
}
