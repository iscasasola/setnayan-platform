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

/** How long a page that just opened is held at its top (`createPageTop`) — long enough for anything the tab tap
 *  set off in the Maker to have run, short enough that the page is the couple's again at once. */
export const HUB_TAB_HOLD_MS = 1500;

/**
 * 🔝 THE HOLD. For a moment after a page opens, ONLY THE COUPLE moves it: a scroll that is not theirs is put back
 * to the top (`onScroll`), and a scroll the Maker asks for by message is not run at all (`held`). Their own touch
 * on the page — or picking a part, which may bring that part into view — ends the hold at once (`release`).
 * The belt to `openHubTab`'s braces: whatever else a tab tap sets off, the page it opened is still at its top.
 */
export function createPageTop(win: { readonly scrollY: number; scrollTo(to: { top: number; behavior: 'instant' }): void }, now: () => number = Date.now) {
  let until = 0;
  return {
    hold() {
      until = now() + HUB_TAB_HOLD_MS;
    },
    release() {
      until = 0;
    },
    held: () => now() < until,
    /** A scroll happened. True when it was not the couple's and the page was put back to its top. */
    onScroll(): boolean {
      if (now() >= until || win.scrollY === 0) return false;
      win.scrollTo({ top: 0, behavior: 'instant' });
      return true;
    },
  };
}

/** What the Maker sends when a part is picked or played — each may bring that part into view, so each ends the hold. */
export const HUB_TAB_FREES: readonly string[] = ['markEl', 'play', 'playEl', 'playSeq', 'playStage'];

type TabGroup = { hidden: boolean; getAttribute(name: string): string | null };
type TabDoc = { querySelectorAll(sel: string): ArrayLike<TabGroup> };

/** The tab on screen: the one whose groups are shown — null on a page that is one scroll. */
export function shownHubTab(doc: TabDoc): string | null {
  for (const g of Array.from(doc.querySelectorAll('[data-hub-tab]'))) if (!g.hidden) return g.getAttribute('data-hub-tab');
  return null;
}

/**
 * 🔝 A TAB OPENS ITS PAGE FROM THE TOP — AND NOTHING TAKES IT AWAY FROM THERE (owner's rule; measured on the
 * preview 08 Oct: after a tab tap the Invitation ended at 959 / 77 / 156 px, not 0).
 *
 * The cause: a part picked earlier was "brought up" for its sheet, and the canvas remembered where the page
 * rested (`canvas-bring-up.ts`); when the tab tap closed that edit, the Maker's `settle` sent the page BACK to
 * that resting place — a place on the page before. A page pick is the Maker moving the page on purpose, so the
 * resting place is forgotten FIRST (the same `forget` a scroll to a scene does), then the page starts at its top.
 * False — and nothing changes, nothing is forgotten — when no group carries the tab.
 */
export function openHubTab(
  doc: TabDoc,
  win: { scrollTo(to: { top: number; behavior: 'auto' }): void },
  lift: { forget(): void },
  tab: string,
): boolean {
  if (!showHubTab(doc, tab)) return false;
  lift.forget();
  win.scrollTo({ top: 0, behavior: 'auto' });
  return true;
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
