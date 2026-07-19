'use client';

import { useEffect, useRef } from 'react';

/**
 * Collapsible — the ONE shared animated expand/collapse primitive for the
 * vendor dashboard.
 *
 * Everything that grows or shrinks (My Shop's Manage panels, the QR card's
 * Shortlist↔Locked swap on My Customers) routes its height change through here
 * so the motion is identical everywhere and tuned in one place. Uses the Web
 * Animations API (measure → animate `height` → settle to `auto`/`0`), and
 * honors `prefers-reduced-motion` by snapping with no animation.
 *
 * Contract: render it always-mounted with an `open` boolean. First paint is
 * un-animated (matches SSR); subsequent `open` flips animate. Content is
 * clipped by `overflow:hidden` mid-animation, then released to `auto` so
 * nested inputs/focus rings aren't cut off once settled.
 */
export function Collapsible({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const settle = () => {
      el.style.height = open ? 'auto' : '0px';
      el.style.overflow = open ? 'visible' : 'hidden';
    };

    // First run mirrors the SSR'd closed/open state without animating.
    if (!mounted.current) {
      mounted.current = true;
      settle();
      return;
    }

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      settle();
      return;
    }

    const start = el.getBoundingClientRect().height;
    // Measure the natural target height with content laid out.
    el.style.height = 'auto';
    el.style.overflow = 'hidden';
    const end = open ? el.getBoundingClientRect().height : 0;
    el.style.height = `${start}px`;
    // Force a reflow so the browser registers the start height before animating.
    void el.getBoundingClientRect();

    const anim = el.animate(
      [{ height: `${start}px` }, { height: `${end}px` }],
      { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    anim.onfinish = settle;
    anim.oncancel = settle;

    return () => anim.cancel();
  }, [open]);

  return (
    <div ref={ref} className={className} style={{ height: 0, overflow: 'hidden' }}>
      {children}
    </div>
  );
}
