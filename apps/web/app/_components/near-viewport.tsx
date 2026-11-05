'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * 🗺 MOUNT ONLY WHEN NEAR THE SCREEN (Batch 9 walk W2, 2026-10-16).
 *
 * With the Invitation on ONE page, the venue map sits ~1,500 px below the cover, and `loading="lazy"` lets Chromium
 * fetch anything within its own native distance (1,250–2,500 px) — so every guest's landing asked OpenStreetMap for 4
 * tiles (21 requests against main's 17) whether or not they ever scrolled to Details. This holds the children back
 * until the box comes within `NEAR_VIEWPORT_MARGIN` of the screen, then mounts them for good.
 *
 * The box itself is always drawn (same class / style), so the layout does not move when the children arrive. A box
 * that is `display: none` (a section hidden by the page it is not on) never intersects, so it never loads. With no
 * IntersectionObserver (very old browsers) it mounts at once — the shipped behaviour.
 *
 * Held by `lib/the-map-waits-until-it-is-near.test.ts`.
 */
export const NEAR_VIEWPORT_MARGIN = '300px';

export function NearViewport({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: `${NEAR_VIEWPORT_MARGIN} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-near-viewport={near ? 'near' : 'far'} className={className} style={style}>
      {near ? children : null}
    </div>
  );
}
