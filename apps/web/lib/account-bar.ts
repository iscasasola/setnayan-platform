/**
 * account-bar.ts — WHICH TABS the account-level phone bar draws, for whom.
 *
 * Owner, 21 Oct 2026, verbatim "yes to all" to the controller's four
 * recommendations on the approved prototype
 * `Setnayan/prototypes/account_bottom_bar_2026-10-21.html` (DECISION_LOG
 * 2026-10-21 "THE ACCOUNT BAR — EVENTS · DISCOVER · MEMORIES · PEOPLE"):
 *
 *   1 · Events · Discover · Memories · People — "Events" replaces "Home" (it is
 *       the Events board; the rail already says Events).
 *   2 · Shop is a FIFTH tab, and only for an account that OWNS a shop
 *       (`hasVendor && !canOpenShop`). A team member of someone else's shop has
 *       `hasVendor` but owns nothing, so `canOpenShop` is still true for them —
 *       they reach the shop from the avatar sheet's "Switch to · Shop" tile.
 *   · Admin is NEVER a tab (internal accounts reach it from the avatar sheet).
 *   · No floating ＋ — Create stays on the Events board (Planning ＋ · "Create
 *     an event" · "+ Start planning").
 *   · In the app shell, while `/` is in middleware's
 *     `APP_EXCLUDED_MARKETING_PATHS` (Apple is reviewing 1.0), there is no
 *     Discover to tap — the shell bounces it to the board — so the bar is
 *     Events · Memories · People. `discoverOpen` is that question, answered on
 *     the server from the request (`discoverOpensHere()` in
 *     lib/request-platform.ts), so the first paint is already the right bar.
 *
 * Pure and dependency-free so the server layouts, the client bar and the guard
 * all ask the same function (`app/dashboard/(launcher)/the-account-bar-is-the-ruling.test.ts`).
 */

export type AccountBarTab = 'events' | 'discover' | 'memories' | 'people' | 'shop';

/** Does this account OWN a shop (not merely work in one)? The prototype's gate. */
export function ownsAShop(ctx: { hasVendor: boolean; canOpenShop: boolean }): boolean {
  return ctx.hasVendor && !ctx.canOpenShop;
}

/** The bar's tabs, in order, for one account on one shell. */
export function accountBarTabs({
  ownsShop,
  discoverOpen,
}: {
  ownsShop: boolean;
  discoverOpen: boolean;
}): AccountBarTab[] {
  const tabs: AccountBarTab[] = ['events'];
  if (discoverOpen) tabs.push('discover');
  tabs.push('memories', 'people');
  if (ownsShop) tabs.push('shop');
  return tabs;
}
