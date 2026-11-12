'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

import {
  COVER_BEAT_MS,
  coverDragMove,
  coverStep,
  type CoverDrag,
  type CoverPhoto,
} from '@/lib/service-cover-show';

/**
 * service-face-cover-show.tsx — THE COVER THAT PLAYS. Drawn by `service-face.tsx` when a card has two photos or more;
 * the list, the beat and the swipe rule live in `lib/service-cover-show.ts` (the owner's words are there).
 *
 *   · PLAYS only while at least half of it is on screen, a new photo every 5 s, a 0.9 s fade. Reduced motion → it never
 *     moves by itself (every motion in the app), but a swipe still turns it, at once.
 *   · LOADS the first photo with the page — exactly the still cover it replaces — and the rest only once it is on
 *     screen and the page is idle. A card off screen costs one image, as before.
 *   · SWIPE the photo: left = next, right = back, wrapping. A swipe PAUSES this card (‖) until it leaves the screen.
 *   · WHERE THE SWIPE STARTS DECIDES: the photo owns a sideways drag that starts on it (`touch-action: pan-y` — up/down
 *     still scrolls the page). It never moves a sideways rail it sits in, and a row's swipe-to-delete never sees it
 *     (that one listens to touch events, which stop here). Start anywhere else on the card → the rail / the row, as
 *     before. Pointer events still bubble, so Find's long-press keeps its own 8 px slop: a swipe cancels a hold.
 *   · A TAP opens the card exactly as a tap anywhere on the face does: the photo sits above the face's door (or the
 *     caller's stretched link), so it hands the press to whatever the card's press would have hit. A tap that ENDS a
 *     swipe is swallowed — swiping never opens a card.
 */
/**
 * What a press at (x, y) would have hit were the photo not there — a true hit test: the TOPMOST element that is not
 * the photo. If that is one of the photo's own ancestors (the card sits inside the caller's link), nothing is handed
 * over and the press carries on up to it; a control painted BENEATH the card (a swipe row's hidden Delete) is never
 * reached, because only the topmost element counts.
 */
function underThePhoto(show: HTMLElement | null, x: number, y: number): HTMLElement | null {
  if (!show || typeof document.elementsFromPoint !== 'function') return null;
  const top = document.elementsFromPoint(x, y).find((el) => !show.contains(el));
  if (!top || top.contains(show)) return null;
  const target = top.closest<HTMLElement>('a[href], button');
  return target && !target.contains(show) ? target : null;
}

export function ServiceFaceCoverShow({ photos, cornerAbove = false }: { photos: readonly CoverPhoto[]; cornerAbove?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const drag = useRef<(CoverDrag & { id: number }) | null>(null);
  const swallow = useRef(false);
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [held, setHeld] = useState(false);
  const [quick, setQuick] = useState(false);
  const [still, setStill] = useState(false);
  const count = photos.length;

  // Reduced motion: never moves by itself.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // On screen (half of it) → may play. Off screen → stops, and a swipe's pause is forgotten.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setOnScreen(e.isIntersecting);
          if (!e.isIntersecting) setHeld(false);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The rest of the photos load once the card is on screen and the page has settled.
  useEffect(() => {
    if (armed || !onScreen) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setArmed(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setArmed(true), 900);
    return () => window.clearTimeout(t);
  }, [armed, onScreen]);

  // The beat.
  useEffect(() => {
    if (!onScreen || held || still || !armed || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => coverStep(i, 1, count)), COVER_BEAT_MS);
    return () => window.clearInterval(t);
  }, [onScreen, held, still, armed, count]);

  const flip = useCallback(
    (step: 1 | -1) => {
      setArmed(true);
      setQuick(true);
      setIndex((i) => coverStep(i, step, count));
      setHeld(true);
      window.setTimeout(() => setQuick(false), 300);
    },
    [count],
  );

  function onPointerDown(e: PointerEvent<HTMLSpanElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, flipped: false };
  }
  function onPointerMove(e: PointerEvent<HTMLSpanElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const wasUndecided = d.axis === null;
    const { drag: next, step } = coverDragMove(d, e.clientX, e.clientY);
    if (next.axis === 'y') {
      drag.current = null;
      return;
    }
    drag.current = { ...next, id: d.id };
    if (wasUndecided && next.axis === 'x') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer the browser already released — the swipe simply ends */
      }
    }
    if (step !== 0) flip(step);
  }
  function onPointerEnd() {
    if (drag.current?.axis === 'x') {
      swallow.current = true;
      window.setTimeout(() => {
        swallow.current = false;
      }, 400);
    }
    drag.current = null;
  }
  function onClick(e: MouseEvent<HTMLSpanElement>) {
    if (swallow.current) {
      swallow.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // A tap on the photo is a tap on the card: hand it to what the card's own press would have hit —
    //   1. the face's door (Find, the shop page, Explore);
    //   2. else whatever link or button lies UNDER the photo (the supplier's Services list stretches its "open in the
    //      Card Maker" link over the card as a sibling, not a parent);
    //   3. else nothing to hand over: the card sits INSIDE the caller's link (a bundle on the Shop page), so the press
    //      simply carries on up to it.
    const show = root.current;
    const face = show?.closest('[data-service-face]');
    const door = face?.querySelector<HTMLElement>(':scope > [data-service-face-door]') ?? underThePhoto(show, e.clientX, e.clientY);
    if (!door) return;
    e.preventDefault();
    e.stopPropagation();
    door.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        button: e.button,
      }),
    );
  }

  const caption = photos[index]?.caption ?? null;
  const fade = still ? 'transition-none' : quick ? 'transition-opacity duration-[250ms]' : 'transition-opacity duration-[900ms]';

  return (
    <span
      ref={root}
      data-cover-show=""
      data-cover-show-at={index}
      className="absolute inset-0 z-10 cursor-pointer touch-pan-y select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      // A row's swipe-to-delete listens to TOUCH events — a swipe that starts on the photo is the photo's.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {photos.map((p, k) =>
        k === 0 || armed ? (
          // eslint-disable-next-line @next/next/no-img-element -- already-resolved display URLs, like the still cover it replaces
          <img
            key={p.url}
            src={p.url}
            alt=""
            loading={k === 0 ? 'lazy' : undefined}
            decoding="async"
            draggable={false}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${fade} ${k === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : null,
      )}
      {held ? (
        <span
          aria-hidden
          data-cover-show-paused=""
          className="pointer-events-none absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center gap-[2px] rounded-full bg-black/45"
        >
          <span className="h-[7px] w-[2px] bg-white" />
          <span className="h-[7px] w-[2px] bg-white" />
        </span>
      ) : null}
      {caption ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-1 truncate rounded-full bg-black/45 px-1.5 py-0.5 text-center text-[9px] font-medium leading-tight text-white ${cornerAbove ? 'bottom-[26px]' : 'bottom-[5px]'}`}
        >
          {caption}
        </span>
      ) : (
        <span
          aria-hidden
          data-cover-show-dots=""
          className={`pointer-events-none absolute inset-x-0 flex justify-center gap-[3px] ${cornerAbove ? 'bottom-[26px]' : 'bottom-[5px]'}`}
        >
          {photos.map((p, k) => (
            <span
              key={p.url}
              className={`h-1 w-1 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)] ${k === index ? 'bg-white' : 'bg-white/55'}`}
            />
          ))}
        </span>
      )}
    </span>
  );
}
