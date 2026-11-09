'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * In-view reveal for My Performance sections (owner 2026-07-02: "we always want
 * their first animation to show").
 *
 * Wraps a section and adds `.perf-play` the FIRST time it scrolls into view, so
 * the CSS bar-grow + section fade run when the vendor actually looks at it —
 * never finishing off-screen at page load. It also provides the in-view flag to
 * <CountUp> (via context) so the numbers tick at the same moment.
 *
 * Replay on toggle: the windowed block is re-keyed by `mode` in
 * PerformanceControls, so switching Daily/Monthly/Annual remounts these wrappers
 * → `played` resets → they re-observe → in-view sections animate again.
 *
 * Context value: `null` (no wrapper → <CountUp> animates on mount as a fallback),
 * `false` (armed, not yet in view → hold at 0), `true` (in view → play).
 */
const ReanimateCtx = createContext<boolean | null>(null);

export function useReanimate(): boolean | null {
  return useContext(ReanimateCtx);
}

export function Reanimate({
  children,
  className = '',
  still = false,
  onPlay,
}: {
  children: ReactNode;
  className?: string;
  /**
   * STILL UNDER REDUCED MOTION (Analytics, owner-approved 6 Nov 2026: "reduced motion → final values at once"): with
   * `prefers-reduced-motion` or a hidden tab the section plays at once — nothing waits for a scroll to show its true
   * value. Absent → exactly as it always was.
   */
  still?: boolean;
  /** Told once, when the section plays (Analytics staggers sections that arrive together). */
  onPlay?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  const told = useRef(false);

  useEffect(() => {
    if (played && !told.current) {
      told.current = true;
      onPlay?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played]);

  useEffect(() => {
    if (played) return;
    const el = ref.current;
    if (
      still &&
      (document.visibilityState === 'hidden' ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches))
    ) {
      setPlayed(true);
      return;
    }
    // No element or no IntersectionObserver support → reveal immediately so
    // content is never stuck in its hidden pre-animation state.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPlayed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlayed(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [played, still]);

  return (
    <div ref={ref} className={`perf-reanim ${played ? 'perf-play' : ''} ${className}`.trim()}>
      <ReanimateCtx.Provider value={played}>{children}</ReanimateCtx.Provider>
    </div>
  );
}
