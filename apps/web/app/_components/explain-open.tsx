'use client';

/**
 * explain-open.tsx — what an ⓘ (`explain.tsx`) OPENS: the centred popup on a phone, the attached note on a computer.
 * Its own chunk, loaded on the ⓘ's first press (see `explain.tsx`), so the many screens that draw an ⓘ do not carry
 * the code of a popup most visits never open. The rules are the ⓘ's, unchanged: on a phone the rest of the screen is
 * dark and blurred and out of reach (`inertBehind`), Esc closes and Tab stays inside (`useModalA11y`), a tap on the
 * dark closes it; on a computer a note under the ⓘ that does not darken the page.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { inertBehind } from '@/lib/popup-behind';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { placePickList, type PickListPlacement } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import { EXPLAIN_NOTE_WIDTH } from './explain';

/** A phone: the centre of the screen, dark and blurred behind, one button. */
export function ExplainPopup({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const got = useRef<HTMLButtonElement>(null);
  const headId = useId();
  /* Nothing behind works: every branch of the page but this one is out of reach, and put back exactly on close. */
  useLayoutEffect(() => {
    const el = root.current;
    return el ? inertBehind(el) : undefined;
  }, []);
  /* The app's one modal contract: Esc closes, Tab stays inside, the page behind does not scroll. */
  useModalA11y({ open: true, onClose, containerRef: panel, initialFocusRef: got });
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={root} data-explain-popup="" className="fixed inset-0 z-[96]">
      {/* A tap on the dark closes it — the dark IS the close button (one layer, so the page lock keeps it live). */}
      <OverlayBackdrop onClose={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        tabIndex={-1}
        className="sn-explain-pop absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-48px)] w-[min(320px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-cream px-5 pb-3.5 pt-[22px] text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)] focus:outline-none"
      >
        <b id={headId} className="block text-[18px] font-semibold leading-snug text-ink">
          {title}
        </b>
        <div data-explain-words="" className="mt-2 flex flex-col gap-2 text-[15px] leading-normal text-ink/70">
          {children}
        </div>
        <button
          ref={got}
          type="button"
          data-explain-got-it=""
          onClick={onClose}
          className="sn-press sn-press-ring mt-4 flex h-12 w-full flex-none items-center justify-center rounded-full bg-sn-accent text-[15px] font-semibold text-sn-on-accent"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** A computer: a small note under the ⓘ. It is attached to its button and does not darken the page. */
export function ExplainNote({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const note = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<PickListPlacement | null>(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      /* Under the ⓘ, its left edge a little before the dot; flipped above when there is no room below; never off the screen. */
      setAt(
        placePickList({
          button: { top: r.top, bottom: r.bottom, left: r.left + r.width / 2 - 34, width: EXPLAIN_NOTE_WIDTH },
          listHeight: note.current?.scrollHeight ?? 0,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!note.current?.contains(t) && !anchor.current?.contains(t)) shut.current();
    };
    /* Esc peels ONE layer — heard before a sheet or a modal this note may sit in. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shut.current();
      anchor.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchor]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={note}
      role="dialog"
      aria-label={title}
      data-explain-note=""
      data-explain-side={at?.side}
      style={{ position: 'fixed', top: at?.top ?? 0, left: at?.left ?? 0, width: EXPLAIN_NOTE_WIDTH, maxHeight: at?.maxHeight, visibility: at ? 'visible' : 'hidden' }}
      /* The house's own desktop list look (the dropdown's): glass and a shadow, no outline. */
      className="sn-explain-note sn-glass-bare z-[95] overflow-y-auto overscroll-contain rounded-2xl px-4 py-3.5 text-left shadow-[0_18px_40px_-18px_rgba(30,26,18,.45)]"
    >
      <b className="block text-[15px] font-semibold text-ink">{title}</b>
      <div data-explain-words="" className="mt-1 flex flex-col gap-1.5 text-[13.5px] leading-normal text-ink/70">
        {children}
      </div>
    </div>,
    document.body,
  );
}
