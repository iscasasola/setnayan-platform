import Link from 'next/link';
import { Store } from 'lucide-react';
import { EventSwitcher, type SwitcherEvent, type SwitcherVendorTarget } from '@/app/dashboard/[eventId]/_components/event-switcher';
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { ProfileMenu } from '@/app/_components/profile-menu';
import { HideOnScrollHeader } from '@/app/_components/nav/hide-on-scroll-header';

/**
 * Account-route dashboard chrome — iteration 0000 single-strip top-nav
 * (locked 2026-05-14) + event-switcher / add-event entry-point
 * (locked 2026-05-15).
 *
 * Rendered ONLY by `dashboard/(account)/layout.tsx` — i.e. on the non-event
 * dashboard routes (`/dashboard` picker, `/dashboard/profile`,
 * `/dashboard/notifications`, `/dashboard/create-event`, `/dashboard/api-keys`).
 *
 * 2026-06-14 chrome retirement: the old `usePathname()` "return null on event
 * routes" guard is GONE. This component used to be rendered by the shared
 * parent layout for every /dashboard route and suppressed on event routes only
 * after hydration — which made the legacy cream chrome flash before the paper
 * event chrome. Now it lives inside the `(account)` route group, so it renders
 * structurally (server-side) only where it belongs, and its palette is the v2.1
 * `--m-*` paper system (was cream) so the old design is fully retired.
 *
 * Layout:
 *   - **Left:** Monogram of the primary event (caret ▾ opens the switcher;
 *     tap routes to the primary event dashboard). With zero events the
 *     anchor renders as the empty-state "+" monogram linking to
 *     `/dashboard/create-event`.
 *   - **Right:** Notification bell + (I) ProfileMenu dropdown (Profile,
 *     Settings, Sign out). The global Setnayan wordmark + standalone
 *     `Sign out` button are intentionally NOT in this chrome.
 */

type PrimaryEventData = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
  monogram_style?: string | null;
  monogram_custom_svg?: string | null;
};

type Props = {
  userId: string;
  email: string;
  /** Presigned display URL of the ACCOUNT's profile photo (owner directive
      2026-06-12: avatar = account photo, never the event logo). */
  photoUrl: string | null;
  unreadCount: number;
  primaryEvent: PrimaryEventData | null;
  switcherEvents: SwitcherEvent[];
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: SwitcherVendorTarget[];
  /** DB-driven creatable event types (2026-06-13) for the switcher's
      add-event sheet — fetched by the account layout, threaded through. */
  eventTypes?: readonly EventTypeRow[];
};

export function OuterDashboardHeader({
  userId,
  email,
  photoUrl,
  unreadCount,
  primaryEvent,
  switcherEvents,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
  eventTypes,
}: Props) {
  // Reusable chrome elements rendered in two layouts: a sticky top strip
  // on mobile, OR a fixed left sidebar on desktop (owner directive 2026-05-23
  // "the top nav did not combine to side nav on desktop mode").
  // Unified switcher (2026-06-12 single-switcher directive) — the
  // EventSwitcher handles the zero-event case itself (empty "+" monogram
  // anchor with the menu still openable).
  const monogramAffordance = (
    <EventSwitcher
      currentRole="customer"
      currentEventId={primaryEvent?.event_id ?? null}
      currentEventName={primaryEvent?.display_name ?? null}
      currentEventDate={primaryEvent?.event_date ?? null}
      currentMonogramText={primaryEvent?.monogram_text ?? null}
      currentMonogramColor={primaryEvent?.monogram_color ?? null}
      currentMonogramFrameKey={primaryEvent?.monogram_frame_key}
      currentMonogramFontKey={primaryEvent?.monogram_font_key}
      currentMonogramStyle={primaryEvent?.monogram_style}
      currentMonogramCustomSvg={primaryEvent?.monogram_custom_svg}
      events={switcherEvents}
      hasCustomerAccess
      hasVendorAccess={hasVendorAccess}
      hasAdminAccess={hasAdminAccess}
      vendorProfiles={vendorProfiles}
      eventTypes={eventTypes}
    />
  );

  // Upper-right avatar = the ACCOUNT's profile photo (owner directive
  // 2026-06-12: account photo, never the event logo). ProfileMenu falls back
  // to the account initial when no photo is uploaded.
  return (
    <>
      {/* Mobile: sticky top strip (< lg / < 1024px). Hidden on desktop —
          the sidebar below is the single source of chrome on lg+. Hides on
          scroll-down / reveals on scroll-up per the universal top-nav rule
          (owner 2026-06-15) via HideOnScrollHeader. */}
      <HideOnScrollHeader className="sticky top-0 z-10 border-b border-[var(--m-line)] bg-[var(--m-paper)]/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {monogramAffordance}

          <div className="flex items-center gap-2">
            {/* Marketplace (Store) link + Switch View pill REMOVED from the
                mobile top bar per owner directive 2026-06-03. Both stay
                reachable: Marketplace via in-app entry points + the desktop
                sidebar below; role-switch via the event-switcher dropdown. */}
            <UnreadBellBadge
              userId={userId}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <ProfileMenu email={email} photoUrl={photoUrl} ariaLabel="Account menu" />
          </div>
        </div>
      </HideOnScrollHeader>

      {/* Desktop: fixed left sidebar (>= lg / >= 1024px). Paper palette
          (--m-paper-2 surface · --m-line border) so it matches the event
          route's SidebarShell. Main content gets `lg:pl-60` from the account
          layout so it sits to the right of this 240px sidebar. */}
      <nav
        aria-label="Dashboard navigation"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-[var(--m-line)] lg:bg-[var(--m-paper-2)]"
      >
        {/* Top: monogram + caret event switcher (or "Add event" empty state). */}
        <div className="border-b border-[var(--m-line)] px-3 py-3">
          {monogramAffordance}
        </div>

        {/* Middle (flex-1): empty spacer. Non-event routes don't have the
            event nav — those live in the event-route sidebar. Browsing
            affordances live at the bottom strip so the chrome doesn't read
            empty. */}
        <div className="flex-1" />

        {/* Bottom strip: Marketplace + bell + profile. */}
        <div className="border-t border-[var(--m-line)] px-3 py-3">
          <Link
            href="/explore"
            aria-label="Vendor marketplace"
            className="mb-1 flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Store aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>Marketplace</span>
          </Link>

          {/* RoleSwitchPill RETIRED 2026-06-12 (single-switcher directive) —
              cross-console hopping lives in the unified EventSwitcher's
              "Switch view" rows (top-of-sidebar monogram caret above). */}
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--m-line)] pt-3">
            <UnreadBellBadge
              userId={userId}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <ProfileMenu email={email} photoUrl={photoUrl} ariaLabel="Account menu" />
          </div>
        </div>
      </nav>
    </>
  );
}
