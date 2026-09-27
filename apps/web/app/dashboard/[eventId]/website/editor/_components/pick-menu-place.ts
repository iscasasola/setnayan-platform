/**
 * WHERE A `PickMenu` LIST OPENS — pure, so the placement is executed by a test,
 * not described by one.
 *
 * Measured live on production (2026-09-27, controller, commit 3e45275): the
 * element sheet's Font dropdown opened ENTIRELY below a 390×844 phone screen
 * (button at 455, list drawn at 880), and off the right edge of a 1440 desktop.
 * Two faults, fixed in two places:
 *
 *   1. CONTAINING BLOCK — the sheet is `.sn-glass-bare`, whose `backdrop-filter`
 *      makes it the containing block for every `position: fixed` descendant, so
 *      viewport coordinates were added to the sheet's own offset. `PickMenu`
 *      now portals the list to `document.body`; that fix lives there.
 *   2. NO ROOM BELOW — "Home ▾" sits near the bottom of a phone, and a list
 *      that always opens downward shows ~66px of itself. THIS function decides:
 *      below when it fits; otherwise ABOVE when there is more room above; and
 *      the height is always capped to the room on the chosen side, so a long
 *      list scrolls inside itself instead of leaving the screen.
 *
 * All figures are CSS pixels in viewport coordinates (getBoundingClientRect).
 */

/** Gap between the button and the list. */
export const PICK_LIST_GAP = 6;
/** Distance the list always keeps from every screen edge. */
export const PICK_LIST_MARGIN = 8;
/** The list is never narrower than this, nor than its button. */
export const PICK_LIST_MIN_WIDTH = 160;
/** Never taller than this share of the screen, even with room (was `max-h-[60dvh]`). */
export const PICK_LIST_MAX_SHARE = 0.6;

export type PickListPlacement = {
  top: number;
  left: number;
  minWidth: number;
  /** The list scrolls inside itself past this. */
  maxHeight: number;
  side: 'below' | 'above';
};

export function placePickList({
  button,
  listHeight,
  viewport,
}: {
  /** The button's rect. */
  button: { top: number; bottom: number; left: number; width: number };
  /** The list's full content height (its `scrollHeight`), 0 before it has mounted. */
  listHeight: number;
  viewport: { width: number; height: number };
}): PickListPlacement {
  const minWidth = Math.max(button.width, PICK_LIST_MIN_WIDTH);
  const left = Math.max(PICK_LIST_MARGIN, Math.min(button.left, viewport.width - minWidth - PICK_LIST_MARGIN));

  const cap = Math.floor(viewport.height * PICK_LIST_MAX_SHARE);
  const want = Math.min(Math.max(0, listHeight), cap);
  const roomBelow = Math.max(0, viewport.height - button.bottom - PICK_LIST_GAP - PICK_LIST_MARGIN);
  const roomAbove = Math.max(0, button.top - PICK_LIST_GAP - PICK_LIST_MARGIN);

  if (want <= roomBelow || roomBelow >= roomAbove) {
    return {
      top: button.bottom + PICK_LIST_GAP,
      left,
      minWidth,
      maxHeight: Math.min(cap, roomBelow),
      side: 'below',
    };
  }
  const maxHeight = Math.min(cap, roomAbove);
  const drawn = Math.min(want, maxHeight);
  return {
    top: button.top - PICK_LIST_GAP - drawn,
    left,
    minWidth,
    maxHeight,
    side: 'above',
  };
}
