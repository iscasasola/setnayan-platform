'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useTabReselect } from '@/app/_components/nav/use-chrome-away';
import { formatCount } from '@/lib/format-number';
import { HOME_LAST_SEG_KEY, HOME_SEG_LABEL, HOME_SEG_ORDER, homeSegHref, type HomeSeg } from '@/lib/home-segments';
import hp from './home-profile.module.css';

/**
 * home-segment-bar.tsx — HOME'S SECTIONS: Events · People · Shop · Memories (owner 11 Nov 2026, "One profile page
 * approve" — v3; the order is "THE ACCOUNT BAR ORDER", Shop only for an owner).
 *
 * v3 `.segs`: UNDERLINED TABS, numbers only where a cheap read exists (Events N · Shop N · People "N asking"; Memories
 * is a word). Since 13 Nov 2026 the tabs are Home's ONE row of sections — the header's pill doors that repeated them
 * are gone (owner: *"dupes … simple and just 1"*), so a number that waits on you (`hot`) is drawn here, in the brand
 * colour, with its word in the accessible name. Each tab is a LINK (`/dashboard?seg=…`): a deep link, Back, a new tab all work, and the server draws the
 * section's body. The motions, all the house's own:
 *   · the underline slides to the picked tab;
 *   · the body slides in from the side its section lies on (`HomeSegBody`; a fade under "reduce motion");
 *   · RE-TAP = TOP (T5): the picked tab, or the Home tab while on Home (`useTabReselect('home')`), scrolls back to
 *     the top instead of reloading.
 * The tabs are drawn twice by the top (`CollapsingTop`): once under the header at rest, once under the pinned row when
 * it has locked — the same component, so the two never disagree. `HomeSegMemory` is mounted ONCE and owns the Home
 * tab's re-tap (the top of the section). Discover → Home coming back to the section you left AND the place in it
 * (owner 9 Nov, DECISION_LOG row 44a4c660: "tapping home returns you to your last view on home"; 13 Nov: "any menu")
 * is the shared bar's, the same for every tab (`app/_components/nav/tab-memory.ts`).
 */

function toTop() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

export function HomeSegMemory() {
  // Re-tap Home ON Home: the top of the section you are in, in one tap (the shared bar has already forgotten Home's
  // kept view — `tab-memory.ts`). Coming back to Home from another tab is the bar's: it opens Home's last address
  // (`/dashboard?seg=…`) and puts its scroll back, the same for every tab.
  useTabReselect(
    'home',
    useCallback(() => {
      toTop();
      return true;
    }, []),
  );
  return null;
}

export function HomeTabs({
  seg,
  segs,
  counts,
  hot = {},
  copy = false,
}: {
  seg: HomeSeg;
  segs: readonly HomeSeg[];
  /** The tab's number, only where a cheap read answered (events · service cards · people asking). */
  counts: Partial<Record<HomeSeg, number>>;
  /** A number that waits on you, keyed by tab → its word ("asking"): the brand colour, and the word read aloud. */
  hot?: Partial<Record<HomeSeg, string>>;
  /** The second drawing (in the locked top) — it carries no tour anchor, so the spotlight finds ONE. */
  copy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  // The line follows the picked tab — measured before paint, re-measured when the row changes width.
  useLayoutEffect(() => {
    const el = ref.current;
    const ln = line.current;
    if (!el || !ln) return;
    const place = () => {
      const a = el.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!a || a.offsetWidth === 0) return;
      ln.style.width = `${a.offsetWidth - 24}px`;
      ln.style.transform = `translateX(${a.offsetLeft + 12}px)`;
      el.setAttribute('data-measured', '');
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [seg, segs]);
  const tabs = (
    <>
      {segs.map((s) => (
        <Link
          key={s}
          href={homeSegHref(s)}
          className={hp.tab}
          aria-current={s === seg ? 'page' : undefined}
          data-home-tab={s}
          scroll={false}
        >
          {HOME_SEG_LABEL[s]}
          {typeof counts[s] === 'number' ? (
            <span className={hp.n} data-hot={hot[s] ? '' : undefined} data-home-tab-n={s}>
              {formatCount(counts[s] as number)}
              {hot[s] ? <span className="sr-only"> {hot[s]}</span> : null}
            </span>
          ) : null}
        </Link>
      ))}
      <span ref={line} className={hp.line} aria-hidden />
    </>
  );
  const props = {
    ref,
    className: hp.tabs,
    role: 'group',
    'aria-label': 'Home — sections',
    'data-four': segs.length >= 4 ? '' : undefined,
    // The picked section is a link to the page you are on: re-tapping it goes to the top, never reloads.
    onClickCapture: (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[aria-current="page"]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      toTop();
    },
  };
  // The copy in the locked top carries no tour anchor — the spotlight finds ONE.
  return copy ? (
    <div {...props} data-home-segments="pinned">
      {tabs}
    </div>
  ) : (
    <div {...props} data-tour="home-segments" data-home-segments="">
      {tabs}
    </div>
  );
}

/**
 * 📌 The section's pinned row goes UP into the top (v3 #7: one row, shown once the header has scrolled away, above the
 * tabs). The row is still mounted by its section — it reads that section's own state — and portalled into the seat
 * (`data-home-pin-slot`). With no seat on the page (a lab, a page outside Home) it is drawn where it stands.
 */
export function HomePinPortal({ children }: { children: ReactNode }) {
  const [seat, setSeat] = useState<HTMLElement | null | undefined>(undefined);
  useEffect(() => {
    setSeat(document.querySelector<HTMLElement>('[data-home-pin-slot]'));
  }, []);
  if (seat === undefined) return null;
  return seat ? createPortal(children, seat) : <>{children}</>;
}

/** The section's body. Home keys it by section, so a switch remounts it — and it slides in from its side. */
export function HomeSegBody({ seg, children }: { seg: HomeSeg; children: ReactNode }) {
  return <SlideIn key={seg} seg={seg}>{children}</SlideIn>;
}

function SlideIn({ seg, children }: { seg: HomeSeg; children: ReactNode }) {
  const [dir, setDir] = useState<'left' | 'right' | 'none'>('none');
  // Before paint, so the body never shows a frame in place before it slides.
  useLayoutEffect(() => {
    let prev: string | null = null;
    try {
      prev = window.sessionStorage.getItem(`${HOME_LAST_SEG_KEY}-body`);
      window.sessionStorage.setItem(`${HOME_LAST_SEG_KEY}-body`, seg);
    } catch {
      prev = null;
    }
    const from = HOME_SEG_ORDER.indexOf(prev as HomeSeg);
    const to = HOME_SEG_ORDER.indexOf(seg);
    setDir(from < 0 || from === to ? 'none' : to > from ? 'right' : 'left');
  }, [seg]);
  return (
    <div className={hp.body} data-dir={dir} data-home-body={seg}>
      {children}
    </div>
  );
}
