'use client';

import { useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
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
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });

  const credit = creditLine(capturedByName, capturedAt, timeZone);

  // Swipe down to dismiss — the archetype's own gesture. Touch only: a mouse
  // has the backdrop, the close button and Esc, and binding a drag to it would
  // fight text selection inside the card.
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    if (dragY > 110) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div
      className="sn-gal-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (kind === 'clip' ? 'Video clip' : 'Photograph')}
        tabIndex={-1}
        className="sn-gal-lb-card relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden outline-none"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
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
          onClick={onClose}
          aria-label="Close"
          className="sn-gal-btn absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(23_22_15/0.66)]"
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-[70vh] w-full bg-black object-contain" />
        )}

        <div className="p-4 sm:p-5">
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
    </div>
  );
}
