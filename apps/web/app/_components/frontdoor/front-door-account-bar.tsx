/**
 * front-door-account-bar.tsx — the account bar on Discover (`/`), for somebody
 * signed in. Signed out it renders nothing: the public front door is unchanged.
 *
 * Owner, 22 Oct 2026, over the signed-in Events board with the new bar
 * (Events · Discover · Memories · People): *"Discover needs to show the bottom
 * nav still."* The bar (#6753) was mounted by the two `/dashboard` layouts
 * only, and its Discover tab is `/` — a page outside both — so pressing
 * Discover was the one tab that took the bar away.
 *
 * 🔑 THE SAME BAR, THE SAME RULE, THE SAME MOUNT. `<AccountBarSlot>` (the bar
 * in its own chunk, server-rendered), with the tabs `accountBarTabs()` answers
 * from the same switcher context the layouts read — so Shop shows for an owner
 * here exactly as it does on the board. Discover lights because `/` is its
 * address (`activeMatchExact`). Every read is React `cache()`d and already paid
 * on this page by `SignedInCluster` (the top bar's bell + account switcher).
 *
 * 🍎 THE APP SHELL IS UNCHANGED. While `/` is in middleware's
 * `APP_EXCLUDED_MARKETING_PATHS` the native shell never renders this page (it
 * is bounced to the board), and `discoverOpensHere()` says the same thing here.
 *
 * Rendered by `front-door.tsx` OUTSIDE the shell's <main>: the dock is `fixed`,
 * and a fixed element inside an element that takes a `view-transition-name`
 * (the page does, for the length of a set-change slide — globals.css) would be
 * positioned against that element instead of the screen.
 */
import 'server-only';

import { getCurrentUser } from '@/lib/auth';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import { accountBarTabs, ownsAShop } from '@/lib/account-bar';
import { discoverOpensHere } from '@/lib/request-platform';

export async function FrontDoorAccountBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [switcherData, discoverOpen] = await Promise.all([
    // A failed read still draws the bar — without a Shop tab, the same
    // fallback the layouts use (it measured nothing, so it claims no shop).
    getSwitcherData(user.id).catch(() => ({
      context: { hasVendor: false, canOpenShop: false },
    })),
    discoverOpensHere(),
  ]);
  return <AccountBarSlot tabs={accountBarTabs({ ownsShop: ownsAShop(switcherData.context), discoverOpen })} />;
}
