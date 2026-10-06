'use client';

import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  ELEMENT_SHEET_CLOSED,
  HALF_SHEET_REST,
  HALF_SHEET_SLIM,
  HALF_SHEET_UP,
  SLIM_BAR_SEAT,
  elementSheetStep,
  isCanvasTapOutside,
  slimBarWords,
  type ElementSheetEvent,
  type ElementSheetState,
} from '@/lib/element-sheet-state';
import { MAKER_LT_TOOL } from '@/lib/maker-phone-room';
import { useMaker, useMakerTool } from './maker-context';

/** A drag shorter than this is a tap, not a drag; past `HALF_SHEET_DRAG_PX` it changes the size. */
const HALF_SHEET_TAP_PX = 6;
const HALF_SHEET_DRAG_PX = 40;

/**
 * 📱 THE MAKER'S PHONE SHEET. Since 2026-10-05 (the owner's lower third:
 * *"all tools can only reside on the thumb area / lower third"* → *"approve"*)
 * every Maker editor on a phone is a TOOL of the lower third — over it, beside
 * the column that names it and closes it (`MAKER_LT_TOOL`, `useMakerTool`) —
 * and the page above is never dimmed. The old scrim and grip are gone.
 */

/** A phone, by the Maker's own breakpoint (`lg`): the half sheet's moves are the phone's. */
function onPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023.98px)').matches;
}

/**
 * ▁ THE HALF SHEET — owner 2026-10-04 ("EVENT DETAILS / MAKER: FOUR FIXES BEFORE
 * BUILD" + "TAPPING THE PAGE OUTSIDE THE SELECTED ELEMENT COLLAPSES ITS SHEET TO
 * A SLIM BAR"; screen 8 of `prototypes/event_details_improved_2026-10-04_fable.html`).
 * The shape every Maker sheet over the canvas mounts into; its moves are the
 * ONE sheet reducer the part sheet runs too (`elementSheetStep`,
 * `lib/element-sheet-state.ts`) — never a second mechanism.
 *
 * On a phone:
 *   · it rests at HALF the screen (`HALF_SHEET_REST`) and the page above it is
 *     NOT dimmed and stays live — the edited scene is brought into view above
 *     the sheet (`onReveal`), so a change is seen as it is made, and a tap on
 *     another element switches the sheet to it (the parent hands a new `target`);
 *   · the grab handle drags it up for more rows and back down; down from half,
 *     or a tap on the page where nothing is selectable (the canvas's
 *     `tapOutside`), collapses it to a SLIM BAR ("Names · Motion ▴") that
 *     restores on a tap; a second such tap once folded goes through (closes);
 *   · Peek — press and hold — slides it away while held, to see the whole scene;
 *   · × closes and deselects (`onClose`).
 * On a desktop it is the panel beside the page, exactly as before
 * (`desktopClassName`): every phone move wears a `max-lg:` class.
 *
 * ONE SLIM HEADER (owner, live iPhone test 2026-10-05: "Theme · Peek · × ·
 * progress bar · Save the Date · 3 of 6 ▾ · All items", then "SAVE THE DATE",
 * then "Theme" again): a sheet that has its own way to say where it is (the
 * guided flow's step ▾) hands it in as `head`, and on a phone it takes the
 * title's place in the one row — `head` · Peek · ×. `restOn` (the step) puts a
 * sheet dragged up back to half when it moves on: every step opens at rest.
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
  head = null,
  restOn,
  tool = true,
  children,
}: {
  /** The sheet's accessible name (the aside's `aria-label`). */
  label: string;
  /** Its title — the Hub's own name for what is being edited. */
  title: string;
  /** What is selected (a scene, a row, an element) — a new one switches the sheet to it. Null: nothing is, and nothing is drawn. */
  target: string | null;
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
  /** 📱 The phone header's own lead (the guided step ▾) — drawn in place of the title, in the one row. */
  head?: ReactNode;
  /** When this changes, a sheet dragged up comes back to half (each guided step opens at rest). */
  restOn?: string | null;
  /** 🧰 Fold the lower third for it (a phone) — false while the sheet is not drawn there (the guided flow's picker). */
  tool?: boolean;
  children: ReactNode;
}) {
  /* 🧰 IN THE MAKER the half sheet is a TOOL of the lower third on a phone
     (owner 2026-10-05, "approve"): it sits over the lower third, right of the
     column that names it and closes it — no grip, no Peek, no slim bar, never
     raised over the page. Elsewhere (Event Details' record rows) it keeps its
     half-sheet moves. */
  const inMaker = useMaker() !== null;
  const [state, dispatch] = useReducer(
    (st: ElementSheetState<string>, ev: ElementSheetEvent<string>) => elementSheetStep(st, ev),
    ELEMENT_SHEET_CLOSED as ElementSheetState<string>,
    (s: ElementSheetState<string>) => elementSheetStep<string>(s, { t: 'set', target }),
  );
  /* A new target (a tap on another element, a navigator pick) switches the sheet. */
  useEffect(() => {
    dispatch({ t: 'set', target });
  }, [target]);
  /* 🫳 A tap on the page where nothing is selectable → the slim bar; once folded,
     the next one goes through and closes (the reducer's `tapOutside`). Phone only. */
  const foldedRef = useRef(state.collapsed);
  foldedRef.current = state.collapsed;
  const inMakerRef = useRef(inMaker);
  inMakerRef.current = inMaker;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !isCanvasTapOutside(e.data) || !onPhone()) return;
      /* In the Maker a tap on the empty page closes the tool — the navigator comes back. */
      if (foldedRef.current || inMakerRef.current) closeRef.current();
      else dispatch({ t: 'tapOutside' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  /* ▁ A new step rests at half again — "drag up for more" is per step, never carried on. */
  const raisedRef = useRef(Boolean(state.raised));
  raisedRef.current = Boolean(state.raised);
  const lastRest = useRef(restOn);
  useEffect(() => {
    if (restOn === lastRest.current) return;
    lastRest.current = restOn;
    if (raisedRef.current) dispatch({ t: 'dragDown' });
  }, [restOn]);
  /* 📱 The edited thing in view above the sheet — on opening, on a switch, on a restore. */
  const shown = Boolean(state.target) && !state.collapsed;
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
    if (Math.abs(dy) < HALF_SHEET_TAP_PX) dispatch({ t: 'gripTap' });
    else if (Math.abs(dy) >= HALF_SHEET_DRAG_PX) dispatch({ t: dy < 0 ? 'dragUp' : 'dragDown' });
  };

  /* Peek — held while pressed; a pointer captured on the button keeps it until let go. */
  const peekOn = () => dispatch({ t: 'peekStart' });
  const peekOff = () => dispatch({ t: 'peekEnd' });
  /* × — close and deselect. */
  const close = () => {
    dispatch({ t: 'close' });
    onClose();
  };
  useMakerTool(inMaker && tool && Boolean(state.target), { key: `sheet:${label}`, name: title, close });

  /* 🚫 CLOSED IS NOT DRAWN (live dead end, 2026-10-04): a sheet with nothing
     selected has no aside, no slim bar and no hit area — never an empty glass
     panel lying over the Maker's bottom bar. */
  if (!state.target) return null;

  /* 🧰 The Maker's lower third: the tool, and nothing that floats. */
  if (inMaker) {
    return (
      <aside
        aria-label={label}
        data-phone-chrome="panel"
        data-half-sheet="tool"
        style={style}
        className={`sn-glass-bare flex min-h-0 flex-col ${MAKER_LT_TOOL} ${desktopClassName}`}
      >
        {beforeGrip}
        <div className={`${head ? 'flex' : 'hidden lg:flex'} items-center gap-2 px-3 pt-2 lg:px-4 lg:pt-3`} data-half-sheet-head="">
          {head ? (
            <div className="flex min-w-0 flex-1 items-center lg:hidden" data-half-sheet-lead="">
              {head}
            </div>
          ) : null}
          {/* The title and × are the desktop's — on a phone the lower third's column names it and closes it. */}
          <p className="hidden min-w-0 flex-1 truncate font-serif text-lg text-ink lg:block">{title}</p>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            data-half-sheet-close=""
            className="sn-press hidden h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink lg:inline-flex"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {children}
      </aside>
    );
  }

  const slim = state.collapsed;
  const size = slim ? 'slim' : state.raised ? 'up' : 'half';
  return (
    <>
      <aside
        aria-label={label}
        data-phone-chrome="panel"
        data-half-sheet={size}
        data-peeking={state.peeking ? '' : undefined}
        style={{ ...style, ...(dragDy > 0 ? { transform: `translateY(${dragDy}px)` } : {}) }}
        className={`sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl ${state.raised ? HALF_SHEET_UP : HALF_SHEET_REST} ${
          slim ? 'max-lg:hidden' : ''
        } ${state.peeking ? 'max-lg:translate-y-[calc(100%-64px)]' : ''} ${
          dragDy > 0 ? '' : 'transition-[height,transform] duration-200 ease-out motion-reduce:transition-none'
        } lg:transform-none ${desktopClassName}`}
      >
        {beforeGrip}
        <button
          type="button"
          aria-label={state.raised ? 'Show less' : 'Show more'}
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
            if (e.detail === 0) dispatch({ t: 'gripTap' });
          }}
          className={`flex h-6 w-full shrink-0 touch-none items-center justify-center lg:hidden ${state.peeking ? 'opacity-0' : ''}`}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-ink/20" />
        </button>
        <div className="flex items-center gap-2 px-4 pt-1 lg:pt-3" data-half-sheet-head="">
          {head ? (
            <div className={`flex min-w-0 flex-1 items-center lg:hidden ${state.peeking ? 'max-lg:opacity-0' : ''}`} data-half-sheet-lead="">
              {head}
            </div>
          ) : null}
          <p className={`min-w-0 flex-1 truncate font-serif text-lg text-ink ${head ? 'max-lg:hidden' : ''} ${state.peeking ? 'max-lg:opacity-0' : ''}`}>{title}</p>
          {/* 👁 PEEK — press and hold: the sheet slides away while held (phone). */}
          <button
            type="button"
            aria-pressed={Boolean(state.peeking)}
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
            onClick={close}
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
        <HalfSheetSlimBar
          title={title}
          section={section}
          closeLabel={closeLabel}
          onRestore={() => dispatch({ t: 'restore' })}
          onClose={close}
        />
      ) : null}
    </>
  );
}

/**
 * ▁ THE HALF SHEET FOLDED — one 56 px row, "Names · Motion ▴" (a tap restores
 * the sheet) and × (closes it). On a phone it rests ON TOP of the Maker's
 * bottom bar (`SLIM_BAR_SEAT`), so Page ▾ · Look · Event Details stay in reach
 * while a sheet is folded.
 */
export function HalfSheetSlimBar({
  title,
  section = null,
  closeLabel = 'Close',
  onRestore,
  onClose,
}: {
  title: string;
  section?: string | null;
  closeLabel?: string;
  onRestore: () => void;
  onClose: () => void;
}) {
  const words = slimBarWords(title, section);
  return (
    <div
      data-phone-chrome="panel"
      data-phone-chrome-name="the slim bar"
      data-half-sheet-slim=""
      className={`sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 rounded-t-2xl border-t border-ink/10 px-3 pb-[env(safe-area-inset-bottom)] ${HALF_SHEET_SLIM} ${SLIM_BAR_SEAT} lg:hidden`}
    >
      <button
        type="button"
        data-half-sheet-restore=""
        aria-label={`Open ${words} again`}
        onClick={onRestore}
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
  );
}
