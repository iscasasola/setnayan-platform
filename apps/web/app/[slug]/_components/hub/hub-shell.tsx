'use client';

/**
 * HubShell — the Event Hub's tabs, each its own page.
 *
 * 🧭 ONE BAR PER STAGE (controller under owner delegation, 20 Nov 2026 —
 * DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED"): this
 * file used to hold TWO frames. The second, `frame="stage"`, was `/[slug]/hub`'s
 * own fullscreen screen with its own bottom bar (Live · Watch · Camera ·
 * Memories · Me · More) — a second bar beside the event page's on The Day. It is
 * gone: `/hub` now sends its visitor to the event page's matching tab
 * (`dayHubLanding`, `_lib/day-hub.ts`), Watch lives inside Live, and Schedule and
 * Directions — the old "More" — are on Live too. One frame is left, and the bar
 * is the page's own `SiteMenuBar`.
 *
 * ── 📱 AND IT IS NOW THE GUEST'S WHOLE EVENT HUB (owner 2026-09-30) ──────────
 * *"so this is not a 1 page scroll jumping to different marks. this is each
 * menu gets their own full page scroll"* — DECISION_LOG "EACH MENU TAB IS ITS
 * OWN FULL PAGE", which names THIS file as the pattern to reuse: *"do not build
 * a second shell"*. So there is one shell over ONE mechanism (which tab is
 * showing, and its address):
 *
 *   · `frame="page"` — the event page itself (`/[slug]`) on the Invitation
 *     (Welcome · Details · Our Love Story · Me) and The Day (Live · Welcome ·
 *     Camera · Gallery · Me). The server renders every tab's content ONCE, each
 *     group marked `data-hub-tab` and all but the shown one `hidden`
 *     (`site-body.tsx` · `_lib/hub-tabs.ts`); this frame shows one tab at a
 *     time, from its top, under the guest's own bar (`SiteMenuBar` — the
 *     designed bar, never a second one). The page keeps the window as its
 *     scroller, so the couple's theme, the sticky header and every sheet stay
 *     exactly as they were: only which tab is on the page changes.
 *
 * 🔑 EVERY TAB HAS ITS OWN ADDRESS: `?tab=<key>`. A link opened
 * from a chat lands on its tab (the server reads it, so there is no flash of
 * another tab first); Back walks the tabs the guest opened. An old `#mark` link
 * (`#site-details`, the ticket's `#pass`) still lands: the frame opens the tab
 * that holds the mark, then scrolls to it.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { NavSlot } from '../../_lib/site-nav';
import {
  HUB_PAGE_ATTR,
  HUB_TAB_ATTR,
  HUB_TAB_PARAM,
  SCROLL_PAGE,
  activeHubTab,
  filingTabs,
  hubPagesOf,
  hubTabOfHref,
  inPageTabs,
  isJumpMarkTab,
} from '../../_lib/hub-tabs';
import { SITE_MENU_ANCHORS, type SiteMenuTabKey } from '../../_lib/site-menu';
import { hashOpensSheet } from '../rsvp-sheet-state';

type HubPageProps = {
  /** The one frame left (20 Nov 2026) — kept as a prop so every mount reads as what it is. */
  frame: 'page';
  /** The guest's bar, resolved by `resolveSiteNav` with `tabbed` — its in-page
   *  tabs carry their `?tab=` address; the Camera and the like still leave.
   *  The bar itself is the page's own `SiteMenuBar`, which reads the same
   *  address to mark the tab you are on. */
  slots: readonly NavSlot[];
  /** 📜 The Invitation and Save the Date (owner 2026-10-15): ONE page of jump marks, and Me its own page. The frame
   *  switches between those two pages; the marks are the page's own anchors. */
  onePage?: boolean;
};

/** THE ONE SHELL — the event page's tabs (`frame="page"`). */
export function HubShell(props: HubPageProps) {
  return <HubPageFrame {...props} />;
}

/**
 * THE ONE MECHANISM — which tab is showing IS its address.
 * The tab is read from `?tab=` (`activeHubTab`: the address's tab when this
 * reader has it, else the first), so the server — which reads the same
 * address — drew exactly this tab, and the page's bar marks it from the same
 * read (`site-menu-bar.tsx`). `go` writes the address (push: a tap the guest
 * may want to go Back from; replace: a correction nobody chose).
 * `window.history` is Next's own sanctioned path here: it keeps the router's
 * search params in step — so every reader of the address moves together, Back
 * and Forward included, and a later refresh re-renders the SAME tab.
 */
function useTabAddress(keys: readonly string[], onePage = false) {
  const params = useSearchParams();
  const active = activeHubTab(params?.get(HUB_TAB_PARAM) ?? null, keys);
  const go = useCallback((key: string, mode: 'push' | 'replace', hash?: string) => {
    const url = new URL(window.location.href);
    /* 📜 The one page is the event's own bare address — its marks ride the #hash, never `?tab=`. */
    if (onePage && key === SCROLL_PAGE) url.searchParams.delete(HUB_TAB_PARAM);
    else url.searchParams.set(HUB_TAB_PARAM, key);
    url.hash = hash ? `#${hash}` : '';
    const next = `${url.pathname}${url.search}${url.hash}`;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === here) return;
    if (mode === 'push') window.history.pushState(null, '', next);
    else window.history.replaceState(null, '', next);
  }, [onePage]);
  return [active, go] as const;
}

/**
 * Show exactly one tab's content. Every group the server drew carries
 * `data-hub-tab`; all but the shown tab's are `hidden` — the attribute, not a
 * class, because the page's `space-y-*` rhythm skips `[hidden]` siblings, so the
 * first thing on a tab sits at the top of it with no borrowed gap.
 */
function showTab(key: string) {
  /* 📜 By PAGE (`data-hub-page`): on a one-page stage Home · Details · Story are all the one page. */
  document.querySelectorAll<HTMLElement>(`[${HUB_TAB_ATTR}]`).forEach((el) => {
    el.hidden = (el.getAttribute(HUB_PAGE_ATTR) ?? el.getAttribute(HUB_TAB_ATTR)) !== key;
  });
}

/** The page holding an element, when that element is on one. */
function tabHolding(id: string): string | null {
  if (!id) return null;
  const el = document.getElementById(id);
  const group = el?.closest(`[${HUB_TAB_ATTR}]`);
  return group ? (group.getAttribute(HUB_PAGE_ATTR) ?? group.getAttribute(HUB_TAB_ATTR)) : null;
}

/**
 * 📱 THE PAGE FRAME — the event page's tabs, each its own page (see the file's
 * docblock). Renders the guest's bar and nothing else: the tabs' content is the
 * page's own, already on it.
 */
function HubPageFrame({ slots, onePage = false }: HubPageProps) {
  /* 📜 One page: the pages are the one page (`SCROLL_PAGE`) and Me — the marks are not pages (`hubPagesOf`). */
  const keys = onePage ? hubPagesOf(filingTabs(slots, true), true) : inPageTabs(slots);
  const [active, go] = useTabAddress(keys, onePage);
  const activeRef = useRef(active);
  activeRef.current = active;
  const keysRef = useRef(keys);
  keysRef.current = keys;

  // Whatever set the tab — a tap, Back, a mark — the page shows that tab.
  useEffect(() => {
    showTab(active);
  }, [active]);

  useEffect(() => {
    /** Open the tab holding `id` and bring `id` into view. */
    const openMark = (id: string, mode: 'push' | 'replace'): boolean => {
      const k = tabHolding(id);
      if (!k || !keysRef.current.includes(k)) return false;
      if (k !== activeRef.current) {
        showTab(k);
        go(k, mode, id);
      }
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      return true;
    };

    /* 📜 AN OLD TAB'S ADDRESS ON THE ONE PAGE (`?tab=details`, `?tab=story` — every link shared before
       2026-10-15) still lands: on the one page, scrolled to that section, the address made the mark it now is.
       `?tab=home` was the page from its top: it is simply the bare address. */
    if (onePage) {
      const asked = new URLSearchParams(window.location.search).get(HUB_TAB_PARAM)?.trim() ?? '';
      if (asked && isJumpMarkTab(asked, true) && keysRef.current.includes(SCROLL_PAGE)) {
        const anchor = asked !== SCROLL_PAGE && asked in SITE_MENU_ANCHORS ? SITE_MENU_ANCHORS[asked as SiteMenuTabKey] : undefined;
        go(SCROLL_PAGE, 'replace', anchor && !window.location.hash ? anchor : window.location.hash.slice(1) || undefined);
        if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
      }
    }

    // An address that arrived with a mark on another tab (`/slug#site-details`).
    const arrived = decodeURIComponent(window.location.hash.slice(1));
    if (arrived && !hashOpensSheet(arrived) && tabHolding(arrived) !== activeRef.current) {
      requestAnimationFrame(() => openMark(arrived, 'replace'));
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      const href = link.getAttribute('href') ?? '';
      // A tab's address — the bar, or any "see your ticket" link on the page.
      const tab = hubTabOfHref(href);
      if (tab) {
        if (!keysRef.current.includes(tab)) return;
        e.preventDefault();
        if (tab !== activeRef.current) {
          showTab(tab);
          go(tab, 'push');
        }
        // A new page opens at its top; tapping the tab you are on goes back up.
        window.scrollTo({ top: 0 });
        return;
      }
      // A mark on another tab. The reply sheet's own marks are the sheet's.
      if (!href.startsWith('#') || hashOpensSheet(href)) return;
      const id = decodeURIComponent(href.slice(1));
      const k = tabHolding(id);
      if (!k || k === activeRef.current || !keysRef.current.includes(k)) return;
      e.preventDefault();
      openMark(id, 'push');
    };
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && !hashOpensSheet(id)) openMark(id, 'replace');
    };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, [go, onePage]);

  // The bar is the page's own (`SiteMenuBar`, mounted beside this); this frame
  // is the mechanism behind it and draws nothing of its own.
  return null;
}
