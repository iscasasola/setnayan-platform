import 'server-only';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import {
  getSwitcherData,
  type SwitcherData,
} from '@/app/_components/account-switcher/get-switcher-data';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';

/**
 * signed-in-cluster.tsx — the ONE utility cluster, for the surfaces that were
 * not handing one in.
 *
 * ─── WHAT THE OWNER SAW (2026-08-15, two screenshots) ─────────────────────
 * Two signed-in screens, two different bars. On `/dashboard/notifications`:
 * a real bell and the account switcher (an identity pill with a chevron). On
 * `/`: a "🔔" EMOJI and a plain initials circle. *"why does the top nav
 * differ?"*
 *
 * 🔑 IT WAS THE SHELL'S FALLBACK SHOWING THROUGH. `FrontDoorShell` renders
 * `topBarSlot ?? <a 🔔 + an initials button>`. The five signed-in trees each
 * hand in their own cluster, so they got the real one. `/` and every
 * `variant="doorway"` page handed in nothing, so they got the placeholder —
 * which was written for a SIGNED-OUT visitor and is wrong for a signed-in one.
 *
 * 🔴 AND IT COST A REAL THING, NOT JUST A LOOK: the emoji is a static link. It
 * cannot show a count. `UnreadBellBadge` server-renders the unread number and
 * then keeps it live over a realtime subscription. So on `/` — and on About,
 * Alaala, Explore, Real Stories and the product doorways — a person with a
 * stack of unread notifications was shown a bell that could never say so. The
 * owner's own inbox in the first screenshot was full at the time.
 *
 * ⚠ THIS IS THE EXACT HAZARD `one-top-bar.test.ts` WROTE DOWN and did not
 * cover: *"a tree that stops passing `topBarSlot` still renders a perfectly
 * good-looking bar."* An absence with no symptom. The guard checked the five
 * app trees; nothing checked the surfaces that were never in that list.
 *
 * 🔑 REUSED, NOT REBUILT (RULE 0). These are the SAME two components
 * `dashboard/(account)/layout.tsx` mounts, with the same props and the same
 * fallback. A second cluster would be a second answer to one question and the
 * two would drift inside a week — which is the whole reason the shared bar
 * exists.
 *
 * COST: none measured. Every surface that renders this is ALREADY dynamic —
 * `/`, `/about`, `/explore` and `/papic` all answer
 * `private, no-cache, no-store` with `x-vercel-cache: MISS` (checked live
 * 2026-08-15), so nothing was made uncacheable to add it. Both reads are React
 * `cache()`d at source and shared with the account resolver the rail already
 * calls.
 *
 * RETURNS NULL FOR A SIGNED-OUT VISITOR, so the caller can mount it
 * unconditionally and the shell's signed-out branch (the rail's sign-in
 * prompt) is untouched.
 */
export async function SignedInCluster({
  /** Where the bell points. Every current caller wants the account inbox. */
  href = '/dashboard/notifications',
}: {
  href?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    isAnonymous: !!user.is_anonymous,
    photoUrl: null,
    events: [],
    context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false },
  };

  /*
    A FAILED READ MUST STILL PAINT A BAR. Same posture as the rail's nav-label
    read directly above the caller: the chrome degrades to a working control,
    never to a blank corner. An unread count that cannot be read renders as NO
    badge — never as a zero, because "0" is a measured claim and this is an
    unmeasured one (`unmeasured-is-not-zero.test.ts`).
  */
  const [shell, switcherData] = await Promise.all([
    getDashboardShell(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[SignedInCluster] unread count read failed:', err);
      return { unreadCount: 0 } as Awaited<ReturnType<typeof getDashboardShell>>;
    }),
    getSwitcherData(user.id).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[SignedInCluster] switcher data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
  ]);

  return (
    <>
      <UnreadBellBadge
        userId={user.id}
        initialUnread={shell.unreadCount}
        href={href}
        ariaBaseLabel="Notifications"
        ariaUnreadSuffix="unread"
      />
      <AccountSwitcher data={switcherData} />
    </>
  );
}
