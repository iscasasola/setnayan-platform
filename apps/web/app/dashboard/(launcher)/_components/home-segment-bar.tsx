'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { PillSelector } from '@/app/_components/pill-selector';
import { useTabReselect } from '@/app/_components/nav/use-chrome-away';
import { HOME_LAST_SEG_KEY, HOME_SEG_LABEL, HOME_SEG_ORDER, homeSegHref, type HomeSeg } from '@/lib/home-segments';
import hp from './home-profile.module.css';

/**
 * home-segment-bar.tsx — HOME'S SECTIONS: Events · People · Shop · Memories (owner 11 Nov 2026, "One profile page
 * approve" — v3; the order is "THE ACCOUNT BAR ORDER", Shop only for an owner).
 *
 * ONE segmented control (INTERACTION_RULES: "sections inside a panel = ONE segmented control") — the app's shared pill
 * selector, each section a LINK (`/dashboard?seg=…`): a deep link, Back, a new tab all work, and the server draws the
 * section's body. Three motions, all the house's own:
 *   · the thumb slides to the picked section (the pill selector's);
 *   · the body slides in from the side its section lies on (`HomeSegBody`, `home-profile.module.css`; a fade under
 *     "reduce motion");
 *   · RE-TAP = TOP (T5): the picked section, or the Home tab while on Home (`useTabReselect('home')`), scrolls back to
 *     the top instead of reloading.
 * And the bar remembers the section (`HOME_LAST_SEG_KEY`), so Discover → Home comes back to it (T5: the other tab keeps
 * its last state; read by `account-bottom-nav.tsx`).
 */

function toTop() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

export function HomeSegmentBar({ seg, segs }: { seg: HomeSeg; segs: readonly HomeSeg[] }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(HOME_LAST_SEG_KEY, seg);
    } catch {
      /* storage refused — Home then comes back to Events, a correct answer */
    }
  }, [seg]);

  useTabReselect(
    'home',
    useCallback(() => {
      toTop();
      return true;
    }, []),
  );

  return (
    <div
      className={hp.segs}
      data-tour="home-segments"
      data-home-segments=""
      // The picked section is a link to the page you are on: re-tapping it goes to the top, never reloads.
      onClickCapture={(e) => {
        const a = (e.target as Element | null)?.closest?.('a[aria-current="page"]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        toTop();
      }}
    >
      <PillSelector
        label="Home — sections"
        value={seg}
        link={Link}
        data="home-segments"
        options={segs.map((s) => ({ key: s, label: HOME_SEG_LABEL[s], href: homeSegHref(s) }))}
      />
    </div>
  );
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
