/**
 * 🔁 EVERY BOTTOM MENU REMEMBERS WHERE YOU LEFT IT (owner, 2026-11-13, universal rule across the whole app):
 *
 *   *"tapping a menu when you are at a different menu will jump to your page's last state while pressing it when you
 *    are at that menu will jump to the top."*
 *
 *   · a tap on ANOTHER tab   → that tab's LAST state: the sub-page you were on under it, scrolled to where you were.
 *   · a tap on the tab you are ON → its FIRST state: the tab's own page, at the top (already there → scroll to top).
 *
 * The app bars (`BottomNav` — couple, supplier, admin, account) and the event site's tab panes (`HubShell`) both read
 * this one module, so the rule cannot drift between them. Same ruling, written earlier as "T5" on the account bar's Home
 * (`useHomeDoor`, `HomeSegMemory`) — this generalises it to every tab.
 *
 * A tab's memory is keyed by its OWN page (the tab's href without its query): two events' Guests tabs are two tabs.
 * Session-scoped (sessionStorage), and every read and write is guarded — a private window or blocked storage simply
 * means the tab opens on its own page, exactly as before this rule.
 */

export const TAB_MEMORY_PREFIX = 'sn-tab-last:';
export const TAB_RESTORE_KEY = 'sn-tab-restore';

/** Where a tab was left: the full path + query under it, and the page's scroll. */
export type TabState = { path: string; y: number };

/** The tab's own page, without query or hash — the memory key. */
export function tabRoot(href: string): string {
  return href.split(/[?#]/)[0] || '/';
}

/** A storage that may be missing or may throw (private mode, blocked site data). */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): Store | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Parse a stored state; anything malformed reads as "nothing remembered". */
export function parseTabState(raw: string | null): TabState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return null;
    const { path, y } = v as Record<string, unknown>;
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
    return { path, y: typeof y === 'number' && Number.isFinite(y) && y > 0 ? Math.round(y) : 0 };
  } catch {
    return null;
  }
}

export function rememberTab(href: string, state: TabState, s: Store | null = store()): void {
  try {
    s?.setItem(TAB_MEMORY_PREFIX + tabRoot(href), JSON.stringify(state));
  } catch {
    /* storage full or blocked — the tab opens on its own page */
  }
}

export function recallTab(href: string, s: Store | null = store()): TabState | null {
  try {
    return parseTabState(s?.getItem(TAB_MEMORY_PREFIX + tabRoot(href)) ?? null);
  } catch {
    return null;
  }
}

/**
 * The href a tab should carry. The tab you are ON always points at its own page (a tap = first state). Any other tab
 * points at its remembered page — but only while that page still belongs to the tab (`belongs`, the bar's own active
 * rule); a memory that no longer matches falls back to the tab's own href.
 */
export function tabHref(
  item: { href: string },
  active: boolean,
  remembered: TabState | null,
  belongs: (path: string) => boolean,
): string {
  if (active || !remembered) return item.href;
  const path = tabRoot(remembered.path);
  return belongs(path) ? remembered.path : item.href;
}

/**
 * The tap on the tab you are on: is this already the tab's first state? Then scroll to the top instead of navigating.
 * Anything else under the tab — a sub-page, or the tab's page with a different query — navigates to the tab's own href.
 */
export function isTabFirstState(currentPathWithQuery: string, item: { href: string }): boolean {
  return currentPathWithQuery === item.href;
}

/** Arriving on a remembered page: ask for the scroll back. Read once by `takeRestore` on the page it names. */
export function requestRestore(state: TabState, s: Store | null = store()): void {
  if (state.y <= 0) return;
  try {
    s?.setItem(TAB_RESTORE_KEY, JSON.stringify(state));
  } catch {
    /* no restore — the page opens at the top */
  }
}

/** The scroll to put back on THIS page, once; a request for another page is left alone (it may not have arrived). */
export function takeRestore(currentPathWithQuery: string, s: Store | null = store()): number | null {
  try {
    const want = parseTabState(s?.getItem(TAB_RESTORE_KEY) ?? null);
    if (!want || want.path !== currentPathWithQuery) return null;
    s?.removeItem(TAB_RESTORE_KEY);
    return want.y;
  } catch {
    return null;
  }
}

/**
 * Put the scroll back once the page is tall enough to hold it — a page that streams in grows for a moment, so try on
 * each frame for up to ~1.5 s, and stop the moment the person scrolls themselves.
 */
export function restoreScroll(y: number, win: Window = window): void {
  const until = Date.now() + 1500;
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  win.addEventListener('wheel', stop, { once: true, passive: true });
  win.addEventListener('touchstart', stop, { once: true, passive: true });
  const step = () => {
    if (stopped) return;
    win.scrollTo(0, y);
    if (Math.abs(win.scrollY - y) <= 2 || Date.now() > until) {
      win.removeEventListener('wheel', stop);
      win.removeEventListener('touchstart', stop);
      return;
    }
    win.requestAnimationFrame(step);
  };
  win.requestAnimationFrame(step);
}

/** The first state's scroll: to the top, gently unless the person asked for less motion. */
export function scrollToTop(win: Window = window): void {
  const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  win.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * 🔁 THE SAME RULE FOR A BAR THAT SWITCHES PANES ON ONE PAGE (the event site's `HubShell`: its tabs show and hide
 * panes instead of navigating, so a pane's "last state" is its scroll). One memory per page view, keyed by the page
 * and the pane.
 *
 *   switchPane(from, to) → 'top'          the pane you are on was tapped: scroll it to the top
 *                        → { y }          another pane: show it, then put its scroll back (0 = its top)
 */
export function createPaneMemory() {
  const ys = new Map<string, number>();
  return {
    switchPane(page: string, from: string, to: string, fromY: number): 'top' | { y: number } {
      if (from === to) return 'top';
      ys.set(`${page}|${from}`, Math.max(0, Math.round(fromY)));
      return { y: ys.get(`${page}|${to}`) ?? 0 };
    },
  };
}
