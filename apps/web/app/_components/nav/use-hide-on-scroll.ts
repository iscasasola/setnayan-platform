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
 */

import { useEffect, useState } from 'react';

const TOP_ZONE_PX = 64; // always-visible band at the very top of the page
const DEADZONE_PX = 4; // ignore sub-pixel / jitter scrolls below this delta

export function useHideOnScroll(enabled = true): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // Ensure the nav is shown if the caller flips enabled→false mid-life.
      setHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < TOP_ZONE_PX) setHidden(false); // always visible near the very top
        else if (y > lastY + DEADZONE_PX) setHidden(true); // scrolling down → hide
        else if (y < lastY - DEADZONE_PX) setHidden(false); // scrolling up → reveal
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return hidden;
}
