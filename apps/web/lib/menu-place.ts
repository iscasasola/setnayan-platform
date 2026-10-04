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
export type MenuRoom = { within: { left: number; right: number }; below: number };

export const MENU_ROOM_ATTR = 'data-menus-open-below';

/** The box a menu opened from `el` must stay inside — or null (place against the screen). */
export function menuRoomOf(el: Element | null | undefined): MenuRoom | null {
  const box = el?.closest(`[${MENU_ROOM_ATTR}]`)?.getBoundingClientRect();
  if (!box) return null;
  return { within: { left: box.left, right: box.right }, below: box.bottom };
}

/** `placeMenu`, for a menu that may have a box to stay in. Narrows to the box when it must. */
export function placeMenuIn(
  anchor: MenuAnchor,
  viewport: { width: number; height: number },
  menu: { width: number; height: number },
  align: 'start' | 'end',
  room: MenuRoom | null,
): { left: number; top: number; width: number } {
  if (!room) return { ...placeMenu(anchor, viewport, menu, align), width: menu.width };
  const width = Math.min(menu.width, room.within.right - room.within.left);
  const want = align === 'end' ? anchor.right - width : anchor.left;
  const left = Math.max(room.within.left, Math.min(want, room.within.right - width));
  // Below the BOX, not just below the button: the button's neighbours are in the box.
  const below = { ...anchor, bottom: Math.max(anchor.bottom, room.below) };
  const { top } = placeMenu(below, viewport, { width, height: menu.height }, align);
  return { left, top, width };
}
