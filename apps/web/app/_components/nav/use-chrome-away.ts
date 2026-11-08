'use client';

/**
 * use-chrome-away.ts — 🫥 THE CHROME STEPS AWAY, AND A TAB RE-TAP SAYS SO (THE ONE BUILD F4, 8 Nov 2026).
 *
 * (a) `useChromeAway(on)` — while `on`, the phone's shell top bar slides up and the bottom bar slides down (0.32 s, the
 *     exact reverse when `on` turns false), and `--sn-bottomdock-h` drops to the safe-area inset, so a ThumbRow that
 *     stood on the bar settles where the bar was (v66/v71, owner: *"top nav and bottom nav hide"* while a picked client
 *     fills the screen). It writes ONE attribute, `data-chrome-away` on `<html>`; the drawing is `front-door.css`
 *     (below 1024 px only — a desk keeps its rail and bar). The attribute is removed on unmount, so leaving the page can
 *     never strand the chrome away.
 *
 * (b) `TAB_RESELECT_EVENT` — a tap on the bar's ALREADY-ACTIVE tab dispatches a cancelable `window` event
 *     (`sn:tab-reselect`, detail `{ key, href }`). A page listens (`useTabReselect`) — Clients: back to the unselected
 *     list (owner: *"pressing it again will go to the unselected client page"*). If the listener calls
 *     `preventDefault()` the tab's own navigation is skipped; otherwise the tab navigates as it always did (no-JS too).
 * 🔒 app/_components/nav/the-chrome-steps-away.test.ts
 */
import { useEffect } from 'react';

export const CHROME_AWAY_ATTR = 'data-chrome-away';
export const TAB_RESELECT_EVENT = 'sn:tab-reselect';

export type TabReselectDetail = { key: string; href: string };

/** True when the event was handled and the tab's own navigation must be skipped. */
export function dispatchTabReselect(detail: TabReselectDetail): boolean {
  if (typeof window === 'undefined') return false;
  const ev = new CustomEvent<TabReselectDetail>(TAB_RESELECT_EVENT, { detail, cancelable: true });
  return !window.dispatchEvent(ev);
}

/** Held while the chrome slides BACK, so the return runs the same 0.32 s curve — the exact reverse. */
export const CHROME_BACK_ATTR = 'data-chrome-back';
export const CHROME_AWAY_MS = 320;

export function useChromeAway(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.removeAttribute(CHROME_BACK_ATTR);
    root.setAttribute(CHROME_AWAY_ATTR, '');
    return () => {
      root.removeAttribute(CHROME_AWAY_ATTR);
      root.setAttribute(CHROME_BACK_ATTR, '');
      window.setTimeout(() => {
        if (!root.hasAttribute(CHROME_AWAY_ATTR)) root.removeAttribute(CHROME_BACK_ATTR);
      }, CHROME_AWAY_MS);
    };
  }, [on]);
}

/** Listen for a re-tap on the active tab `key`. Return `true` from `handler` to skip the tab's own navigation. */
export function useTabReselect(key: string, handler: (detail: TabReselectDetail) => boolean | void): void {
  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent<TabReselectDetail>).detail;
      if (!detail || detail.key !== key) return;
      if (handler(detail) === true) e.preventDefault();
    };
    window.addEventListener(TAB_RESELECT_EVENT, on);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, on);
  }, [key, handler]);
}
