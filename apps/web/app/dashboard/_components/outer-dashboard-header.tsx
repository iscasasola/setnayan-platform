'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from 'lucide-react';
import { EventSwitcher, type SwitcherEvent, type SwitcherVendorTarget } from '@/app/dashboard/[eventId]/_components/event-switcher';
import { EmptyEventMonogram } from '@/app/_components/event-monogram';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { ProfileMenu } from '@/app/_components/profile-menu';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';

/**
 * Outer dashboard chrome — iteration 0000 single-strip top-nav
 * (locked 2026-05-14) + event-switcher / add-event entry-point
 * (locked 2026-05-15).
 *
 * Renders on non-event-scoped dashboard routes (/dashboard root,
 * /dashboard/profile, /dashboard/notifications, /dashboard/create-event,
 * /dashboard/api-keys). On /dashboard/[eventId]/* this component returns
 * null — the nested event layout owns the single source of chrome.
 *
 * Layout:
 *   - **Left:** Monogram of the primary event (caret ▾ opens the switcher;
 *     tap routes to the primary event dashboard). With zero events the
 *     anchor renders as the empty-state "+" monogram linking to
 *     `/dashboard/create-event`.
 *   - **Right:** Notification bell + (I) ProfileMenu dropdown (Profile,
 *     Settings, Sign out · split 2026-05-30 from "Profile & settings"
 *     into two anchor-linked rows). The global Setnayan wordmark + standalone
 *     `Sign out` button are intentionally NOT in this chrome — they were
 *     the row-1 half of the two-stacked-row drift confirmed
 *     2026-05-15.
 */

const NON_EVENT_DASHBOARD_PREFIXES = new Set([
  'api-keys',
  'create-event',
  'notifications',
  'profile',
]);

function isEventScopedRoute(pathname: string): boolean {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (!match) return false;
  return !NON_EVENT_DASHBOARD_PREFIXES.has(match[1] ?? '');
}

type PrimaryEventData = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
};

type Props = {
  userId: string;
  email: string;
  unreadCount: number;
  primaryEvent: PrimaryEventData | null;
  switcherEvents: SwitcherEvent[];
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: SwitcherVendorTarget[];
};

export function OuterDashboardHeader({
  userId,
  email,
  unreadCount,
  primaryEvent,
  switcherEvents,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
}: Props) {
  const pathname = usePathname() ?? '';
  if (isEventScopedRoute(pathname)) return null;

  // Reusable chrome elements rendered in two layouts: a sticky top strip
  // on mobile, OR a fixed left sidebar on desktop. Owner directive 2026-05-23
  // (verbatim — second pass): "the top nav did not combine to side nav on
  // desktop mode". PR #395 only consolidated chrome for /dashboard/[eventId]/*
  // routes (via bottom-nav.tsx); the non-event routes (/dashboard root,
  // /profile, /create-event, /notifications, /api-keys) still showed the top
  // strip on desktop because OuterDashboardHeader had no `lg:hidden` /
  // sidebar variant. This commit adds both.
  const monogramAffordance = primaryEvent ? (
    <EventSwitcher
      currentEventId={primaryEvent.event_id}
      currentEventName={primaryEvent.display_name}
      currentEventDate={primaryEvent.event_date}
      currentMonogramText={primaryEvent.monogram_text}
      currentMonogramColor={primaryEvent.monogram_color}
      events={switcherEvents}
      hasVendorAccess={hasVendorAccess}
      hasAdminAccess={hasAdminAccess}
      vendorProfiles={vendorProfiles}
    />
  ) : (
    <Link
      href="/dashboard/create-event"
      aria-label="Create your first event"
      className="inline-flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
    >
      <EmptyEventMonogram size="md" />
      <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-ink/60 sm:inline">
        Add event
      </span>
    </Link>
  );

  return (
    <>
      {/* Mobile: sticky top strip (< lg / < 1024px). Hidden on desktop —
          the sidebar below is the single source of chrome on lg+. */}
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {monogramAffordance}

          <div className="flex items-center gap-2">
            <Link
              href="/vendors"
              aria-label="Vendor marketplace"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink sm:px-3"
            >
              <Store aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">Marketplace</span>
            </Link>
            <RoleSwitchPill
              currentRole="customer"
              hasCustomerAccess
              hasVendorAccess={hasVendorAccess}
              hasAdminAccess={hasAdminAccess}
              vendorProfiles={vendorProfiles}
            />
            <UnreadBellBadge
              userId={userId}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <ProfileMenu email={email} ariaLabel="Account menu" />
          </div>
        </div>
      </header>

      {/* Desktop: fixed left sidebar (>= lg / >= 1024px). Mirrors the
          event-route sidebar from bottom-nav.tsx so the chrome is visually
          identical across event + non-event surfaces. Main content gets
          `lg:pl-60` from the parent layout (dashboard/layout.tsx) so it
          sits to the right of this 240px sidebar. */}
      <nav
        aria-label="Dashboard navigation"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-ink/10 lg:bg-cream"
      >
        {/* Top: monogram + caret event switcher (or "Add event" empty state). */}
        <div className="border-b border-ink/10 px-3 py-3">
          {monogramAffordance}
        </div>

        {/* Middle (flex-1): empty spacer. Non-event routes don't have the
            4-tab event nav (Home / Guests / Website / Services) — those
            live in the event-route sidebar. Browsing affordances live at
            the bottom strip so the chrome doesn't read empty. */}
        <div className="flex-1" />

        {/* Bottom strip: Marketplace + role-switch + bell + profile. Same
            arrangement as the event-route sidebar's bottom strip so the
            two surfaces feel consistent. */}
        <div className="border-t border-ink/10 px-3 py-3">
          <Link
            href="/vendors"
            aria-label="Vendor marketplace"
            className="mb-1 flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Store aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>Marketplace</span>
          </Link>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
            <RoleSwitchPill
              currentRole="customer"
              hasCustomerAccess
              hasVendorAccess={hasVendorAccess}
              hasAdminAccess={hasAdminAccess}
              vendorProfiles={vendorProfiles}
            />
            <div className="flex items-center gap-2">
              <UnreadBellBadge
                userId={userId}
                initialUnread={unreadCount}
                href="/dashboard/notifications"
                ariaBaseLabel="Notifications"
                ariaUnreadSuffix="unread"
              />
              <ProfileMenu email={email} ariaLabel="Account menu" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
