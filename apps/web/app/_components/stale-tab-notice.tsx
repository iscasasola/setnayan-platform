'use client';

/**
 * stale-tab-notice.tsx — the live notice that says your tab is older than the site (inventory #46).
 *
 * The whole reasoning lives in `lib/build-version.ts`, including why this is a
 * mitigation rather than the cure. In short: we deploy every 15–25 minutes, and
 * a tab open across a deploy can break in a way that throws NOTHING — the guest
 * list went blank on the owner on 2026-09-20 with no exception, so no error
 * boundary and no stale-bundle reload. This gives that silence a voice.
 *
 * ── WHEN IT CHECKS ─────────────────────────────────────────────────────────
 * On the tab becoming visible again, and on window focus. NOT on an interval:
 * a poll burns a function invocation per tab per tick forever, and the moment
 * that matters is exactly when someone comes BACK to a tab they left open —
 * which is the event we already get for free.
 *
 * ── IT UPDATES BY ITSELF ONLY WHEN NOTHING IS TYPED (owner ruling 22e93e56, 16 Nov 2026) ─────────────────
 * A page holding NO unsaved typing takes the new version silently, with no notice: its next in-app link press
 * becomes a full load, or — when the tab is shown again — it reloads there and then. ONCE per served version
 * (`claimSelfUpdate`). 🔑 A page WITH typing never reloads by itself: a couple may be halfway through a guest's
 * name, a supplier halfway through a quote. For that page alone the notice stays, and the reload is its button.
 * The decision is `staleTabAction` / `hasUnsavedTyping` in `lib/build-version.ts`, executed by its tests.
 * `lib/stale-bundle.ts` still auto-reloads its own case, because there the page is ALREADY broken.
 *
 * ── IT IS NEVER UNDER A SHEET, AND IT IS DRAWN ONCE (walk RW-7853-a, 16 Nov 2026) ───────────────────────────────
 * The typing page it speaks to is most often the phone's full-screen chat thread (z 45), which hid the in-flow notice.
 * While a layer covers the page (`aLayerCoversThePage`, `lib/build-version.ts`) the notice rides the app's top
 * notification layer instead (`stale-tab-notice-lift.tsx`, the peek toast's place); on a plain page it stays in the
 * flow, never fixed over the page. Its wrapper is no longer a second live region. 🔒 lib/the-update-notice-is-on-top.test.ts
 *
 * It also never retries a failed check. If `/api/health` does not answer, that
 * is a network problem, not a version problem, and inventing a version bar out
 * of a failed fetch would be the same class of lie as rendering an empty list
 * for a refused read.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { LazyInlineNotice } from './notices/inline-notice-lazy';
import {
  LAYER_ATTRIBUTES,
  LAYER_OVER_THE_PAGE,
  LOADED_BUILD_VERSION,
  MODAL_LAYER,
  SELF_UPDATE_KEY_PREFIX,
  aLayerCoversThePage,
  claimSelfUpdate,
  hasUnsavedTyping,
  servingVersionFrom,
  staleTabAction,
} from '@/lib/build-version';

/** The notice on the app's top notification layer, while a sheet or the full-screen thread covers the page. */
const StaleTabNoticeLift = lazy(() => import('./stale-tab-notice-lift'));

/** Is a Sheet, a RiseScreen, a blocker or the phone's full-screen thread over the page right now? */
function pageIsCovered(): boolean {
  const layers = Array.from(document.querySelectorAll(LAYER_OVER_THE_PAGE), (el) => {
    const cs = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      modal: el.matches(MODAL_LAYER),
      position: cs.position,
      display: cs.display,
      visibility: cs.visibility,
      width: r.width,
      height: r.height,
    };
  });
  return aLayerCoversThePage(layers);
}

function tabStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Has this served version already made its one self-update? Unreadable storage counts as yes (never loop). */
function selfUpdateUsed(serving: string): boolean {
  const storage = tabStorage();
  if (!storage) return true;
  try {
    return Boolean(storage.getItem(SELF_UPDATE_KEY_PREFIX + serving));
  } catch {
    return true;
  }
}

/** A plain same-site link press the router would handle — the one we may turn into a full load. */
function inAppLinkHref(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return null;
  return url.href;
}

export function StaleTabNotice() {
  const [stale, setStale] = useState(false);
  const [servingVersion, setServingVersion] = useState<string | null>(null);
  /** A layer is over the page — the notice is drawn on the top notification layer instead of the flow. */
  const [covered, setCovered] = useState(false);
  /** A served version this tab should take silently on its next in-app link press. */
  const armed = useRef<string | null>(null);
  /** Fields the person typed into — React keeps a controlled field's default in step, so value≠default is not enough. */
  const touched = useRef<WeakSet<EventTarget>>(new WeakSet());

  const typing = useCallback(() => hasUnsavedTyping(document, (el) => touched.current.has(el as EventTarget)), []);

  const check = useCallback(
    async (shown: boolean) => {
      if (!LOADED_BUILD_VERSION) return; // nothing to compare — see build-version.ts
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const serving = servingVersionFrom(await res.json());
        if (!serving) return;
        setServingVersion(serving);
        const action = staleTabAction({
          loaded: LOADED_BUILD_VERSION,
          serving,
          typing: typing(),
          selfUpdateUsed: selfUpdateUsed(serving),
        });
        if (action === 'none') {
          armed.current = null;
          setStale(false);
          return;
        }
        if (action === 'notice') {
          armed.current = null;
          setStale(true);
          return;
        }
        // Nothing typed: no notice. Shown again → take it now; otherwise on the next in-app link press.
        setStale(false);
        armed.current = serving;
        if (shown && claimSelfUpdate(tabStorage(), serving)) window.location.reload();
      } catch {
        // A failed check is a network fact, not a version fact. Say nothing.
      }
    },
    [typing],
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(true);
    };
    const onInput = (e: Event) => {
      if (e.target) touched.current.add(e.target);
    };
    const onClick = (e: MouseEvent) => {
      const serving = armed.current;
      if (!serving) return;
      const href = inAppLinkHref(e);
      if (!href) return;
      if (typing()) {
        // Typing started since the check: never reload — the notice speaks instead.
        armed.current = null;
        setStale(true);
        return;
      }
      if (!claimSelfUpdate(tabStorage(), serving)) return; // already used once — the router goes as usual
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(href);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    document.addEventListener('input', onInput, true);
    document.addEventListener('click', onClick, true);
    // One check on mount covers a tab restored by the browser at start-up, which fires neither event. It never
    // reloads by itself — at most it arms the next link press.
    void check(false);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [check, typing]);

  // 🪟 Only while the notice is up: follow the layers that open and close over the page (a sheet is mounted or
  // unmounted; the thread fixes itself at the phone width), at most once a frame. Nothing runs on a current tab.
  const showing = stale && Boolean(servingVersion);
  useEffect(() => {
    if (!showing) {
      setCovered(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setCovered(pageIsCovered());
      });
    };
    measure();
    const watch = new MutationObserver(measure);
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...LAYER_ATTRIBUTES] });
    window.addEventListener('resize', measure);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', measure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showing]);

  // 🔔 Inventory #46 — a LIVE notice (info) in the one notice system (owner approved 14 Nov 2026): "Reload · Hide", at the
  // very top, never fixed over the page. Since 16 Nov it shows ONLY on a page holding unsaved typing (or once the one
  // self-update for this version is spent) — that page never reloads by itself. "Hide" is kept by the one notice memory against the
  // SERVING version, so the next deploy is a new fact and speaks again. (The fixed bottom bar and its body-padding
  // reserve went with it: "No bar fixed to the screen.")
  if (!stale || !servingVersion) return null;
  // 🔁 ONE notice, ONE live region (walk RW-7853-a): `NoticeLine` is already the `role="status"`, so the wrapper no
  // longer announces a second copy. It is drawn in the flow OR on the top layer — never both.
  const notice = (
    <LazyInlineNotice
      kind="live"
      tone="info"
      noticeKey={`app-updated:${servingVersion}`}
      title="Setnayan was updated while this page was open"
      actions={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="sn-press inline-flex min-h-11 items-center rounded-full bg-mulberry px-4 text-sm font-semibold text-cream"
        >
          Reload
        </button>
      }
      onClose={() => setStale(false)}
    />
  );
  if (covered) {
    // A sheet or the full-screen thread is over the page: the flow is underneath it, so the notice rides the app's
    // top notification layer until that layer goes (`stale-tab-notice-lift.tsx`).
    return (
      <Suspense fallback={null}>
        <StaleTabNoticeLift>{notice}</StaleTabNoticeLift>
      </Suspense>
    );
  }
  return (
    <div data-app-chrome="" data-stale-tab-notice="" className="px-4">
      {notice}
    </div>
  );
}
