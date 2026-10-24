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
 *     (one already inert stays the business of whoever made it so), and it leaves a full-screen fixed sibling alone —
 *     that is a backdrop, and tapping the darkened space must still close the pop-up. Opened after it, a nested
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

/** A full-screen fixed layer beside the pop-up — its backdrop. Left live so a tap on it still closes the pop-up. */
function isBackdrop(el: Element): boolean {
  if (el.hasAttribute('data-overlay-backdrop')) return true;
  if (getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1;
}

export function isolateOverlay(container: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};
  /* The Maker sheet's own walk (`popup-behind.ts`), reused — one copy of "nothing behind works" — with the backdrop
     kept live and everything made inert also hidden from a screen reader. */
  return inertBehind(container, isBackdrop, true);
}
