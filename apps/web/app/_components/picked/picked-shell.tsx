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
 * From a list (a soft tap, drawn in the list's intercepting slot over it): it rises from the tapped row in 700 ms and
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
 * ── THE CHAT AS HOME, AND A PAGE BESIDE IT (a side that asks: `chatHome`) ─────────────────────────────────────────
 * With `chatHome` the chat is the one body and every other page RISES over it (`RiseScreen`) on a phone. With
 * `chatHome.pane` (Unichat part G, owner 20 Nov 2026) a computer does the same thing sideways: the page opens in its
 * own 420 px column on the right with its own ←, the chat narrows by exactly that and is never covered, and opening
 * another page replaces the one there. ⋯ (`chatHome.more`, `PickedMoreRow`) holds the places the chat's own strip does
 * not open — a page, a page of its own that is not a tab, a place elsewhere, a file.
 *
 * 🔒 vendor-dashboard/customers/the-picked-client-opens-over-the-list.test.ts · app/_components/picked/one-picked-shell.test.ts
 *    · vendor-dashboard/clients/[eventId]/the-more-menu-holds-places-to-go.test.ts
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { onItsOwnLayer } from '@/lib/rise-layer';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, Search, X, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { usePortalHost } from '@/lib/use-portal-host';
import { keepLayerMark } from '@/lib/use-back-closes';
import { useOneOpen } from '@/lib/one-open';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { RiseScreen, useRiseClose } from '@/app/_components/rise/rise-screen';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { EASE_SETTLE, MOVE_MS, QUICK_MS } from '@/lib/motion-table';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { formatCount } from '@/lib/format-number';
import { nextPanelTabId, PICKED_CHAT_SEARCH_EVENT, PickedCoveredContext, PickedHeadContext, PickedHeadLineContext, PickedNavContext, type PickedShellNav } from './picked-nav';
import { pickedPageFromUrl } from './picked-url-page';
import { ThumbLayerContext, type ThumbLayer } from '@/app/vendor-dashboard/_components/thumb-layer';
import {
  PICKED_OPEN_MS,
  PICKED_PAGE_SLIDE_EASE,
  PICKED_PAGE_SLIDE_MS,
  forgetPickedOrigin,
  pickedCloseStep,
  pickedMotion,
  prefersReducedMotion,
  readPickedOrigin,
  type PickedOrigin,
} from './picked-motion';
import { centreInStrip, pageSwipeStep } from '@/app/_components/centre-in-strip';

/** Where a body swipe may NOT start (it belongs to something that moves sideways itself, or to a field). */
const PAGE_SWIPE_SKIP = '[data-picked-menu],[data-calendar],[data-dates-week-strip],input,textarea,select,[contenteditable="true"],[data-no-page-swipe]';

/**
 * ⋯ ONE ROW BEHIND THE HEAD'S MORE (Unichat part G, owner 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19, "⋯ holds
 * places to go"). A bare page id is that page under its tab's own word and icon. Anything else names its own word and
 * icon and is ONE of: a menu page under other words (`page`), a page of its own that is not a tab (`body` — a trade
 * page: the Song list, the Script), a place elsewhere in the app (`href`), or a file to keep (`file`). `heading` is the
 * small label drawn above the row ("For your trade").
 */
export type PickedMoreItem<P extends string> = { id: string; label: string; icon: LucideIcon; heading?: string } & (
  | { page: P }
  | { body: ReactNode }
  | { href: string }
  | { file: { href: string; filename: string } }
);
export type PickedMoreRow<P extends string> = P | PickedMoreItem<P>;

/** 🖥 The page column beside the chat on a computer (drawing: the third column, 420 px; the chat narrows, never covered). */
const PANE_OUT_MS = MOVE_MS * 0.8;

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
  /** 🔦 A spotlight stop on a menu tab (`data-tour`), per page — the supplier tour's Chat and Quotation stops. */
  tours?: ReadonlyArray<{ id: P; tour: string }>;
  /** The side's own reading of a raw `?tab=` / legacy `#hash` (its alias table); absent = the page ids only. */
  pageOf?: (raw: string) => P | null;
  /**
   * ‹ A NAMED WAY BACK beside ✕ (owner rule "never lose the back button", DECISION_LOG 17 Nov). The SAME close, drawn
   * as icon + word ("‹ Calendar"). CSS decides which one shows (`data-picked-close-as` is hidden unless a page's own
   * rule shows it, as Clients does on a computer, `supplier-frame.css`). Absent = only today's ✕, unchanged: the couple
   * side never passes it.
   */
  closeAs?: { label: string; icon: LucideIcon } | null;
  /**
   * 🖥 CHAT STAYS OPEN ON A COMPUTER (owner 18 Nov 2026, DECISION_LOG "THE CLIENT PAGE GOES TO SEVEN TABS — BOTH SIDES":
   * *"we want chat to stay active on desktop view and the other screens will cater other parts"*). From 1024 px `page`
   * leaves the menu and is drawn in its own right column (work 592 · gap 24 · chat 360; from 1280 work 564 · gap 28 ·
   * chat 400); the other tabs switch the work column beside it, which opens on `workDefault` unless a `?tab=` names
   * another page. Under 1024 nothing changes: one column, Chat the first tab. Absent = one column everywhere.
   */
  sideChat?: { page: P; workDefault: P } | null;
  /** ➡ A row pinned on top of the chat page (the supplier's Next step), wherever the chat is drawn. */
  chatTop?: ReactNode;
  /**
   * ⋯ Rows behind the head's More for a side WITHOUT `chatHome` (the host's picked supplier, which keeps its tabs until
   * its own build): shown at every width. Only `page` · `href` · `file` rows — a page of its own (`body`) needs the chat
   * as home to open over. With `chatHome`, its own `more` is the list and this is ignored.
   */
  more?: readonly PickedMoreRow<P>[];
  /**
   * 🔎 The magnifier in the head, while the chat page is on show (drawing UNICHAT-LIVE: search sits in the chat header,
   * which is this shell). It only ASKS the chat to open its own search (`PICKED_CHAT_SEARCH_EVENT`, `picked-nav.ts`).
   * Off unless a side passes its chat page — and no side should until the chat listens (part D's file).
   */
  headSearch?: { page: P } | null;
  /** The part of its page a door id lands on (`payments` → `#payments` on Book & Budget); absent = the page's top. */
  anchorOf?: (raw: string) => string | null;
  /**
   * 💬 THE PAGE IS ITS CHAT (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING":
   * *"can you make it live just as a chat but everything is inside that chat?"*). On a phone `page` is ALWAYS drawn and
   * the menu row is gone: any other page RISES full screen over it (the one `RiseScreen`), so closing it lands on the
   * same chat scroll — the chat never unmounted. The title opens `titleOpens`; the pages in `more` sit behind the head's
   * ⋯. Every `?tab=` door still works: it opens the chat with that page risen.
   * 🖥 From 1024 px nothing changes (owner 18 Nov: the chat keeps its own column, the tabs switch the work beside it).
   * Absent = today's tabs everywhere (the host's picked supplier, until its own build).
   */
  chatHome?: {
    page: P;
    line: string;
    titleOpens: P;
    more: readonly PickedMoreRow<P>[];
    /** 🔦 A tour stop on the title (`data-tour`). */
    titleTour?: string;
    /**
     * 🖥 ON A COMPUTER A PAGE OPENS IN ITS OWN COLUMN BESIDE THE CHAT (owner 20 Nov 2026, drawing UNICHAT-LIVE: "The
     * opened page covered half the chat on a computer. Now it is its own third column; the chat narrows."). With this
     * on there is no tab row and no work column at any width: the chat is the page, ⋯ shows on a computer too, and a
     * page (or a ⋯ page of its own) opens in a right-hand column with its own ←. Opening another one replaces it.
     */
    pane?: boolean;
  } | null;
};

/** 🖥 The width from which the chat keeps its own column (`sideChat`). */
const SIDE_CHAT_QUERY = '(min-width: 1024px)';
/** The two columns' frame: 592 + 24 + 360 = 976 from 1024; 564 + 28 + 400 = 992 from 1280 (drawing v12 §4). */
// 🖥 The frame from 1024 px when Chat has its own column — said in CSS (`lg:`/`xl:`), so the server's first paint is
// already the computer's layout and nothing moves when the page wakes (owner review, 19 Nov 2026).
const NARROW_FRAME = 'mx-auto w-full max-w-3xl';
const WIDE_FRAME = 'mx-auto w-full max-w-3xl lg:max-w-[976px] xl:max-w-[992px]';

/** The menu's edge fade per side that has more pages past it — the pinned row's door-strip mask, both ways. */
const MENU_FADE = {
  none: '',
  right: '[-webkit-mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]',
  left: '[-webkit-mask-image:linear-gradient(to_left,black_calc(100%-32px),transparent)] [mask-image:linear-gradient(to_left,black_calc(100%-32px),transparent)]',
  both: '[-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)] [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]',
} as const;

/**
 * Bring a part of the shown page (`#payments`, `#forms`, the Script fold) to the top of the page's OWN scroller —
 * vertical only. Never `scrollIntoView`: it also moved the body sideways (§10 #26). One path for a `?tab=` landing and
 * for an in-page door (`nav.select`).
 */
function scrollToPart(id: string): boolean {
  const part = id ? document.getElementById(id) : null;
  // A page risen over the chat scrolls inside the rise screen's own body.
  const scroller = part?.closest<HTMLElement>('[data-picked-body],[data-rise-body]');
  if (!part || !scroller) return false;
  const top = part.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  return true;
}

/** The risen page's ✕, handed up: a door back to the chat closes the screen the way its own ✕ does (the same fall). */
function RiseCloser({ into }: { into: { current: (() => void) | null } }) {
  const close = useRiseClose();
  useEffect(() => {
    into.current = close;
    return () => {
      if (into.current === close) into.current = null;
    };
  }, [close, into]);
  return null;
}

/** `#deposit` → `deposit`; a malformed escape is simply not a part. */
function hashId(hash: string): string {
  const raw = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

const NO_MORE_ROWS: readonly never[] = [];

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
  tours = [],
  pageOf,
  closeAs = null,
  sideChat = null,
  chatTop = null,
  more = NO_MORE_ROWS,
  headSearch = null,
  anchorOf,
  chatHome = null,
}: PickedShellProps<P>) {
  const router = useRouter();
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // ➡ THE MENU SAYS WHEN IT SCROLLS (owner screenshot 17 Nov: "Hub · R…" clipped, no cue): a side with more pages past it
  // fades out, as the pinned row's door strip does (`pinned-row/pin-doors.tsx`). Measured on scroll and resize.
  const [menuMore, setMenuMore] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setMenuMore((was) => (was.left === left && was.right === right ? was : { left, right }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [host]);
  // 🥞 The page rows' floor (host) and the column they span from 701 (the pinned row's column — it never slides).
  const [thumbHost, setThumbHost] = useState<HTMLDivElement | null>(null);
  const [thumbColumn, setThumbColumn] = useState<HTMLDivElement | null>(null);
  const thumbLayer = useMemo<ThumbLayer>(() => ({ host: thumbHost, column: thumbColumn }), [thumbHost, thumbColumn]);
  const [page, setPage] = useState<P>(initialPage);
  // 🖥 On a computer the chat keeps its own column; read after mount (the server and the first paint draw the phone).
  const [wide, setWide] = useState(false);
  const sideChatPage = sideChat?.page ?? null;
  // 🖥 The chat keeps the whole page and a page opens in a column beside it (`chatHome.pane`) — no work column then.
  const panes = chatHome?.pane === true;
  useEffect(() => {
    if ((!sideChatPage && !panes) || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(SIDE_CHAT_QUERY);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [sideChatPage, panes]);
  const split = wide && sideChat !== null && !panes;
  const paneOn = wide && panes;
  // 💬 The chat is home (`chatHome`): once the page is awake on a phone, the chat is the one body and any other page
  // rises over it. Before that (the server's paint, a computer) the page is drawn where it always was.
  const [awake, setAwake] = useState(false);
  useEffect(() => setAwake(true), []);
  const homePage = chatHome?.page ?? null;
  const rises = homePage !== null && awake && !split;
  const risenPage: P | null = rises && page !== homePage ? page : null;
  const riseCloseRef = useRef<(() => void) | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useOneOpen(moreOpen, setMoreOpen); // one open at a time — lib/one-open.ts
  const moreMenuId = useId();
  const moreButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const closeMore = useCallback(() => {
    setMoreOpen(false);
    moreButtonRef.current?.focus();
  }, []);
  // ⌨ The menu's keys (WAI-ARIA menu): it opens with its first row focused; ↓ / ↑ step, Home / End jump, Esc closes
  // back onto ⋯ (`escClose` below — the screen's own Esc must not close the whole client too).
  useEffect(() => {
    if (moreOpen) moreMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [moreOpen]);
  const onMoreKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(moreMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const at = items.indexOf(document.activeElement as HTMLElement);
      const go = (i: number) => items[(i + items.length) % items.length]?.focus();
      if (e.key === 'Tab') return setMoreOpen(false);
      if (e.key === 'ArrowDown') go(at + 1);
      else if (e.key === 'ArrowUp') go(at - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(items.length - 1);
      else return;
      e.preventDefault();
    },
    [],
  );
  // ⋯ A page of its own (a trade page — not a tab, so not a `?tab=`): the one that is open, by its row id.
  const [extraId, setExtraId] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const paneHeadingId = useId();
  const [risenThumbHost, setRisenThumbHost] = useState<HTMLDivElement | null>(null);
  const risenThumbLayer = useMemo<ThumbLayer>(() => ({ host: risenThumbHost, column: risenThumbHost }), [risenThumbHost]);
  // The page the work column draws: on a computer the chat is never it (it has its own column).
  const workPage: P = rises ? homePage! : split && page === sideChat!.page ? sideChat!.workDefault : page;
  const shownMenu = useMemo(() => (split ? menu.filter((m) => m.id !== sideChatPage) : menu), [split, menu, sideChatPage]);
  // ⋯ Only pages this menu really has (Hub before booking is not one).
  // A row that names a menu page shows only while the menu has that page; a row with no page behind it always shows.
  const moreMenu = useMemo(
    () =>
      (chatHome ? chatHome.more : more).flatMap((row): PickedMoreItem<P>[] => {
        if (typeof row === 'string') {
          const m = menu.find((x) => x.id === row);
          return m ? [{ id: m.id, label: m.label, icon: icons[m.id], page: m.id }] : [];
        }
        // A page of its own opens over the chat as home — without `chatHome` there is nowhere for it to open.
        if ('body' in row && !chatHome) return [];
        return 'page' in row && !menu.some((m) => m.id === row.page) ? [] : [row];
      }),
    [chatHome, more, menu, icons],
  );
  const extra = useMemo(() => {
    const row = extraId === null ? undefined : moreMenu.find((r) => r.id === extraId);
    return row && 'body' in row ? row : null;
  }, [extraId, moreMenu]);
  const [gearOpen, setGearOpen] = useState(false);
  const [headSlot, setHeadSlot] = useState<HTMLSpanElement | null>(null);
  const [headLineSlot, setHeadLineSlot] = useState<HTMLSpanElement | null>(null);
  // The pages opened in this visit — their badge has been seen (the page itself marks the read on the server side).
  const [seen, setSeen] = useState<ReadonlySet<P>>(() => new Set([initialPage]));
  useEffect(() => {
    setSeen((was) => (was.has(page) ? was : new Set([...was, page])));
  }, [page]);
  // 🖥 On a computer the Chat tab is not in the menu, so its unread count is drawn on the Chat column's own heading.
  /* 🖥 Its own flag, not `seen`: `seen` is seeded with the landing page, and the landing page defaults to Chat — so on a
     computer the column's count would read 0 on every plain visit while messages wait. Only opening the chat clears it. */
  const [chatOpened, setChatOpened] = useState(false);
  const chatUnread = sideChat && !chatOpened ? (badges[sideChat.page] ?? 0) : 0;
  const markChatSeen = useCallback(() => {
    if (!sideChatPage) return;
    setChatOpened(true);
    setSeen((was) => (was.has(sideChatPage) ? was : new Set([...was, sideChatPage])));
  }, [sideChatPage]);
  const originRef = useRef<PickedOrigin | null>(null);
  const closingRef = useRef(false);
  const headingId = useId();

  // The URL may name a page the server could not see (a legacy `#payments`, a client-side replace) — read it once
  // after mount. `?tab=` wins; a hash only when there is no `?tab=`, and then the URL is rewritten to `?tab=`.
  useEffect(() => {
    try {
      const found = pickedPageFromUrl<P>(window.location.search, window.location.hash, menu.map((m) => m.id), pageOf);
      // 🔗 The part the URL's HASH names (review, 19 Nov 2026). An old `#forms` / `#inspiration` link with no `?tab=`
      // lands on its part, not the top of Details (`anchorOf`); and with a `?tab=`, a hash is an element of that page
      // (`?tab=payments#deposit` → the deposit card), which outranks the tab's own part.
      const hash = hashId(window.location.hash);
      if (hash) hashPartRef.current = found?.fromHash ? (anchorOf?.(hash) ?? null) : found || new URLSearchParams(window.location.search).get('tab') ? hash : null;
      if (!found) return;
      if (found.page !== page) setPage(found.page);
      // A hash becomes `?tab=`, written with `null` like `select` below (walk 13 Nov 2026, F-W1-67/73).
      if (found.fromHash) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', found.page);
        url.hash = '';
        window.history.replaceState(null, '', url.toString());
      }
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
    if (m) onItsOwnLayer(el, el.animate(m.frames, m.timing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // 🎯 #36: the picked page sits in the MIDDLE of the menu strip — on a tap, a body swipe, a deep link and the first
  // open (instant then, so the menu does not glide on arrival); at either end the strip stays at its end. ONLY the strip
  // scrolls (§10 #26: `scrollIntoView` also moved the page body sideways), and the body is put back if it ever moved.
  const centredOnce = useRef(false);
  const hashPartRef = useRef<string | null>(null);
  useEffect(() => {
    const strip = menuRef.current;
    const first = !centredOnce.current;
    if (centreInStrip(strip, strip?.querySelector<HTMLElement>(`[data-picked-page="${workPage}"]`) ?? null, first) !== null) centredOnce.current = true;
    if (bodyRef.current?.scrollLeft) bodyRef.current.scrollLeft = 0;
  }, [workPage, host]);

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

  // `scrollTo` (a `?tab=` that names a part: the Script fold, the payments, the Forms) — the SAME path as `nav.select`.
  // It waits for the portal (`host`): the first frame is drawn in place and then moved onto <body>, and a scroll made
  // on the in-place frame is thrown away with it (measured 19 Nov 2026 — `?tab=forms` opened Details at its top).
  useEffect(() => {
    if (!host) return;
    const fromHash = hashPartRef.current;
    const fromTab = scrollTo && workPage === scrollTo.page ? scrollTo.id : null;
    if (!fromHash && !fromTab) return;
    const t = window.setTimeout(() => {
      // The hash's own part first; if the page has no such element, the tab's part (never nothing).
      if (!(fromHash && scrollToPart(fromHash)) && fromTab) scrollToPart(fromTab);
    }, prefersReducedMotion() ? 0 : PICKED_OPEN_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const fills = fillPages.includes(workPage);
  const frame = sideChat && !panes ? WIDE_FRAME : NARROW_FRAME;
  // Before the page wakes on a computer, the server's frame has no second column yet: a Chat landing is drawn where the
  // Chat column will be (right, 360/400), any other page where the work column will be — so nothing jumps on wake.
  const chatAlone = sideChat !== null && !split && page === sideChat.page;
  const workWidth = !sideChat || panes
    ? 'flex-1'
    : chatAlone
      ? 'flex-1 lg:ml-auto lg:w-[360px] lg:flex-none xl:w-[400px]'
      : 'flex-1 lg:w-[592px] lg:flex-none xl:w-[564px]';
  const select = useCallback(
    (id: P) => {
      // ⋯ A page of its own is open: a door to the chat closes it the way its own ✕ does; any other door replaces it.
      if (extraId !== null) {
        if (rises && id === homePage) return riseCloseRef.current ? riseCloseRef.current() : setExtraId(null);
        setExtraId(null);
      }
      if (id === (rises ? page : workPage)) return;
      // 🖥 The chat is already open beside the work on a computer: a door to it leaves the work where it is.
      if (split && id === sideChatPage) return;
      // 💬 Back to the chat from a risen page: the screen closes the way its own ✕ does (`landHome` then tidies the URL).
      if (rises && id === homePage && riseCloseRef.current) return riseCloseRef.current();
      if (id === sideChatPage) setChatOpened(true);
      setPage(id);
      try {
        const url = new URL(window.location.href);
        // The chat is the page's plain address (one address per screen); any other page is `?tab=`.
        if (rises && id === homePage) url.searchParams.delete('tab');
        else url.searchParams.set('tab', id);
        url.hash = '';
        /* 🔗 THE ROUTER MUST HEAR THE TAB (walk 13 Nov 2026, F-W1-67/73: the supplier's card stayed `?tab=files`, the
           couple's workspace `?tab=schedule`, and a refresh opened the wrong page). `window.history.state` carries Next's
           `__NA` mark, and Next's patched replaceState passes such a write straight through WITHOUT telling the router —
           so the router kept the landing address, and the next refresh it drew (a chat poll, a server action's
           revalidation) wrote that address back. `null` is Next's documented way to change the URL: the router adopts it.
           (The Clients month keeps `window.history.state` on purpose — its taps race a pending fetch; a tab switch here
           sends no request. Details does the same as this, `lib/a-named-item-door-opens-its-item.test.ts` 6b.) */
        // A risen page holds a history entry of its own (the phone's Back closes it) — its mark rides along.
        window.history.replaceState(keepLayerMark(window.history.state), '', url.toString());
      } catch {
        /* a URL that cannot be written still shows the right page */
      }
      // 💬 The chat under a risen page never moves: no scroll to its top, no slide.
      if (rises) return;
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
    [workPage, split, sideChatPage, rises, page, homePage, extraId],
  );

  // 💬 The risen page has closed (✕, Esc, the phone's Back): the chat is the page again, at its plain address.
  const landHome = useCallback(() => {
    if (homePage === null) return;
    setPage(homePage);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* the chat still shows */
    }
  }, [homePage]);
  // ⋯ A page of its own opens over the chat (a phone) or in the column beside it (a computer) — it takes the place of
  // whatever page was open there, and that page's `?tab=` leaves the address with it.
  const openExtra = useCallback(
    (id: string) => {
      setGearOpen(false);
      setMoreOpen(false);
      if (homePage !== null && page !== homePage) landHome();
      setExtraId(id);
    },
    [homePage, page, landHome],
  );
  // 🖥 The column's own ←: out the way it came in, then the chat has the whole width again.
  const paneClosing = useRef(false);
  const closePane = useCallback(() => {
    if (paneClosing.current) return;
    const done = () => {
      paneClosing.current = false;
      if (extraId !== null) setExtraId(null);
      else landHome();
    };
    const el = paneRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return done();
    paneClosing.current = true;
    el.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(24px)', opacity: 0 }], { duration: PANE_OUT_MS, easing: EASE_SETTLE, fill: 'forwards' }).finished.then(done, done);
  }, [extraId, landHome]);
  // A second risen page (a door inside the first) starts at its own top.
  useEffect(() => {
    if (risenPage === null) return;
    rootRef.current?.ownerDocument.querySelector('[data-picked-risen]')?.closest('[data-rise-body]')?.scrollTo({ top: 0 });
  }, [risenPage]);

  // ⌨ Arrow keys step the menu one page by its id (the rule lives in `picked-nav.ts`); focus follows the pick.
  const ids = useMemo(() => shownMenu.map((m) => m.id), [shownMenu]);
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
      // 💬 With the chat as home on a phone there is no row of pages to step through: a swipe turns nothing.
      on = !(homePage !== null && !split) && !!t && !t.closest(PAGE_SWIPE_SKIP) && e.touches.length === 1;
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
      const i = shownMenu.findIndex((m) => m.id === workPage);
      const next = shownMenu[i + step];
      if (i >= 0 && next) select(next.id);
    };
    body.addEventListener('touchstart', start, { passive: true });
    body.addEventListener('touchend', end, { passive: true });
    return () => {
      body.removeEventListener('touchstart', start);
      body.removeEventListener('touchend', end);
    };
  }, [shownMenu, workPage, select, host, homePage, split]);

  // ✕ — the exact reverse of the open, then back to the list (or to it, on a hard load).
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const el = rootRef.current;
    const origin = originRef.current;
    const leave = () => {
      forgetPickedOrigin();
      if (pickedCloseStep(origin, window.history.length) === 'back') router.back();
      else router.push(closeHref);
    };
    if (!el) return leave();
    // The SAME frames and timing as the open, played backwards — the exact reverse, easing included.
    const m = pickedMotion(origin);
    if (!m) return leave();
    const anim = onItsOwnLayer(el, el.animate(m.frames, { ...m.timing, direction: 'reverse', fill: 'forwards' }));
    anim.onfinish = leave;
  }, [router, closeHref]);

  // The house modal contract (`useModalA11y`): focus moves in, Tab stays inside, Esc closes — and only the TOPMOST layer
  // answers Esc, so with the ⚙ sheet (or any sheet a page opens) on top, Esc peels that layer, not the client. Armed once
  // the screen is on <body> (`host`): the first frame is drawn in place, then remounted into the portal. Page scroll is
  // left alone (`lockScroll: false`) — the screen is fixed full-height with its own scroller, as before.
  // ⋯ Esc peels ONE layer: with the More menu open it closes the menu (back onto ⋯), never the whole client under it.
  const escClose = useCallback(() => (moreOpen ? closeMore() : close()), [moreOpen, closeMore, close]);
  useModalA11y({ open: Boolean(host), onClose: escClose, containerRef: rootRef, lockScroll: false });

  // A ⚙ row or a link inside a page switches pages the same way the menu does (and closes the ⚙ sheet first).
  // A folded id (`payments`, `forms`) is read by the side's own `pageOf`, and lands on its part (`anchorOf`).
  const nav = useMemo<PickedShellNav>(
    () => ({
      // 💬 Inside a risen page, the page is that one (its own doors must not think they are on the chat).
      page: risenPage ?? workPage,
      select: (id: string) => {
        setGearOpen(false);
        setMoreOpen(false);
        const target = menu.some((m) => m.id === id) ? (id as P) : (pageOf?.(id) ?? null);
        if (!target || !menu.some((m) => m.id === target)) return;
        select(target);
        const anchor = anchorOf?.(id) ?? null;
        // Two frames: the switched page is drawn before it is scrolled to its part (no timer, no new motion value).
        if (anchor) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              scrollToPart(anchor);
            }),
          );
          // 💬 A page that RISES is drawn in place first and then moved onto <body>; a scroll made on the first frame
          // is thrown away with it (the same reason `scrollTo` above waits) — so the part is found again once it lands.
          if (rises) window.setTimeout(() => scrollToPart(anchor), prefersReducedMotion() ? 60 : PICKED_OPEN_MS);
        }
      },
    }),
    [workPage, select, menu, pageOf, anchorOf, rises, risenPage],
  );
  // 🥞 On a computer the page rows span the work column, not the whole frame (the chat column has none).
  const bodyRefCb = useCallback(
    (el: HTMLDivElement | null) => {
      bodyRef.current = el;
      if (split) setThumbColumn(el);
    },
    [split],
  );
  const chatTopRow = chatTop ? <div className="shrink-0" data-picked-chat-top="">{chatTop}</div> : null;
  // 🖥 What the column beside the chat holds: a ⋯ page of its own, else the page the address names. One at a time.
  const paneKey = !paneOn ? null : extra ? `more:${extra.id}` : risenPage;
  const paneTitle = extra ? extra.label : (menu.find((m) => m.id === risenPage)?.label ?? title);
  const paneWas = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = paneRef.current;
    const was = paneWas.current;
    paneWas.current = paneKey;
    if (!el || paneKey === null || was === paneKey || prefersReducedMotion() || typeof el.animate !== 'function') return;
    // In from the side at Move; a page that REPLACES the one open only cross-fades (the column itself never moved).
    if (was === null) el.animate([{ transform: 'translateX(24px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: MOVE_MS, easing: EASE_SETTLE });
    else el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: QUICK_MS, easing: EASE_SETTLE });
    el.querySelector('[data-rise-body]')?.scrollTo({ top: 0 });
  }, [paneKey]);

  const screen = (
    <PickedNavContext.Provider value={nav}>
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-picked-client={pickedId}
      className="fixed inset-0 flex h-[100dvh] flex-col bg-cream text-ink outline-none transition-[padding] duration-sn-elem ease-sn motion-reduce:transition-none lg:data-[picked-pane-open]:pr-[420px]"
      style={{ zIndex: 'var(--sn-z-pop)' }}
      {...(paneKey !== null ? { 'data-picked-pane-open': '' } : {})}
    >
      {/* 📌 The pinned row: the client · ⚙ · ✕ (v113). No hard line under it — the menu's ground carries on. */}
      <div className="shrink-0 bg-[rgb(var(--color-cream))] pt-[env(safe-area-inset-top)]">
        <div ref={split ? undefined : setThumbColumn} className={`${frame} relative flex items-center gap-2 px-4 pt-2`} data-picked-pin="">
          <div className="min-w-0 flex-1">
            <h1 id={headingId} className="truncate text-[20px] font-bold leading-tight text-ink" data-pin-word="">
              {chatHome ? (
                // 💬 The name is the door to Details (drawing v3, screen 2) — the words are the press, so no frame.
                <button
                  type="button"
                  onClick={() => nav.select(chatHome.titleOpens)}
                  className="sn-press -my-1 inline-flex min-h-11 max-w-full items-center truncate text-left"
                  aria-label={`${title} · open ${menu.find((m) => m.id === chatHome.titleOpens)?.label ?? 'details'}`}
                  data-picked-title-door={chatHome.titleOpens}
                  data-tour={chatHome.titleTour}
                >
                  <span className="truncate">{title}</span>
                </button>
              ) : (
                title
              )}
            </h1>
            {/* 📅 The page's own line under the title (the supplier's Chat: their date · Free — CHAT-09); empty = gone. */}
            <span ref={setHeadLineSlot} className="block truncate text-[12.5px] leading-tight text-ink/70 empty:hidden" data-picked-head-line="" />
          </div>
          {/* 📞 🎥 📎 — the page on show draws its own head actions here (`PickedHeadContext`; v8.3 head row). */}
          <span ref={setHeadSlot} className="flex shrink-0 items-center gap-1.5 empty:hidden" data-picked-head-actions="" />
          {/* ⚙ This page's own settings — not the list's ⚙ (that menu is mounted once, on the list). The house door
              (`MenuSettingsButton`) on the `client` key (L1, `lib/menu-settings.ts`); its rows are this page's own. */}
          {/* ⋯ The places the strip does not open (drawing v3; part G, 20 Nov: trade pages · Files · Hub · Crew · calendar ·
              Report). On a phone always; on a computer too once pages open beside the chat (`pane` — no tab row there). */}
          {/* 🔎 The chat's search, asked for from the head (the slot — see `PICKED_CHAT_SEARCH_EVENT`). Only while the
              chat is on show; the event goes out inside the tap so the chat can focus its box in the same gesture. */}
          {headSearch && (workPage === headSearch.page || split) ? (
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Search}
              label="Search in this chat"
              onClick={() => window.dispatchEvent(new CustomEvent(PICKED_CHAT_SEARCH_EVENT, { detail: { pickedId } }))}
              data-testid="picked-head-search"
              data-picked-head-search=""
            />
          ) : null}
          {moreMenu.length > 0 ? (
            <span className={panes || !chatHome ? 'inline-flex shrink-0' : 'inline-flex shrink-0 lg:hidden'} data-picked-more="">
              <ActionButton
                ref={moreButtonRef}
                tone="neutral"
                iconOnly
                icon={MoreHorizontal}
                label="More"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                data-testid="picked-more"
              />
              {/* ⋯ A MENU UNDER THE HEAD, AT ITS RIGHT (drawing UNICHAT-LIVE, `.menu.top`: 232 px, 8 px in from the right — the
                  pinned row is its anchor, so it sits at the corner even with ⚙ · ✕ after ⋯; plain rows, the
                  "For your trade" label) — places to go, the row itself is the press. Esc, a tap outside or a row closes it. */}
              {moreOpen ? (
                <>
                  {/* The scrim sits above the thumb row (`--sn-z-thumb`), so the composer dims under it as drawn; the menu one up. */}
                  <OverlayBackdrop onClose={closeMore} tabIndex={-1} className="z-[var(--sn-z-nav)]" data-picked-more-scrim="" />
                  <div
                    ref={moreMenuRef}
                    id={moreMenuId}
                    role="menu"
                    aria-label={`More for ${title}`}
                    onKeyDown={onMoreKey}
                    className="absolute right-2 top-full z-[var(--sn-z-pop)] mt-1 w-[232px] origin-top-right sn-frame sn-frame-flush py-1 motion-safe:animate-[sn-peek-in_var(--sn-dur-elem)_var(--sn-ease)_backwards]"
                    data-picked-more-menu=""
                  >
                    {moreMenu.map((m) => {
                      const Icon: LucideIcon = m.icon;
                      // One look for a page, a page of its own, a place and a file (drawing `.li`: 18 px ink-2 icon, words).
                      const row = 'flex min-h-11 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold text-ink hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none';
                      const inner = (
                        <>
                          <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-[color:var(--m-slate-2)]" strokeWidth={1.9} />
                          <span className="min-w-0 flex-1 truncate">{m.label}</span>
                        </>
                      );
                      return (
                        <div key={m.id} role="none">
                          {m.heading ? (
                            <p role="presentation" className="px-4 pt-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--m-slate-2)]" data-picked-more-heading="">
                              {m.heading}
                            </p>
                          ) : null}
                          {'page' in m ? (
                            <button type="button" role="menuitem" onClick={() => { closeMore(); nav.select(m.page); }} className={row} data-picked-more-row={m.id}>
                              {inner}
                            </button>
                          ) : 'body' in m ? (
                            <button type="button" role="menuitem" onClick={() => openExtra(m.id)} className={row} data-picked-more-row={m.id}>
                              {inner}
                            </button>
                          ) : 'href' in m ? (
                            <Link href={m.href} role="menuitem" onClick={() => setMoreOpen(false)} className={row} data-picked-more-row={m.id}>
                              {inner}
                            </Link>
                          ) : (
                            <SaveFileLink href={m.file.href} filename={m.file.filename} role="menuitem" className={row} onSaved={() => setMoreOpen(false)} data-picked-more-row={m.id}>
                              {inner}
                            </SaveFileLink>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </span>
          ) : null}
          {gear ? (
            <MenuSettingsButton menu="client" rise open={gearOpen} onOpenChange={setGearOpen} line={gear.line}>
              {gear.node}
            </MenuSettingsButton>
          ) : null}
          {closeAs ? (
            <ActionButton tone="neutral" icon={closeAs.icon} label={closeAs.label} onClick={close} data-testid="picked-close-as" data-picked-close-as="" />
          ) : null}
          <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={close} data-testid="picked-close" />
        </div>
        {/* 🗂 The page menu — icon over word, the picked one framed (it is the one you pressed). */}
        <div
          ref={menuRef}
          role="tablist"
          aria-label={`${title} pages`}
          className={`${frame} ${chatHome ? (panes ? 'hidden' : 'hidden lg:flex') : 'flex'} gap-0.5 overflow-x-auto px-4 pb-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${MENU_FADE[menuMore.left ? (menuMore.right ? 'both' : 'left') : menuMore.right ? 'right' : 'none']}`}
          data-picked-menu=""
          data-picked-menu-more={menuMore.left ? (menuMore.right ? 'both' : 'left') : menuMore.right ? 'right' : undefined}
        >
          {shownMenu.map((m) => {
            const Icon: LucideIcon = icons[m.id];
            const on = m.id === workPage;
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
                data-tour={tours.find((t) => t.id === m.id)?.tour}
                tabIndex={on ? 0 : -1}
                onClick={() => select(m.id)}
                onKeyDown={(e) => onKeyDown(e, m.id)}
                className={`relative grid min-h-[48px] min-w-[66px] shrink-0 justify-items-center gap-[3px] rounded-xl px-1.5 pb-1.5 pt-[7px] text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry ${sideChat && m.id === sideChat.page ? 'lg:hidden ' : ''}${
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
                    {count > 99 ? '99+' : formatCount(count)}
                    <span className="sr-only"> unread</span>
                  </small>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className={sideChat && !panes ? `contents ${WIDE_FRAME} lg:flex lg:min-h-0 lg:flex-1 lg:gap-6 xl:gap-7` : 'contents'} data-picked-columns={split ? 'work-chat' : undefined}>
      <div
        ref={bodyRefCb}
        className={`min-h-0 ${workWidth} overflow-x-hidden overscroll-contain [overscroll-behavior-x:none] bg-[color:var(--m-paper)] ${fills ? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'}`}
        data-picked-body=""
      >
        <div
          id="picked-page"
          role="tabpanel"
          aria-labelledby={`picked-tab-${workPage}`}
          className={
            fills
              ? 'mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col'
              : 'mx-auto w-full max-w-3xl px-4 pb-[max(calc(env(safe-area-inset-bottom)+24px),var(--sn-thumb-room,0px))] pt-3'
          }
          data-picked-page-body={workPage}
          {...(fills ? { 'data-picked-fill': '' } : {})}
        >
          <PickedHeadContext.Provider value={headSlot}>
            <PickedHeadLineContext.Provider value={headLineSlot}>
              <ThumbLayerContext.Provider value={thumbLayer}>
                {sideChat && workPage === sideChat.page ? chatTopRow : null}
                {/* 🙈 Under a risen page the chat stays mounted but is not on show — it must not mark itself read.
                    Beside a page's own column (a computer) it IS on show. */}
                <PickedCoveredContext.Provider value={!paneOn && (risenPage !== null || extra !== null)}>{bodies[workPage]}</PickedCoveredContext.Provider>
              </ThumbLayerContext.Provider>
            </PickedHeadLineContext.Provider>
          </PickedHeadContext.Provider>
        </div>
      </div>
      {/* 🖥 The chat's own column on a computer — the same body, never a second copy (the phone draws it as a tab). */}
      {split ? (
        <aside
          aria-label={menu.find((m) => m.id === sideChat!.page)?.label ?? 'Chat'}
          className="hidden min-h-0 w-[360px] flex-none flex-col overflow-hidden rounded-t-xl bg-[color:var(--m-paper)] lg:flex xl:w-[400px]"
          data-picked-chat-col=""
          data-picked-fill=""
          onPointerDownCapture={markChatSeen}
          onFocusCapture={markChatSeen}
        >
          <PickedHeadContext.Provider value={headSlot}>
            <PickedHeadLineContext.Provider value={headLineSlot}>
              <ThumbLayerContext.Provider value={thumbLayer}>
                {/* The column's own name (drawing v12 §3 "Chat") — and the unread count the hidden Chat tab used to
                    carry here. It goes the moment the reader touches the column, as a tab's does when it is opened. */}
                <div className="flex shrink-0 items-center gap-2 px-4 pt-3" data-picked-chat-head="">
                  <p className="home-k2">{menu.find((m) => m.id === sideChat!.page)?.label ?? 'Chat'}</p>
                  {chatUnread > 0 ? (
                    <small
                      className="h-4 min-w-4 rounded-full bg-sn-accent px-1 text-center text-[10px] font-bold leading-4 text-sn-on-accent"
                      data-picked-badge={sideChat!.page}
                    >
                      {chatUnread > 99 ? '99+' : formatCount(chatUnread)}
                      <span className="sr-only"> unread</span>
                    </small>
                  ) : null}
                </div>
                {chatTopRow}
                {bodies[sideChat!.page]}
              </ThumbLayerContext.Provider>
            </PickedHeadLineContext.Provider>
          </PickedHeadContext.Provider>
        </aside>
      ) : null}
      </div>
      {/* 🥞 The thumb host: a page's floating row lands HERE, inside this screen's layer (not on <body> under it). */}
      <div ref={setThumbHost} data-picked-thumb-layer="" />
      {/* ⤴ A PAGE RISEN OVER THE CHAT — the shipped body, unchanged; only the way in changed. ✕, Esc and the phone's
          Back close it (the one `RiseScreen`), and the chat under it is where it was left. */}
      {risenPage !== null && chatHome && !paneOn ? (
        <RiseScreen
          title={menu.find((m) => m.id === risenPage)?.label ?? title}
          line={chatHome.line}
          data="picked-page"
          onClose={landHome}
        >
          <RiseCloser into={riseCloseRef} />
          <div className="px-4 pb-[var(--sn-thumb-room,0px)] pt-3" data-picked-page-body={risenPage} data-picked-risen="">
            <PickedHeadContext.Provider value={null}>
              <PickedHeadLineContext.Provider value={null}>
                <ThumbLayerContext.Provider value={risenThumbLayer}>{bodies[risenPage]}</ThumbLayerContext.Provider>
              </PickedHeadLineContext.Provider>
            </PickedHeadContext.Provider>
          </div>
          <div ref={setRisenThumbHost} data-picked-thumb-layer="risen" />
        </RiseScreen>
      ) : null}
      {/* ⤴ ⋯ A PAGE OF ITS OWN (a trade page) — risen the same way on a phone; ✕, Esc and Back land on the chat. */}
      {extra !== null && chatHome && !paneOn ? (
        <RiseScreen title={extra.label} line={chatHome.line} data="picked-more-page" onClose={() => setExtraId(null)}>
          <RiseCloser into={riseCloseRef} />
          <div className="px-4 pb-[var(--sn-thumb-room,0px)] pt-3" data-picked-more-page={extra.id}>
            <PickedHeadContext.Provider value={null}>
              <PickedHeadLineContext.Provider value={null}>
                <ThumbLayerContext.Provider value={risenThumbLayer}>{extra.body}</ThumbLayerContext.Provider>
              </PickedHeadLineContext.Provider>
            </PickedHeadContext.Provider>
          </div>
          <div ref={setRisenThumbHost} data-picked-thumb-layer="risen" />
        </RiseScreen>
      ) : null}
      {/* 🖥 THE PAGE'S OWN COLUMN BESIDE THE CHAT (owner 20 Nov 2026; drawing UNICHAT-LIVE, computer view): 420 px on
          the right, its own ←, the chat narrowed beside it (the root's right padding) and never covered. The same
          shipped body the phone raises; opening another page replaces what is here. */}
      {paneKey !== null && chatHome ? (
        <aside
          aria-labelledby={paneHeadingId}
          className="absolute inset-y-0 right-0 hidden w-[420px] flex-col border-l border-ink/10 bg-[color:var(--m-paper)] pt-[env(safe-area-inset-top)] lg:flex"
          data-picked-pane={extra ? extra.id : (risenPage ?? '')}
        >
          <div ref={paneRef} className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 px-2 pt-2" data-picked-pane-head="">
              <ActionButton tone="neutral" iconOnly icon={ArrowLeft} label="Back to chat" onClick={closePane} data-testid="picked-pane-back" />
              <h2 id={paneHeadingId} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">
                {paneTitle}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain" data-rise-body="">
              <div
                className="px-4 pb-[max(24px,var(--sn-thumb-room,0px))] pt-3"
                {...(extra ? { 'data-picked-more-page': extra.id } : { 'data-picked-page-body': risenPage ?? '', 'data-picked-risen': '' })}
              >
                <PickedHeadContext.Provider value={null}>
                  <PickedHeadLineContext.Provider value={null}>
                    <ThumbLayerContext.Provider value={risenThumbLayer}>{extra ? extra.body : risenPage !== null ? bodies[risenPage] : null}</ThumbLayerContext.Provider>
                  </PickedHeadLineContext.Provider>
                </PickedHeadContext.Provider>
              </div>
            </div>
          </div>
          <div ref={setRisenThumbHost} data-picked-thumb-layer="pane" />
        </aside>
      ) : null}
    </div>
    </PickedNavContext.Provider>
  );

  // Drawn on <body> once it exists (the first frame is drawn in place, so server HTML and first paint agree).
  return host ? createPortal(screen, host) : screen;
}
