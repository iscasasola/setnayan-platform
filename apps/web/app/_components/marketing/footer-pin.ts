'use client';

/**
 * Footer pin store — the tiny shared state behind the "footer stays available"
 * interaction (owner 2026-07-03):
 *
 *   Clicking any link INSIDE the site footer pins the footer: on the page you
 *   land on, the footer rides along as a fixed bottom sheet so you can keep
 *   hopping footer link → footer link (privacy → terms → help …) without
 *   re-scrolling to the bottom each time. Pressing anything in the top nav
 *   (logo, Prices, Download, Vendors, Sign in) unpins it — the sheet animates
 *   back down and the footer returns to its normal place at the end of the page.
 *
 * WHY an IN-MEMORY module flag (not sessionStorage): the pin must survive the
 * `/` → marketing-page boundary (the homepage footer lives inside HomeReskin;
 * the marketing footer lives in the persistent SiteFooterChrome — two mounts
 * that never share a React tree). A module-scoped variable survives client-side
 * soft navigations (the only boundary that handoff needs) AND correctly resets
 * on a hard reload / full page load, so a stale pin can never auto-open the
 * bottom sheet on a page the visitor reached without touching the footer.
 * (sessionStorage survived reloads/Back and left the sheet stuck open.)
 *
 * `expectFooterNav` is a one-shot: pinFooter() arms it, and the next
 * navigation reconciled via syncFooterPinToNavigation() consumes it to KEEP
 * the footer pinned. Any navigation that arrives WITHOUT it armed (an in-page
 * body link, browser Back/Forward, a fresh load) unpins — so the footer only
 * ever follows footer-to-footer hops, exactly as specified.
 */

import { useSyncExternalStore } from 'react';

let pinned = false;
let expectFooterNav = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by every footer link click — arms the one-shot and pins the footer. */
export function pinFooter() {
  expectFooterNav = true;
  if (!pinned) {
    pinned = true;
    emit();
  }
}

/** Called by every top-nav press — animates the footer back down. */
export function unpinFooter() {
  expectFooterNav = false;
  if (pinned) {
    pinned = false;
    emit();
  }
}

/**
 * Called once per navigation (from SiteFooterChrome's pathname effect). If the
 * navigation was driven by a footer link (pinFooter armed the one-shot), keep
 * the footer pinned and disarm; otherwise unpin, so an unrelated navigation
 * never leaves the bottom sheet stuck open.
 */
export function syncFooterPinToNavigation() {
  if (expectFooterNav) {
    expectFooterNav = false; // consume — the pin carried across this one hop
    return;
  }
  unpinFooter();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => pinned;
const getServerSnapshot = () => false;

/** Reactive read of the pin flag (false during SSR — the sheet is client-only). */
export function useFooterPinned(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
