'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  readConsent,
  writeConsent,
  OPEN_CONSENT_EVENT,
} from '@/lib/cookie-consent';
import { isConsentSuppressedRoute } from './capture-safe-routes';
import { isNativeApp } from '@/lib/capacitor';
import { bottomChromeLift, type ChromeBox } from '@/lib/bottom-chrome';

/**
 * How much of the viewport's bottom edge is already claimed by THIS route's
 * own chrome — the Event Hub tab bar, the guest hub's QR/Camera/Photos bar,
 * the `/features` sticky CTA — so the banner can stack ABOVE it instead of
 * covering it (mobile audit 2026-09, item 1: the old `inset-x-3 bottom-3`
 * card sat on top of the countdown on `/cale-ice`, listing prices on
 * `/explore`, the sticky CTA on `/features`, the venue pills, a supplier
 * profile — on every route that has bottom chrome of its own).
 *
 * DELIBERATELY GENERIC rather than a shared height token: this banner is
 * mounted once in the root layout and runs on every route, and none of those
 * routes' own bottom bars know it exists (nor should they — teaching every
 * bottom bar in the app about one banner is the wrong direction of
 * dependency). So it goes looking, the same way the mobile audit itself did:
 * find every `position: fixed`/`sticky` element genuinely anchored to and
 * touching the bottom edge, and take the tallest. Excludes anything that
 * starts above the vertical midline (a modal / full-screen sheet, not a
 * bar) and anything taller than ~45% of the viewport (a decorative
 * full-height layer, not real chrome) — same shape of filter the audit
 * script used to tell a bar from a backdrop.
 */
function measureRouteBottomChrome(exclude: HTMLElement): number {
  if (typeof document === 'undefined') return 0;
  const boxes: ChromeBox[] = [];
  // Tailwind's `fixed`/`sticky` utilities are literal class tokens, so this
  // reaches every candidate cheaply without walking the whole DOM; anything
  // it over-matches (a class merely containing the substring) is filtered
  // out below by its actual computed position.
  const candidates = document.querySelectorAll<HTMLElement>(
    '[class*="fixed"], [class*="sticky"]',
  );
  for (const el of candidates) {
    if (el === exclude || exclude.contains(el) || el.contains(exclude)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    boxes.push(el.getBoundingClientRect());
  }
  // Which of those are bars, and how tall the stack is: `lib/bottom-chrome.ts`.
  return bottomChromeLift(boxes, window.innerHeight);
}

/** How far the banner's TOP edge is from the bottom of the window, while it is the full-width sheet — read by `.sn-door-dock`. */
const BANNER_TOP_VAR = '--cookie-banner-top';

// Site-wide cookie-consent banner under RA 10173. Mounted once in the root
// layout so it appears on every route, including the homepage. Reads/writes
// consent via lib/cookie-consent and gates PostHog analytics. "Cookie
// settings" links anywhere re-open it via OPEN_CONSENT_EVENT.
//
// "Every route" now carries exactly two documented exceptions, both operator
// surfaces behind a signed-in control-room membership — see below.
//
// 🔒 NEVER IN THE STORE SHELL. App Review 2026-06-30 (Guideline 5.1.2(i)) read
// this banner inside the iOS WebView as "collects cookies used to track" and
// asked for App Tracking Transparency — or for the prompt to go. We do not
// track (PostHog is first-party product analytics, consent-gated, no ad or
// broker sharing), and Apple's own remedy for that case is to REMOVE the
// prompt. So inside the Capacitor shell the banner never renders and no
// choice is ever written: `analyticsAllowed()` is false while undecided, so
// PostHog never initialises there either (posthog-provider.tsx gates on it).
// Essential cookies (session, theme) are unaffected — they were never gated.
//
// SELF-GATED, same idiom as SiteChrome's `isMarketingRoute`: `usePathname()` +
// one pure predicate, so the root layout keeps mounting this unconditionally and
// the route policy lives in exactly one testable place. The gate is a DENY-list
// of three Live Studio surfaces — the OBS-captured program output, the host's
// full-screen controller, and a paired venue screen (/live/screen) — and
// nothing else; see capture-safe-routes.ts for
// why each is excluded and why `/panood/cam/` deliberately is not.
export function CookieConsentBanner() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(true);
  const [manage, setManage] = useState(false);
  // ☐ THE OPTIONAL BOX STARTS UNTICKED — consent is something a person does, never
  // something done for them (the app's standing rule: `app/signup/consent-is-
  // affirmative.test.ts`, `lib/terms-agreement.ts`). Until 2026-10-11 it started
  // TICKED: a visitor who opened "Manage" and pressed Save without touching the
  // box was recorded as having said yes to analytics. It shows a yes only when a
  // yes is already stored. `optional-analytics-waits-for-a-yes.test.ts` holds it.
  const [analytics, setAnalytics] = useState(false);
  const [storeShell, setStoreShell] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  // How far to lift off the true bottom edge so this banner sits ABOVE the
  // route's own bottom chrome instead of on top of it. 0 on every route that
  // has none — the overwhelming majority.
  const [liftPx, setLiftPx] = useState(0);

  const showing = mounted && !decided && !storeShell && !isConsentSuppressedRoute(pathname);

  // Re-measure whenever the banner becomes visible, the route changes, the
  // viewport resizes, or another bar's own show/hide transition finishes —
  // that last one is how a scroll-triggered bar like `/features`' sticky CTA
  // (which only *transforms* into view, it doesn't mount/unmount) is caught
  // without polling or a scroll listener on every route.
  //
  // 🏁 …AND WHENEVER THE PAGE ITSELF CHANGES UNDER IT (2026-10-11). Measured on
  // the guest page, 12 fresh visits at 375 × 812: in 5 the banner sat ON the
  // Welcome / Details bar (`--cb-lift: 0px`), so a tap on Details pressed
  // "Manage". The bar is streamed into the page AFTER the banner has taken its
  // one measurement, and a bar that ARRIVES fires none of the three events
  // above — it is not a resize, and it has no transition to end. So the page is
  // watched for the arrival itself: any element added or removed re-measures,
  // once per frame at most, for as long as the banner is up (it is up only
  // until a visitor answers it, once).
  useEffect(() => {
    if (!showing) return;
    const el = barRef.current;
    if (!el) return;
    const recompute = () => setLiftPx(measureRouteBottomChrome(el));
    recompute();
    let frame = 0;
    const soon = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    };
    const arrivals = typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon);
    arrivals?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', recompute);
    window.addEventListener('transitionend', recompute, true);
    return () => {
      arrivals?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('transitionend', recompute, true);
    };
  }, [showing, pathname, manage]);

  // 📣 SAY WHERE THE BANNER'S TOP IS, so a page's own docked action can stand
  // ABOVE it rather than under it (`.sn-door-dock`, globals.css — the guest
  // page's "Get inside"). The same 12 visits: in the other 7 the banner, lifted
  // clear of the bar, sat on "Get inside" instead. One custom property on the
  // root — the banner still knows nothing about any page — published only while
  // it is the edge-to-edge sheet (from `sm` it is a corner card beside the
  // page's column, not over it), and removed the moment it goes.
  useEffect(() => {
    if (!showing) return;
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const say = () => {
      const r = el.getBoundingClientRect();
      if (r.width >= window.innerWidth - 1) root.style.setProperty(BANNER_TOP_VAR, `${Math.round(window.innerHeight - r.top)}px`);
      else root.style.removeProperty(BANNER_TOP_VAR);
    };
    say();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(say);
    ro?.observe(el);
    window.addEventListener('resize', say);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', say);
      root.style.removeProperty(BANNER_TOP_VAR);
    };
  }, [showing, manage, liftPx]);

  // Reserve the space instead of covering it: while shown, the banner grows
  // the page's own bottom padding by its measured height (same idiom as
  // `stale-tab-notice.tsx`'s bar), so the true last thing on the page — a
  // supplier's final price, the last guest row — scrolls clear rather than
  // sitting underneath a fixed card. Restored exactly on close/unmount.
  useEffect(() => {
    if (!showing) return;
    const el = barRef.current;
    if (!el) return;
    const body = document.body;
    const before = body.style.paddingBottom;
    const base = parseFloat(getComputedStyle(body).paddingBottom) || 0;
    const reserve = () => {
      body.style.paddingBottom = `${base + el.getBoundingClientRect().height}px`;
    };
    reserve();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserve);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      body.style.paddingBottom = before;
    };
  }, [showing, manage]);

  useEffect(() => {
    setMounted(true);
    // Post-mount, like inline-checkout-drawer.tsx — `window.Capacitor` does
    // not exist during SSR. Only the Capacitor shell injects it; the desktop
    // Tauri wrapper does not, and keeps the banner (it is not store-reviewed).
    setStoreShell(isNativeApp());
    const c = readConsent();
    setDecided(c !== null);
    setAnalytics(c?.analytics ?? false);
    const onOpen = () => {
      // Re-opened from "Cookie settings": the box shows the choice as it is
      // STORED NOW (it may have been made a moment ago, in this same visit) —
      // and nothing at all when none was made.
      setAnalytics(readConsent()?.analytics ?? false);
      setDecided(false);
      setManage(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  // `showing` folds all four gates (mounted, decided, storeShell, the
  // capture-safe-routes deny-list); this early return must stay in lockstep
  // with it or the two effects above run for a banner that never paints.
  if (!showing) return null;

  const choose = (a: boolean) => {
    writeConsent(a);
    setDecided(true);
    setManage(false);
  };

  return (
    <div
      ref={barRef}
      role="region"
      data-app-chrome=""
      aria-label="Cookie consent"
      /* COMPACT SLIM SHEET below `sm`, not the old floating rounded card
         (mobile audit 2026-09, item 1): `inset-x-3 bottom-3` covered real
         content on every route with bottom chrome of its own — the
         countdown on `/cale-ice`, listing prices on `/explore`, the sticky
         CTA on `/features`, the venue pills, a supplier profile — and it
         was ALSO the one place on the whole site using a 12px side gutter
         where everywhere else uses 16px (item 4; there was no second
         offender — the automated gutter scan never found one, on any
         viewport, and this is the only 12px `inset-x-3` in this file).
         Edge-to-edge with 16px internal padding fixes both at once.
         `liftPx` (from measureRouteBottomChrome, via the CSS var below)
         stacks it above the route's OWN bar; `sm:` keeps the original
         corner card, where none of this ever applied. */
      className="fixed inset-x-0 z-[70] border-t border-ink/10 bg-cream/95 px-4 py-3 text-sm text-ink/80 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur bottom-[calc(var(--cb-lift,0px)+max(0.75rem,env(safe-area-inset-bottom)))] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:rounded-2xl sm:border sm:p-4 sm:shadow-lg"
      style={{ '--cb-lift': `${liftPx}px` } as CSSProperties}
    >
      {!manage ? (
        <>
          <p>
            We use essential cookies to run Setnayan, and optional analytics to
            improve it.{' '}
            {/* A full 44px tap height via padding + a matching negative margin, so
                the hit area grows without the inline text visually shifting
                (mobile audit item 1; 40px until 2026-10-11, when the guest walk
                measured it under the 44px rule). Same trick as the links below. */}
            <Link
              href="/cookies"
              className="inline-flex min-h-[44px] items-center py-3 -my-3 text-terracotta hover:underline"
            >
              Cookie policy
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => choose(true)}
              className="rounded-full bg-terracotta-700 px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => choose(false)}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => setManage(true)}
              className="min-h-[44px] px-2 py-1.5 text-xs text-ink/55 hover:text-ink"
            >
              Manage
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-ink">Cookie settings</p>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span>
              <strong>Essential</strong> · keeps you signed in · always on
            </span>
            <input type="checkbox" checked disabled aria-label="Essential cookies (always on)" />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3">
            <span>
              <strong>Analytics</strong> · helps us improve
            </span>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              aria-label="Analytics cookies"
            />
          </label>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Link
              href="/cookies"
              className="inline-flex min-h-[44px] items-center px-2 py-1.5 text-xs text-ink/55 hover:text-ink"
            >
              Learn more
            </Link>
            <button
              type="button"
              onClick={() => choose(analytics)}
              className="rounded-full bg-terracotta-700 px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90"
            >
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
