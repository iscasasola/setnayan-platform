/**
 * tab-memory.ts — 🔁 EVERY BOTTOM-BAR TAB KEEPS ITS LAST VIEW, AND A RE-TAP GOES TO ITS TOP (owner 9 Nov 2026,
 * DECISION_LOG row 44a4c660, confirmed 13 Nov: *"when you are not on that home menu, tapping home returns you to your
 * last view on home"* — widened the same day: *"this should apply to any menu"*).
 *
 *   1 · Tapping ANOTHER tab opens that tab's LAST VIEW: the last address you were on inside it AND the scroll there.
 *   2 · Tapping the tab you are ON goes to its top in ONE tap: the page may answer first (`sn:tab-reselect`, e.g. Home
 *       keeps its section, Clients drops the picked client); unanswered, the bar scrolls to the top when you are on the
 *       tab's first screen, else opens the first screen (a fresh page, at the top). Either way the tab's kept view is
 *       forgotten, so the next return starts from its top too. No double-tap gesture.
 *
 * ONE mechanism for every bar — the account bar (Home · Discover), the event bar, the supplier bar, the admin bar —
 * because every one of them draws the shared `BottomNav` (flat path). Home's section memory rides it: the Home tab's
 * last address is `/dashboard?seg=…`.
 *
 * Pure over a `Storage`-shaped store (sessionStorage in the bar, a plain map in the guard). Every caller wraps it in
 * try/catch — a private window that refuses storage gets the plain tab, a correct answer.
 * 🔒 app/_components/nav/every-tab-keeps-its-last-view.test.ts
 */

export type TabStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type TabView = { href: string; y: number };

/** One bar's tabs share a scope (their keys), so `home` on one bar never answers for `home` on another. */
export function tabScope(keys: readonly string[]): string {
  return keys.join(',');
}

const viewKey = (scope: string, key: string) => `sn-tab-view:${scope}:${key}`;
/** Set by a tap on another tab; consumed by the bar once that tab's page is drawn. */
export const TAB_RESTORE_KEY = 'sn-tab-restore';

function parse(raw: string | null): TabView | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TabView>;
    if (typeof v.href !== 'string' || !v.href.startsWith('/') || v.href.startsWith('//')) return null;
    const y = Number(v.y);
    return { href: v.href, y: Number.isFinite(y) && y > 0 ? Math.round(y) : 0 };
  } catch {
    return null;
  }
}

/** Keep where you are in the tab you are on. */
export function saveTabView(store: TabStore, scope: string, key: string, view: TabView): void {
  store.setItem(viewKey(scope, key), JSON.stringify({ href: view.href, y: Math.max(0, Math.round(view.y)) }));
}

export function readTabView(store: TabStore, scope: string, key: string): TabView | null {
  return parse(store.getItem(viewKey(scope, key)));
}

/** Re-tap on the tab you are on: its kept view is forgotten. */
export function forgetTabView(store: TabStore, scope: string, key: string): void {
  store.removeItem(viewKey(scope, key));
}

/** Where a tap on ANOTHER tab goes: its kept address, else the tab's own. */
export function tabDoor(store: TabStore, scope: string, key: string, href: string): string {
  return readTabView(store, scope, key)?.href ?? href;
}

/** A tap on another tab: remember to put its scroll back once its page is drawn. */
export function markTabRestore(store: TabStore, scope: string, key: string): void {
  const v = readTabView(store, scope, key);
  if (v && v.y > 0) store.setItem(TAB_RESTORE_KEY, JSON.stringify({ scope, key, href: v.href, y: v.y }));
  else store.removeItem(TAB_RESTORE_KEY);
}

/**
 * On a drawn page: the scroll to put back, or null. Only for the tab the tap was for, on the address it opened (a
 * redirect elsewhere is not "your last view"). The mark is consumed either way.
 */
export function takeTabRestore(store: TabStore, scope: string, activeKey: string | null, here: string): number | null {
  const raw = store.getItem(TAB_RESTORE_KEY);
  if (!raw) return null;
  store.removeItem(TAB_RESTORE_KEY);
  try {
    const m = JSON.parse(raw) as { scope?: string; key?: string; href?: string; y?: number };
    if (m.scope !== scope || m.key !== activeKey || m.href !== here) return null;
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
