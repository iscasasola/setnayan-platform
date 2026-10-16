'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';
import { formatCount } from '@/lib/format-number';

/**
 * 🎞 GLIMPSE — THE RAIL (owner 2026-10-15, DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED" + "GLIMPSE'S MOTION IS A SLOW
 * CONTINUOUS DRIFT, NOT A STEP"; prototype `photos_glimpse_style_2026-10-15_fable.html`).
 *
 * One 3:4 photo centred, the previous and next peeking in at both edges. The centre card is scale 1 · opacity 1;
 * a card one place away is .92 · .72 — MEASURED EVERY FRAME from each card's distance to the rail's centre, never an
 * index, so a half-swipe and the drift both look right as each photo passes the middle.
 *
 * THE DRIFT (owner, verbatim: *"is just slowly moves horizontally"*): a steady sideways glide, about one photo every
 * `DRIFT_SECONDS_PER_PHOTO`, an ENDLESS loop — the photos are drawn three times once the page is live and the rail
 * is moved back by exactly one copy whenever it leaves the middle copy, which looks like nothing at all (no
 * snap-back). Snap is OFF while it drifts and ON while the guest browses by hand. It pauses on touch, swipe, wheel,
 * hover and keyboard, and while the full-screen photo is open; it resumes `RESUME_AFTER_MS` after the last of them.
 * It never runs off screen (IntersectionObserver), in a hidden tab, or under reduced motion — there the rail is a
 * plain snap rail with no scale either.
 *
 * ⚠ THE SERVER DRAWS ONE PLAIN SNAP RAIL — every photo once, in order — so the page reads before any JavaScript;
 * the copies for the loop are added after it is live.
 *
 * Tap: the centre card opens the SHIPPED full-screen viewer (`GalleryLightbox`) — never a second one; a neighbour
 * tap only brings it to the centre. Where am I: dots up to `DOTS_MAX` photos, then "3 / 12".
 */
export const DRIFT_SECONDS_PER_PHOTO = 9;
export const RESUME_AFTER_MS = 6000;
export const DOTS_MAX = 8;
/** A neighbour one card away is drawn at this scale and opacity (the prototype's .92 / .72). */
export const GLIMPSE_SIDE_SCALE = 0.92;
export const GLIMPSE_SIDE_OPACITY = 0.72;

/** How many times the photos are drawn while the loop runs — the middle copy is the one the guest is in. */
const COPIES = 3;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function GlimpseRail({
  urls,
  label = 'Our photos',
  preview = false,
}: {
  urls: readonly string[];
  label?: string;
  /**
   * 👁 A PREVIEW is the same rail with nothing in it to press — for a place that sits INSIDE a button (Post Event's
   * gallery preview is the open-up's button, and a button may not hold buttons). Same drift, same emphasis, same
   * pause on touch and hover; the cards are plain boxes, there is no ‹ ›, no full-screen photo and no "tap to open"
   * line, and the region is not a tab stop — a tap anywhere is the parent's, which opens the whole gallery.
   */
  preview?: boolean;
}) {
  const n = urls.length;
  const railRef = useRef<HTMLDivElement>(null);
  /** Live after the first effect: the loop's copies are drawn and the emphasis is measured. */
  const [live, setLive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [centre, setCentre] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const loops = live && !reduced && n > 1;
  const copies = loops ? COPIES : 1;

  /* Everything the frame loop reads, kept off React's render so a frame never re-renders the rail. */
  const st = useRef({ pos: 0, last: 0, raf: 0, measureRaf: 0, pausedUntil: 0, hover: false, touching: false, onScreen: false, open: false, centre: 0, centreCard: 0 });

  useEffect(() => {
    setReduced(prefersReducedMotion());
    setLive(true);
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

  /** One copy's width: from the first card of a copy to the first card of the next. */
  const copyWidth = useCallback((): number => {
    const all = cards();
    if (copies < 2 || all.length < n * 2) return 0;
    return all[n]!.offsetLeft - all[0]!.offsetLeft;
  }, [cards, copies, n]);

  /** The scroll position that puts card `i` (an index into every drawn card) in the middle. */
  const leftFor = useCallback((i: number): number => {
    const rail = railRef.current;
    const c = cards()[i];
    if (!rail || !c) return 0;
    return c.offsetLeft + c.offsetWidth / 2 - rail.clientWidth / 2;
  }, [cards]);

  /** Keep the guest inside the middle copy — a jump of exactly one copy, which looks like nothing. */
  const wrap = useCallback(() => {
    const rail = railRef.current;
    const w = copyWidth();
    if (!rail || !w) return;
    const start = leftFor(n);
    if (rail.scrollLeft >= start + w) {
      rail.scrollLeft -= w;
      st.current.pos -= w;
    } else if (rail.scrollLeft < start) {
      rail.scrollLeft += w;
      st.current.pos += w;
    }
  }, [copyWidth, leftFor, n]);

  /** The emphasis, measured from each card's distance to the middle — and which photo is centred. */
  const measure = useCallback(() => {
    st.current.measureRaf = 0;
    const rail = railRef.current;
    if (!rail) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    const all = cards();
    let best = 0;
    let bestD = Infinity;
    all.forEach((c, i) => {
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
    st.current.centreCard = best;
    const photo = n > 0 ? best % n : 0;
    if (photo !== st.current.centre) {
      st.current.centre = photo;
      setCentre(photo);
    }
  }, [cards, n, reduced]);

  /* Once the copies are drawn, start in the middle copy, on the photo that was centred. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (loops) rail.scrollLeft = leftFor(n + st.current.centre);
    st.current.pos = rail.scrollLeft;
    measure();
  }, [loops, leftFor, measure, n]);

  /** Hold the drift for `ms` and give the guest's hand the snap back. */
  const pause = useCallback((ms = RESUME_AFTER_MS) => {
    st.current.pausedUntil = performance.now() + ms;
    const rail = railRef.current;
    if (rail && rail.dataset.glimpseSnap !== 'on') {
      rail.style.scrollSnapType = '';
      rail.dataset.glimpseSnap = 'on';
    }
  }, []);

  /* 🎞 The drift. One frame loop for the rail's life; it moves only when nothing holds it. */
  useEffect(() => {
    if (!loops) return;
    const rail = railRef.current;
    if (!rail) return;
    const s = st.current;
    s.last = performance.now();
    s.pos = rail.scrollLeft;
    const frame = (now: number) => {
      const dt = Math.min(64, now - s.last);
      s.last = now;
      const free = !s.hover && !s.touching && !s.open && s.onScreen && document.visibilityState === 'visible' && now >= s.pausedUntil;
      if (free) {
        if (rail.dataset.glimpseSnap !== 'off') {
          /* Snap off while it drifts — a mandatory snap would pull every small step back to the nearest photo. */
          rail.style.scrollSnapType = 'none';
          rail.dataset.glimpseSnap = 'off';
          s.pos = rail.scrollLeft;
        }
        const step = (cards()[1]?.offsetLeft ?? 0) - (cards()[0]?.offsetLeft ?? 0);
        s.pos += (step / DRIFT_SECONDS_PER_PHOTO) * (dt / 1000);
        rail.scrollLeft = s.pos;
        wrap();
        measure();
      } else {
        s.pos = rail.scrollLeft;
      }
      s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(s.raf);
  }, [loops, cards, measure, wrap]);

  /* Only while it is on screen. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) st.current.onScreen = e.isIntersecting;
    });
    io.observe(rail);
    return () => io.disconnect();
  }, []);

  /* The full-screen photo holds the drift; ← → move it, as in the rail. */
  useEffect(() => {
    st.current.open = open !== null;
    if (open === null || n < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % n));
      else if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + n) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n]);

  /* Measure as the rail moves, and again on a resize. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => {
      if (!st.current.measureRaf) st.current.measureRaf = requestAnimationFrame(() => {
        wrap();
        measure();
      });
    };
    const onResize = () => {
      rail.scrollLeft = leftFor((loops ? n : 0) + st.current.centre);
      st.current.pos = rail.scrollLeft;
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
  }, [leftFor, loops, measure, n, wrap]);

  /** Bring photo `photo` to the middle — the nearest drawn copy of it. */
  const bring = useCallback(
    (cardIndex: number) => {
      const rail = railRef.current;
      if (!rail) return;
      pause();
      rail.style.scrollSnapType = '';
      rail.scrollTo({ left: leftFor(cardIndex), behavior: reduced ? 'auto' : 'smooth' });
    },
    [leftFor, pause, reduced],
  );

  const step = (by: 1 | -1) => {
    const all = cards();
    const rail = railRef.current;
    if (!rail || all.length === 0) return;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    all.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const next = best + by;
    if (next < 0 || next >= all.length) return;
    bring(next);
  };

  const drawn = Array.from({ length: copies }, (_, copy) => urls.map((url, i) => ({ url, i, copy })));
  const ends = !loops;

  return (
    <div
      className="group relative"
      data-glimpse=""
      /* A MOUSE hovering holds it — never a finger: a tap fires compatibility mouse events with no leave after
         them, which held the drift for good (measured in the lab walk, 2026-10-15). */
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        st.current.hover = true;
        pause(0);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        st.current.hover = false;
        pause();
      }}
    >
      <div
        ref={railRef}
        className="sn-glimpse-rail flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-7 pt-3 outline-none sm:gap-[18px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', paddingInline: 'calc((100% - var(--g-w)) / 2)', ['--g-w' as string]: 'min(62vw, 380px)' }}
        {...(preview ? { 'aria-hidden': true } : { role: 'region', 'aria-roledescription': 'carousel', 'aria-label': label, tabIndex: 0 })}
        data-glimpse-snap="on"
        onPointerDown={() => {
          st.current.touching = true;
          pause();
        }}
        onPointerUp={() => {
          st.current.touching = false;
          pause();
        }}
        onPointerCancel={() => {
          st.current.touching = false;
          pause();
        }}
        onTouchStart={() => {
          st.current.touching = true;
          pause();
        }}
        onTouchEnd={() => {
          st.current.touching = false;
          pause();
        }}
        onWheel={() => pause()}
        onFocus={() => pause()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pause();
            setOpen(st.current.centre);
          }
        }}
      >
        {drawn.flat().map(({ url, i, copy }, k) => {
          const cardClass =
            'relative !min-h-0 block aspect-[3/4] w-[var(--g-w)] shrink-0 snap-center overflow-hidden rounded-card bg-ink/5 p-0 shadow-[0_6px_16px_rgb(var(--color-ink)/0.14)] [opacity:var(--g-o,1)] [transform:scale(var(--g-s,1))] motion-safe:transition-[transform,opacity] motion-safe:duration-200';
          /* eslint-disable-next-line @next/next/no-img-element */
          const img = <img src={url} alt="" aria-hidden loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />;
          if (preview) {
            return (
              <span key={`${copy}-${i}-${url.slice(0, 24)}`} data-glimpse-card="" data-glimpse-photo={i} aria-hidden className={cardClass}>
                {img}
              </span>
            );
          }
          return (
            <button
              key={`${copy}-${i}-${url.slice(0, 24)}`}
              type="button"
              data-glimpse-card=""
              data-glimpse-photo={i}
              tabIndex={-1}
              aria-hidden={copy === (loops ? 1 : 0) ? undefined : true}
              aria-label={`Photo ${formatCount(i + 1)} of ${formatCount(n)}`}
              onClick={() => {
                if (k === st.current.centreCard) {
                  pause();
                  setOpen(i);
                } else {
                  bring(k);
                }
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
            disabled={ends && centre === 0}
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
            disabled={ends && centre === n - 1}
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
          onClose={() => {
            const at = open;
            setOpen(null);
            pause();
            const rail = railRef.current;
            if (rail) rail.scrollLeft = leftFor((loops ? n : 0) + at);
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
