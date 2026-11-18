'use client';

import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useTabReselect } from '@/app/_components/nav/use-chrome-away';
import { HOME_LAST_SEG_KEY, HOME_SEG_ORDER, type HomeSeg } from '@/lib/home-segments';
import hp from './home-profile.module.css';

/**
 * home-segment-bar.tsx — HOME'S SECTIONS: Events · People · Shop · Memories (owner 11 Nov 2026, "One profile page
 * approve" — v3; the order is "THE ACCOUNT BAR ORDER", Shop only for an owner).
 *
 * 17 Nov 2026 (owner "Yes, all 3", user dashboard drawing `user_dashboard_clean_2026-11-17`): THE TAB ROW IS GONE.
 * The section's ONE pinned row — "Events ▾" · its doors · its one action · ⚙ — is the switch, drawn at rest under the
 * header and kept when the top locks (`HomeProfile`, `CollapsingTop rowAtRest`). Its picker lists the sections with
 * the numbers the tabs carried (`HomeSegCountsProvider` → `homeSegOptions`). Each section is still an address
 * (`/dashboard?seg=…`): a deep link, Back and a new tab all work, and the move is client navigation on the same page,
 * so the layout's bar and rail are never redrawn. The motions, all the house's own:
 *   · the body slides in from the side its section lies on (`HomeSegBody`; a fade under "reduce motion");
 *   · RE-TAP = TOP (T5): the Home tab while on Home (`useTabReselect('home')`) scrolls back to the top instead of
 *     reloading.
 * `HomeSegMemory` is mounted ONCE and owns the Home tab's re-tap (the top of the section). Discover → Home coming back
 * to the section you left AND the place in it (owner 9 Nov, DECISION_LOG row 44a4c660: "tapping home returns you to
 * your last view on home"; 13 Nov: "any menu") is the shared bar's, the same for every tab
 * (`app/_components/nav/tab-memory.ts`).
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

/**
 * 🔢 THE SECTIONS' NUMBERS, for the pinned row's picker (owner 17 Nov 2026, "Yes, all 3": the tab row goes; the pinned
 * "Events ▾" is the one switch). Home reads them once (`HomeProfile` — Events N · Shop N · People "N asking") and the
 * row of whichever section is showing lists them beside its "Home" group (`homeSegOptions`). Plain data, no read here.
 */
export type HomeSegCounts = {
  counts: Partial<Record<HomeSeg, number>>;
  /** A number that waits on you, keyed by section → its word ("asking"): drawn as the picker's dot. */
  hot: Partial<Record<HomeSeg, string>>;
};
const HomeSegCountsContext = createContext<HomeSegCounts>({ counts: {}, hot: {} });

export function HomeSegCountsProvider({ counts, hot, children }: HomeSegCounts & { children: ReactNode }) {
  const value = useMemo(() => ({ counts, hot }), [counts, hot]);
  return <HomeSegCountsContext.Provider value={value}>{children}</HomeSegCountsContext.Provider>;
}

/** The numbers Home read for its sections — empty outside Home (a lab, a page outside it): no number, never a 0. */
export function useHomeSegCounts(): HomeSegCounts {
  return useContext(HomeSegCountsContext);
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
