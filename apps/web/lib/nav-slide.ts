/**
 * nav-slide.ts — which way the page slides on a bottom-bar tab press, as one
 * pure answer the listener (`app/_components/nav/nav-slide-controller.tsx`)
 * and its guard (`app/_components/nav/one-tab-slide-everywhere.test.ts`) both ask.
 *
 * Owner, 24 Oct 2026: *"The transition animation between menus found in event
 * dashboard does not apply to the user and shop dashboard."* There is ONE
 * slide — this direction rule, one listener in the root layout, one set of
 * keyframes in globals.css — and every dashboard's bar is the same
 * `<BottomNav>`. What differed was what each dashboard handed it.
 *
 * ── THE LIT TAB IS THE BAR'S OWN ANSWER ────────────────────────────────────
 * The listener used to work out which tab was lit from the tabs' addresses
 * alone (exact for a dashboard's home, prefix for the rest). That is not the
 * rule the bar lights a tab by: the bar reads each tab's `activeMatch`, and the
 * shop's tabs are lit by long lists of OTHER addresses (Customers by
 * `/vendor-dashboard/bookings`, `/messages`, `/calendar` …; Shop by `/verify`,
 * `/reviews`, `/team` …). On every one of those pages the address rule found
 * NO lit tab, and "no lit tab" is a deliberate no-slide — so a supplier pressed
 * the bar and the page just swapped. The bar already marks its lit tab
 * `aria-current="page"`; that mark is now read first, and the address rule is
 * only the fallback for a bar that lights nothing.
 *
 * Direction is the SIGN of the step in the bar's left-to-right order, never its
 * size: one slide whether you skip no tabs or three.
 */

export type SlideTab = {
  /** The tab's address (pathname only). */
  path: string;
  /** The bar drew it lit (`aria-current="page"`). */
  current: boolean;
};

/** A dashboard's home tab is lit only on its own address — every other page there starts with it. */
const HOME = /^\/(dashboard\/[^/]+|vendor-dashboard|admin)$/;

/** Which tab the bar has lit for `pathname`, or -1 when none can be named (then: no slide). */
export function activeTabIndex(tabs: readonly SlideTab[], pathname: string): number {
  const lit = tabs.findIndex((t) => t.current);
  if (lit >= 0) return lit;
  let best = -1;
  let bestLen = -1;
  tabs.forEach((t, i) => {
    const ok = HOME.test(t.path) ? pathname === t.path : pathname === t.path || pathname.startsWith(t.path + '/');
    if (ok && t.path.length > bestLen) {
      best = i;
      bestLen = t.path.length;
    }
  });
  return best;
}

/**
 * The slide for pressing tab `pressed` while tab `active` is lit: 'fwd' (the
 * page leaves to the LEFT, the new one arrives from the RIGHT) for a tab to the
 * right, 'back' for one to the left, null for the lit tab itself or when either
 * is unknown — a plain navigation, never a slide the wrong way.
 */
export function tabSlideDir(pressed: number, active: number): 'fwd' | 'back' | null {
  if (pressed < 0 || active < 0 || pressed === active) return null;
  return pressed > active ? 'fwd' : 'back';
}
