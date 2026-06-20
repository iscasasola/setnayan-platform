'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * PostHeroReveal — gates the post-hero homepage content behind a
 * "Tap to learn more" affordance at the end of the hero scrub.
 *
 * WHY (owner 2026-06-14): after the hero's "Set na 'yan" end-card, the page
 * should LOCK — the visitor can end right there, or tap to learn more, which
 * moves the page up into the "what you get" content. We achieve the lock
 * WITHOUT fighting scroll momentum: the content is kept COLLAPSED (height 0)
 * so the hero's end IS the page bottom — there is simply nothing to scroll into
 * until the visitor taps. Tapping expands the content and smooth-scrolls to it.
 *
 * SSR / a11y: the content renders EXPANDED on the server (crawlers + no-JS see
 * everything, no SEO loss). On mount we collapse it to arm the gate — EXCEPT
 * under prefers-reduced-motion, which keeps it open (no gate). The collapse
 * happens while the hero's loading veil covers the screen and the content sits
 * a full scroll below the fold, so there is no visible flash.
 */
export function PostHeroReveal({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(true); // SSR: open (SEO + no-JS)
  const [atEnd, setAtEnd] = useState(false); // hero end reached → show the prompt
  const wrapRef = useRef<HTMLDivElement>(null);

  // Arm the gate on mount (collapse), unless the visitor prefers reduced motion.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // keep open — no gate
    setRevealed(false);
  }, []);

  // Reveal the prompt once the visitor reaches the bottom of the (collapsed)
  // page — i.e. the very end of the hero scrub.
  useEffect(() => {
    if (revealed) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        setAtEnd(window.innerHeight + window.scrollY >= doc.scrollHeight - 8);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [revealed]);

  const reveal = () => {
    setRevealed(true);
    setAtEnd(false);
    // Two frames later the content is back in flow with real height → scroll to it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      ),
    );
  };

  return (
    <>
      <div
        ref={wrapRef}
        id="what-you-get"
        style={{ maxHeight: revealed ? 'none' : 0, overflow: 'hidden' }}
      >
        {children}
      </div>

      {/* Floating "Tap to learn more" — fades in at the hero end, fixed bottom-center. */}
      {!revealed && (
        <button
          type="button"
          onClick={reveal}
          aria-label="Tap to learn more"
          className="m-mono"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'max(22px, env(safe-area-inset-bottom))',
            transform: `translate(-50%, ${atEnd ? '0' : '14px'})`,
            opacity: atEnd ? 1 : 0,
            pointerEvents: atEnd ? 'auto' : 'none',
            transition: 'opacity .5s ease, transform .5s ease',
            zIndex: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 22px',
            borderRadius: 'var(--m-r-full)',
            background: 'rgba(251,251,250,.92)',
            color: '#1E2229',
            border: '1px solid rgba(255,255,255,.5)',
            boxShadow: '0 8px 30px rgba(0,0,0,.28)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            fontSize: 12,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Tap to learn more
          <span aria-hidden style={{ color: 'var(--m-mulberry)' }}>
            ↓
          </span>
        </button>
      )}
    </>
  );
}
