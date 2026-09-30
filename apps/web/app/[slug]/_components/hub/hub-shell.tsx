'use client';

/**
 * HubShell — the fullscreen, no-scroll event-day "hub" for guests (Phase 2 of
 * the event-day guest-hub program · DECISION_LOG 2026-06-28).
 *
 * Owner centerpiece: "On the day, a guest opens their event page on their
 * phone and sees ONE screen-filling, no-scroll hub with a bottom MENU that
 * toggles between the day-of functions — instead of a long scrolling page.
 * Everything shows in realtime, fills the screen, menu to toggle between
 * functions."
 *
 * This is a SEPARATE fullscreen route (/[slug]/hub) — the long-scrolling
 * /[slug] page (4,100+ lines, also serving STD/reveal/RSVP/anonymous) stays
 * 100% intact. The hub is reachable from the event-day bottom bar.
 *
 * ARCHITECTURE. The SERVER (hub/page.tsx) resolves the guest identity + every
 * panel's data and renders each panel's CONTENT as a ReactNode, handing them
 * here as named props (`now`, `schedule`, …). This client shell owns only the
 * fixed-height chrome + the menu toggle: it never touches the DB. A panel prop
 * that is `null` means that function isn't available for this viewer/phase, so
 * its menu slot is dropped (a no-guest viewer has no `me`; a non-live event has
 * no `watch`). Menu meta (icon + label) lives here so no component type crosses
 * the server→client boundary.
 *
 * NO-SCROLL SHELL. `fixed inset-0` flex column: a slim signature header (safe-
 * area top) + the panel region (the only scrollable area, for a long Schedule)
 * + the bottom toggle menu (safe-area bottom). The PAGE never scrolls.
 *
 * REALTIME. `useDayOfLiveTick` re-runs the server component (router.refresh)
 * on a quiet cadence + on tab-focus while the wedding day is active — the
 * pull-only "live propagation" the rest of the day-of surfaces already use, so
 * "everything shows in realtime" without any push/socket infra. The active
 * panel (client state) survives the refresh.
 *
 * MENU. Respects the responsive ruleset — ≤5 primary pill slots + a "More"
 * overflow sheet on mobile. The aesthetic echoes the canonical floating
 * frosted-pill BottomNav, but this is a PANEL TOGGLE (one route, client state),
 * not route navigation — so it deliberately does not mount the canonical
 * `BottomNav` (which is usePathname/<Link>-driven) and is not named
 * `*-bottom-nav.tsx` (the delegation lint guard keys on that name).
 *
 * ── 📱 AND IT IS NOW THE GUEST'S WHOLE EVENT HUB (owner 2026-09-30) ──────────
 * *"so this is not a 1 page scroll jumping to different marks. this is each
 * menu gets their own full page scroll"* — DECISION_LOG "EACH MENU TAB IS ITS
 * OWN FULL PAGE", which names THIS file as the pattern to reuse: *"do not build
 * a second shell"*. So there is one shell with two frames over ONE mechanism
 * (which tab is showing, and its address):
 *
 *   · `frame="stage"` (default) — this route's fixed, no-scroll frame, as above.
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
 * 🔑 EVERY TAB HAS ITS OWN ADDRESS, in both frames: `?tab=<key>`. A link opened
 * from a chat lands on its tab (the server reads it, so there is no flash of
 * another tab first); Back walks the tabs the guest opened. An old `#mark` link
 * (`#site-details`, the ticket's `#pass`) still lands: the frame opens the tab
 * that holds the mark, then scrolls to it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  CalendarClock,
  Camera,
  Images,
  MapPin,
  MoreHorizontal,
  Radio,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';
import type { NavSlot } from '../../_lib/site-nav';
import {
  HUB_TAB_ATTR,
  HUB_TAB_PARAM,
  activeHubTab,
  hubTabOfHref,
  inPageTabs,
} from '../../_lib/hub-tabs';
import { hashOpensSheet } from '../rsvp-sheet-state';

export type HubPanelKey =
  | 'now'
  | 'watch'
  | 'camera'
  | 'photos'
  | 'me'
  | 'schedule'
  | 'directions';

// Menu meta lives client-side (icon component types can't cross the RSC
// boundary). The array order is the canonical PRIORITY order — the first five
// AVAILABLE panels become the primary pills, the rest fall into "More". Watch
// rides high so a live broadcast is one tap away; Schedule/Directions are
// reference panels that comfortably live under More when the bar is full.
const MENU: { key: HubPanelKey; label: string; icon: LucideIcon }[] = [
  // 📱 The guest's words (owner 2026-09-30): the first tab is "Live", and the
  // photo tab is "Gallery" — the owner's name, never "Photos" (site-nav.ts
  // NAMING LOCK). Keys are unchanged, so every `?tab=` address still works.
  { key: 'now', label: 'Live', icon: Activity },
  { key: 'watch', label: 'Watch', icon: Radio },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'photos', label: 'Gallery', icon: Images },
  { key: 'me', label: 'Me', icon: User },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock },
  { key: 'directions', label: 'Directions', icon: MapPin },
];

const MAX_PRIMARY = 5;

type HubStageProps = {
  frame?: 'stage';
  /** Event date (drives the realtime tick; inert outside the wedding day). */
  eventDate: string | null;
  /** Slim signature header (monogram / names + live badge), server-rendered. */
  header: ReactNode;
  now: ReactNode;
  watch: ReactNode | null;
  camera: ReactNode | null;
  photos: ReactNode | null;
  me: ReactNode | null;
  schedule: ReactNode | null;
  directions: ReactNode | null;
};

type HubPageProps = {
  frame: 'page';
  /** The guest's bar, resolved by `resolveSiteNav` with `tabbed` — its in-page
   *  tabs carry their `?tab=` address; the Camera and the like still leave.
   *  The bar itself is the page's own `SiteMenuBar`, which reads the same
   *  address to mark the tab you are on. */
  slots: readonly NavSlot[];
};

/** THE ONE SHELL. `frame="page"` → the event page's tabs; otherwise the stage. */
export function HubShell(props: HubStageProps | HubPageProps) {
  return props.frame === 'page' ? <HubPageFrame {...props} /> : <HubStageFrame {...props} />;
}

/**
 * THE ONE MECHANISM — which tab is showing IS its address. Both frames use it.
 * The tab is read from `?tab=` (`activeHubTab`: the address's tab when this
 * reader has it, else the first), so the server — which reads the same
 * address — drew exactly this tab, and the page's bar marks it from the same
 * read (`site-menu-bar.tsx`). `go` writes the address (push: a tap the guest
 * may want to go Back from; replace: a correction nobody chose).
 * `window.history` is Next's own sanctioned path here: it keeps the router's
 * search params in step — so every reader of the address moves together, Back
 * and Forward included, and a later refresh re-renders the SAME tab.
 */
function useTabAddress(keys: readonly string[]) {
  const params = useSearchParams();
  const active = activeHubTab(params?.get(HUB_TAB_PARAM) ?? null, keys);
  const go = useCallback((key: string, mode: 'push' | 'replace', hash?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(HUB_TAB_PARAM, key);
    url.hash = hash ? `#${hash}` : '';
    const next = `${url.pathname}${url.search}${url.hash}`;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === here) return;
    if (mode === 'push') window.history.pushState(null, '', next);
    else window.history.replaceState(null, '', next);
  }, []);
  return [active, go] as const;
}

function HubStageFrame({
  eventDate,
  header,
  now,
  watch,
  camera,
  photos,
  me,
  schedule,
  directions,
}: HubStageProps) {
  const router = useRouter();
  // Pull-only realtime: re-read current truth on a quiet cadence while the
  // wedding day is active + the tab is visible (no push/socket). The active
  // panel is local state, so it survives the server refresh.
  useDayOfLiveTick(eventDate, () => router.refresh());

  const panels: Record<HubPanelKey, ReactNode | null> = {
    now,
    watch,
    camera,
    photos,
    me,
    schedule,
    directions,
  };

  const available = MENU.filter((m) => panels[m.key] != null);
  const primary = available.slice(0, MAX_PRIMARY);
  const overflow = available.slice(MAX_PRIMARY);

  const availableKeys = available.map((m) => m.key);
  // If a realtime refresh removes the active panel (e.g. the live window
  // closed → Watch disappears), `activeHubTab` falls back to the first
  // still-available panel, so we never render a blank stage.
  const [activeKey, go] = useTabAddress(availableKeys);
  const active = (activeKey || 'now') as HubPanelKey;
  const [moreOpen, setMoreOpen] = useState(false);

  const moreSheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    containerRef: moreSheetRef,
  });

  const overflowActive = overflow.some((m) => m.key === active);

  function select(key: HubPanelKey) {
    go(key, 'push');
    setMoreOpen(false);
  }

  // The toggle menu is an ARIA tab set, not navigation: the bar is a `tablist`,
  // each pill a `tab` controlling the single `tabpanel` stage, with roving
  // tabindex + arrow-key movement (APG tabs pattern). The panel is labelled by
  // whichever control is active — a primary tab, or the "More" disclosure when
  // an overflow panel is showing.
  const PANEL_ID = 'hub-panel';
  const MORE_ID = 'hub-more-tab';
  const SHEET_ID = 'hub-more-sheet';
  const tabId = (key: HubPanelKey) => `hub-tab-${key}`;
  const activeControlId = overflowActive ? MORE_ID : tabId(active);
  // Exactly one primary tab is tabbable (roving): the active one, or the first
  // when the active panel lives in the overflow sheet.
  const focusKey = primary.some((m) => m.key === active) ? active : primary[0]?.key;

  const tablistRef = useRef<HTMLDivElement>(null);
  function onTablistKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const tabs = Array.from(
      tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (tabs.length === 0) return;
    const current = tabs.findIndex((t) => t === document.activeElement);
    let next = current;
    if (e.key === 'ArrowRight') next = current < 0 ? 0 : (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft')
      next = current < 0 ? tabs.length - 1 : (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    target.focus();
    const key = target.getAttribute('data-tabkey');
    if (key) go(key, 'replace');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream text-ink">
      {/* Signature header — slim, safe-area aware. */}
      <header className="shrink-0 border-b border-ink/8 bg-cream/80 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)] backdrop-blur">
        {header}
      </header>

      {/* Panel stage (tabpanel) — the ONLY scrollable region (a long Schedule).
          The page itself never scrolls. Re-mounted per panel so the entrance
          plays. */}
      <main
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={activeControlId}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 focus-visible:outline-none"
      >
        <PanelFade key={active}>{panels[active]}</PanelFade>
      </main>

      {/* Bottom toggle menu — ≤5 primary tabs + a More overflow sheet. */}
      <nav
        aria-label="Live hub"
        className="shrink-0 border-t border-ink/10 bg-cream/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur"
      >
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{
            gridTemplateColumns: `repeat(${primary.length + (overflow.length > 0 ? 1 : 0)}, minmax(0, 1fr))`,
          }}
        >
          {/* `display:contents` so the tab buttons remain direct grid items. */}
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Live hub sections"
            aria-orientation="horizontal"
            onKeyDown={onTablistKeyDown}
            className="contents"
          >
            {primary.map((m) => (
              <HubMenuButton
                key={m.key}
                label={m.label}
                icon={m.icon}
                active={active === m.key}
                onClick={() => select(m.key)}
                buttonProps={{
                  role: 'tab',
                  id: tabId(m.key),
                  'data-tabkey': m.key,
                  'aria-selected': active === m.key,
                  'aria-controls': PANEL_ID,
                  tabIndex: m.key === focusKey ? 0 : -1,
                }}
              />
            ))}
          </div>
          {overflow.length > 0 ? (
            <HubMenuButton
              label="More"
              icon={MoreHorizontal}
              active={overflowActive}
              onClick={() => setMoreOpen((v) => !v)}
              buttonProps={{
                id: MORE_ID,
                'aria-haspopup': 'dialog',
                'aria-expanded': moreOpen,
                'aria-controls': SHEET_ID,
              }}
            />
          ) : null}
        </div>
      </nav>

      {/* More overflow sheet — anchored above the menu. */}
      {moreOpen && overflow.length > 0 ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            ref={moreSheetRef}
            id={SHEET_ID}
            role="dialog"
            aria-modal="true"
            aria-label="More event functions"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-ink/10 bg-cream p-3 shadow-2xl"
          >
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                More
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-1">
              {overflow.map((m) => {
                const Icon = m.icon;
                return (
                  <li key={m.key}>
                    <button
                      type="button"
                      onClick={() => select(m.key)}
                      aria-current={active === m.key ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                        active === m.key
                          ? 'bg-ink text-cream'
                          : 'text-ink hover:bg-ink/5'
                      }`}
                    >
                      <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                      {m.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Show exactly one tab's content. Every group the server drew carries
 * `data-hub-tab`; all but the shown tab's are `hidden` — the attribute, not a
 * class, because the page's `space-y-*` rhythm skips `[hidden]` siblings, so the
 * first thing on a tab sits at the top of it with no borrowed gap.
 */
function showTab(key: string) {
  document.querySelectorAll<HTMLElement>(`[${HUB_TAB_ATTR}]`).forEach((el) => {
    el.hidden = el.getAttribute(HUB_TAB_ATTR) !== key;
  });
}

/** The tab holding an element, when that element is on one. */
function tabHolding(id: string): string | null {
  if (!id) return null;
  const el = document.getElementById(id);
  return el?.closest(`[${HUB_TAB_ATTR}]`)?.getAttribute(HUB_TAB_ATTR) ?? null;
}

/**
 * 📱 THE PAGE FRAME — the event page's tabs, each its own page (see the file's
 * docblock). Renders the guest's bar and nothing else: the tabs' content is the
 * page's own, already on it.
 */
function HubPageFrame({ slots }: HubPageProps) {
  const keys = inPageTabs(slots);
  const [active, go] = useTabAddress(keys);
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
  }, [go]);

  // The bar is the page's own (`SiteMenuBar`, mounted beside this); this frame
  // is the mechanism behind it and draws nothing of its own.
  return null;
}

/** One toggle pill in the bottom menu. Active = filled ink pill (the signature
 *  read), restrained transition. ≥44px tap target. `buttonProps` carries the
 *  ARIA tab (or More-disclosure) wiring from the shell. */
function HubMenuButton({
  label,
  icon: Icon,
  active,
  onClick,
  buttonProps,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement> & {
    'data-tabkey'?: string;
  };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...buttonProps}
      className={`flex min-h-[44px] w-full select-none flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
        active ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      <Icon
        aria-hidden
        className="h-[20px] w-[20px]"
        strokeWidth={active ? 2 : 1.75}
      />
      <span className="text-[0.6rem] font-semibold leading-none tracking-wide">
        {label}
      </span>
    </button>
  );
}

/** A restrained entrance for the freshly-shown panel — the hub's one signature
 *  moment (premium-UI doctrine). Skipped under prefers-reduced-motion. */
function PanelFade({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 260ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
}
