'use client';

/**
 * 🗂 THE PICKED CLIENT (THE ONE BUILD, 8 Nov 2026 · prototype v113, B1 step 5). OWNER: L2.
 *
 * One screen over the still-mounted Clients list: the pinned row (the client's name · ⚙ · ✕), the nine-page menu
 * (Details · Chat · Schedule · Quotation · Payment · Forms · Files · Hub · Report — Payment and Hub once booked) and
 * ONE page body at a time. It replaces the flag-ON `RelationshipTabShell` branch of `clients/[eventId]/page.tsx`;
 * the flag-OFF card is untouched.
 *
 * ── HOW IT SWITCHES ──────────────────────────────────────────────────────────────────────────────────────────
 * Every body is already rendered on the server (`_pages/switch.tsx`); a menu tap swaps which one shows and writes
 * `?tab=<page>` with `history.replaceState` — the same mechanism `RelationshipTabShell` used, so a page switch costs
 * NO request (B1 §8 M5).
 *
 * ── HOW IT OPENS AND CLOSES ──────────────────────────────────────────────────────────────────────────────────
 * From the list (a soft tap, drawn in the `@client` slot over the list): it rises from the tapped row in 520 ms and
 * ✕ is the exact reverse into the same row, then `router.back()` — the list never re-renders, so its scroll stays.
 * From anywhere else (hard load, Today, a notification): it is simply there, and ✕ goes to the Clients list.
 * Reduced motion: a 120 ms fade both ways. (`picked-client-motion.ts`; L1's shared primitive replaces the numbers.)
 *
 * ── LAYERS (spec §10 #23: page < thumb row < bottom nav < pop-ups/sheets) ──────────────────────────────────────
 * The picked client covers the bottom nav (v113: no bar while a client is open), so it is a pop-up layer:
 * `--sn-z-pop` (L1's token, 40: over the thumb row and the bar, under a `Sheet` at `--sn-z-modal`), drawn on <body> like `Sheet`, so no
 * page stacking context can trap it under the bar.
 * 🥞 Which is why a page's OWN thumb row (Schedule's "My times · + My moment", Payment, Forms, Hub, Report —
 * `SupplierThumbRow`) must not go to <body> at z 25: it would sit UNDER this screen and no tap reaches it (release
 * check, 8 Nov). The screen keeps a thumb host inside its own layer — after the page body, outside the sliding page —
 * and hands it down through `ThumbLayerContext`; the row portals there. 🔒 ../the-thumb-row-floats-over-the-picked-client.test.ts
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  Flag,
  FolderOpen,
  Info,
  LayoutDashboard,
  MessageSquare,
  ReceiptText,
  Wallet,
  X,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { usePortalHost } from '@/lib/use-portal-host';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { PickedClientPage } from './picked-client-menu';
import { SCRIPT_FOLD_ID } from './picked-client-menu';
import { PickedNavContext, type PickedNav } from './picked-client-nav';
import { ThumbLayerContext, type ThumbLayer } from '../../../_components/thumb-layer';
import { warmPickedPages } from '../_pages/lazy';
import { warmThreadParts } from '../../../messages/[threadId]/_components/on-demand';
import { warmHubParts } from '../../../on-the-day/_components/on-demand';

/** Every non-Details page's code (Chat · Quotation · the thread's parts, Hub, Forms · Files · Payment · Report). */
function warmEveryPage(): void {
  warmPickedPages();
  warmThreadParts();
  warmHubParts();
}
import {
  PICKED_EASE,
  PICKED_OPEN_MS,
  PICKED_PAGE_SLIDE_EASE,
  PICKED_PAGE_SLIDE_MS,
  forgetPickedOrigin,
  pickedMotion,
  prefersReducedMotion,
  readPickedOrigin,
  type PickedOrigin,
} from './picked-client-motion';
import { centreInStrip, pageSwipeStep } from '@/app/_components/centre-in-strip';

/** Where a body swipe may NOT start (it belongs to something that moves sideways itself, or to a field). */
const PAGE_SWIPE_SKIP = '[data-picked-menu],[data-calendar],[data-dates-week-strip],input,textarea,select,[contenteditable="true"],[data-no-page-swipe]';

const PAGE_ICON: Record<PickedClientPage, typeof Info> = {
  details: Info,
  chat: MessageSquare,
  schedule: CalendarDays,
  quote: ReceiptText,
  payments: Wallet,
  forms: ClipboardList,
  files: FolderOpen,
  hub: LayoutDashboard,
  report: Flag,
};

export const CLIENTS_LIST_HREF = '/vendor-dashboard/customers';

export function PickedClientShell({
  eventId,
  eventName,
  menu,
  initialPage,
  bodies,
  scrollToScript = false,
  settingsLine,
  settings,
}: {
  eventId: string;
  eventName: string;
  /** The menu this client's stage shows, in order (`pickedMenuFor`). */
  menu: { id: PickedClientPage; label: string }[];
  /** The page the URL names, resolved on the server (`visiblePickedPage`) so the first paint is the right page. */
  initialPage: PickedClientPage;
  bodies: Record<PickedClientPage, ReactNode>;
  /** `?tab=script` — land on Schedule scrolled to the Script fold. */
  scrollToScript?: boolean;
  /** The ⚙ sheet's one line. */
  settingsLine: { line: string; tip: string };
  /** The ⚙ sheet's rows (shipped facts only). */
  settings: ReactNode;
}) {
  const router = useRouter();
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // 🥞 The page rows' floor (host) and the column they span from 701 (the pinned row's column — it never slides).
  const [thumbHost, setThumbHost] = useState<HTMLDivElement | null>(null);
  const [thumbColumn, setThumbColumn] = useState<HTMLDivElement | null>(null);
  const thumbLayer = useMemo<ThumbLayer>(() => ({ host: thumbHost, column: thumbColumn }), [thumbHost, thumbColumn]);
  const [page, setPage] = useState<PickedClientPage>(initialPage);
  const [gearOpen, setGearOpen] = useState(false);
  const originRef = useRef<PickedOrigin | null>(null);
  const closingRef = useRef(false);
  const headingId = useId();
  const eventPath = `/vendor-dashboard/clients/${eventId}`;

  // The URL may name a page the server could not see (a hash, a client-side replace) — read it once after mount.
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t && t !== page && menu.some((m) => m.id === t)) setPage(t as PickedClientPage);
    } catch {
      /* keep the server's page */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🎬 OPEN — rise from the tapped row (or a fade), once, before the first paint after the portal lands.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !host) return;
    originRef.current = readPickedOrigin(eventPath);
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
      if (ric) idle = ric(warmEveryPage);
      else warmEveryPage();
    }, PICKED_OPEN_MS);
    return () => {
      window.clearTimeout(t);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && cic) cic(idle);
    };
  }, [host]);

  // `?tab=script` → Schedule, scrolled to the Script fold.
  useEffect(() => {
    if (!scrollToScript || page !== 'schedule') return;
    const t = window.setTimeout(() => {
      document.getElementById(SCRIPT_FOLD_ID)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, prefersReducedMotion() ? 0 : PICKED_OPEN_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (id: PickedClientPage) => {
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
      else router.push(CLIENTS_LIST_HREF);
    };
    if (!el) return leave();
    // The SAME frames and timing as the open, played backwards — the exact reverse, easing included.
    const m = pickedMotion(origin);
    if (!m) return leave();
    const anim = el.animate(m.frames, { ...m.timing, direction: 'reverse', fill: 'forwards' });
    anim.onfinish = leave;
  }, [router]);

  // The house modal contract (`useModalA11y`): focus moves in, Tab stays inside, Esc closes — and only the TOPMOST layer
  // answers Esc, so with the ⚙ sheet (or any sheet a page opens) on top, Esc peels that layer, not the client. Armed once
  // the screen is on <body> (`host`): the first frame is drawn in place, then remounted into the portal. Page scroll is
  // left alone (`lockScroll: false`) — the screen is fixed full-height with its own scroller, as before.
  useModalA11y({ open: Boolean(host), onClose: close, containerRef: rootRef, lockScroll: false });

  // A ⚙ row or a link inside a page switches pages the same way the menu does (and closes the ⚙ sheet first).
  const nav = useMemo<PickedNav>(
    () => ({
      page,
      select: (id) => {
        setGearOpen(false);
        select(id);
      },
    }),
    [page, select],
  );

  const screen = (
    <PickedNavContext.Provider value={nav}>
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-picked-client={eventId}
      className="fixed inset-0 flex h-[100dvh] flex-col bg-cream text-ink"
      style={{ zIndex: 'var(--sn-z-pop)' }}
    >
      {/* 📌 The pinned row: the client · ⚙ · ✕ (v113). No hard line under it — the menu's ground carries on. */}
      <div className="shrink-0 bg-[rgb(var(--color-cream))] pt-[env(safe-area-inset-top)]">
        <div ref={setThumbColumn} className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pt-2" data-picked-pin="">
          <h1 id={headingId} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink" data-pin-word="">
            {eventName}
          </h1>
          {/* ⚙ This client's own settings — not Clients ⚙ (that menu is mounted once, on the list). The house door
              (`MenuSettingsButton`) on the `client` key (L1, `lib/menu-settings.ts`); its rows are this page's own. */}
          <MenuSettingsButton menu="client" open={gearOpen} onOpenChange={setGearOpen} line={settingsLine}>
            {settings}
          </MenuSettingsButton>
          <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={close} data-testid="picked-close" />
        </div>
        {/* 🗂 The nine-page menu — icon over word, the picked one framed (it is the one you pressed). */}
        <div
          ref={menuRef}
          role="tablist"
          aria-label={`${eventName} pages`}
          className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-3 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-picked-menu=""
        >
          {menu.map((m) => {
            const Icon = PAGE_ICON[m.id];
            const on = m.id === page;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`picked-tab-${m.id}`}
                aria-selected={on}
                aria-controls="picked-page"
                data-picked-page={m.id}
                onClick={() => select(m.id)}
                className={`flex min-h-[48px] min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry ${
                  on
                    ? 'border border-[rgb(var(--color-terracotta-700,154_98_52))] bg-white text-[rgb(var(--color-terracotta-700,154_98_52))]'
                    : 'border border-transparent text-ink/80'
                }`}
              >
                <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.6} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [overscroll-behavior-x:none] bg-white" data-picked-body="">
        <div
          id="picked-page"
          role="tabpanel"
          aria-labelledby={`picked-tab-${page}`}
          className="mx-auto w-full max-w-3xl px-4 pb-[max(calc(env(safe-area-inset-bottom)+24px),var(--sn-thumb-room,0px))] pt-3"
          data-picked-page-body={page}
        >
          <ThumbLayerContext.Provider value={thumbLayer}>{bodies[page]}</ThumbLayerContext.Provider>
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
