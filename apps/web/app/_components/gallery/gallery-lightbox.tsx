'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import { creditLine } from '@/lib/capture-credit-pure';

/**
 * THE SHARED GALLERY LIGHTBOX — one photograph or one clip, full attention.
 *
 * Gallery archetype § 2: *"Lightbox honours the scroll. It rises 26px over the
 * grid in 240ms and swipe-down dismisses it; the grid never re-renders, so you
 * land exactly where you left."* It is drawn ONCE in the archetype and shared by
 * every gallery surface, so it is one component here too — unlike the three
 * grids, which are genuinely three different screens.
 *
 * ⚠ THE GRID MUST NOT RE-RENDER. That is why this takes the opened item as a
 * prop and owns nothing about the collection: the caller holds one piece of
 * state (which item is open) and the tiles above it are untouched.
 *
 * COLOURS: obsidian tokens only. Every theme colour is unreadable here — see the
 * measured table beside `--sn-ob-*` in globals.css.
 *
 * ── A REAL FULL-SCREEN VIEWER (owner 2026-10-24, two reports in one day) ─────────────────────────────────────────
 * *"when i opened the QR Code, there is no way to go back"* — and a Love Story photo opened SEE-THROUGH: the story's
 * own words, a blurred copy of a photo and the rail's side cards all over the picture.
 *
 * 🔑 `fixed inset-0` IS NOT "THE SCREEN" INSIDE A CONTAINED BOX. A Love Story moment's photo slot is a size container
 * (`container-type: inline-size`, which is layout containment) and wears the look's entrance (`transform`, `opacity`,
 * `filter`). Each of those makes the box the containing block of every `position: fixed` inside it — so the "full
 * screen" viewer was the size of the moment, and inherited its fade. Nothing in this file was wrong; WHERE it was
 * mounted was. So it is PORTALLED to `document.body` and no ancestor can shrink it or see through it again.
 *
 *   · the ground is OPAQUE (`.sn-gal-scrim`, the obsidian page) — nothing of the page shows through;
 *   · ✕, Escape, a tap outside, swipe-down AND the phone's Back all close it (`useBackCloses`, one history entry);
 *   · ‹ › and a sideways swipe move it when the caller has neighbours (`onPrev` / `onNext`);
 *   · the page under it does not scroll (`useModalA11y`'s lock).
 * 🔒 Held by `lib/a-photo-viewer-is-a-real-screen.test.ts`.
 */
export function GalleryLightbox({
  src,
  posterSrc,
  kind,
  capturedByName,
  capturedAt,
  timeZone,
  onClose,
  actions,
  label,
  caption,
  plate = 'dark',
  onPrev,
  onNext,
}: {
  /** The full image, or the playable video for a clip. */
  src: string;
  /** Poster frame for a clip (ignored for photos). */
  posterSrc?: string | null;
  kind: 'photo' | 'clip';
  capturedByName?: string | null;
  capturedAt?: string | null;
  timeZone?: string | null;
  onClose: () => void;
  /** Surface-specific controls (save, download, "not me"). */
  actions?: ReactNode;
  label?: string;
  /** The line under the picture — a moment's title, a gift method's name and account. */
  caption?: ReactNode;
  /**
   * `white` draws the picture on a white plate with a quiet margin — for a QR code, which a banking app on ANOTHER
   * phone must be able to scan (a dark ground around it defeats the scanner's quiet zone). Absent = the photograph
   * on black, as before.
   */
  plate?: 'dark' | 'white';
  /** The neighbours — a sideways swipe (and the caller's own ‹ ›) moves to them. Absent = one picture. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  /* Every way out goes through history, so Back closes it and ✕ takes our entry back off. */
  const close = useBackCloses(true, onClose);
  useModalA11y({ open: true, onClose: close, containerRef: dialogRef });
  /* The portal's host. This is only ever mounted by a tap (never server-drawn open), so the document is there on the
     first render — and the dialog exists when `useModalA11y` moves focus into it. */
  const host = typeof document === 'undefined' ? null : document.body;

  const credit = creditLine(capturedByName, capturedAt, timeZone);

  // Swipe down to dismiss — the archetype's own gesture — and sideways to move
  // when there are neighbours. The first 10px decide the axis, so a vertical
  // drag never nudges the picture sideways. Touch only: a mouse has the
  // backdrop, the buttons and the keys, and binding a drag to it would fight
  // text selection inside the card.
  const sideways = Boolean(onPrev || onNext);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = t ? { x: t.clientX, y: t.clientY, axis: null } : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    const t = e.touches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) s.axis = sideways && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (s.axis === 'x') setDragX(dx);
    else if (s.axis === 'y') setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    if (dragY > 110) close();
    else if (dragX < -60) onNext?.();
    else if (dragX > 60) onPrev?.();
    setDragY(0);
    setDragX(0);
    start.current = null;
  };

  if (!host) return null;
  return createPortal(
    <div
      data-photo-viewer=""
      className="sn-gal-scrim fixed inset-0 z-[80] flex items-center justify-center overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (kind === 'clip' ? 'Video clip' : 'Photograph')}
        tabIndex={-1}
        className="sn-gal-lb-card relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden outline-none"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center py-2" aria-hidden>
          <i className="h-1 w-11 rounded-full bg-[rgb(251_250_247/0.28)]" />
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="sn-gal-btn absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(23_22_15/0.66)]"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        {kind === 'clip' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={src}
            poster={posterSrc ?? undefined}
            controls
            autoPlay
            playsInline
            loop
            className="max-h-[70vh] w-full bg-black object-contain"
          />
        ) : (
          // Presigned URL — a plain <img>; the optimizer would cache an expiring
          // URL, and this is the same rule every tile in the product follows.
          plate === 'white' ? (
            <div data-viewer-plate="white" className="mx-4 mt-10 flex justify-center rounded-xl bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={label ?? ''} className="max-h-[62vh] w-full max-w-[22rem] object-contain" />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={src} alt="" className="max-h-[70vh] w-full bg-black object-contain" />
          )
        )}

        <div className="p-4 sm:p-5">
          {caption ? <div data-viewer-caption="" className="sn-gal-text mb-2 text-sm leading-snug">{caption}</div> : null}
          {credit ? (
            <p className="sn-gal-soft font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
              By {credit}
            </p>
          ) : null}
          {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        <p className="sn-gal-soft pb-3 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] opacity-70">
          Swipe down to close
        </p>
      </div>
    </div>,
    host,
  );
}
