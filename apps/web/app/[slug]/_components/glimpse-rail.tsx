'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';
import { formatCount } from '@/lib/format-number';
import { WHOLE_PHOTO_CLASS } from '@/lib/whole-photo';

/**
 * 🎞 GLIMPSE — THE RAIL (owner 2026-10-15, DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED"; prototype
 * `photos_glimpse_style_2026-10-15_fable.html`).
 *
 * One 3:4 photo centred, the previous and next peeking in at both edges. The centre card is scale 1 · opacity 1;
 * a card one place away is .92 · .72 — MEASURED from each card's distance to the rail's centre as the guest scrolls,
 * never an index, so a half-swipe looks right as each photo passes the middle.
 *
 * ✋ IT NEVER MOVES BY ITSELF (owner 2026-10-24, verbatim: *"there shouldnt be the auto scrolling photos"*). This
 * REVERSES the 2026-10-15 ruling "GLIMPSE'S MOTION IS A SLOW CONTINUOUS DRIFT, NOT A STEP": the drift, its endless
 * loop (the photos drawn three times) and its resume timer are gone. Photos move only when the guest swipes, taps a
 * neighbour, presses ‹ › or an arrow key. The rail is a plain snap rail on the server AND in the browser.
 * 🔒 Held by `lib/photos-never-move-by-themselves.test.ts` — no timer, no frame loop driving the scroll.
 *
 * Tap: the centre card opens the SHIPPED full-screen viewer (`GalleryLightbox`) — never a second one; a neighbour
 * tap only brings it to the centre. Where am I: dots up to `DOTS_MAX` photos, then "3 / 12".
 */
export const DOTS_MAX = 8;
/** A neighbour one card away is drawn at this scale and opacity (the prototype's .92 / .72). */
export const GLIMPSE_SIDE_SCALE = 0.92;
export const GLIMPSE_SIDE_OPACITY = 0.72;
/** The centre card's width in the Photos scene — the full-width rail's `--g-w`. */
export const GLIMPSE_CARD_WIDTH = 'min(62vw, 380px)';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function GlimpseRail({
  urls,
  label = 'Memories',
  preview = false,
  width = GLIMPSE_CARD_WIDTH,
  whole = false,
  caption = null,
}: {
  urls: readonly string[];
  label?: string;
  /**
   * 👁 A PREVIEW is the same rail with nothing in it to press — for a place that sits INSIDE a button (Post Event's
   * gallery preview is the open-up's button, and a button may not hold buttons). Same emphasis, still until the
   * guest moves it; the cards are plain boxes, there is no ‹ ›, no full-screen photo and no "tap to open"
   * line, and the region is not a tab stop — a tap anywhere is the parent's, which opens the whole gallery.
   */
  preview?: boolean;
  /**
   * 📐 The centre card's width (the rail's `--g-w`) — absent = the Photos scene's own `min(62vw, 380px)`. A rail that
   * sits INSIDE a part narrower than the screen (a Love Story moment's photo slot, owner 2026-10-17 "Use the Glimpse
   * swipe for a moment's photos") passes a width in its own container's units (`cqw`), so the card and the peeks
   * are sized from that part and not from the window. Same rail — only its size.
   */
  width?: string;
  /**
   * 🖼 THE WHOLE PHOTO (owner 2026-10-17, on a Love Story photo that cut the man off at its edge: *"there might be a
   * better way to present instead if it looking cropped"*). Each card keeps its 3:4 place — so the rail
   * and the page never move as photos arrive — but the photo inside is drawn WHOLE at its own shape, centred, with
   * the card's corners and lift on the photo itself; nothing is cut. Absent = the Photos scene's filled 3:4 cards.
   */
  whole?: boolean;
  /** The line under the photo in the full-screen viewer — a Love Story moment's title. Absent = none. */
  caption?: string | null;
}) {
  const n = urls.length;
  const railRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [centre, setCentre] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  /* Kept off React's render so a scroll never re-renders the rail. */
  const st = useRef({ measureRaf: 0, centre: 0 });

  useEffect(() => {
    setReduced(prefersReducedMotion());
    let mq: MediaQueryList | null = null;
    const onChange = () => setReduced(prefersReducedMotion());
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onChange);
    } catch {
      /* an old engine: the first read stands */
    }
    return () => mq?.removeEventListener('change', onChange);
  }, []);

  const cards = useCallback((): HTMLElement[] => {
    const rail = railRef.current;
    return rail ? Array.from(rail.querySelectorAll<HTMLElement>('[data-glimpse-card]')) : [];
  }, []);

  /** The scroll position that puts card `i` in the middle. */
  const leftFor = useCallback((i: number): number => {
    const rail = railRef.current;
    const c = cards()[i];
    if (!rail || !c) return 0;
    return c.offsetLeft + c.offsetWidth / 2 - rail.clientWidth / 2;
  }, [cards]);

  /** The emphasis, measured from each card's distance to the middle — and which photo is centred. */
  const measure = useCallback(() => {
    st.current.measureRaf = 0;
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    cards().forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
      if (!reduced && n > 1) {
        const t = Math.min(1, d / (c.offsetWidth * 1.1));
        c.style.setProperty('--g-s', (1 - (1 - GLIMPSE_SIDE_SCALE) * t).toFixed(3));
        c.style.setProperty('--g-o', (1 - (1 - GLIMPSE_SIDE_OPACITY) * t).toFixed(3));
      } else {
        c.style.removeProperty('--g-s');
        c.style.removeProperty('--g-o');
      }
    });
    if (best !== st.current.centre) {
      st.current.centre = best;
      setCentre(best);
    }
  }, [cards, n, reduced]);

  /* ← → move the full-screen photo, as in the rail. */
  useEffect(() => {
    if (open === null || n < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % n));
      else if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + n) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n]);

  /* Measure as the GUEST moves the rail, and again on a resize — nothing here moves it. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    const onScroll = () => {
      if (!st.current.measureRaf) st.current.measureRaf = requestAnimationFrame(measure);
    };
    const onResize = () => {
      rail.scrollLeft = leftFor(st.current.centre);
      measure();
    };
    rail.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      rail.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (st.current.measureRaf) cancelAnimationFrame(st.current.measureRaf);
      st.current.measureRaf = 0;
    };
  }, [leftFor, measure]);

  /** Bring card `i` to the middle — a guest's tap or key, never a timer. */
  const bring = useCallback(
    (i: number) => {
      const rail = railRef.current;
      if (!rail) return;
      rail.scrollTo({ left: leftFor(i), behavior: reduced ? 'auto' : 'smooth' });
    },
    [leftFor, reduced],
  );

  const step = (by: 1 | -1) => {
    const next = st.current.centre + by;
    if (next < 0 || next >= n) return;
    bring(next);
  };

  return (
    <div className="group relative" data-glimpse="">
      <div
        ref={railRef}
        className="sn-glimpse-rail flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-7 pt-3 outline-none sm:gap-[18px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', paddingInline: 'calc((100% - var(--g-w)) / 2)', ['--g-w' as string]: width }}
        {...(preview ? { 'aria-hidden': true } : { role: 'region', 'aria-roledescription': 'carousel', 'aria-label': label, tabIndex: 0 })}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(st.current.centre);
          }
        }}
      >
        {urls.map((url, i) => {
          const cardClass = whole
            ? 'relative !min-h-0 block aspect-[3/4] w-[var(--g-w)] shrink-0 snap-center bg-transparent p-0 [opacity:var(--g-o,1)] [transform:scale(var(--g-s,1))] motion-safe:transition-[transform,opacity] motion-safe:duration-200'
            : 'relative !min-h-0 block aspect-[3/4] w-[var(--g-w)] shrink-0 snap-center overflow-hidden rounded-card bg-ink/5 p-0 shadow-[0_6px_16px_rgb(var(--color-ink)/0.14)] [opacity:var(--g-o,1)] [transform:scale(var(--g-s,1))] motion-safe:transition-[transform,opacity] motion-safe:duration-200';
          const img = whole ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" aria-hidden loading="lazy" draggable={false} className={WHOLE_PHOTO_CLASS} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" aria-hidden loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          );
          if (preview) {
            return (
              <span key={`${i}-${url.slice(0, 24)}`} data-glimpse-card="" data-glimpse-photo={i} aria-hidden className={cardClass}>
                {img}
              </span>
            );
          }
          return (
            <button
              key={`${i}-${url.slice(0, 24)}`}
              type="button"
              data-glimpse-card=""
              data-glimpse-photo={i}
              tabIndex={-1}
              aria-label={`Photo ${formatCount(i + 1)} of ${formatCount(n)}`}
              onClick={() => {
                if (i === st.current.centre) setOpen(i);
                else bring(i);
              }}
              className={cardClass}
            >
              {img}
            </button>
          );
        })}
      </div>

      {n > 1 ? (
        <>
          {preview ? null : (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => step(-1)}
            disabled={centre === 0}
            className="absolute left-4 top-[calc(50%-1.5rem)] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-cream/90 text-2xl leading-none text-ink opacity-0 backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 disabled:!opacity-0 [@media(hover:hover)]:grid"
          >
            ‹
          </button>
          )}
          {preview ? null : (
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => step(1)}
            disabled={centre === n - 1}
            className="absolute right-4 top-[calc(50%-1.5rem)] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-cream/90 text-2xl leading-none text-ink opacity-0 backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 disabled:!opacity-0 [@media(hover:hover)]:grid"
          >
            ›
          </button>
          )}
          <div className="flex min-h-[22px] items-center justify-center" data-glimpse-where="">
            {n <= DOTS_MAX ? (
              <span className="flex gap-1.5" aria-hidden>
                {urls.map((u, i) => (
                  <i
                    key={`${i}-${u.slice(0, 24)}`}
                    className={`h-1.5 w-1.5 rounded-full bg-ink transition-[opacity,transform] duration-200 ${i === centre ? 'scale-125 opacity-100' : 'opacity-25'}`}
                  />
                ))}
              </span>
            ) : (
              <span className="font-sans text-xs font-medium tabular-nums tracking-[0.18em] text-ink/70" aria-live="polite">
                {formatCount(centre + 1)} / {formatCount(n)}
              </span>
            )}
          </div>
          {preview ? null : <p className="mt-2.5 text-center font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink/70">Swipe · tap to open</p>}
        </>
      ) : null}

      {!preview && open !== null && urls[open] ? (
        <GalleryLightbox
          src={urls[open]!}
          kind="photo"
          label={`Photo ${formatCount(open + 1)} of ${formatCount(n)}`}
          caption={caption ?? undefined}
          onPrev={n > 1 ? () => setOpen((o) => (o === null ? o : (o - 1 + n) % n)) : undefined}
          onNext={n > 1 ? () => setOpen((o) => (o === null ? o : (o + 1) % n)) : undefined}
          onClose={() => {
            const at = open;
            setOpen(null);
            /* Land on the photo they were looking at. */
            const rail = railRef.current;
            if (rail) rail.scrollLeft = leftFor(at);
          }}
          actions={
            n > 1 ? (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => setOpen((o) => (o === null ? o : (o - 1 + n) % n))} className="sn-gal-btn flex h-11 w-11 items-center justify-center rounded-full text-xl">
                  ‹
                </button>
                <span className="sn-gal-soft font-mono text-xs tabular-nums tracking-[0.14em]">
                  {formatCount(open + 1)} / {formatCount(n)}
                </span>
                <button type="button" aria-label="Next photo" onClick={() => setOpen((o) => (o === null ? o : (o + 1) % n))} className="sn-gal-btn flex h-11 w-11 items-center justify-center rounded-full text-xl">
                  ›
                </button>
              </>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}
