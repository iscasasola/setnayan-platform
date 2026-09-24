'use client';

import { useEffect } from 'react';
import { isStoreShellInBrowser, storeShellHidesHref } from '@/lib/store-shell';

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
 */
const MARK = 'storeShellHidden';

function apply(a: HTMLAnchorElement): void {
  const hide = storeShellHidesHref(a.getAttribute('href'), window.location.href);
  if (hide) {
    if (a.dataset[MARK] === '1') return;
    a.hidden = true;
    // `hidden` alone loses to a utility class (`inline-flex` sets display at
    // the same specificity, later in the cascade) — so say it with !important.
    a.style.setProperty('display', 'none', 'important');
    a.setAttribute('aria-hidden', 'true');
    a.tabIndex = -1;
    a.dataset[MARK] = '1';
  } else if (a.dataset[MARK] === '1') {
    // The href moved off a refused route — give the link back.
    a.hidden = false;
    a.style.removeProperty('display');
    a.removeAttribute('aria-hidden');
    a.removeAttribute('tabindex');
    delete a.dataset[MARK];
  }
}

function sweep(root: Element | Document): void {
  if (root instanceof HTMLAnchorElement) apply(root);
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(apply);
}

export function StoreShellLinkGuard() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isStoreShellInBrowser(navigator.userAgent, document.cookie)) return;

    sweep(document);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') {
          if (r.target instanceof HTMLAnchorElement) apply(r.target);
          continue;
        }
        r.addedNodes.forEach((n) => {
          if (n instanceof Element) sweep(n);
        });
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}
