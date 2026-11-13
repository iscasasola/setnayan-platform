'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 📖 THE STORY'S PROGRESS BARS — one bar per screen, on top (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE
 * SCENE PER SCREEN) — SIX CALLS SETTLED" (1); `post-event-story-fable.html`).
 *
 * 🔑 COUNTED FROM WHAT THE PAGE DREW, NEVER FROM A LIST. A screen is a scene the server actually rendered — a styled
 * scene's frame (`data-post-event-look`) or a plain one (`data-story-screen`) — so a scene that drew nothing has no bar
 * (owner 2026-09-28, "look at the progress line, there was a blank"). A screen nested inside another is not counted
 * twice. The bars fill up to the screen in view. Nothing is fetched; nothing is stored.
 */
const SCREENS = '[data-post-event-look], [data-story-screen]';

export function StoryProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(0);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const root = ref.current?.closest('[data-reads-as="story"]');
    if (!root) return;
    const screens = Array.from(root.querySelectorAll<HTMLElement>(SCREENS)).filter(
      (el) => !el.parentElement?.closest(SCREENS),
    );
    setTotal(screens.length);
    if (screens.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best = -1;
        let bestRatio = 0;
        screens.forEach((el, i) => {
          const r = seen.get(el) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = i;
          }
        });
        if (best >= 0) setAt(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    screens.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-story-progress=""
      aria-hidden
      className="pointer-events-none sticky top-0 z-30 flex gap-[3px] px-3 pb-1 pt-2"
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`block h-[2.5px] flex-1 rounded-full ${i <= at ? 'bg-ink' : 'bg-ink/15'}`} />
      ))}
    </div>
  );
}
