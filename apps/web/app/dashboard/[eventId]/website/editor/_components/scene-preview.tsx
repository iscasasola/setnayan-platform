'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTileDocument, tileFrame, type TileHead, type TileSnapshot } from '@/lib/maker-tile-preview';

/**
 * 🖼 ONE NAVIGATOR TILE'S PREVIEW — the section exactly as the canvas drew it,
 * scaled into the tile (owner 2026-09-26: *"the navigator preview must really
 * show the preview"*). How and why: `lib/maker-tile-preview.ts`.
 *
 *   · A document of its own, the canvas's width, sandboxed with NO scripts —
 *     it cannot run, navigate or be tabbed into; it is a picture that happens
 *     to be made of the page's own markup.
 *   · Mounted only while the tile is on screen (`observeRoot`, the navigator's
 *     own scroller), so a long stage costs what the visible tiles cost.
 *   · It sits UNDER the tile's button and takes no pointer, so select, drag,
 *     the eye and long-press all reach the tile exactly as before.
 *   · It fades in over the words-only card only once it has drawn — the tile
 *     box never changes size, so nothing shifts.
 */
export function ScenePreview({
  head,
  snapshot,
  device,
  observeRoot,
}: {
  head: TileHead | null;
  snapshot: TileSnapshot | null;
  device: 'desktop' | 'phone';
  observeRoot: Element | null;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [tileWidth, setTileWidth] = useState(0);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
      { root: observeRoot, rootMargin: '160px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [observeRoot]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setTileWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const srcDoc = useMemo(
    () => (head && snapshot ? buildTileDocument(head, snapshot) : null),
    [head, snapshot],
  );
  useEffect(() => setDrawn(false), [srcDoc]);

  const frame = snapshot ? tileFrame(device, snapshot.frameWidth, tileWidth) : null;
  const mount = Boolean(onScreen && srcDoc && frame && frame.scale > 0);

  return (
    <span
      ref={boxRef}
      aria-hidden
      data-maker-preview={mount ? (drawn ? 'drawn' : 'loading') : 'off'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {mount && frame ? (
        <iframe
          title=""
          tabIndex={-1}
          aria-hidden
          sandbox="allow-same-origin"
          srcDoc={srcDoc!}
          onLoad={(e) => {
            // Show the TOP of the section: scroll the copy to where it starts.
            try {
              const d = e.currentTarget.contentDocument;
              const root = d?.querySelector('[data-snm-root]');
              const w = d?.defaultView;
              if (root && w) {
                const top = root.getBoundingClientRect().top + w.scrollY;
                if (getComputedStyle(root).position !== 'fixed') w.scrollTo(0, Math.max(0, top));
              }
            } catch {
              /* a copy we cannot scroll still shows its top */
            }
            setDrawn(true);
          }}
          className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-opacity duration-sn-control ease-sn ${
            drawn ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width: frame.width, height: frame.height, transform: `scale(${frame.scale})` }}
        />
      ) : null}
    </span>
  );
}
