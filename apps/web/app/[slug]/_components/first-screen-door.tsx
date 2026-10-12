'use client';

import { useEffect, useRef } from 'react';
import type { FitPlan } from '../_lib/first-screen-fit';
import { firstScreenFitter } from '../_lib/first-screen-fit-dom';

/**
 * 🚪 THE FIRST SCREEN MAKES ROOM FOR "GET INSIDE" — the measuring half of
 * `_lib/first-screen-fit.ts` (read that first: the rule, and what gives way).
 *
 * The button stays in the cover's flow; nothing is ever drawn underneath it.
 * This measures the cover three ways (as designed · air closed up · the mark
 * small), asks the pure rule for a plan, and writes it: two custom properties on
 * the first-screen block (`--fs-air`, `--fs-mark`, read by `globals.css`) and,
 * for each block that moves, `--fs-shift` (the block is drawn that far from its
 * own place; the page's own flow is untouched, so nothing after it moves).
 *
 * It fits again whenever what it measured can change: the window, the fonts,
 * the block itself (it is streamed in hidden, and a tab hides it), the cookie
 * banner's top (`--cookie-banner-top` on the root), and the door opening — an
 * open door keeps the plan and is scrolled into view, clear of the bar.
 *
 * The frameless card cover is fitted (`data-cover-frameless`) — and, since
 * 2026-10-13, a PHOTO cover (owner: the photo moves so the names, the date and
 * "Get inside" are on the stranger's first screen). A photo cover stands in the
 * page's first group and the door in the next, so the fit's box is the one that
 * holds both, marked `data-first-screen-photo`; its photo is the first part to
 * give way (`_lib/first-screen-fit.ts`). On any other cover the door is simply in
 * flow, as it always was. Draws nothing; without script the page is the page as
 * written.
 *
 * 🎚 WHILE THE COVER HANDS OVER BY SCRUB it stands aside (`handedOver`): the
 * page's hold is armed (`data-hub-page-on`, `hub-scrub-engine.ts`), the door is
 * no longer in the cover's flow — it is what ARRIVES when the cover has built
 * out, drawn where the hand-over puts it — so there is no first screen to make
 * room on, and nothing the fit gives could move it. Fitting anyway fed a loop:
 * the fit shrank the cover, the hand-over re-measured and moved the door, the
 * fit undid its plan, and so on — the page changed length every ~120 ms on a
 * 375 × 560 screen (measured, Chromium). So, armed: nothing written, any plan
 * taken back; when the hold is off again (reduce motion, the Reveal still up,
 * no hand-over at all) it fits exactly as before. The arming is watched.
 */
export function FirstScreenDoor() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const door = mark.current?.closest('details');
    if (!door) return;
    const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const card = door.closest<HTMLElement>('[data-pahina-first-screen]');
    const cardCover = card?.querySelector<HTMLElement>('[data-cover-frameless]');
    const cardInner = cardCover?.firstElementChild;
    /* 📷 …or the PHOTO cover before the door: the last masthead above it on the page that holds a photo. */
    const photoHead = card && cardCover ? null : Array.from((door.closest('main') ?? document.body).querySelectorAll<HTMLElement>('header[data-pahina-first-screen]')).filter((h) => h.querySelector('figure') !== null && (h.compareDocumentPosition(door) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).pop() ?? null;
    const photoInner = photoHead?.querySelector('h1')?.parentElement ?? null;
    let host: HTMLElement | null = photoHead;
    while (host && !host.contains(door)) host = host.parentElement;
    const photo = !(card && cardCover && cardInner instanceof HTMLElement) && photoHead !== null && photoInner !== null && host !== null;
    const screen = photo ? host : card;
    const cover = photo ? photoInner : cardCover;
    const inner = photo ? photoInner : cardInner;
    if (!screen || !cover || !(inner instanceof HTMLElement)) {
      const onToggleOnly = () => {
        if (door.open) door.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
      };
      door.addEventListener('toggle', onToggleOnly);
      return () => door.removeEventListener('toggle', onToggleOnly);
    }
    const root = document.documentElement;
    const { blocks, clear, set, lay, make, mark: markScreen } = firstScreenFitter(screen, cover, inner, door, () => window.scrollY, photo);
    markScreen(true);

    let plan: FitPlan | null = null;
    const handedOver = () => door.closest('[data-hub-page-on]') !== null;
    const fit = () => {
      if (screen.getBoundingClientRect().height === 0) return; // streamed in hidden, or another tab is showing
      if (photo && (photoHead!.getBoundingClientRect().height === 0 || door.getBoundingClientRect().height === 0)) return; // (the photo cover and the door are in two groups: both must be shown)
      // 📐 Held: the plan made before the hold armed is KEPT, and nothing is measured again (see the docblock).
      if (handedOver()) return;
      const list = blocks();
      clear(list);
      if (door.open && plan) {
        // An open door keeps the plan it opened on; only the distances follow its new height.
        set(plan.air, plan.mark);
        lay(list, plan.gives);
        return;
      }
      const rest = parseFloat(getComputedStyle(door).scrollMarginBottom) || 0;
      const banner = parseFloat(getComputedStyle(root).getPropertyValue('--cookie-banner-top')) || 0;
      // The button's bottom edge may reach the bottom bar's top less a gap — or the cookie banner's, while it is up.
      const limit = window.innerHeight - Math.max(rest, banner > 0 ? banner + 8 : 0);
      plan = make(list, limit);
    };

    let frame = 0;
    const soon = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        fit();
      });
    };
    const onToggle = () => {
      fit();
      if (door.open) door.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    };
    fit();
    const sized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    sized?.observe(screen);
    const banner = typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon);
    banner?.observe(root, { attributes: true, attributeFilter: ['style'] });
    // The cover's hand-over arming or standing down (the page's hold, when the cover is wrapped to leave by Scrub).
    const hold = door.closest('.hub-page-cell');
    const armed = hold && typeof MutationObserver !== 'undefined' ? new MutationObserver(soon) : null;
    if (hold) armed?.observe(hold, { attributes: true, attributeFilter: ['data-hub-page-on'] });
    window.addEventListener('resize', soon);
    door.addEventListener('toggle', onToggle);
    void document.fonts?.ready.then(soon);
    return () => {
      sized?.disconnect();
      banner?.disconnect();
      armed?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', soon);
      door.removeEventListener('toggle', onToggle);
      clear(blocks());
      markScreen(false);
    };
  }, []);
  return <span ref={mark} hidden />;
}
