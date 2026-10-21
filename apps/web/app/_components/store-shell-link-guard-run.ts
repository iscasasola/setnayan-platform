/**
 * The store-shell link guard's WORK — loaded only inside the store shell (`store-shell-link-guard.tsx` imports it on
 * demand, after it has asked `isStoreShellInBrowser`). Its own chunk, so the web and the desktop app never download it
 * and the Maker's first load (at its 507 KB ceiling) does not carry it. What it does and why: see that file.
 */
import { storeShellHidesHref } from '@/lib/store-shell';
import { hasNativeStore } from '@/lib/iap/iap-gate';
import { isAppleIapEnabled } from '@/lib/apple-iap-flag';

const MARK = 'storeShellHidden';
let iap = false;

function apply(a: HTMLAnchorElement): void {
  const hide = storeShellHidesHref(a.getAttribute('href'), window.location.href, iap);
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

/** Start guarding (the caller has checked it is the store shell). Returns the stop. */
export function guardStoreShellLinks(): () => void {
  // `iapAvailable` with the store shell already true (the caller) — its other two parts, spelled out.
  iap = hasNativeStore(navigator.userAgent) && isAppleIapEnabled();
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
}
