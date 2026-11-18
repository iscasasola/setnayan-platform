'use client';

/**
 * 🤝 TRUSTED BY — an endless row of shop profile photos (owner 2026-11-14, DECISION_LOG "A SHOP PAGE ENDS WITH ITS
 * PARTNERS, THEN SIMILAR SHOPS NEARBY — APPROVED AS DRAWN"; owner: *"carousel infinity"*).
 *
 * Each partner = its round shop profile photo (the shop card's logo circle; initials with no logo) · its name · how
 * they work together, in `lib/vendor-partnership-kinds.ts`'s words. Order is the server's (strongest kind first).
 *
 *   · NATIVE SWIPE — the row is a horizontal scroller with scroll-snap; a phone swipes it like any list. No library.
 *   · ENDLESS — once the row is wider than its box, the list is drawn three times and the scroller is parked on the
 *     middle copy. When a swipe or an arrow settles inside an outer copy, the scroller jumps by exactly one copy's
 *     width — the same picture, so the jump cannot be seen — and the last partner is followed by the first again, in
 *     both directions. The wrap arithmetic is the review carousel's (`review-carousel.tsx`, `(i ± 1 + n) % n`),
 *     applied to a position instead of an index.
 *   · ARROWS ON A COMPUTER ONLY (768 and up); a phone swipes. Few enough to fit → one plain row, no arrows, no copies.
 *     One partner → one tile.
 *   · NOTHING MOVES BY ITSELF. With "reduce motion" switched on, an arrow jumps instead of sliding.
 *   · THE COPIES ARE INVISIBLE TO A SCREEN READER AND THE TAB KEY (`aria-hidden`, `tabIndex -1`): each partner is
 *     announced and focusable exactly once.
 *
 * The first paint (the server's, and the cached copy's) is the plain row — nothing here can differ between the server
 * and the browser until the row has been measured.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';

export type TrustedByTile = {
  id: string;
  name: string;
  /** null = a still-hidden partner: drawn, never linked (its address would name it). */
  href: string | null;
  kindLabel: string;
  kindHint: string;
  logoUrl: string | null;
  initials: string;
};

// The browser's layout effect, or the plain effect on the server (where neither runs).
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const COPIES = 3;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function TrustedByCarousel({ tiles, label }: { tiles: ReadonlyArray<TrustedByTile>; label: string }) {
  const viewRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const [loop, setLoop] = useState(false);
  const settleTimer = useRef<number | null>(null);

  /** One copy's width = where copy 2 starts minus where copy 1 starts — exact, gaps included. */
  const copyWidth = useCallback((): number => {
    const row = rowRef.current;
    if (!row || tiles.length === 0) return 0;
    const a = row.children[0] as HTMLElement | undefined;
    const b = row.children[tiles.length] as HTMLElement | undefined;
    return a && b ? b.offsetLeft - a.offsetLeft : 0;
  }, [tiles.length]);

  const step = useCallback((): number => {
    const row = rowRef.current;
    const a = row?.children[0] as HTMLElement | undefined;
    const b = row?.children[1] as HTMLElement | undefined;
    return a && b ? b.offsetLeft - a.offsetLeft : 120;
  }, []);

  // Measure: does one copy overflow its box? Re-measured when the box changes width (a turned phone, a resized window).
  useIsoLayoutEffect(() => {
    const view = viewRef.current;
    const row = rowRef.current;
    if (!view || !row || tiles.length < 2) {
      setLoop(false);
      return;
    }
    const measure = () => {
      const one = loop ? copyWidth() : row.scrollWidth;
      setLoop(one > view.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    return () => ro.disconnect();
  }, [tiles.length, loop, copyWidth]);

  // Entering the loop: park on the middle copy, with no animation.
  useIsoLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.scrollLeft = loop ? copyWidth() : 0;
  }, [loop, copyWidth]);

  /** Back into the middle copy once the scroller rests in an outer one. */
  const recentre = useCallback(() => {
    const view = viewRef.current;
    const w = copyWidth();
    if (!view || w <= 0) return;
    if (view.scrollLeft < w * 0.5) view.scrollLeft += w;
    else if (view.scrollLeft >= w * 1.5) view.scrollLeft -= w;
  }, [copyWidth]);

  const onScroll = useCallback(() => {
    if (!loop) return;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    // `scrollend` is not everywhere yet; a short quiet spell is the same signal.
    settleTimer.current = window.setTimeout(recentre, 140);
  }, [loop, recentre]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const go = (dir: -1 | 1) => {
    const view = viewRef.current;
    if (!view) return;
    view.scrollBy({ left: dir * step(), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const copies = loop ? COPIES : 1;
  const middle = loop ? 1 : 0;

  return (
    <div className="flex items-center gap-2" data-trusted-by-carousel="" data-loop={loop ? '' : undefined}>
      {loop ? (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous partner"
          className="hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-cream text-ink hover:border-ink/30 md:grid"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : null}
      <div
        ref={viewRef}
        onScroll={onScroll}
        className={
          'min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' +
          (loop ? ' [mask-image:linear-gradient(90deg,#000_85%,transparent)]' : '')
        }
      >
        <ul ref={rowRef} aria-label={label} className="flex flex-nowrap gap-[18px] py-0.5">
          {Array.from({ length: copies }, (_, copy) =>
            tiles.map((t) => (
              <li
                key={`${copy}-${t.id}`}
                className="flex-none snap-start"
                aria-hidden={copy === middle ? undefined : true}
              >
                <Tile tile={t} hidden={copy !== middle} />
              </li>
            )),
          )}
        </ul>
      </div>
      {loop ? (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next partner"
          className="hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 bg-cream text-ink hover:border-ink/30 md:grid"
        >
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

function Tile({ tile, hidden }: { tile: TrustedByTile; hidden: boolean }) {
  const body = (
    <>
      <span className="relative grid h-16 w-16 place-items-center rounded-full border border-ink/10 bg-white font-mono text-[15px] font-bold text-[color:var(--sn-initials-ink)] md:h-[72px] md:w-[72px]">
        {tile.logoUrl ? (
          // A plain <img>, as on the shop card: a presigned logo's address changes per render (front-door-feed.tsx).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tile.logoUrl} alt="" loading="lazy" className="h-full w-full rounded-full object-contain p-[3px]" />
        ) : (
          <span aria-hidden>{tile.initials}</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-cream shadow-[0_0_0_1px_rgba(44,42,41,0.12)]">
          <BadgeCheck aria-hidden className="h-[15px] w-[15px] text-success-700" strokeWidth={2} />
        </span>
      </span>
      <span className="text-[13px] font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{tile.name}</span>
      <span
        className="mt-0.5 inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-semibold leading-snug text-ink/70"
        title={tile.kindHint}
      >
        {tile.kindLabel}
      </span>
    </>
  );
  const cls = 'grid w-[104px] content-start justify-items-center gap-1 text-center';
  return tile.href ? (
    <a href={tile.href} className={`${cls} rounded-xl`} tabIndex={hidden ? -1 : undefined}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}
