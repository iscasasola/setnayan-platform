'use client';

import { useEffect, useRef } from 'react';
import { MARK_MIN, fitFirstScreen, layoutFirstScreen, type FitPlan, type FitSnapshot } from '../_lib/first-screen-fit';

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
 * Only the frameless card cover is fitted (`data-cover-frameless`). On any other
 * cover the door is simply in flow, as it always was. Draws nothing; without
 * script the page is the page as written.
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
    const screen = door.closest<HTMLElement>('[data-pahina-first-screen]');
    const cover = screen?.querySelector<HTMLElement>('[data-cover-frameless]');
    const inner = cover?.firstElementChild;
    if (!screen || !cover || !(inner instanceof HTMLElement)) {
      const onToggleOnly = () => {
        if (door.open) door.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
      };
      door.addEventListener('toggle', onToggleOnly);
      return () => door.removeEventListener('toggle', onToggleOnly);
    }
    const root = document.documentElement;
    screen.setAttribute('data-first-screen-fit', '');

    /** The cover's parts, named by where they stand around the names and the date, then the link under the cover. */
    const blocks = (): Array<{ key: string; el: HTMLElement }> => {
      const out: Array<{ key: string; el: HTMLElement }> = [];
      let afterNames = false;
      let afterDate = false;
      const add = (key: string, el: HTMLElement) => out.push({ key: out.some((b) => b.key === key) ? `${key}-${out.length}` : key, el });
      for (const el of Array.from(inner.children)) {
        if (!(el instanceof HTMLElement) || el.getBoundingClientRect().height === 0) continue;
        if (el.matches('[data-motion="arrive-mark"]')) add('mark', el);
        else if (el.matches('h1')) {
          add('names', el);
          afterNames = true;
        } else if (el.matches('[data-motion="arrive-date"]')) {
          add('date', el);
          afterDate = true;
        } else add(!afterNames ? 'eyebrow' : !afterDate ? 'line' : 'time', el);
      }
      const link = cover.nextElementSibling;
      if (link instanceof HTMLElement && link.querySelector('a[href]') && link.getBoundingClientRect().height > 0) add('link', link);
      return out;
    };
    const snapshot = (list: Array<{ key: string; el: HTMLElement }>): FitSnapshot => {
      const box = (key: string, el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { key, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
      };
      return { parts: list.map((b) => box(b.key, b.el)), door: box('door', door) };
    };
    const set = (air: number, markScale: number) => {
      screen.style.setProperty('--fs-air', String(air));
      screen.style.setProperty('--fs-mark', String(markScale));
    };
    const clear = (list: Array<{ key: string; el: HTMLElement }>) => {
      screen.style.removeProperty('--fs-air');
      screen.style.removeProperty('--fs-mark');
      for (const el of [...list.map((b) => b.el), door]) {
        el.style.removeProperty('--fs-shift');
        el.removeAttribute('data-fs-shift');
      }
    };
    const write = (list: Array<{ key: string; el: HTMLElement }>, shift: Record<string, number>) => {
      for (const [key, px] of Object.entries(shift)) {
        const el = key === 'door' ? door : list.find((b) => b.key === key)?.el;
        if (!el) continue;
        el.style.setProperty('--fs-shift', `${px}px`);
        el.setAttribute('data-fs-shift', '');
      }
    };

    /** Draw `gives` below the button, on the page as it now measures: each block that moves, by how far. */
    const lay = (list: Array<{ key: string; el: HTMLElement }>, gives: readonly string[]) => {
      const snap = snapshot(list);
      const laid = layoutFirstScreen(snap, gives);
      write(list, Object.fromEntries([...snap.parts, snap.door].map((b) => [b.key, Math.round(laid.tops[b.key]! - b.top)]).filter(([, d]) => d !== 0)));
      return laid.doorBottom;
    };

    let plan: FitPlan | null = null;
    const handedOver = () => door.closest('[data-hub-page-on]') !== null;
    const fit = () => {
      if (screen.getBoundingClientRect().height === 0) return; // streamed in hidden, or another tab is showing
      const list = blocks();
      clear(list);
      if (handedOver()) {
        plan = null;
        return;
      }
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
      const natural = snapshot(list);
      set(0, 1);
      const noAir = snapshot(list);
      set(0, MARK_MIN);
      const smallMark = snapshot(list);
      plan = fitFirstScreen({ natural, noAir, smallMark }, limit);
      if (plan.air === 1 && plan.mark === 1 && plan.gives.length === 0) {
        clear(list); // it fits as designed: the page as written, to the letter
        return;
      }
      set(plan.air, plan.mark);
      // What was given back must not cost the button its place: if it did, take it all back.
      if (lay(list, plan.gives) > limit + 0.5 && plan.fits) {
        clear(list);
        plan = { ...plan, air: 0, mark: plan.gives.includes('mark') ? 1 : MARK_MIN };
        set(plan.air, plan.mark);
        lay(list, plan.gives);
      }
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
      screen.removeAttribute('data-first-screen-fit');
    };
  }, []);
  return <span ref={mark} hidden />;
}
