'use client';

import { useEffect } from 'react';
import { isStoreShellInBrowser } from '@/lib/store-shell';

/**
 * STORE-SHELL LINK GUARD — in the App Store / Play Store shell, no link to a
 * web-only route stays on screen.
 *
 * Middleware already REFUSES every route in lib/store-shell.ts
 * (`isStoreShellWebOnlyPath` → /web-only). What it cannot do is stop a page
 * from DRAWING a link to one: a "See plans", "Unlock", "Get Papic" link then
 * sits in the app as a call to action for a purchase the app cannot make, and a
 * dead end when tapped (guideline 3.1.1). Pages that price or sell something
 * gate themselves server-side (`isStoreShellRequest()`); this is the net under
 * them, keyed on the SAME registry (`storeShellHidesHref`), so a link added
 * tomorrow to any refused route is covered the day it ships.
 *
 * It hides the anchor (`display:none !important` + `aria-hidden` + out of the tab order) and
 * nothing else. It never runs outside the store shell — desktop
 * (`SetnayanApp/desktop`) and the web are untouched — and the pages stay
 * whole: only the door to /web-only goes. Mounted once, in app/layout.tsx.
 *
 * 🍎 Where Apple sells in this app it asks the gate's two parts (`iapAvailable`) exactly as
 * middleware does, so a link to a page In-App Purchase opens (Papic, the Live
 * Watch controller — `IAP_OPENED_ROUTE`) stays; with it off, nothing changes.
 *
 * ⚡ The work itself (`store-shell-link-guard-run.ts`: the sweep, the observer, the In-App Purchase gate) is its own
 * chunk, fetched only after the store-shell check below passes — this component is in every page's first load (the
 * Maker's sits at its 507 KB ceiling), and the web never needs the rest (2026-10-21).
 */
export function StoreShellLinkGuard() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isStoreShellInBrowser(navigator.userAgent, document.cookie)) return;
    let stop: (() => void) | null = null;
    let gone = false;
    void import('./store-shell-link-guard-run').then((m) => {
      if (!gone) stop = m.guardStoreShellLinks();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return null;
}
