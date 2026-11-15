'use client';

/**
 * 🧭 THE SECTION BAR — one short sticky bar under the shop's name: each tab jumps to its section, the section you are
 * in is underlined, and ↑ Top sits at the bar's right edge as the way back (owner 2026-11-13, DECISION_LOG "ALL THREE
 * PUBLIC PAGES: SIMPLER TO MOVE AROUND, EQUALLY ELEGANT"; prototype `public_pages_three_2026-11-13`, `secBar`).
 *
 *   verified shop    About · Services · Portfolio · Reviews · Inquire
 *   unverified shop  Services · Reviews · Where · Inquire
 *
 * 🔑 THE LINKS ARE REAL ANCHORS, so with no JavaScript the hash still jumps. With it, the jump offsets for the bar and
 * NEVER writes history — no `history`, no storage, nothing persisted.
 *
 * 🎞 THE ONE OBSERVER. The verified page's scroll motion (README table rows 6–10) is CSS on the page; this component
 * only adds `.in` once to each part as it enters, then lets go. Before it runs, nothing is hidden: the resting state
 * is the base style, so the page is complete and still without JS. Parts already on screen when it starts are marked
 * `.in` first, so turning the motion on never blinks what the reader is already looking at.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export type ShopSectionTab = { id: string; label: string };

/** The parts that rise as they enter: every direct child of a section, and anything marked `data-rise`. */
const RISE_SELECTOR = '[data-shop-section] > *, [data-rise]';

/**
 * 🪟 WHERE THE BAR SCROLLS. On the shop page that is the window. The same bar also draws inside the sample shop page
 * (`SampleShopPage`), which /for-suppliers lifts into a full-screen sheet that scrolls INSIDE itself — so the bar finds
 * its nearest scrolling ancestor and jumps, tracks and returns to the top within it. No such ancestor → the window,
 * exactly as before. Sections are looked up inside that scroller too, so a second drawing of the same sample (the
 * miniature the sheet rose from) can never be the one it jumps to.
 */
type Scroller = {
  el: HTMLElement | null;
  top: () => number;
  to: (top: number, smooth: boolean) => void;
  viewTop: () => number;
  end: () => boolean;
};

function scrollerOf(nav: HTMLElement): Scroller {
  let el: HTMLElement | null = nav.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const oy = getComputedStyle(el).overflowY;
    // `scrollHeight > clientHeight` too: an ancestor with only `overflow-x: hidden` computes overflow-y to `auto` without
    // ever scrolling, and must not be mistaken for the scroller.
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) break;
    el = el.parentElement;
  }
  if (!el || el === document.body || el === document.documentElement) {
    return {
      el: null,
      top: () => window.scrollY,
      to: (top, smooth) => window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }),
      viewTop: () => 0,
      end: () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
    };
  }
  const box = el;
  return {
    el: box,
    top: () => box.scrollTop,
    to: (top, smooth) => box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }),
    viewTop: () => box.getBoundingClientRect().top,
    end: () => box.scrollTop + box.clientHeight >= box.scrollHeight - 2,
  };
}

function sectionIn(scroller: Scroller, id: string): HTMLElement | null {
  if (!scroller.el) return document.getElementById(id);
  return scroller.el.querySelector<HTMLElement>(`[id="${id.replace(/"/g, '')}"]`);
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function ShopSectionBar({
  tabs,
  motionRootId,
  topId = 'shop-top',
}: {
  tabs: ReadonlyArray<ShopSectionTab>;
  motionRootId?: string;
  /** The page top ↑ Top returns to — the shop page's `shop-top`; a sample page passes its own. */
  topId?: string;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState<string | null>(tabs[0]?.id ?? null);
  const holdUntil = useRef(0);

  // Which section you are in — the last one whose top has passed under the bar. At the very end of the page the last
  // tab is current, because a short last section can never reach the bar.
  useEffect(() => {
    const nav0 = navRef.current;
    if (!nav0) return;
    const scroller = scrollerOf(nav0);
    let ticking = false;
    const track = () => {
      ticking = false;
      if (performance.now() < holdUntil.current) return;
      const nav = navRef.current;
      if (!nav) return;
      const line = nav.getBoundingClientRect().bottom + 8;
      let cur: string | null = tabs[0]?.id ?? null;
      for (const t of tabs) {
        const sec = sectionIn(scroller, t.id);
        if (sec && sec.getBoundingClientRect().top <= line) cur = t.id;
      }
      if (scroller.end() && tabs.length > 0) cur = tabs[tabs.length - 1]!.id;
      setCurrent(cur);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(track);
    };
    const target: HTMLElement | Window = scroller.el ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    track();
    return () => target.removeEventListener('scroll', onScroll);
  }, [tabs]);

  // Keep the current tab in view when the bar scrolls sideways on a phone.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !current) return;
    const a = nav.querySelector<HTMLAnchorElement>(`a[href="#${current}"]`);
    if (!a) return;
    const l = a.offsetLeft - 12;
    const r = a.offsetLeft + a.offsetWidth + 12;
    if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: l, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, [current]);

  // THE ONE OBSERVER — adds `.in` once, then unobserves. Only on a page that asked for motion (the verified shop).
  useEffect(() => {
    if (!motionRootId) return;
    const root = document.getElementById(motionRootId);
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const parts = Array.from(root.querySelectorAll<HTMLElement>(RISE_SELECTOR));
    const vh = window.innerHeight;
    for (const el of parts) {
      if (el.getBoundingClientRect().top < vh) el.classList.add('in');
    }
    root.setAttribute('data-shop-js', '');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    for (const el of parts) if (!el.classList.contains('in')) io.observe(el);
    return () => io.disconnect();
  }, [motionRootId]);

  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const scroller = scrollerOf(nav);
    const sec = sectionIn(scroller, id);
    if (!sec) return; // let the anchor do its plain job
    e.preventDefault();
    const navH = nav.getBoundingClientRect().height;
    holdUntil.current = performance.now() + (reducedMotion() ? 150 : 1000);
    setCurrent(id);
    scroller.to(sec.getBoundingClientRect().top - scroller.viewTop() + scroller.top() - navH - 6, !reducedMotion());
  };

  const toTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    holdUntil.current = performance.now() + (reducedMotion() ? 150 : 1000);
    setCurrent(tabs[0]?.id ?? null);
    const nav = navRef.current;
    if (nav) scrollerOf(nav).to(0, !reducedMotion());
  };

  if (tabs.length === 0) return null;
  return (
    <nav
      ref={navRef}
      aria-label="On this page"
      data-shop-section-bar=""
      className="sticky top-0 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-ink/10 bg-page/95 px-3 backdrop-blur [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={jump(t.id)}
          aria-current={current === t.id ? 'true' : undefined}
          className={`inline-flex min-h-[46px] shrink-0 items-center whitespace-nowrap border-b-2 px-3.5 text-[0.92rem] font-semibold no-underline transition-colors ${
            current === t.id ? 'border-terracotta text-ink' : 'border-transparent text-ink/60 hover:text-ink'
          }`}
        >
          {t.label}
        </a>
      ))}
      <a
        href={`#${topId}`}
        onClick={toTop}
        aria-label="Back to the top of the page"
        className="sticky right-0 ml-auto inline-flex min-h-[46px] shrink-0 items-center gap-1.5 whitespace-nowrap bg-page pl-4 pr-3 shadow-[-10px_0_10px_-6px_rgb(var(--sn-page-bg)/0.95)] font-mono text-[0.64rem] font-bold uppercase tracking-[0.12em] text-ink/60 no-underline"
      >
        <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Top
      </a>
    </nav>
  );
}
