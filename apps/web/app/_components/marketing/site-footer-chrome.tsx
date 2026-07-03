'use client';

/**
 * SiteFooterChrome — the ONE persistent reskin footer for the public site,
 * mounted once in the root layout AFTER {children} (so in normal flow it sits
 * at the end of every marketing page's content) and gated by the same
 * isMarketingRoute predicate as the top nav.
 *
 * THE PINNED-FOOTER INTERACTION (owner 2026-07-03): clicking any footer link
 * pins the footer (footer-pin.ts) — because this component lives in the root
 * layout it SURVIVES the navigation, and while pinned it renders as a fixed
 * bottom sheet that slides up over the destination page, so the visitor can
 * keep moving footer link → footer link without hunting for the footer again.
 * Pressing anything in the top nav unpins it: the sheet animates back down
 * (~.45s, skipped under prefers-reduced-motion) and the footer returns to its
 * normal in-flow spot at the end of the page.
 *
 * While pinned the element is position:fixed, so the page bottom temporarily
 * has no in-flow footer — it's the same single element, lifted out of flow,
 * never two copies.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isMarketingRoute } from './site-chrome';
import { ReskinFooter } from './reskin-footer';
import { useFooterPinned, syncFooterPinToNavigation } from './footer-pin';
// The footer's .hr-* styles are scoped under .home-reskin. On footer-ONLY
// routes (article/reading detail pages) SiteChrome doesn't mount, so import the
// stylesheet here too — CSS imports dedupe, so this is a no-op where SiteChrome
// already pulled it in.
import '@/app/_components/home/home-reskin.css';

export function SiteFooterChrome() {
  const pathname = usePathname();
  const pinned = useFooterPinned();

  // Reconcile the pin on every navigation: a footer-link hop keeps the footer
  // pinned (pinFooter armed the one-shot); ANY other navigation — an in-page
  // body link, browser Back/Forward, a fresh load — unpins it, so the bottom
  // sheet never gets stuck open on a page the visitor didn't reach via the
  // footer. Runs on mount too (first landing after a footer click keeps it).
  useEffect(() => {
    syncFooterPinToNavigation();
  }, [pathname]);

  // Two-phase animation state: `sheet` keeps the fixed-sheet styling mounted
  // through the exit transition; `shown` drives the translateY. Pin: mount the
  // sheet off-screen, then raise it next frame. Unpin: lower it, then return
  // to normal flow after the transition.
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (pinned) {
      setSheet(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    if (sheet) {
      exitTimer.current = setTimeout(() => setSheet(false), 500);
      return () => {
        if (exitTimer.current) clearTimeout(exitTimer.current);
      };
    }
    // `sheet` is deliberately read, not depended on: this effect must run only
    // when the pin flag flips (reading the latest sheet value at that moment),
    // not when the exit timer itself clears `sheet`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned]);

  if (!isMarketingRoute(pathname)) return null;

  const cls =
    'home-reskin hr-open hr-chrome-foot' +
    (sheet ? ' hr-foot-sheet' : '') +
    (shown ? ' hr-foot-sheet-in' : '');

  return (
    <div className={cls}>
      <ReskinFooter />
    </div>
  );
}
