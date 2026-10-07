/**
 * 🧭 THE STAGES CANVAS'S TABS, ON THE PAGE'S OWN DOCUMENT — which tab is on screen, and showing one.
 *
 * The new Maker's Stages canvas draws every tab's content once, in groups marked `data-hub-tab`, and shows one
 * tab's groups at a time — the guest page's own mechanism (`hub/hub-shell.tsx` `showTab`, `_lib/hub-tabs.ts`;
 * the groups are `site-body.tsx`'s, filed by `lib/maker-stage-filing.ts`). These two are that mechanism for the
 * canvas: the bridge switches with them (`editor-bridge.tsx` `hubTab`) and the Stages panel reads the tab on
 * screen with them (`stage-tools.tsx`) — the label "You're editing · Invitation › Me" names the tab the canvas
 * SHOWS, never a guess (owner 08 Oct: on Me it read "Welcome").
 *
 * 📦 No imports, on purpose: the Maker's panel reads this small file, never the bridge — so the bridge stays in
 * the guest page's code and nothing of the Maker rides a guest's page (the rule `maker-section-find.ts` keeps).
 *
 * Pure over a structural document: executed by `lib/every-stages-tab-has-its-own-page.test.ts`.
 */

/** How long a page that just opened keeps its top against a `scrollTo` (the page pick's own, sent with it). */
export const HUB_TAB_HOLD_MS = 400;

type TabGroup = { hidden: boolean; getAttribute(name: string): string | null };
type TabDoc = { querySelectorAll(sel: string): ArrayLike<TabGroup> };

/** The tab on screen: the one whose groups are shown — null on a page that is one scroll. */
export function shownHubTab(doc: TabDoc): string | null {
  for (const g of Array.from(doc.querySelectorAll('[data-hub-tab]'))) if (!g.hidden) return g.getAttribute('data-hub-tab');
  return null;
}

/**
 * Show one tab's page: every group but that tab's is hidden. False — and NOTHING changes — when no group carries
 * the tab, so a pick the page cannot honour never blanks it.
 */
export function showHubTab(doc: TabDoc, tab: string): boolean {
  const groups = Array.from(doc.querySelectorAll('[data-hub-tab]'));
  if (!groups.some((g) => g.getAttribute('data-hub-tab') === tab)) return false;
  for (const g of groups) g.hidden = g.getAttribute('data-hub-tab') !== tab;
  return true;
}
