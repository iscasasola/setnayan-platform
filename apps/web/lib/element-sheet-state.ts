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
 */

export type SheetSection = 'text' | 'animate' | 'arrange';

export type ElementSheetState<T> = {
  /** The part being edited, or null — no sheet. */
  target: T | null;
  /** Folded to the slim bar (phone only). */
  collapsed: boolean;
  /** Text · Motion · Arrange — kept while the sheet moves between parts. */
  section: SheetSection;
};

export type ElementSheetEvent<T> =
  /** A tap ON a part in the canvas. */
  | { t: 'tapPart'; target: T }
  /** A tap on the canvas that hit no part. */
  | { t: 'tapOutside' }
  /** The handle dragged (or tapped) down. */
  | { t: 'dragDown' }
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
const samePart = (a: Part | null, b: Part | null) => Boolean(a && b && a.key === b.key && a.el === b.el);

export function elementSheetStep<T extends Part>(s: ElementSheetState<T>, e: ElementSheetEvent<T>): ElementSheetState<T> {
  switch (e.t) {
    case 'tapPart':
      if (samePart(s.target, e.target)) return s.collapsed ? { ...s, collapsed: false } : s;
      return { ...s, target: e.target, collapsed: false };
    case 'tapOutside':
      if (!s.target) return s;
      return s.collapsed ? { ...ELEMENT_SHEET_CLOSED } : { ...s, collapsed: true };
    case 'dragDown':
      return s.target && !s.collapsed ? { ...s, collapsed: true } : s;
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
      return samePart(s.target, next) ? { ...s, target: next } : { ...s, target: next, collapsed: false };
    }
  }
}
