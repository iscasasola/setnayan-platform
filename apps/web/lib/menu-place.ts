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
