'use client';

/**
 * 🗂 THE ONE PICKED PAGE SHELL — both sides (Supplier Build 3 · Lane A, 9 Nov 2026; first built as the supplier's
 * picked client, THE ONE BUILD 8 Nov · prototype v113, B1 step 5).
 *
 * One screen over the still-mounted list: the pinned row (the name · ⚙ · ✕), the page menu (icon over word) and ONE
 * page body at a time. The supplier's picked client (`vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx`)
 * and the host's picked supplier (`dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx`)
 * are thin wrappers that hand this their menu, icons and doors — owner 8 Nov: *"and will it take up the same full screen
 * effect"* → yes, the same layer, the same motion, the same tab switch. There is no second copy.
 *
 * ── HOW IT SWITCHES ──────────────────────────────────────────────────────────────────────────────────────────
 * Every body is already rendered on the server; a menu tap swaps which one shows and writes `?tab=<page>` with
 * `history.replaceState` — a page switch costs NO request (B1 §8 M5).
 *
 * ── HOW IT OPENS AND CLOSES ──────────────────────────────────────────────────────────────────────────────────
 * From a list (a soft tap, drawn in the list's intercepting slot over it): it rises from the tapped row in 520 ms and
 * ✕ is the exact reverse into the same row, then `router.back()` — the list never re-renders, so its scroll stays.
 * From anywhere else (hard load, Today, a notification): it is simply there, and ✕ goes to `closeHref`.
 * Reduced motion: a 120 ms fade both ways (`./picked-motion.ts`).
 *
 * ── LAYERS (spec §10 #23: page < thumb row < bottom nav < pop-ups/sheets) ──────────────────────────────────────
 * The picked page covers the bottom nav, so it is a pop-up layer: `--sn-z-pop` (over the thumb row and the bar, under
 * a `Sheet` at `--sn-z-modal`), drawn on <body> like `Sheet`, so no page stacking context can trap it under the bar.
 * 🥞 A page's OWN thumb row must not go to <body> at z 25: it would sit UNDER this screen. The screen keeps a thumb host
 * inside its own layer — after the page body, outside the sliding page — and hands it down through `ThumbLayerContext`.
 *
 * 🔒 vendor-dashboard/customers/the-picked-client-opens-over-the-list.test.ts · app/_components/picked/one-picked-shell.test.ts
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { usePortalHost } from '@/lib/use-portal-host';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { nextPanelTabId, PickedHeadContext, PickedNavContext, type PickedShellNav } from './picked-nav';
import { ThumbLayerContext, type ThumbLayer } from '@/app/vendor-dashboard/_components/thumb-layer';
import {
  PICKED_OPEN_MS,
  PICKED_PAGE_SLIDE_EASE,
  PICKED_PAGE_SLIDE_MS,
  forgetPickedOrigin,
  pickedMotion,
  prefersReducedMotion,
  readPickedOrigin,
  type PickedOrigin,
} from './picked-motion';
import { centreInStrip, pageSwipeStep } from '@/app/_components/centre-in-strip';

/** Where a body swipe may NOT start (it belongs to something that moves sideways itself, or to a field). */
const PAGE_SWIPE_SKIP = '[data-picked-menu],[data-calendar],[data-dates-week-strip],input,textarea,select,[contenteditable="true"],[data-no-page-swipe]';

export type PickedShellProps<P extends string> = {
  /** `data-picked-client` — the event (supplier side) or the event-supplier row (host side) this screen is about. */
  pickedId: string;
  /** The pinned row's name. */
  title: string;
  /** The menu, in order. */
  menu: { id: P; label: string }[];
  /** One icon per page (lucide). */
  icons: Record<P, LucideIcon>;
  /** The page the URL names, resolved on the server so the first paint is the right page. */
  initialPage: P;
  bodies: Record<P, ReactNode>;
  /** This page's own address (no query) — an origin recorded for another page is ignored. */
  pagePath: string;
  /** The lists this page opens OVER (path prefixes) — where a recorded tap may have come from. */
  originFrom: readonly string[];
  /** Where ✕ goes when the page was not opened from a list (a hard load, a notification). */
  closeHref: string;
  /** Warm the other pages' code at idle once the open has settled (code only — no data, no request). */
  warm?: () => void;
  /** Land on `page` scrolled to the element `id` (the supplier's `?tab=script`). */
  scrollTo?: { page: P; id: string } | null;
  /** ⚙ this screen's own settings — the house door (`MenuSettingsButton`); absent = no ⚙ (never a dead one). */
  // Only the supplier's picked client has a ⚙ today, so the key is the literal `client`: the one-mount guard
  // (`every-menu-has-one-settings-button.test.ts`) counts literal `menu="…"` mounts, never a variable.
  gear?: { menu: 'client'; line: { line: string; tip: string }; node: ReactNode } | null;
  /**
   * 📌 Pages that FILL the body (Chat): no padding, no body scroll — the page scrolls inside itself, so its pinned stack
   * stays under this shell's pinned row and menu (owner, 9 Nov: "the pinned on top should stay pinned"). A chat's
   * full-screen takeover becomes an in-flow box here (globals.css, `[data-picked-fill] [data-chat-takeover]`) — it
   * never covers the shell's own head and menu.
   */
  fillPages?: readonly P[];
  /**
   * 🔴 A count on a menu entry (v8.3: the Chat tab's unread). A page's badge leaves once it is opened in this visit;
   * 0 / null / absent draws nothing.
   */
  badges?: Partial<Record<P, number | null>>;
};

export function PickedShell<P extends string>({
  pickedId,
  title,
  menu,
  icons,
  initialPage,
  bodies,
  pagePath,
  originFrom,
  closeHref,
  warm,
  scrollTo = null,
  gear = null,
  fillPages = [],
  badges = {},
}: PickedShellProps<P>) {
  const router = useRouter();
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // 🥞 The page rows' floor (host) and the column they span from 701 (the pinned row's column — it never slides).
  const [thumbHost, setThumbHost] = useState<HTMLDivElement | null>(null);
  const [thumbColumn, setThumbColumn] = useState<HTMLDivElement | null>(null);
  const thumbLayer = useMemo<ThumbLayer>(() => ({ host: thumbHost, column: thumbColumn }), [thumbHost, thumbColumn]);
  const [page, setPage] = useState<P>(initialPage);
  const [gearOpen, setGearOpen] = useState(false);
  const [headSlot, setHeadSlot] = useState<HTMLSpanElement | null>(null);
  // The pages opened in this visit — their badge has been seen (the page itself marks the read on the server side).
  const [seen, setSeen] = useState<ReadonlySet<P>>(() => new Set([initialPage]));
  useEffect(() => {
    setSeen((was) => (was.has(page) ? was : new Set([...was, page])));
  }, [page]);
  const originRef = useRef<PickedOrigin | null>(null);
  const closingRef = useRef(false);
  const headingId = useId();

  // The URL may name a page the server could not see (a hash, a client-side replace) — read it once after mount.
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t && t !== page && menu.some((m) => m.id === t)) setPage(t as P);
    } catch {
      /* keep the server's page */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎬 OPEN — rise from the tapped row (or a fade), once, before the first paint after the portal lands.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !host) return;
    originRef.current = readPickedOrigin(pagePath, originFrom);
    const m = pickedMotion(originRef.current);
    if (m) el.animate(m.frames, m.timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // 🎯 #36: the picked page sits in the MIDDLE of the menu strip — on a tap, a body swipe, a deep link and the first
  // open (instant then, so the menu does not glide on arrival); at either end the strip stays at its end. ONLY the strip
  // scrolls (§10 #26: `scrollIntoView` also moved the page body sideways), and the body is put back if it ever moved.
  const centredOnce = useRef(false);
  useEffect(() => {
    const strip = menuRef.current;
    const first = !centredOnce.current;
    if (centreInStrip(strip, strip?.querySelector<HTMLElement>(`[data-picked-page="${page}"]`) ?? null, first) !== null) centredOnce.current = true;
    if (bodyRef.current?.scrollLeft) bodyRef.current.scrollLeft = 0;
  }, [page, host]);

  // ⚡ The other pages' code loads on demand (`_pages/lazy.tsx`); once the open has settled, warm it at idle so a later
  // tap finds it already here. Code only — no data, no request to our server.
  useEffect(() => {
    if (!host) return;
    let idle = 0;
    const t = window.setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (!warm) return;
      if (ric) idle = ric(warm);
      else warm();
    }, PICKED_OPEN_MS);
    return () => {
      window.clearTimeout(t);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && cic) cic(idle);
    };
  }, [host, warm]);

  // `scrollTo` (the supplier's `?tab=script` → Schedule, scrolled to the Script fold).
  useEffect(() => {
    if (!scrollTo || page !== scrollTo.page) return;
    const t = window.setTimeout(() => {
      document.getElementById(scrollTo.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, prefersReducedMotion() ? 0 : PICKED_OPEN_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fills = fillPages.includes(page);
  const select = useCallback(
    (id: P) => {
      if (id === page) return;
      setPage(id);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', id);
        url.hash = '';
        window.history.replaceState(window.history.state, '', url.toString());
      } catch {
        /* a URL that cannot be written still shows the right page */
      }
      bodyRef.current?.scrollTo({ top: 0 });
      // §10 #26: a 0.7 s slide of the PAGE (not the scroller), 44 px, opacity full at 45 %; the scroller keeps
      // overflow-x hidden, so no white edge shows while it travels.
      const el = bodyRef.current?.querySelector<HTMLElement>('#picked-page');
      if (el && !prefersReducedMotion()) {
        el.animate(
          [
            { transform: 'translateX(44px)', opacity: 0 },
            { opacity: 1, offset: 0.45 },
            { transform: 'translateX(0)', opacity: 1 },
          ],
          { duration: PICKED_PAGE_SLIDE_MS, easing: PICKED_PAGE_SLIDE_EASE },
        );
      }
    },
    [page],
  );

  // ⌨ Arrow keys step the menu one page by its id (the rule lives in `picked-nav.ts`); focus follows the pick.
  const ids = useMemo(() => menu.map((m) => m.id), [menu]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: P) => {
    const nextId = nextPanelTabId(ids, id, e.key);
    if (nextId === null) return;
    e.preventDefault();
    select(nextId as P);
    menuRef.current?.querySelector<HTMLElement>(`[data-picked-page="${nextId}"]`)?.focus();
  };

  // 👆 #36: a swipe across the BODY turns the page (v116: ≥ 60 px, 1.5× more sideways than down) in the menu's order,
  // and the menu centres the new one. Never from the menu, a calendar, a field or anything that scrolls sideways.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let sx = 0;
    let sy = 0;
    let on = false;
    const start = (e: TouchEvent) => {
      const t = e.target as Element | null;
      on = !!t && !t.closest(PAGE_SWIPE_SKIP) && e.touches.length === 1;
      if (!on) return;
      sx = e.touches[0]!.clientX;
      sy = e.touches[0]!.clientY;
    };
    const end = (e: TouchEvent) => {
      if (!on) return;
      on = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const step = pageSwipeStep(t.clientX - sx, t.clientY - sy);
      if (!step) return;
      const i = menu.findIndex((m) => m.id === page);
      const next = menu[i + step];
      if (i >= 0 && next) select(next.id);
    };
    body.addEventListener('touchstart', start, { passive: true });
    body.addEventListener('touchend', end, { passive: true });
    return () => {
      body.removeEventListener('touchstart', start);
      body.removeEventListener('touchend', end);
    };
  }, [menu, page, select, host]);

  // ✕ — the exact reverse of the open, then back to the list (or to it, on a hard load).
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const el = rootRef.current;
    const origin = originRef.current;
    const leave = () => {
      forgetPickedOrigin();
      if (origin && window.history.length > 1) router.back();
      else router.push(closeHref);
    };
    if (!el) return leave();
    // The SAME frames and timing as the open, played backwards — the exact reverse, easing included.
    const m = pickedMotion(origin);
    if (!m) return leave();
    const anim = el.animate(m.frames, { ...m.timing, direction: 'reverse', fill: 'forwards' });
    anim.onfinish = leave;
  }, [router, closeHref]);

  // The house modal contract (`useModalA11y`): focus moves in, Tab stays inside, Esc closes — and only the TOPMOST layer
  // answers Esc, so with the ⚙ sheet (or any sheet a page opens) on top, Esc peels that layer, not the client. Armed once
  // the screen is on <body> (`host`): the first frame is drawn in place, then remounted into the portal. Page scroll is
  // left alone (`lockScroll: false`) — the screen is fixed full-height with its own scroller, as before.
  useModalA11y({ open: Boolean(host), onClose: close, containerRef: rootRef, lockScroll: false });

  // A ⚙ row or a link inside a page switches pages the same way the menu does (and closes the ⚙ sheet first).
  const nav = useMemo<PickedShellNav>(
    () => ({
      page,
      select: (id: string) => {
        setGearOpen(false);
        if (menu.some((m) => m.id === id)) select(id as P);
      },
    }),
    [page, select, menu],
  );

  const screen = (
    <PickedNavContext.Provider value={nav}>
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-picked-client={pickedId}
      className="fixed inset-0 flex h-[100dvh] flex-col bg-cream text-ink outline-none"
      style={{ zIndex: 'var(--sn-z-pop)' }}
    >
      {/* 📌 The pinned row: the client · ⚙ · ✕ (v113). No hard line under it — the menu's ground carries on. */}
      <div className="shrink-0 bg-[rgb(var(--color-cream))] pt-[env(safe-area-inset-top)]">
        <div ref={setThumbColumn} className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pt-2" data-picked-pin="">
          <h1 id={headingId} className="min-w-0 flex-1 truncate text-[20px] font-bold text-ink" data-pin-word="">
            {title}
          </h1>
          {/* 📞 🎥 📎 — the page on show draws its own head actions here (`PickedHeadContext`; v8.3 head row). */}
          <span ref={setHeadSlot} className="flex shrink-0 items-center gap-1.5 empty:hidden" data-picked-head-actions="" />
          {/* ⚙ This page's own settings — not the list's ⚙ (that menu is mounted once, on the list). The house door
              (`MenuSettingsButton`) on the `client` key (L1, `lib/menu-settings.ts`); its rows are this page's own. */}
          {gear ? (
            <MenuSettingsButton menu="client" open={gearOpen} onOpenChange={setGearOpen} line={gear.line}>
              {gear.node}
            </MenuSettingsButton>
          ) : null}
          <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={close} data-testid="picked-close" />
        </div>
        {/* 🗂 The page menu — icon over word, the picked one framed (it is the one you pressed). */}
        <div
          ref={menuRef}
          role="tablist"
          aria-label={`${title} pages`}
          className="mx-auto flex w-full max-w-3xl gap-0.5 overflow-x-auto px-4 pb-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-picked-menu=""
        >
          {menu.map((m) => {
            const Icon: LucideIcon = icons[m.id];
            const on = m.id === page;
            const count = seen.has(m.id) ? 0 : (badges[m.id] ?? 0);
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`picked-tab-${m.id}`}
                aria-selected={on}
                aria-controls="picked-page"
                data-picked-page={m.id}
                tabIndex={on ? 0 : -1}
                onClick={() => select(m.id)}
                onKeyDown={(e) => onKeyDown(e, m.id)}
                className={`relative grid min-h-[48px] min-w-[66px] shrink-0 justify-items-center gap-[3px] rounded-xl px-1.5 pb-1.5 pt-[7px] text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry ${
                  on
                    ? 'border border-[rgb(var(--color-terracotta-700,154_98_52))] text-ink'
                    : 'border border-transparent text-ink/70'
                }`}
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.7} />
                <span>{m.label}</span>
                {count > 0 ? (
                  <small
                    className="absolute right-2 top-0.5 h-4 min-w-4 rounded-full bg-sn-accent px-1 text-center text-[10px] font-bold leading-4 text-sn-on-accent"
                    data-picked-badge={m.id}
                  >
                    {count > 99 ? '99+' : count}
                    <span className="sr-only"> unread</span>
                  </small>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={bodyRef}
        className={`min-h-0 flex-1 overflow-x-hidden overscroll-contain [overscroll-behavior-x:none] bg-white ${fills ? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'}`}
        data-picked-body=""
      >
        <div
          id="picked-page"
          role="tabpanel"
          aria-labelledby={`picked-tab-${page}`}
          className={
            fills
              ? 'mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col'
              : 'mx-auto w-full max-w-3xl px-4 pb-[max(calc(env(safe-area-inset-bottom)+24px),var(--sn-thumb-room,0px))] pt-3'
          }
          data-picked-page-body={page}
          {...(fills ? { 'data-picked-fill': '' } : {})}
        >
          <PickedHeadContext.Provider value={headSlot}>
            <ThumbLayerContext.Provider value={thumbLayer}>{bodies[page]}</ThumbLayerContext.Provider>
          </PickedHeadContext.Provider>
        </div>
      </div>
      {/* 🥞 The thumb host: a page's floating row lands HERE, inside this screen's layer (not on <body> under it). */}
      <div ref={setThumbHost} data-picked-thumb-layer="" />
    </div>
    </PickedNavContext.Provider>
  );

  // Drawn on <body> once it exists (the first frame is drawn in place, so server HTML and first paint agree).
  return host ? createPortal(screen, host) : screen;
}
