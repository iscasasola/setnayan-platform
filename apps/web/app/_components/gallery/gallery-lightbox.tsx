'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import { creditLine } from '@/lib/capture-credit-pure';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';

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
 *
 * ── `screen` — THE INSPIRATION VIEWER'S LAYOUT (owner 2026-10-30, live iPhone, on Memories' old photo sheet) ─────────
 * *"the preview is wrong and the buttons are not arranged properly to our design template. like how we open
 * inspiration photos but with the buttons for memories."* The template is the APPROVED Suppliers › Find viewer
 * (`carry-2026-10-29/suppliers-final-proto`, `drawViewer`): the whole screen, ✕ and "2 of 6 · …" on the top line, the
 * photo large with ‹ › and a sideways swipe, what it is under it, then ONE row of equal buttons in the thumb zone.
 * It is a layout of THIS viewer, not a second viewer — the portal, Back, the focus trap, the swipes and the opaque
 * ground are the same code — so Find's inspiration photos can open in it too when that viewer is built.
 *   · `panel` rises from the bottom INSIDE the viewer (a Share, a Tag list, a confirm) — never a page sheet under it;
 *   · `blur` keeps a frame the content screen withheld blurred until the host presses "Look at it".
 * 🔒 `app/_components/memories/memories-photos-open-in-the-shared-viewer.test.ts`.
 */
export type GalleryScreen = {
  /** "3 of 40 · Papic" — the top line. */
  counter: string;
  /** A small press at the top right (⋯ More) — absent = a spacer, so the counter stays centred. */
  more?: ReactNode;
  eyebrow?: string | null;
  title?: ReactNode;
  sub?: ReactNode;
  /** The one row of equal buttons, in the thumb zone. */
  toolbar?: ReactNode;
  /** A panel risen over the bottom of the viewer — the caller owns what it holds and how it closes. */
  panel?: ReactNode;
  onPanelClose?: () => void;
  /** Held back by the content screen: drawn blurred until "Look at it". */
  blur?: boolean;
};

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
  screen,
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
  /** The template's whole-screen layout (see `GalleryScreen`) — absent = the card, as every other surface draws it. */
  screen?: GalleryScreen;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(false);
  /* A withheld frame is blurred again on every move — "Look at it" is for the one frame it was pressed on. */
  useEffect(() => setPeek(false), [src]);
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
    /* A tall card (the guest's own controls under the photo) scrolls — only a pull from its top dismisses. */
    else if (s.axis === 'y') setDragY(dy > 0 && (dialogRef.current?.scrollTop ?? 0) <= 0 ? dy : 0);
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
  if (screen) {
    const blurred = Boolean(screen.blur) && !peek;
    const slide = dragY > 0 ? `translateY(${dragY}px)` : dragX !== 0 ? `translateX(${dragX}px)` : undefined;
    return createPortal(
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (kind === 'clip' ? 'Video clip' : 'Photograph')}
        tabIndex={-1}
        data-photo-viewer="screen"
        className="sn-gal-scrim fixed inset-0 z-[80] flex flex-col overscroll-contain text-[var(--sn-ob-text)] outline-none"
      >
        {/* THE TOP LINE — ✕ · "3 of 40 · Papic" · (⋯) */}
        <div className="flex shrink-0 items-center gap-2 px-2 pb-1 pt-[max(6px,env(safe-area-inset-top))]" data-viewer-top="">
          <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
          <span className="sn-gal-soft min-w-0 flex-1 truncate text-center text-[13.5px]" data-viewer-counter="">
            {screen.counter}
          </span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center">{screen.more ?? null}</span>
        </div>

        {/* THE PHOTO — as large as the screen allows; a sideways swipe moves, a pull down closes. */}
        <div
          className="relative min-h-0 flex-1 touch-pan-y overflow-hidden"
          data-viewer-stage=""
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="absolute inset-3 flex items-center justify-center" style={slide ? { transform: slide } : undefined}>
            {kind === 'clip' ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={src} poster={posterSrc ?? undefined} controls autoPlay playsInline loop className="max-h-full max-w-full rounded-card bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" draggable={false} className={`max-h-full max-w-full rounded-card object-contain ${blurred ? 'blur-[22px]' : ''}`} />
            )}
          </div>
          {blurred ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <button type="button" onClick={() => setPeek(true)} className="sn-gal-btn min-h-[44px] rounded-full bg-[rgb(23_22_15/0.66)] px-4 text-[14px] font-medium">
                Held back · Look at it
              </button>
            </span>
          ) : null}
          {onPrev ? (
            <button type="button" onClick={onPrev} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(23_22_15/0.55)]">
              <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
          {onNext ? (
            <button type="button" onClick={onNext} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(23_22_15/0.55)]">
              <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {/* WHAT IT IS — then the one row of buttons, in the thumb zone. */}
        <div className="shrink-0 px-4 pt-2.5" data-viewer-details="">
          {screen.eyebrow ? <p className="sn-gal-soft font-mono text-[10.5px] uppercase tracking-[0.14em]">{screen.eyebrow}</p> : null}
          {screen.title ? <div className="text-[17px] font-semibold leading-snug">{screen.title}</div> : null}
          {screen.sub ? <div className="sn-gal-soft text-[13.5px] leading-snug">{screen.sub}</div> : null}
        </div>
        {screen.toolbar ? (
          <div className="shrink-0 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-3" data-viewer-toolbar="">
            {screen.toolbar}
          </div>
        ) : (
          <div className="shrink-0 pb-[max(14px,env(safe-area-inset-bottom))]" />
        )}

        {/* A PANEL — risen over the bottom of the viewer (Share · Tag · a confirm); a tap above it puts it away. */}
        {screen.panel ? (
          <>
            <OverlayBackdrop onClose={screen.onPanelClose ?? (() => undefined)} label="Close this panel" className="z-10" />
            <div
              data-viewer-panel=""
              className="absolute inset-x-0 bottom-0 z-20 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-[rgb(251_250_247/0.14)] bg-[var(--sn-ob-card)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-30px_80px_rgb(0_0_0/0.5)]"
            >
              <div className="flex justify-center pb-2" aria-hidden>
                <i className="h-1 w-11 rounded-full bg-[rgb(251_250_247/0.28)]" />
              </div>
              {screen.panel}
            </div>
          </>
        ) : null}
      </div>,
      host,
    );
  }
  return createPortal(
    <div
      data-photo-viewer=""
      data-overlay-backdrop=""
      className="sn-gal-scrim fixed inset-0 z-[80] flex items-center justify-center overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (kind === 'clip' ? 'Video clip' : 'Photograph')}
        tabIndex={-1}
        className="sn-gal-lb-card relative flex max-h-full w-full max-w-2xl flex-col overflow-y-auto overscroll-contain outline-none"
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
