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
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (played) return;
    const el = ref.current;
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
  }, [played]);

  return (
    <div ref={ref} className={`perf-reanim ${played ? 'perf-play' : ''} ${className}`.trim()}>
      <ReanimateCtx.Provider value={played}>{children}</ReanimateCtx.Provider>
    </div>
  );
}
