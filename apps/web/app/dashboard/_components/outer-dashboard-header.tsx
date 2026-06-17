import Link from 'next/link';
import { Store } from 'lucide-react';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { HideOnScrollHeader } from '@/app/_components/nav/hide-on-scroll-header';
import { AccountSwitcher, AccountSwitcherStandalone } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

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

type Props = {
  unreadCount: number;
  /** Pre-fetched data for the unified AccountSwitcher — always provided
      now that getSwitcherData never returns null. */
  switcherData: SwitcherData;
};

export function OuterDashboardHeader({ unreadCount, switcherData }: Props) {
  return (
    <>
      {/* Mobile: sticky top strip (< lg). AccountSwitcher pill at LEFT replaces
          the old EventSwitcher monogram; bell stays at RIGHT. Hides on scroll-
          down per the universal top-nav rule (owner 2026-06-15). */}
      <HideOnScrollHeader className="sticky top-0 z-10 border-b border-[var(--m-line)] bg-[var(--m-paper)]/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <AccountSwitcher data={switcherData} />

          <div className="flex items-center gap-2">
            <UnreadBellBadge
              userId={switcherData.userId}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
          </div>
        </div>
      </HideOnScrollHeader>

      {/* Desktop: fixed left sidebar (>= lg). Paper palette (--m-paper-2 surface
          · --m-line border). Main content gets `lg:pl-60` from the account
          layout. AccountSwitcherStandalone at the bottom replaces ProfileMenu. */}
      <nav
        aria-label="Dashboard navigation"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-[var(--m-line)] lg:bg-[var(--m-paper-2)]"
      >
        {/* Spacer — non-event routes have no sidebar nav items here; affordances
            live at the bottom strip so the chrome doesn't read empty. */}
        <div className="flex-1" />

        {/* Bottom strip: Marketplace + bell + AccountSwitcherStandalone. */}
        <div className="border-t border-[var(--m-line)] px-3 py-3">
          <Link
            href="/explore"
            aria-label="Vendor marketplace"
            className="mb-1 flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Store aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>Marketplace</span>
          </Link>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--m-line)] pt-3">
            <UnreadBellBadge
              userId={switcherData.userId}
              initialUnread={unreadCount}
              href="/dashboard/notifications"
              ariaBaseLabel="Notifications"
              ariaUnreadSuffix="unread"
            />
            <AccountSwitcherStandalone data={switcherData} />
          </div>
        </div>
      </nav>
    </>
  );
}
