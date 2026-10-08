'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOneOpen } from '@/lib/one-open';
import { inertBehind } from '@/lib/popup-behind';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { placePickList, type PickListPlacement } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';

/**
 * ⓘ EXPLANATION — the longer "what is this", behind its own small button (`INTERACTION_RULES.md` § 9, kind 7;
 * approved gallery `prototypes/control_templates_2026-10-08.html` § 7).
 *
 * Owner, 2026-10-08: *"explanation on what you show is for desktop / there is an appropriate info like a center
 * screen popup?"* · on the Page card: *"a small (i) that will give a more detailed explanation"*.
 *
 *   · ITS OWN 44-PX TARGET, beside the thing it explains — never inside another button (a tap on it must not also
 *     press the row or open the card);
 *   · ON A PHONE: a popup in the centre of the screen with ONE button, "Got it". The pop-up rule holds — the rest of
 *     the screen is dark and blurred (`.sn-popup-dark`), nothing behind it works (`inertBehind`), the page behind
 *     does not scroll and Esc closes (`useModalA11y`), and a tap on the dark closes it;
 *   · ON A COMPUTER: a small note under the ⓘ, attached to it — it does not darken the page. A press anywhere else,
 *     or Esc, closes it;
 *   · ONE OPEN AT A TIME (`useOneOpen`): opening one closes any other explanation, dropdown or fold's peer.
 *
 * Only for what a person does NOT need in order to act. Costs, dates, errors and consequences stay on the page.
 * No colour is chosen here: the mark and the button are the app's accent (`sn-accent`).
 * (`InfoTip` is the older `(i)` — a hover note that prints its own label; a screen moves to this one when it moves
 * onto the templates.)
 */

/** A phone's width — the same line the Maker's sheet and every `PickMenu` draw (below `lg`). */
export const EXPLAIN_PHONE_QUERY = '(max-width: 1023.98px)';
/** The desktop note's width. */
export const EXPLAIN_NOTE_WIDTH = 280;

/** How an explanation opens at this width: the centred popup on a phone, the attached note on a computer. */
export function explainOpensAs(viewportWidth: number): 'popup' | 'note' {
  return viewportWidth < 1024 ? 'popup' : 'note';
}

export function Explain({
  title,
  children,
  label,
  className = '',
  data,
}: {
  /** The popup's heading — the name of the thing explained ("Look", "Event name"). */
  title: string;
  /** The explanation: a sentence or three, plain words. */
  children: ReactNode;
  /** The button's name for a screen reader. Defaults to "About <title>". */
  label?: string;
  className?: string;
  /** `data-explain="<data>"`. */
  data?: string;
}) {
  const [open, setOpen] = useState<'popup' | 'note' | null>(null);
  useOneOpen(open !== null, () => setOpen(null));
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        data-explain={data ?? ''}
        aria-label={label ?? `About ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        onClick={() => setOpen((o) => (o ? null : explainOpensAs(window.innerWidth)))}
        className={`sn-press group/explain inline-flex h-11 w-11 flex-none items-center justify-center rounded-full ${className}`}
      >
        <span
          aria-hidden
          className="sn-press-ring inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-ink/15 bg-white text-[12px] font-bold leading-none text-sn-accent transition-colors duration-sn-control ease-sn group-aria-expanded/explain:border-sn-accent group-aria-expanded/explain:bg-sn-accent group-aria-expanded/explain:text-sn-on-accent"
        >
          i
        </span>
      </button>
      {open === 'popup' ? (
        <ExplainPopup title={title} onClose={close}>
          {children}
        </ExplainPopup>
      ) : open === 'note' ? (
        <ExplainNote title={title} anchor={btn} onClose={close}>
          {children}
        </ExplainNote>
      ) : null}
    </>
  );
}

/** A phone: the centre of the screen, dark and blurred behind, one button. */
function ExplainPopup({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
      {/* A tap on the dark closes it. */}
      <button type="button" aria-label="Close" data-explain-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default touch-none" />
      <span aria-hidden className="sn-popup-dark pointer-events-none absolute inset-0" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        tabIndex={-1}
        className="sn-explain-pop absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-48px)] w-[min(320px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white px-5 pb-3.5 pt-[22px] text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)] focus:outline-none"
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
function ExplainNote({
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
