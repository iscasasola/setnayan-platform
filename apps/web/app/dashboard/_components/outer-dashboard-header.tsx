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
 *   - **Right:** Notification bell + (I) ProfileMenu dropdown (Profile &
 *     settings, Sign out). The global Setnayan wordmark + standalone
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

  return (
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {primaryEvent ? (
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
        )}

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
  );
}
