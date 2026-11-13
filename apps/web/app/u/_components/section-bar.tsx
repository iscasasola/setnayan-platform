'use client';

/**
 * section-bar.tsx — THE PERSON PAGE'S WAY AROUND (owner 13 Nov 2026, "THREE PUBLIC PAGES APPROVED" ·
 * "SIMPLER TO MOVE AROUND"; prototype `public_pages_three_2026-11-13`, Person frame).
 *
 * One short sticky bar under the header: a tab per section that is ACTUALLY on the page (the caller passes only
 * the sections it rendered — a tab pointing at nothing is a dead door), the current one underlined as you scroll,
 * and ↑ Top pinned at its right edge as the way back.
 *
 *   · The tabs are real anchors (`href="#events"`), so with no JavaScript the hash still jumps.
 *   · With JavaScript the jump offsets for the bar's own height and NEVER writes history — no `pushState`, no
 *     `location.hash =`, no storage. Back still leaves the page, as a visitor expects.
 *   · One passive scroll listener, coalesced to a frame. Smooth scrolling only when the reader has not asked for
 *     reduced motion.
 * 🔒 app/u/[userSlug]/the-person-page-moves-around.test.ts
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type SectionTab = { id: string; label: string };

const smooth = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export function SectionBar({ tabs }: { tabs: readonly SectionTab[] }) {
  const navRef = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState<string>(tabs[0]?.id ?? '');
  /** After a tap, the tapped tab stays current until the smooth scroll settles. */
  const holdUntil = useRef(0);

  const track = useCallback(() => {
    if (performance.now() < holdUntil.current) return;
    const nav = navRef.current;
    if (!nav) return;
    const line = nav.getBoundingClientRect().bottom + 8;
    let cur = tabs[0]?.id ?? '';
    for (const t of tabs) {
      const sec = document.getElementById(t.id);
      if (sec && sec.getBoundingClientRect().top <= line) cur = t.id;
    }
    // A short last section can never reach the bar; at the end of the page it is still where you are.
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (atEnd && tabs.length > 0) cur = tabs[tabs.length - 1]!.id;
    setCurrent(cur);
  }, [tabs]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        track();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    track();
    return () => window.removeEventListener('scroll', onScroll);
  }, [track]);

  // Keep the current tab in view when the bar scrolls sideways on a phone.
  useEffect(() => {
    const nav = navRef.current;
    const a = nav?.querySelector<HTMLAnchorElement>(`a[data-jump="${current}"]`);
    if (!nav || !a) return;
    const l = a.offsetLeft - 12;
    const r = a.offsetLeft + a.offsetWidth + 12;
    if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: l, behavior: smooth() });
  }, [current]);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const sec = document.getElementById(id);
    if (!sec) return; // let the anchor do what anchors do
    e.preventDefault();
    const navH = navRef.current?.getBoundingClientRect().height ?? 0;
    setCurrent(id);
    holdUntil.current = performance.now() + 1000;
    window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - navH - 6, behavior: smooth() });
  };

  if (tabs.length === 0) return null;
  return (
    <nav ref={navRef} className="uprof-bar-nav" aria-label="On this page" data-section-bar="">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          data-jump={t.id}
          aria-current={current === t.id ? 'true' : undefined}
          onClick={(e) => jump(e, t.id)}
        >
          {t.label}
        </a>
      ))}
      <button
        type="button"
        className="uprof-totop"
        aria-label="Back to the top of the page"
        onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        Top
      </button>
    </nav>
  );
}
