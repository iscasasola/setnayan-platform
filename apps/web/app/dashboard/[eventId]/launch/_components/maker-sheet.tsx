'use client';

import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  HALF_SHEET_CLOSED,
  HALF_SHEET_SLIM,
  HALF_SHEET_TAP_PX,
  halfSheetHeightClass,
  halfSheetReducer,
  isCanvasTapEmpty,
  slimBarWords,
} from '@/lib/maker-half-sheet';

/**
 * 📱 THE MAKER'S PHONE SHEET — owner, live phone test 2026-10-02: *"dim the
 * negative space so they know it is a pop up and pressing on the dimmed part
 * will go back to the main screen"* (the approved phone layout, frame G/I of
 * `prototypes/maker_in_four_2026-09-30_fable.html`).
 *
 * Every Maker editor on a phone is a BOTTOM SHEET over a DIMMED page:
 *   · `SheetScrim` — ink at 40% over the page (the top bar stays live, so
 *     Apply is always in reach); a tap on it closes the sheet. Nothing is dimmed
 *     while no sheet is open — the scrim is drawn only with an open sheet.
 *   · `SheetGrip` — the handle at the sheet's top: a tap, or a drag down,
 *     closes it.
 * The sheet itself wears the room cap (`MAKER_PHONE_PANEL_CAP`,
 * lib/maker-phone-room.ts), so the dimmed page keeps ≥ 55% of the visible
 * height. Phone only (`lg:hidden`): a desktop's panels sit beside the page.
 */

/** The dimmed page behind an open sheet, below the top bar (52 px — `MAKER_PHONE_BAR_PX`). */
export function SheetScrim({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close and go back to the page"
      data-sheet-scrim=""
      onClick={onClose}
      className="fixed inset-x-0 bottom-0 top-[52px] z-[29] cursor-default bg-ink/40 lg:hidden"
    />
  );
}

/** The grab handle: a tap or a drag down closes the sheet. */
export function SheetGrip({ onClose }: { onClose: () => void }) {
  const from = useRef<number | null>(null);
  return (
    <button
      type="button"
      aria-label="Close"
      data-sheet-grip=""
      onPointerDown={(e) => {
        from.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const start = from.current;
        from.current = null;
        if (start === null) return;
        const dy = e.clientY - start;
        if (dy > 24 || Math.abs(dy) < 6) onClose();
      }}
      onClick={(e) => {
        // A keyboard press (no pointer) closes too.
        if (e.detail === 0) onClose();
      }}
      className="flex h-6 w-full shrink-0 touch-none items-center justify-center lg:hidden"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-ink/20" />
    </button>
  );
}

/** A phone, by the Maker's own breakpoint (`lg`): the half sheet's moves are the phone's. */
function onPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023.98px)').matches;
}

/**
 * ▁ THE HALF SHEET — owner 2026-10-04 ("EVENT DETAILS / MAKER: FOUR FIXES BEFORE
 * BUILD" + "TAPPING THE PAGE OUTSIDE THE SELECTED ELEMENT COLLAPSES ITS SHEET TO
 * A SLIM BAR"; screen 8 of `prototypes/event_details_improved_2026-10-04_fable.html`).
 * The shape every Maker sheet over the canvas mounts into; its moves are the
 * pure reducer in `lib/maker-half-sheet.ts`.
 *
 * On a phone:
 *   · it rests at HALF the screen (`HALF_SHEET_REST`) and the page above it is
 *     NOT dimmed and stays live — the edited scene is brought into view above
 *     the sheet (`onReveal`), so a change is seen as it is made, and a tap on
 *     another element switches the sheet to it (the parent hands a new `target`);
 *   · the grab handle drags it up for more rows and back down; down from half,
 *     or a tap on the page where nothing is selectable (the canvas's `tapEmpty`),
 *     collapses it to a SLIM BAR ("Names · Motion ▴") that restores on a tap;
 *   · Peek — press and hold — slides it away while held, to see the whole scene;
 *   · × closes and deselects (`onClose`).
 * On a desktop it is the panel beside the page, exactly as before
 * (`desktopClassName`): every phone move wears a `max-lg:` class.
 *
 * 🔒 NOTHING HERE WRITES. Opening, dragging, peeking and collapsing are state
 * of the draw; there is no action, save or fetch in this module
 * (`lib/a-phone-sheet-opens-at-half.test.ts`).
 */
export function MakerHalfSheet({
  label,
  title,
  target,
  section = null,
  closeLabel = 'Close',
  onClose,
  onReveal,
  desktopClassName = '',
  style,
  beforeGrip = null,
  children,
}: {
  /** The sheet's accessible name (the aside's `aria-label`). */
  label: string;
  /** Its title — the Hub's own name for what is being edited. */
  title: string;
  /** What is selected (a scene, a row, an element) — a new one switches the sheet to it. */
  target: string;
  /** The section the sheet is on (a tab) — the slim bar says it ("Names · Motion ▴"). */
  section?: string | null;
  closeLabel?: string;
  /** × — close and deselect. */
  onClose: () => void;
  /** 📱 Bring the edited thing into view ABOVE the sheet (the canvas's own scroll). */
  onReveal?: (target: string) => void;
  /** The desktop's own classes (`lg:…`) — the panel beside the page. */
  desktopClassName?: string;
  style?: CSSProperties;
  /** Drawn before the grip — the desktop's resize handle. */
  beforeGrip?: ReactNode;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(halfSheetReducer, HALF_SHEET_CLOSED, (s) =>
    halfSheetReducer(s, { type: 'open', target, section }),
  );
  /* A new target (a tap on another element, a navigator pick) switches the sheet. */
  useEffect(() => {
    dispatch({ type: 'open', target });
  }, [target]);
  useEffect(() => {
    dispatch({ type: 'section', section });
  }, [section]);
  /* 🫳 A tap on the page where nothing is selectable → the slim bar (phone only). */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !isCanvasTapEmpty(e.data) || !onPhone()) return;
      dispatch({ type: 'tapEmpty' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  /* 📱 The edited thing in view above the sheet — on opening, on a switch, on a restore. */
  const shown = state.size === 'half' || state.size === 'up';
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;
  useEffect(() => {
    if (shown && state.target && onPhone()) revealRef.current?.(state.target);
  }, [shown, state.target]);

  /* The grab handle: follows a drag down live; let go → the reducer decides. */
  const from = useRef<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const endDrag = (clientY: number | null) => {
    const start = from.current;
    from.current = null;
    setDragDy(0);
    if (start === null || clientY === null) return;
    const dy = clientY - start;
    dispatch(Math.abs(dy) < HALF_SHEET_TAP_PX ? { type: 'gripTap' } : { type: 'drag', dy });
  };

  /* Peek — held while pressed; a pointer captured on the button keeps it until let go. */
  const peekOn = () => dispatch({ type: 'peekStart' });
  const peekOff = () => dispatch({ type: 'peekEnd' });

  const slim = state.size === 'slim';
  const words = slimBarWords(title, section);
  return (
    <>
      <aside
        aria-label={label}
        data-phone-chrome="panel"
        data-half-sheet={state.size}
        data-peeking={state.peeking ? '' : undefined}
        style={{ ...style, ...(dragDy > 0 ? { transform: `translateY(${dragDy}px)` } : {}) }}
        className={`sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl ${halfSheetHeightClass(state.size)} ${
          slim ? 'max-lg:hidden' : ''
        } ${state.peeking ? 'max-lg:translate-y-[calc(100%-64px)]' : ''} ${
          dragDy > 0 ? '' : 'transition-[height,transform] duration-200 ease-out motion-reduce:transition-none'
        } lg:transform-none ${desktopClassName}`}
      >
        {beforeGrip}
        <button
          type="button"
          aria-label={state.size === 'up' ? 'Show less' : 'Show more'}
          data-sheet-grip=""
          data-half-sheet-grip=""
          onPointerDown={(e) => {
            from.current = e.clientY;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (from.current !== null) setDragDy(Math.max(0, e.clientY - from.current));
          }}
          onPointerUp={(e) => endDrag(e.clientY)}
          onPointerCancel={() => endDrag(null)}
          onClick={(e) => {
            // A keyboard press (no pointer): half ⇄ up.
            if (e.detail === 0) dispatch({ type: 'gripTap' });
          }}
          className={`flex h-6 w-full shrink-0 touch-none items-center justify-center lg:hidden ${state.peeking ? 'opacity-0' : ''}`}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-ink/20" />
        </button>
        <div className="flex items-center gap-2 px-4 pt-1 lg:pt-3">
          <p className={`min-w-0 flex-1 truncate font-serif text-lg text-ink ${state.peeking ? 'max-lg:opacity-0' : ''}`}>{title}</p>
          {/* 👁 PEEK — press and hold: the sheet slides away while held (phone). */}
          <button
            type="button"
            aria-pressed={state.peeking}
            aria-label="Peek — hold to see the whole page"
            data-half-sheet-peek=""
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              peekOn();
            }}
            onPointerUp={peekOff}
            onPointerCancel={peekOff}
            onLostPointerCapture={peekOff}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                peekOn();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') peekOff();
            }}
            onBlur={peekOff}
            onContextMenu={(e) => e.preventDefault()}
            className={`sn-press inline-flex h-11 shrink-0 touch-none select-none items-center rounded-full px-3.5 text-[12px] font-semibold tracking-wide ring-1 [-webkit-touch-callout:none] lg:hidden ${
              state.peeking ? 'bg-ink text-cream ring-ink' : 'bg-white text-ink/75 ring-ink/15'
            }`}
          >
            Peek
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            data-half-sheet-close=""
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {children}
      </aside>
      {state.peeking ? (
        <p
          role="status"
          data-half-sheet-peek-note=""
          className="pointer-events-none fixed bottom-[76px] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-cream shadow-lg lg:hidden"
        >
          Peek · let go and the sheet is back
        </p>
      ) : null}
      {/* ▁ THE SLIM BAR — "Names · Motion ▴": a tap brings the sheet back; × closes. */}
      {slim ? (
        <div
          data-phone-chrome="panel"
          data-phone-chrome-name="the slim bar"
          data-half-sheet-slim=""
          className={`sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 rounded-t-2xl border-t border-ink/10 px-3 pb-[env(safe-area-inset-bottom)] ${HALF_SHEET_SLIM} lg:hidden`}
        >
          <button
            type="button"
            data-half-sheet-restore=""
            aria-label={`Open ${words} again`}
            onClick={() => dispatch({ type: 'restore' })}
            className="sn-press flex h-11 min-w-0 flex-1 items-center gap-1.5 truncate rounded-full px-2 text-left text-[13px] font-semibold text-ink/75"
          >
            <span className="truncate font-serif text-[17px] font-medium text-ink">{title}</span>
            {section ? <span className="truncate">· {section}</span> : null}
            <span aria-hidden className="shrink-0">▴</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </>
  );
}
