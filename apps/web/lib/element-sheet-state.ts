/**
 * 📱 THE PART SHEET ON A PHONE — what a tap does (owner, 2026-10-04, tapping
 * the canvas while "Names · Motion" was open: *"when i tap here it, collapese
 * the names/motion popup?"*).
 *
 *   tap empty canvas (not a part)   → the sheet COLLAPSES to a slim bar at the
 *                                     bottom ("Names · Motion ▴"); a second
 *                                     such tap, once collapsed, goes through to
 *                                     the page (the sheet closes, the tap
 *                                     selects what it hit)
 *   tap the bar                     → restored, as it was
 *   tap ANOTHER part                → the sheet switches to it, open, on the
 *                                     SAME section (Text · Motion · Arrange)
 *   tap the same part               → no change (restored, if it was collapsed)
 *   drag the handle down            → collapses to the bar
 *   × / Done                        → closed, nothing selected
 *
 * Nothing is lost by collapsing: every pick is already in the draft.
 *
 * Pure — `elementSheetStep` is the whole of it, so each transition is a test
 * (`element-sheet-state.test.ts`); the Maker (`editor-shell.tsx`) dispatches.
 * Generic over the target so this module needs nothing from the Maker.
 *
 * ▁ ONE REDUCER FOR EVERY MAKER SHEET OVER THE CANVAS (PR-0 of the Maker
 * rearrangement, 2026-10-04 — the scene sheet joined the part sheet here rather
 * than growing a second mechanism). The scene sheet (`MakerHalfSheet`,
 * `launch/_components/maker-sheet.tsx`) runs the same moves with a string
 * target (the selection's key), plus the owner's "FOUR FIXES BEFORE BUILD" fix 1:
 *
 *   drag the handle UP              → taller, for more rows (`raised`); down
 *                                     from there → back to half, not the bar
 *   tap the handle (or a key)       → half ⇄ up; on the bar, restored
 *   Peek, pressed and held          → the sheet slides away while held
 *                                     (`peeking`); let go → back where it was
 *
 * `raised` and `peeking` are present only while true, so a sheet that never
 * used them is exactly the part sheet's shape. Opening, dragging, peeking and
 * folding are draw-time state — nothing here can write.
 */

export type SheetSection = 'text' | 'animate' | 'arrange';

export type ElementSheetState<T> = {
  /** The part being edited, or null — no sheet. */
  target: T | null;
  /** Folded to the slim bar (phone only). */
  collapsed: boolean;
  /** Text · Motion · Arrange — kept while the sheet moves between parts. */
  section: SheetSection;
  /** ▲ Dragged up for more rows (present only while true). */
  raised?: true;
  /** 👁 Peek held — slid away while true (present only while true). */
  peeking?: true;
};

export type ElementSheetEvent<T> =
  /** A tap ON a part in the canvas. */
  | { t: 'tapPart'; target: T }
  /** A tap on the canvas that hit no part. */
  | { t: 'tapOutside' }
  /** The handle dragged (or tapped) down. */
  | { t: 'dragDown' }
  /** ▲ The handle dragged up. */
  | { t: 'dragUp' }
  /** The handle tapped without a drag, or pressed from the keyboard: half ⇄ up; on the bar, restore. */
  | { t: 'gripTap' }
  /** 👁 Peek pressed / let go. */
  | { t: 'peekStart' }
  | { t: 'peekEnd' }
  /** The collapsed bar tapped. */
  | { t: 'restore' }
  /** × / Done — or the navigator chose something else. */
  | { t: 'close' }
  /** A section chosen in the sheet. */
  | { t: 'section'; section: SheetSection }
  /** Any other code that opens a part (the navigator, Style ▾, the part picker). `null` closes. */
  | { t: 'set'; target: T | null | ((prev: T | null) => T | null) };

export const ELEMENT_SHEET_CLOSED: ElementSheetState<never> = { target: null, collapsed: false, section: 'text' };

type Part = { key: string; el: string };
/** The same thing: a part by its key and element; a scene sheet's target (a string) by itself. */
const samePart = (a: Part | string | null, b: Part | string | null) =>
  a !== null && b !== null && (typeof a === 'string' || typeof b === 'string' ? a === b : a.key === b.key && a.el === b.el);
/** A sheet moved to a new thing, or folded, lets go of Peek. */
function calm<T>(s: ElementSheetState<T>): ElementSheetState<T> {
  if (!s.peeking) return s;
  const next = { ...s };
  delete next.peeking;
  return next;
}
/** Back to half: no longer raised (nor peeking). */
function lowered<T>(s: ElementSheetState<T>): ElementSheetState<T> {
  const next = { ...calm(s) };
  delete next.raised;
  return next;
}

export function elementSheetStep<T extends Part | string>(s: ElementSheetState<T>, e: ElementSheetEvent<T>): ElementSheetState<T> {
  switch (e.t) {
    case 'tapPart':
      if (samePart(s.target, e.target)) return s.collapsed ? { ...s, collapsed: false } : s;
      return { ...calm(s), target: e.target, collapsed: false };
    case 'tapOutside':
      if (!s.target) return s;
      return s.collapsed ? { ...ELEMENT_SHEET_CLOSED } : { ...calm(s), collapsed: true };
    case 'dragDown':
      if (!s.target || s.collapsed) return s;
      // From up → back to half; from half → the slim bar.
      return s.raised ? lowered(s) : { ...calm(s), collapsed: true };
    case 'dragUp':
      return s.target && !s.collapsed && !s.raised ? { ...calm(s), raised: true } : s;
    case 'gripTap':
      if (!s.target) return s;
      if (s.collapsed) return { ...s, collapsed: false };
      return s.raised ? lowered(s) : { ...calm(s), raised: true };
    case 'peekStart':
      return s.target && !s.collapsed && !s.peeking ? { ...s, peeking: true } : s;
    case 'peekEnd':
      return calm(s);
    case 'restore':
      return s.collapsed ? { ...s, collapsed: false } : s;
    case 'close':
      return s.target ? { ...ELEMENT_SHEET_CLOSED } : s;
    case 'section':
      return s.section === e.section ? s : { ...s, section: e.section };
    case 'set': {
      const next = typeof e.target === 'function' ? e.target(s.target) : e.target;
      if (!next) return s.target ? { ...ELEMENT_SHEET_CLOSED } : s;
      if (next === s.target) return s;
      /* The same part re-laid (its selected letters changed) keeps the sheet as
         it is — collapsed stays collapsed; another part opens it. */
      return samePart(s.target, next) ? { ...s, target: next } : { ...calm(s), target: next, collapsed: false };
    }
  }
}

/*
 * 📏 THE HALF SHEET'S PHONE HEIGHTS — whole Tailwind class strings (`tailwind.config`
 * scans lib/), each declared so `lib/the-maker-keeps-the-page-on-a-phone.test.ts`
 * can add it up. Phone only (`max-lg:`): a desktop's panel sits beside the page.
 */
/** At rest: the top bar (52 px) + this = 45% of the visible screen — "half". */
export const HALF_SHEET_REST = 'max-lg:h-[calc(45dvh-52px)]';
/** Dragged up for more rows (`raised`): the page keeps a strip above it. */
export const HALF_SHEET_UP = 'max-lg:h-[calc(85dvh-52px)]';
/** The slim bar: one 56 px row (+ the phone's own bottom safe area). */
export const HALF_SHEET_SLIM = 'max-lg:h-[calc(56px+env(safe-area-inset-bottom))]';

/** "Names · Motion ▴" — what the slim bar says. */
export function slimBarWords(title: string, section: string | null): string {
  return section ? `${title} · ${section}` : title;
}

/**
 * 🫳 The canvas's "a tap on nothing" — the bridge (`app/[slug]/_components/editor-bridge.tsx`)
 * posts `tapOutside` for a tap outside every section. One message, read by every sheet.
 */
export function isCanvasTapOutside(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as { source?: unknown; t?: unknown };
  return d.source === 'setnayan-site' && d.t === 'tapOutside';
}
