'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Globe,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// 4-tab refactor (CLAUDE.md 2026-05-22) — owner directive: bottom nav goes from
// 5 tabs to 4. Vendors + Budget come out of the bottom (still reachable elsewhere
// via the planning cards on Home, the top-nav Marketplace link, and the 14-tile
// NavGrid). Add-ons renames to Services. New Website tab joins the lineup, hub-
// linking the public landing page surfaces (URL + QR + RSVP + day-of preview).
type TabKey = 'home' | 'guests' | 'website' | 'services';

type TabLabels = Record<TabKey, string>;

// Default English labels — used if the server layout doesn't pass translations.
const DEFAULT_LABELS: TabLabels = {
  home: 'Home',
  guests: 'Guests',
  website: 'Website',
  services: 'Services',
};

const TABS: { key: TabKey; Icon: LucideIcon; href: (eventId: string) => string }[] = [
  { key: 'home', Icon: Home, href: (id) => `/dashboard/${id}` },
  { key: 'guests', Icon: Users, href: (id) => `/dashboard/${id}/guests` },
  { key: 'website', Icon: Globe, href: (id) => `/dashboard/${id}/website` },
  { key: 'services', Icon: Sparkles, href: (id) => `/dashboard/${id}/add-ons` },
];

function activeTab(pathname: string, eventId: string): TabKey | null {
  // Guests umbrella also covers invitation editor + seating chart since those
  // are guest-side workflows reached from the Guests surface.
  if (
    pathname.includes('/guests') ||
    pathname.includes('/invitation') ||
    pathname.includes('/seating')
  ) return 'guests';
  // Website tab lights up for the new /website hub.
  if (pathname.includes('/website')) return 'website';
  // Services umbrella keeps matching legacy /services path so bookmarked URLs
  // (pre-rename) still light up the right tab during the brief redirect, and
  // covers /add-ons + /schedule which are reached from the Services surface.
  if (
    pathname.includes('/add-ons') ||
    pathname.includes('/services') ||
    pathname.includes('/schedule')
  ) return 'services';
  if (pathname === `/dashboard/${eventId}`) return 'home';
  return null;
}

export function BottomNav({
  eventId,
  labels,
}: {
  eventId: string;
  /** Server-injected translations. Falls back to English when omitted. */
  labels?: Partial<TabLabels>;
}) {
  const pathname = usePathname();
  const current = activeTab(pathname, eventId);
  const resolved: TabLabels = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  return (
    <nav
      aria-label="Event sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:static lg:border-t-0 lg:pb-0"
    >
      <ul className="mx-auto flex w-full max-w-6xl items-stretch justify-around px-2 py-1 sm:px-4 lg:max-w-6xl lg:justify-start lg:gap-2 lg:py-2">
        {TABS.map((tab) => {
          const isActive = current === tab.key;
          const { Icon } = tab;
          return (
            <li key={tab.key} className="flex-1 lg:flex-initial">
              <Link
                href={tab.href(eventId)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-12 min-h-[44pt] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:h-auto lg:flex-row lg:gap-2 lg:px-3 lg:py-2 lg:text-sm ${
                  isActive
                    ? 'text-terracotta'
                    : 'text-ink/60 hover:text-ink'
                }`}
              >
                <Icon aria-hidden className="h-5 w-5 lg:h-4 lg:w-4" strokeWidth={1.75} />
                <span>{resolved[tab.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
