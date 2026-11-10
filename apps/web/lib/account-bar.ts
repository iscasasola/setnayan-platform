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
 *   · Discover is a tab only where `/` actually OPENS. Since the owner's
 *     2026-11-02 ruling ("let everything go live") that is everywhere — the
 *     phone and desktop apps open Discover like the website, so they draw the
 *     same four tabs. (While Apple reviewed 1.0 the app bounced `/` to the board
 *     and drew Events · Memories · People.) `discoverOpen` is that question,
 *     answered on the server (`discoverOpensHere()` in lib/request-platform.ts),
 *     so if `/` is ever refused in a shell again the bar drops the tab in the
 *     same change instead of drawing a press that lands where you stood.
 *
 *
 * 🔁 THE ORDER, RE-RULED (owner, 11 Nov 2026, verbatim: *"arrangement of use
 *    dashboard should be Events - People - Shop - Memories - Discover"* —
 *    DECISION_LOG 2026-11-11 "THE ACCOUNT BAR ORDER"). Which tabs, and for
 *    whom, is unchanged from the rulings above; only their order is new. Shop
 *    still draws only for an owner and Discover only where `/` opens — each in
 *    its ruled place when drawn.
 *
 * Pure and dependency-free so the server layouts, the client bar and the guard
 * all ask the same function (`app/dashboard/(launcher)/the-account-bar-is-the-ruling.test.ts`).
 */

export type AccountBarTab = 'events' | 'people' | 'shop' | 'memories' | 'discover';

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
  // THE ORDER (owner 2026-11-11, DECISION_LOG "THE ACCOUNT BAR ORDER"): Events · People · Shop · Memories ·
  // Discover. The two gated tabs keep their places when they are drawn and leave no gap when they are not.
  const tabs: AccountBarTab[] = ['events', 'people'];
  if (ownsShop) tabs.push('shop');
  tabs.push('memories');
  if (discoverOpen) tabs.push('discover');
  return tabs;
}
