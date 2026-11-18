'use client';

/**
 * useHideOnScroll — the universal "top nav hides on scroll-down, reveals on
 * scroll-up" rule (owner directive 2026-06-15: *"we want to apply this as a
 * universal rule on top navs. whether on website or on dashboards"*).
 *
 * WHY ONE HOOK: the marketing site nav (site-nav.tsx) shipped this behavior
 * first (owner 2026-06-14, so the homepage hero scrub goes full-screen). The
 * owner then asked for the SAME behavior on every top nav — marketing pages
 * AND the couple / vendor / admin dashboards. Per the anti-fork chrome
 * doctrine, the scroll math lives in exactly ONE place and every top nav
 * consumes it, instead of each surface re-deriving the thresholds.
 *
 * BEHAVIOR (identical to the original site-nav implementation):
 *   - Near the very top (scrollY < 64px) the nav is ALWAYS visible — you never
 *     lose the chrome while still reading the hero / page header.
 *   - Scrolling down past a 4px deadzone → hide (more room; full-bleed scrub).
 *   - Scrolling up past a 4px deadzone → reveal instantly (you reached for it).
 *   - rAF-throttled, passive listener — one read per frame, no layout thrash.
 *
 * SCROLL MODEL: keys off `window.scrollY`. Every Setnayan top nav lives above a
 * document-scrolling main column (the marketing pages scroll the body; the
 * dashboards' SidebarShell uses `min-h-screen` + a normal-flow <main>, so the
 * document scrolls and the sticky top bar sticks to the viewport top). No inner
 * overflow container drives these bars, so the window signal is correct
 * everywhere it's used today.
 *
 * USAGE: the hook returns `hidden`; the caller owns the visual treatment so it
 * can match its own transition / palette. The canonical treatment is:
 *
 *   const hidden = useHideOnScroll();
 *   <nav className={`... sticky top-0 transition-transform duration-300 ease-out
 *     motion-reduce:transition-none ${hidden ? '-translate-y-full' : 'translate-y-0'}`} />
 *
 * `enabled` (default true) lets a caller opt out without breaking the rules-of-
 * hooks (e.g. a non-sticky page where the nav scrolls away naturally) — when
 * false the listener never attaches and `hidden` stays false.
 *
 * ── 🫳 TUCK (motion standard 18 Nov 2026, § 5 #37 — owner: *"yes. thumb row and compressed row stays."* · *"but when
 * bottom and top nav appears, the thumb row and compressed pin rows adjust as well"*) ──
 * The same ONE reading now moves the whole chrome, as ONE move. While it says "hidden" it also writes
 * `html[data-tuck]`, and the drawing answers in CSS (transform and opacity only):
 *   · the top bar tucks away (its own `data-hidden`, as before);
 *   · the bottom nav shrinks to a small floating pill wearing the current tab's icon (`bottom-nav.tsx`) — ONE tap on
 *     the pill opens the bar again (`openTuck()`), and the tab you then tap is the tab you land on;
 *   · the floating thumb row comes down onto the pill's row, beside it, and the pinned 44-px row goes to the very top
 *     (`collapsing-top.tsx`) — both STAY on screen and ride with the bars, both ways.
 * The rules, in `tuckNext` (pure, tested): near the top (64 px) everything shows · down → tuck · up a little → back ·
 * the page's end → back · a page too short to scroll never tucks · never STARTED while a sheet, an Undo toast or a
 * busy save is up (`TUCK_BLOCKERS`). The keyboard rule (`html[data-keyboard="open"]`) is untouched.
 * Speeds (globals.css · front-door.css): away in Move on the Spring, back in Quick on Settle. Reduced motion: at once.
 * 🔒 app/_components/nav/tuck-keeps-the-rows.test.ts
 */

import { useEffect, useState } from 'react';
import { pageIsLanding } from '@/lib/pin-landing';

const TOP_ZONE_PX = 64; // always-visible band at the very top of the page
const DEADZONE_PX = 4; // ignore sub-pixel / jitter scrolls below this delta
/** At the page's end the bars come back: within this many px of the last scrollable pixel. */
export const TUCK_END_ZONE_PX = 8;
/** A page that cannot scroll at least this far is "too short to scroll" — its bars never tuck. */
export const TUCK_MIN_SCROLL_PX = 128;

/** `<html>` wears this while the chrome is tucked — the one mark every bar and row reads. */
export const TUCK_ATTR = 'data-tuck';
/** Ask the tucked chrome to open (the pill's one tap). */
export const TUCK_OPEN_EVENT = 'sn:tuck-open';
/** While any of these is on screen a tuck never STARTS: a sheet or dialog, an Undo toast, a busy save's veil. */
export const TUCK_BLOCKERS = '[aria-modal="true"], [data-undo-toast], .sd-loader';

/** Open the tucked chrome now — the bottom-nav pill calls this on its one tap. */
export function openTuck(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TUCK_OPEN_EVENT));
}

export type TuckRead = {
  /** Where the page is now, and where it was a frame ago. */
  y: number;
  lastY: number;
  /** How far the page can scroll at all (scrollHeight − the window's height). */
  max: number;
  /** A sheet, an Undo toast or a busy save is up. */
  blocked: boolean;
};

/** Tucked or not, after this frame's reading. Pure. */
export function tuckNext(hidden: boolean, { y, lastY, max, blocked }: TuckRead): boolean {
  if (max < TUCK_MIN_SCROLL_PX) return false; // a page too short to scroll never tucks
  if (y < TOP_ZONE_PX) return false; // always visible near the very top
  if (y >= max - TUCK_END_ZONE_PX) return false; // the page's end brings everything back
  if (y > lastY + DEADZONE_PX) return hidden || !blocked; // scrolling down → tuck (never STARTED while blocked)
  if (y < lastY - DEADZONE_PX) return false; // scrolling up a little → back
  return hidden;
}

export function useHideOnScroll(enabled = true): boolean {
  const [hidden, setHidden] = useState(false);

  // 🫳 The one mark the bottom nav, the thumb row and the pinned row read — on while hidden, gone the moment it is not.
  useEffect(() => {
    if (!hidden) return;
    const root = document.documentElement;
    root.setAttribute(TUCK_ATTR, '');
    return () => root.removeAttribute(TUCK_ATTR);
  }, [hidden]);

  useEffect(() => {
    if (!enabled) {
      // Ensure the nav is shown if the caller flips enabled→false mid-life.
      setHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;
    // The pill's one tap: open now, and measure the next scroll from here.
    const onOpen = () => {
      lastY = window.scrollY;
      setHidden(false);
    };
    window.addEventListener(TUCK_OPEN_EVENT, onOpen);

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // 📌 THE PAGE'S OWN LANDING IS NOT THE PERSON SCROLLING (2026-10-29, Suppliers › Find: a category's landing
        // scrolled up, the bar came back over the line it had aimed at, and the pinned head covered its first card).
        // While a landing holds (`lib/pin-landing.ts`) the bar stays where the person last put it.
        if (pageIsLanding()) {
          lastY = y;
          ticking = false;
          return;
        }
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const from = lastY;
        // Asked only on the way down — the one moment a tuck could start.
        const blocked = y > from + DEADZONE_PX && document.querySelector(TUCK_BLOCKERS) !== null;
        setHidden((was) => tuckNext(was, { y, lastY: from, max, blocked }));
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(TUCK_OPEN_EVENT, onOpen);
    };
  }, [enabled]);

  return hidden;
}
