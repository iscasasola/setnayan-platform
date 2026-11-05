/**
 * bar-set.ts — WHICH SET OF TABS the phone's bottom bar carries on a page, and
 * which way the bar slides when a press changes the set.
 *
 * Owner, 22 Oct 2026, verbatim: *"bottom nav should not disappear when going to
 * a different menu. and make its build in and build out (for example, pressing
 * shop) everything moves to the left and the shop icons enter from the right.
 * when we press an event, the account menus move to the right and the event
 * icons enter from the left. we already did this kind of effect before."*
 *
 * The three sets sit on one line, left to right — an EVENT's bar · the ACCOUNT
 * bar (Events · Discover · Memories · People) · the SHOP's bar — and a press
 * that moves you between them slides the way that line reads:
 *
 *   account → shop    'fwd'   out to the LEFT, the shop's icons in from the RIGHT
 *   shop    → account 'back'  the reverse
 *   account → event   'back'  out to the RIGHT, the event's icons in from the LEFT
 *   event   → account 'fwd'   the reverse
 *
 * 'fwd' / 'back' are the SAME words the tab-to-tab slide already uses
 * (`NavSlideController`, `html[data-sn-nav-dir]`), so one set of keyframes in
 * globals.css draws both. A press inside one set is not a set change — it is
 * left to that controller, exactly as before.
 *
 * Pure and dependency-free so the listener (`app/_components/nav/bar-set-slide.tsx`)
 * and its guard (`bar-set.test.ts`) ask the same function.
 */

export type BarSet = 'event' | 'account' | 'shop';

/** Left → right. The direction of a set change is the sign of the step. */
const ORDER: Record<BarSet, number> = { event: 0, account: 1, shop: 2 };

/**
 * The account spokes under `/dashboard/<segment>` — every static folder of the
 * `(account)` and `(launcher)` route groups. Anything else in that position is
 * an event id (`/dashboard/[eventId]`). Held equal to the folders on disk by
 * `bar-set.test.ts`, so a new spoke cannot be mistaken for an event.
 */
export const ACCOUNT_SPOKES: readonly string[] = [
  'api-keys',
  'billing',
  'clusters',
  'create-event',
  'creator',
  'library',
  'life-flash',
  'notifications',
  'people',
  'profile',
  'samahan',
  'search',
  'year',
];

/** `/dev/bar-lab` draws all three sets on fixtures (dev-only; production 404s it). */
const LAB = /^\/dev\/bar-lab(?=\/|$)/;

/** Which set a page's bar carries, or null where no set-change slide applies. */
export function barSetOf(pathname: string): BarSet | null {
  const p = pathname.replace(LAB, '') || '/';
  if (p === '/vendor-dashboard' || p.startsWith('/vendor-dashboard/')) return 'shop';
  // `/` is Discover — an account tab (signed out it has no bar, and the
  // listener never runs without one).
  if (p === '/' || p === '/dashboard') return 'account';
  const m = /^\/dashboard\/([^/]+)/.exec(p);
  if (!m) return null;
  return ACCOUNT_SPOKES.includes(m[1]!) ? 'account' : 'event';
}

/** The slide for a press from one set to another — null when the set does not change. */
export function barSlideDir(from: BarSet | null, to: BarSet | null): 'fwd' | 'back' | null {
  if (!from || !to || from === to) return null;
  return ORDER[to] > ORDER[from] ? 'fwd' : 'back';
}

/**
 * Every condition the set-change slide needs, as one pure answer — so the guard
 * can hold, by behaviour, that reduced motion (or no View Transitions, or no
 * bar on screen) means NO slide: the press then navigates as a plain link.
 *
 * ↔ THE SIDE MENU IS THE BAR ON A WIDE SCREEN, AND IT SLIDES BY THE SAME RULE
 * (owner, 23 Oct 2026, DECISION_LOG "OWNER ANSWERS ON THE BUILD TRACKER", Q1 of
 * `prototypes/desktop_layouts_2026-10-22.html`: *"inside an event/shop the side
 * menu swaps with a slide (one rule with the bottom bar)"*). The swap itself
 * shipped 2026-09-21 (`rail-focus.ts`: inside an event or the shop the rail is
 * that section's menu plus one row back); what the rail lacked was the motion.
 * Where the rail is drawn as a column — every tree from 1024, the event tree's
 * 72-px strip from 701 — a press that changes the set slides the RAIL the way
 * the phone's bar slides: the same direction, the same 280 ms, the same easing
 * (globals.css, `sn-rail`). So a slide needs a bar OR a rail on screen, and
 * nothing else about the width matters any more.
 */
export function barSlideFor(c: {
  fromPath: string;
  toPath: string;
  /** `prefers-reduced-motion: reduce` */
  reduced: boolean;
  /** `document.startViewTransition` exists */
  supported: boolean;
  /** this page's dock is drawn at this width */
  dockShown: boolean;
  /** this page's side menu is drawn as a column (not shut, not an open drawer) */
  railShown: boolean;
}): 'fwd' | 'back' | null {
  if (c.reduced || !c.supported || (!c.dockShown && !c.railShown)) return null;
  return barSlideDir(barSetOf(c.fromPath), barSetOf(c.toPath));
}
