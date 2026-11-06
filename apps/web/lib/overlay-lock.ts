/**
 * 🔒 THE PAGE BEHIND A POP-UP DOES NOT MOVE — owner 2026-10-25, verbatim: *"there is an issue when a pop up shows and
 * darken on the background. the darken also moves and does not darken and blurr background. back should not move and
 * will not be scrollable or tappable until pop up is gone via tapping the darkened space or closing the popup. just
 * implement it across all"*.
 *
 * Two DOM helpers, called by the ONE focus hook every overlay already uses (`useModalA11y`), so every sheet, dialog,
 * side panel and full-screen viewer gets them at once — never a per-page copy.
 *
 * 1 · `lockPageScroll()` — `overflow: hidden` on `<body>` (what this hook did before) does NOT stop iOS Safari: a
 *     drag still scrolls the page under the sheet, the toolbar collapses, and every `position: fixed` layer — the
 *     dimmed backdrop included — visibly slides. The lock that holds on iOS pins the body itself: `position: fixed`
 *     at `top: -scrollY`, full width, so nothing under the pop-up can move; on the last unlock the body is released
 *     and the window is put back on EXACTLY the same pixel (`behavior: 'instant'`, no smooth jump). Reference-counted:
 *     a sheet over a sheet keeps the page locked until the last one closes.
 *
 * 2 · `isolateOverlay(container)` — nothing behind it is tappable or read out: every element BESIDE the pop-up's path to
 *     `<body>` gets `inert` + `aria-hidden` (`inertBehind`, the Maker sheet's walk since 2026-10-08, reused). It never touches an element it did not change
 *     (one already inert stays the business of whoever made it so), and it leaves the pop-up's backdrop alone — a
 *     full-screen fixed sibling, a full-screen button, or anything marked `data-overlay-backdrop` (`keepsBesidePopup`)
 *     — because tapping the darkened space must still close the pop-up. Opened after it, a nested
 *     pop-up (a list inside a sheet) is not affected; a second pop-up isolates the first, so only the top one is live.
 *
 * 🔒 Held by `lib/one-backdrop-everywhere.test.ts`.
 */

import { inertBehind } from './popup-behind';

let lockCount = 0;
let saved: {
  scrollY: number;
  scrollX: number;
  body: Partial<Record<'position' | 'top' | 'left' | 'right' | 'width' | 'overflow' | 'overscrollBehavior', string>>;
  html: string;
} | null = null;

export function lockPageScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount > 1) return;
  const b = document.body.style;
  saved = {
    scrollY: window.scrollY,
    scrollX: window.scrollX,
    body: { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow, overscrollBehavior: b.overscrollBehavior },
    html: document.documentElement.style.overscrollBehavior,
  };
  b.position = 'fixed';
  b.top = `-${saved.scrollY}px`;
  b.left = `-${saved.scrollX}px`;
  b.right = '0';
  b.width = '100%';
  b.overflow = 'hidden';
  b.overscrollBehavior = 'none';
  document.documentElement.style.overscrollBehavior = 'none';
  document.documentElement.dataset.overlayLocked = '';
}

export function unlockPageScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0 || !saved) return;
  const b = document.body.style;
  Object.assign(b, saved.body);
  document.documentElement.style.overscrollBehavior = saved.html;
  delete document.documentElement.dataset.overlayLocked;
  window.scrollTo({ top: saved.scrollY, left: saved.scrollX, behavior: 'instant' as ScrollBehavior });
  saved = null;
}

/**
 * 🩹 WHICH LAYER BESIDE A POP-UP STAYS LIVE — its own backdrop, so a tap on the dark still closes it. Owner on his iPhone,
 * 2026-10-25, the People › Invite sheet: *"I cannot tap out the screen"*. This walk had kept only a full-screen FIXED
 * layer (or one marked `data-overlay-backdrop`); a pop-up whose close button is an `absolute inset-0` button inside its
 * own fixed root — `GuestPopup`, the Maker sheet and ~15 hand-made sheets — had that button made `inert`, so the tap
 * landed on nothing, on every browser (measured in Playwright WebKit/iPhone + Chromium/Pixel). So a full-screen
 * BUTTON beside the pop-up is its close layer too, whatever its position: page content is never a button the size of
 * the screen. A full-screen absolute DIV is not kept — it may be page (a canvas, a stage); mark a real backdrop instead.
 * Pure, so `lib/one-backdrop-everywhere.test.ts` holds it without a browser.
 */
export function keepsBesidePopup(l: {
  marked: boolean;
  tag: string;
  position: string;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}): boolean {
  if (l.marked) return true;
  if (l.width < l.viewportWidth - 1 || l.height < l.viewportHeight - 1) return false;
  if (l.position === 'fixed') return true;
  return l.position === 'absolute' && l.tag.toUpperCase() === 'BUTTON';
}

/** A layer beside the pop-up that is its backdrop (`keepsBesidePopup`) — left live so a tap on it closes the pop-up. */
function isBackdrop(el: Element): boolean {
  if (el.hasAttribute('data-overlay-backdrop')) return true;
  const r = el.getBoundingClientRect();
  return keepsBesidePopup({
    marked: false,
    tag: el.tagName,
    position: getComputedStyle(el).position,
    width: r.width,
    height: r.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}

export function isolateOverlay(container: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};
  /* The Maker sheet's own walk (`popup-behind.ts`), reused — one copy of "nothing behind works" — with the backdrop
     kept live and everything made inert also hidden from a screen reader. */
  return inertBehind(container, isBackdrop, true);
}
