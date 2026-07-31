import Link from 'next/link';

import { LogoMark, Wordmark } from '@/app/_components/brand-marks';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

import { HomeCommandBar, type HomeCommandItem } from './home-command-bar';

/**
 * HomeRail — ONE line that carries identity, search and account, replacing the
 * launcher's separate top-bar `<header>` plus the standalone command-bar block
 * beneath it.
 *
 * ── WHY (owner, 2026-07-30) ─────────────────────────────────────────────────
 * Two complaints, one cause. "on the upper part, that is the header part. we do
 * not want this. it looks generic." and, after the first pass, "the search bar
 * is still on top." The launcher was spending its two most valuable rows on
 * chrome: a full-width header strip (wordmark | bell + avatar) and then a
 * full-width search bar, before any of the user's own content appeared.
 *
 * The fix is not to DELETE the header — that would strand notifications,
 * profile and sign-out, which is exactly the orphaned-doorway bug class the
 * repo keeps re-learning (`Route_Wayfinding_Audit_2026-07-15`, rule 3: never
 * delete the only door). Every control the header carried is still here, on the
 * same line as the search, so the page opens on CONTENT while keeping the
 * 2026-07-16 "Wordmark = home · plaque = account menu" grammar intact.
 *
 * ⚠ REACHABILITY CONTRACT — do not remove any of these without adding another
 * rendered door first:
 *   · Wordmark  → `/dashboard`  (the only 1-click home; load-bearing on mobile,
 *                 where no other surface renders a wordmark)
 *   · Bell      → `/dashboard/notifications`
 *   · Switcher  → Profile & settings · Shop/HQ · Setnayan AI · sign out
 * Sign-out exists NOWHERE else on this surface.
 *
 * Sticky so the search and the account menu stay reachable down a long home;
 * `top-0` + the ambient blur means it reads as part of the wash rather than as
 * a bar sitting on top of it.
 */
export function HomeRail({
  userId,
  unreadCount,
  switcherData,
  commandItems,
}: {
  userId: string;
  unreadCount: number;
  switcherData: SwitcherData;
  commandItems: HomeCommandItem[];
}) {
  return (
    <div
      className="sn-reveal sticky top-0 z-40 -mx-4 mb-5 px-4 py-3 backdrop-blur-[14px] sm:-mx-6 sm:mb-8 sm:px-6 lg:-mx-8 lg:px-8"
      style={{ animationDelay: '0.12s' }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Identity — mark alone on phones (the wordmark would eat the row the
            search needs), mark + wordmark from sm up. Both link home. */}
        <Link
          href="/dashboard"
          aria-label="Setnayan — home"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sn-gold-600)]"
        >
          <LogoMark size={28} className="sm:hidden" />
          <span className="hidden sm:inline">
            <Wordmark />
          </span>
        </Link>

        {/* The search takes the rail's slack — it is no longer a row of its own. */}
        <div className="min-w-0 flex-1">
          <HomeCommandBar items={commandItems} variant="rail" />
        </div>

        {/* The utility capsule the old header carried, unchanged in behaviour. */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white/45 p-1 shadow-[0_12px_30px_-22px_rgba(30,26,18,0.45)] backdrop-blur-[16px]">
          <UnreadBellBadge
            userId={userId}
            initialUnread={unreadCount}
            href="/dashboard/notifications"
            ariaBaseLabel="Notifications"
            ariaUnreadSuffix="unread"
            pulse
          />
          <AccountSwitcher data={switcherData} />
        </div>
      </div>
    </div>
  );
}
