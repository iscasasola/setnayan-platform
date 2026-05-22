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
//
// Responsive layout (CLAUDE.md 2026-05-22 · owner directive verbatim:
// "bottom nav on mobile should be visible as sidebar on desktop"):
//   - Mobile (< lg / < 1024px): sticky bottom bar — existing UX, unchanged tap-
//     target heights, safe-area inset, terracotta active accent.
//   - Desktop (>= lg / >= 1024px): fixed left sidebar — 240px wide, cream bg,
//     vertical pill list, top-offset by 64px to clear the sticky top chrome.
//     Active state uses a terracotta left accent bar + bg tint per brand
//     editorial restraint (no heavy fills).
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
    <>
      {/* Mobile: fixed bottom bar (< lg / < 1024px) */}
      <nav
        aria-label="Event sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex w-full max-w-6xl items-stretch justify-around px-2 py-1 sm:px-4">
          {TABS.map((tab) => {
            const isActive = current === tab.key;
            const { Icon } = tab;
            return (
              <li key={tab.key} className="flex-1">
                <Link
                  href={tab.href(eventId)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-12 min-h-[44pt] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
                    isActive
                      ? 'text-terracotta'
                      : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  <span>{resolved[tab.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: fixed left sidebar (>= lg / >= 1024px) — sits flush to the
          left edge, full viewport height. The event layout offsets the top
          chrome + main content with `lg:pl-60` so the chrome appears to the
          right of the sidebar. */}
      <nav
        aria-label="Event sections"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-ink/10 lg:bg-cream"
      >
        <ul className="flex w-full flex-col gap-1 px-3 pt-20 pb-6">
          {TABS.map((tab) => {
            const isActive = current === tab.key;
            const { Icon } = tab;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href(eventId)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex min-h-[44pt] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
                    isActive
                      ? 'bg-terracotta/10 text-terracotta'
                      : 'text-ink/70 hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-sm bg-terracotta"
                    />
                  ) : null}
                  <Icon aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span>{resolved[tab.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
