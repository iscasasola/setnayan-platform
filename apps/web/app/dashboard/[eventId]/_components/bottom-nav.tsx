'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Focus,
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
// 5-tab refactor (CLAUDE.md 2026-05-24) — owner directive: Today's Focus
// promoted from inline event-home block to its own first-class tab, placed
// BEFORE Home. The wizard surface (Concierge Active Wizard · iteration 0016)
// lives at /dashboard/[eventId]/today now; event-home keeps the rest of the
// planning grid. Focus icon (Lucide) is the daily-focus semantic match.
type TabKey = 'today' | 'home' | 'guests' | 'website' | 'services';

type TabLabels = Record<TabKey, string>;

// Default English labels — used if the server layout doesn't pass translations.
const DEFAULT_LABELS: TabLabels = {
  today: 'Today',
  home: 'Home',
  guests: 'Guests',
  website: 'Website',
  services: 'Services',
};

const TABS: { key: TabKey; Icon: LucideIcon; href: (eventId: string) => string }[] = [
  { key: 'today', Icon: Focus, href: (id) => `/dashboard/${id}/today` },
  { key: 'home', Icon: Home, href: (id) => `/dashboard/${id}` },
  { key: 'guests', Icon: Users, href: (id) => `/dashboard/${id}/guests` },
  { key: 'website', Icon: Globe, href: (id) => `/dashboard/${id}/website` },
  { key: 'services', Icon: Sparkles, href: (id) => `/dashboard/${id}/add-ons` },
];

// Why: owner directive 2026-05-22 — "choosing any of these will lock on side nav
// for desktop view not just home". The original implementation only highlighted
// when pathname matched a small closed list of slug substrings; dozens of real
// event-scoped sub-routes (/vendors, /budget, /orders, /messages, /paperwork,
// /documents, /contracts, /disputes, /activity, /sponsors, /hosts,
// /date-selection, and every guest/[id] / vendor/[id]/workspace sub-route)
// matched none of the 4, so the side nav showed NO active item.
//
// Fix pattern: Home is exact-match only (so it doesn't catch every sub-route,
// since every dashboard URL starts with /dashboard/{eventId}). The other 3
// tabs each carry an umbrella of route segments they conceptually cover and
// match via startsWith on the full {/segment} prefix — never bare .includes(),
// which would mis-fire on path fragments like `/messages` appearing inside an
// unrelated route someday. Order matters: Guests + Website are checked before
// Services so the Services catch-all only fires for genuinely planning-side
// surfaces that aren't people-side or landing-page-side.
const TODAY_UMBRELLA = ['today'];
const GUESTS_UMBRELLA = ['guests', 'invitation', 'seating', 'hosts', 'sponsors'];
const WEBSITE_UMBRELLA = ['website'];
const SERVICES_UMBRELLA = [
  'add-ons',
  'services',
  'schedule',
  'vendors',
  'budget',
  'orders',
  'messages',
  'paperwork',
  'documents',
  'contracts',
  'disputes',
  'activity',
  'date-selection',
];

function matchesUmbrella(pathname: string, eventId: string, umbrella: string[]): boolean {
  const eventBase = `/dashboard/${eventId}`;
  return umbrella.some((segment) => {
    const segmentBase = `${eventBase}/${segment}`;
    return pathname === segmentBase || pathname.startsWith(`${segmentBase}/`);
  });
}

function activeTab(pathname: string, eventId: string): TabKey | null {
  const homeHref = `/dashboard/${eventId}`;
  // Today: checked BEFORE Home so the /today sub-route doesn't fall through
  // to the Home exact-match (which it wouldn't anyway since Home is exact,
  // but the ordering is also load-bearing for the umbrella-style sub-routes
  // we may add later · /today/streak, /today/recap, etc.).
  if (matchesUmbrella(pathname, eventId, TODAY_UMBRELLA)) return 'today';
  // Home: exact match only so it doesn't catch sub-routes (every dashboard
  // URL technically starts with /dashboard/{id}, so startsWith would over-match).
  if (pathname === homeHref) return 'home';
  // People-side surfaces — guest list, invitation editor, seating chart,
  // hosts list, sponsors list — all land under the Guests tab.
  if (matchesUmbrella(pathname, eventId, GUESTS_UMBRELLA)) return 'guests';
  // Public landing page hub.
  if (matchesUmbrella(pathname, eventId, WEBSITE_UMBRELLA)) return 'website';
  // Services catch-all for everything event-planning-side: add-ons (canonical),
  // services (legacy alias still served during the rename window), schedule,
  // vendors marketplace + per-vendor workspaces, budget, orders, messages
  // (vendor chats), paperwork (BIR + marriage license pipeline), documents,
  // contracts (vendor-uploaded PDFs), disputes, activity feed, date-selection.
  // Every event-scoped route is enumerated above; routes added in the future
  // need an explicit entry in one of the umbrellas (no silent default).
  if (matchesUmbrella(pathname, eventId, SERVICES_UMBRELLA)) return 'services';
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
                      ? 'text-[var(--m-orange-2)]'
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
          chrome + main content with `lg:pl-[var(--sidebar-width,240px)]` so
          the chrome appears to the right of the sidebar.
          Owner directive 2026-05-23: sidebar width is now driven by the
          `--sidebar-width` CSS variable (default 240px = lg:w-60), so the
          host can drag the right edge to resize. SidebarResizeHandle (sister
          component) owns the variable + localStorage. Width range 200-360px,
          mirrors the EventHomeSplitView pattern from PR #384. */}
      <nav
        aria-label="Event sections"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:w-[var(--sidebar-width,240px)] lg:flex-col lg:border-r lg:border-ink/10 lg:bg-cream"
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
                  className={`relative flex min-h-[44pt] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-orange)] ${
                    isActive
                      ? ''
                      : 'text-ink/70 hover:bg-ink/5 hover:text-ink'
                  }`}
                  style={
                    isActive
                      ? {
                          background: 'var(--m-orange-4)',
                          color: 'var(--m-orange-2)',
                        }
                      : undefined
                  }
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-sm"
                      style={{ background: 'var(--m-orange)' }}
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
