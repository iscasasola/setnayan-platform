/**
 * tab-memory.ts — 🔁 EVERY BOTTOM-BAR TAB KEEPS ITS LAST VIEW, AND A RE-TAP GOES TO ITS TOP (owner 9 Nov 2026,
 * DECISION_LOG row 44a4c660, confirmed 13 Nov: *"when you are not on that home menu, tapping home returns you to your
 * last view on home"* — widened the same day: *"this should apply to any menu"*).
 *
 *   1 · Tapping ANOTHER tab opens that tab's LAST VIEW: the last address you were on inside it AND the scroll there.
 *   2 · Tapping the tab you are ON goes to its top in ONE tap: the page may answer first (`sn:tab-reselect`, e.g. Home
 *       keeps its section, Clients drops the picked client); unanswered, the bar scrolls to the top when you are on the
 *       tab's first screen, else opens the first screen (a fresh page, at the top). Either way the tab's kept view is
 *       forgotten, so the next return starts from its top too.
 *   3 · 👆👆 THE ONE DOUBLE TAP (owner 13 Nov 2026, amending rule 2): on a tab that carries a `twin` (Home on the account
 *       bar ⇄ Today on the supplier bar) and that you are ALREADY on, the first tap is still the top at once; a second
 *       tap within `TWIN_TAP_MS` opens the twin tab's last view (Home → your shop — the last-used one, which the
 *       supplier pages already open by the `sn_shop` cookie the account switcher writes; Today → your Home). No shop =
 *       no twin = just the top. A double tap on a tab you are NOT on is two ordinary taps. No other double taps. It is a
 *       shortcut only: the single tap is the accessible behaviour, and the switch stays reachable in the account sheet.
 *
 * ONE mechanism for every bar — the account bar, the event bar, the supplier bar, the admin bar — because every one of
 * them draws the shared `BottomNav` (flat path). A tab's memory is keyed by the tab's OWN address (its root href), so a
 * twin on another bar can be found, and Home's section memory rides it: the Home tab's last address is `/dashboard?seg=…`.
 *
 * Pure over a `Storage`-shaped store (sessionStorage in the bar, a plain map in the guard). Every caller wraps it in
 * try/catch — a private window that refuses storage gets the plain tab, a correct answer.
 * 🔒 app/_components/nav/every-tab-keeps-its-last-view.test.ts
 */

export type TabStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type TabView = { href: string; y: number };

const viewKey = (tab: string) => `sn-tab-view:${tab}`;
/** Set by a tap that opens a kept view; consumed by the bar once that tab's page is drawn. */
export const TAB_RESTORE_KEY = 'sn-tab-restore';
/** The double tap's window — a second tap on the tab you are on within this many ms opens its twin. */
export const TWIN_TAP_MS = 300;

/** Only this app's own paths are ever followed — never `//host` or a full URL. */
const ownPath = (href: unknown): href is string => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');

/** Keep where you are in the tab you are on (`tab` = the tab's own address). */
export function saveTabView(store: TabStore, tab: string, view: TabView): void {
  if (!ownPath(view.href)) return;
  store.setItem(viewKey(tab), JSON.stringify({ href: view.href, y: Math.max(0, Math.round(view.y)) }));
}

export function readTabView(store: TabStore, tab: string): TabView | null {
  try {
    const v = JSON.parse(store.getItem(viewKey(tab)) ?? 'null') as Partial<TabView> | null;
    if (!v || !ownPath(v.href)) return null;
    const y = Number(v.y);
    return { href: v.href, y: Number.isFinite(y) && y > 0 ? Math.round(y) : 0 };
  } catch {
    return null;
  }
}

/** Re-tap on the tab you are on: its kept view is forgotten. */
export function forgetTabView(store: TabStore, tab: string): void {
  store.removeItem(viewKey(tab));
}

/** Where a tap on a tab goes: its kept address, else the tab's own. */
export function tabDoor(store: TabStore, tab: string): string {
  return readTabView(store, tab)?.href ?? tab;
}

/** About to open `tab`'s kept view: remember to put its scroll back once its page is drawn. */
export function markTabRestore(store: TabStore, tab: string): void {
  const v = readTabView(store, tab);
  if (v && v.y > 0) store.setItem(TAB_RESTORE_KEY, JSON.stringify({ tab, href: v.href, y: v.y }));
  else store.removeItem(TAB_RESTORE_KEY);
}

/**
 * On a drawn page: the scroll to put back, or null. Only for the tab the tap was for (`activeTab`, its own address), on
 * the address it opened — a redirect elsewhere is not "your last view". The mark is consumed either way.
 */
export function takeTabRestore(store: TabStore, activeTab: string | null, here: string): number | null {
  const raw = store.getItem(TAB_RESTORE_KEY);
  if (!raw) return null;
  store.removeItem(TAB_RESTORE_KEY);
  try {
    const m = JSON.parse(raw) as { tab?: string; href?: string; y?: number };
    if (m.tab !== activeTab || m.href !== here) return null;
    const y = Number(m.y);
    return Number.isFinite(y) && y > 0 ? y : null;
  } catch {
    return null;
  }
}

/** A re-tap nobody answered: scroll in place when already on the tab's first screen, else open that first screen. */
export function reselectInPlace(here: string, tabHref: string): boolean {
  return here === tabHref;
}

/**
 * 👆👆 A re-tap on the tab you are ON, at `now`: is it the second tap of a double tap that opens the twin? `last` is the
 * previous re-tap on the same tab (or null). Only a tab with a twin, only within `TWIN_TAP_MS`. The caller only asks on
 * a re-tap — a tap on a tab you are not on never reaches here, so it can never be half of a double tap.
 */
export function isTwinTap(last: { tab: string; at: number } | null, tab: string, twin: string | undefined, now: number): boolean {
  return !!twin && !!last && last.tab === tab && now - last.at >= 0 && now - last.at <= TWIN_TAP_MS;
}
