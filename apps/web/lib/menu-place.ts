/**
 * menu-place.ts — WHERE A POPPED-OUT MENU OPENS: UNDER ITS BUTTON, AND ALWAYS
 * WHOLLY ON SCREEN.
 *
 * ⚖ Live bug on 74ff0be at 375 px (2026-10-03): a guest row's ⋯ list ("More
 * for <name>") was pinned by its RIGHT edge to the right edge of a button that
 * sits on the LEFT of the card — so its 224 px ran off the left of the phone
 * and only "…to NFC" showed. The guest-table popovers (`overlay-primitives.tsx`
 * `Popover`) already clamped themselves; the ⋯ list had its own arithmetic and
 * did not. Both now ask this one function.
 *
 * Pure. `align` says which edge of the button the menu lines up with — 'start'
 * (its left edges meet) or 'end' (its right edges meet) — and the result is
 * then CLAMPED into the viewport, `edge` px from either side. Below the button
 * first; above it when there is no room below.
 */

export type MenuAnchor = { top: number; bottom: number; left: number; right: number };

export function placeMenu(
  anchor: MenuAnchor,
  viewport: { width: number; height: number },
  menu: { width: number; height: number },
  align: 'start' | 'end' = 'start',
  { gap = 6, edge = 8 }: { gap?: number; edge?: number } = {},
): { left: number; top: number } {
  const want = align === 'end' ? anchor.right - menu.width : anchor.left;
  const left = Math.max(edge, Math.min(want, viewport.width - menu.width - edge));
  let top = anchor.bottom + gap;
  if (top + menu.height > viewport.height - edge) top = Math.max(edge, anchor.top - menu.height - gap); // flip above
  return { left, top };
}

/**
 * ⚖ A MENU OPENED INSIDE A BOX STAYS IN THE BOX, AND OPENS BELOW IT (owner,
 * live iPhone review of maria-and-jose, 2026-10-04). On the guest card the
 * host's ⋯ sits on the LEFT of the ticket's column, so its list — lined up by
 * its right edge, clamped only to the SCREEN — ran left past the card's edge
 * and covered the ticket and the status line; the Invite list covered "Tap to
 * view". An element marked `data-menus-open-below` is that box: a menu opened
 * from inside it is clamped between the box's left and right edges, and opens
 * under the box's bottom edge, so nothing in the box is hidden by it.
 */
export type MenuRoom = { within: { left: number; right: number }; below: number; top?: number };

export const MENU_ROOM_ATTR = 'data-menus-open-below';

/** The box a menu opened from `el` must stay inside — or null (place against the screen). */
export function menuRoomOf(el: Element | null | undefined): MenuRoom | null {
  const box = el?.closest(`[${MENU_ROOM_ATTR}]`)?.getBoundingClientRect();
  if (!box) return null;
  return { within: { left: box.left, right: box.right }, below: box.bottom, top: box.top };
}

/**
 * The least of a menu that must show under its box: two full lines of a list.
 * The box is brought up so the WHOLE list fits when it can; when the page
 * cannot scroll that far, at least this much shows and the rest scrolls inside.
 */
export const MENU_MIN_ROOM = 112;

/**
 * `placeMenu`, for a menu that may have a box to stay in. Narrows to the box
 * when it must.
 *
 * ⚖ IN A BOX IT NEVER FLIPS ABOVE (independent review of #6352, 2026-10-04: on
 * an iPhone SE, 375×667, with the card's ticket row low on the screen, the
 * flip put the menu back over the ticket). It opens under the box and, when
 * the rest of the screen is shorter than the list, says so with `maxHeight` —
 * the list scrolls inside itself. `menuNudge` says how far to bring the box up
 * first when even `MENU_MIN_ROOM` does not fit. `menu.height` must be measured
 * AT THE NARROWED WIDTH (`menuWidthIn`): a narrower list wraps taller.
 */
export function placeMenuIn(
  anchor: MenuAnchor,
  viewport: { width: number; height: number },
  menu: { width: number; height: number },
  align: 'start' | 'end',
  room: MenuRoom | null,
  { gap = 6, edge = 8 }: { gap?: number; edge?: number } = {},
): { left: number; top: number; width: number; maxHeight?: number } {
  if (!room) return { ...placeMenu(anchor, viewport, menu, align, { gap, edge }), width: menu.width };
  const width = menuWidthIn(menu.width, room);
  const want = align === 'end' ? anchor.right - width : anchor.left;
  const left = Math.max(room.within.left, Math.min(want, room.within.right - width));
  // Below the BOX, not just below the button: the button's neighbours are in the box.
  const top = Math.max(anchor.bottom, room.below) + gap;
  const fits = viewport.height - edge - top;
  return menu.height > fits ? { left, top, width, maxHeight: Math.max(0, fits) } : { left, top, width };
}

/** The width a menu takes inside a box — measure its height at THIS width. */
export function menuWidthIn(width: number, room: MenuRoom | null): number {
  return room ? Math.min(width, room.within.right - room.within.left) : width;
}

/**
 * How far the box must come up so the whole menu fits under it — never so far
 * that the box's own top leaves the screen (then the list scrolls inside).
 */
export function menuNudge(
  room: MenuRoom,
  viewport: { height: number },
  menuHeight: number,
  { gap = 6, edge = 8, boxTop }: { gap?: number; edge?: number; boxTop?: number } = {},
): number {
  const need = menuHeight > 0 ? menuHeight : MENU_MIN_ROOM;
  const short = Math.ceil(room.below + gap + need - (viewport.height - edge));
  if (short <= 0) return 0;
  // Bring it up by what is short, but keep the box's top on screen.
  return boxTop == null ? short : Math.max(0, Math.min(short, Math.floor(boxTop - edge)));
}

/**
 * Bring the box `el` sits in up by `by` px — its nearest scrolling ancestor
 * (the card panel), else the page. Instant, so the next measure is true.
 */
export function nudgeUp(el: Element, by: number): void {
  if (by <= 0) return;
  let p: Element | null = el.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      p.scrollBy({ top: by, behavior: 'instant' as ScrollBehavior });
      return;
    }
    p = p.parentElement;
  }
  window.scrollBy({ top: by, behavior: 'instant' as ScrollBehavior });
}
