/**
 * ▁ THE MAKER'S HALF SHEET — the one shape every phone sheet over the canvas
 * mounts into (PR-0 of the Maker rearrangement; `EVENT_DETAILS_STUDY_2026-10-04_fable.md`
 * § 7 "PR-0", screen 8 of `prototypes/event_details_improved_2026-10-04_fable.html`).
 *
 * Owner, 2026-10-04 ("EVENT DETAILS / MAKER: FOUR FIXES BEFORE BUILD", verbatim
 * *"yes to all"*): the phone sheet is HALF the screen; the edited scene scrolls
 * into view above it so the change is seen live; drag up for more rows; Peek
 * (press-and-hold) hides the sheet to see the whole scene. Then ("TAPPING THE
 * PAGE OUTSIDE THE SELECTED ELEMENT COLLAPSES ITS SHEET TO A SLIM BAR", verbatim
 * *"slim bar is good"*): tap the empty page → a slim bottom bar ("Names · Motion ▴")
 * that restores on tap · tap another element → the sheet switches to it, same
 * section · the same element → no change · drag the handle down → the bar ·
 * × / Done → close and deselect. Nothing is lost: the draft holds every change.
 *
 * THIS FILE IS THE PURE HALF: the states and every move between them, with no
 * React, no DOM and — 🔑 — NO WRITE. Opening, dragging, peeking and collapsing
 * a sheet are draw-time state; nothing here (or in the component that wears it,
 * `MakerHalfSheet` in `launch/_components/maker-sheet.tsx`) can reach a save.
 * Held by `lib/maker-half-sheet.test.ts` (every transition) and
 * `lib/a-phone-sheet-opens-at-half.test.ts` (the rest height, and no write).
 *
 * States (`size`):
 *   · `closed` — nothing selected, no sheet;
 *   · `half`   — the rest: ~45% of the screen with the top bar (the page keeps
 *                ≥ 55% — `MAKER_PREVIEW_MIN_SHARE`, lib/maker-phone-room.ts);
 *   · `up`     — dragged up for more rows (the couple chose it; it drops back
 *                to half on a drag down);
 *   · `slim`   — collapsed to one bar ("Title · Section ▴"); a tap restores the
 *                size it came from.
 * plus `peeking` — held only while the Peek control is pressed, over half or up.
 */

export type HalfSheetSize = 'closed' | 'half' | 'up' | 'slim';

export type HalfSheetState = {
  size: HalfSheetSize;
  /** The selected thing's key (a scene, a row, an element) — null when closed. */
  target: string | null;
  /** The section the sheet is on (a tab, a segment) — kept when the target switches. */
  section: string | null;
  /** The size a slim bar restores to. */
  restoreTo: 'half' | 'up';
  /** Peek held — the sheet slides away while true. */
  peeking: boolean;
};

export type HalfSheetAction =
  /** A thing is selected — the sheet rises to half (or switches to it, if open). */
  | { type: 'open'; target: string; section?: string | null }
  /** A tap on an element on the page: another → switch (same section); the same → no change. */
  | { type: 'tapTarget'; target: string }
  /** A tap on the page where nothing is selectable → the slim bar. */
  | { type: 'tapEmpty' }
  /** The grab handle let go after moving `dy` px (negative = up). */
  | { type: 'drag'; dy: number }
  /** The grab handle pressed without a drag (or from the keyboard): half ⇄ up. */
  | { type: 'gripTap' }
  /** The slim bar tapped — back to the size it came from. */
  | { type: 'restore' }
  | { type: 'peekStart' }
  | { type: 'peekEnd' }
  /** The sheet moved to another section. */
  | { type: 'section'; section: string | null }
  /** × / Done — close and deselect. */
  | { type: 'close' };

export const HALF_SHEET_CLOSED: HalfSheetState = {
  size: 'closed',
  target: null,
  section: null,
  restoreTo: 'half',
  peeking: false,
};

/** A drag shorter than this is a tap, not a drag. */
export const HALF_SHEET_TAP_PX = 6;
/** How far the handle must travel to change the size. */
export const HALF_SHEET_DRAG_PX = 40;

export function halfSheetReducer(state: HalfSheetState, action: HalfSheetAction): HalfSheetState {
  switch (action.type) {
    case 'open': {
      const section = action.section === undefined ? state.section : action.section;
      if (state.size === 'closed') {
        return { size: 'half', target: action.target, section, restoreTo: 'half', peeking: false };
      }
      // Already open: the same sheet, now about this thing — the size it is at (a slim bar restores).
      const size = state.size === 'slim' ? state.restoreTo : state.size;
      if (state.target === action.target && state.size === size && state.section === section) return state;
      return { ...state, size, target: action.target, section, peeking: false };
    }
    case 'tapTarget': {
      if (state.size === 'closed') {
        return { size: 'half', target: action.target, section: state.section, restoreTo: 'half', peeking: false };
      }
      if (state.target === action.target) {
        // The same element → no change; on a slim bar it is a way back up.
        return state.size === 'slim' ? { ...state, size: state.restoreTo } : state;
      }
      const size = state.size === 'slim' ? state.restoreTo : state.size;
      return { ...state, size, target: action.target, peeking: false };
    }
    case 'tapEmpty':
      if (state.size === 'half' || state.size === 'up') return { ...state, size: 'slim', restoreTo: state.size, peeking: false };
      return state;
    case 'drag': {
      if (state.size === 'closed' || state.size === 'slim') return state;
      if (Math.abs(action.dy) < HALF_SHEET_DRAG_PX) return state;
      if (action.dy < 0) return state.size === 'half' ? { ...state, size: 'up', peeking: false } : state;
      // Down: from up → half; from half → the slim bar.
      if (state.size === 'up') return { ...state, size: 'half', peeking: false };
      return { ...state, size: 'slim', restoreTo: 'half', peeking: false };
    }
    case 'gripTap':
      if (state.size === 'half') return { ...state, size: 'up' };
      if (state.size === 'up') return { ...state, size: 'half' };
      if (state.size === 'slim') return { ...state, size: state.restoreTo };
      return state;
    case 'restore':
      return state.size === 'slim' ? { ...state, size: state.restoreTo } : state;
    case 'peekStart':
      return state.size === 'half' || state.size === 'up' ? (state.peeking ? state : { ...state, peeking: true }) : state;
    case 'peekEnd':
      return state.peeking ? { ...state, peeking: false } : state;
    case 'section':
      return state.section === action.section ? state : { ...state, section: action.section };
    case 'close':
      return HALF_SHEET_CLOSED;
  }
}

/*
 * 📏 THE PHONE HEIGHTS — whole Tailwind class strings (`tailwind.config` scans
 * lib/), each declared so `lib/the-maker-keeps-the-page-on-a-phone.test.ts` can
 * add it up. Phone only (`max-lg:`): a desktop's panel sits beside the page.
 */
/** At rest: the top bar (52 px) + this = 45% of the visible screen — "half". */
export const HALF_SHEET_REST = 'max-lg:h-[calc(45dvh-52px)]';
/** Dragged up for more rows: the page keeps a strip above it. */
export const HALF_SHEET_UP = 'max-lg:h-[calc(85dvh-52px)]';
/** The slim bar: one 56 px row (+ the phone's own bottom safe area). */
export const HALF_SHEET_SLIM = 'max-lg:h-[calc(56px+env(safe-area-inset-bottom))]';

/** The class a size wears on a phone (the slim bar is drawn by its own element). */
export function halfSheetHeightClass(size: HalfSheetSize): string {
  return size === 'up' ? HALF_SHEET_UP : HALF_SHEET_REST;
}

/** "Names · Motion ▴" — what the slim bar says. */
export function slimBarWords(title: string, section: string | null): string {
  return section ? `${title} · ${section}` : title;
}

/*
 * 🫳 A TAP ON THE PAGE WHERE NOTHING IS SELECTABLE. The canvas is its own frame:
 * a tap in it never reaches this window as a pointer event. The bridge
 * (`app/[slug]/_components/editor-bridge.tsx`) posts `tapOutside` for a tap that
 * lands outside every editable section — the SAME message the part sheet reads
 * (`lib/element-sheet-state.ts`, `rd/motion-four-effects`); one message for one
 * fact. A half sheet answers with its slim bar.
 */
export const CANVAS_TAP_EMPTY = 'tapOutside';

/** Is this `message` the canvas saying "a tap on nothing"? (same origin only) */
export function isCanvasTapEmpty(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as { source?: unknown; t?: unknown };
  return d.source === 'setnayan-site' && d.t === CANVAS_TAP_EMPTY;
}
