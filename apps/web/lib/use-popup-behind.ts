'use client';

import { useLayoutEffect, type RefObject } from 'react';

import { inertBehind } from './popup-behind';
import { useModalA11y } from './use-modal-a11y';

/**
 * usePopupBehind — THE POP-UP RULE'S TWO BEHAVIOURS, FOR A POP-UP THAT DRAWS ITS OWN PANEL.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, "Anything popped up over the page"): *"the rest of the screen
 * darkens … The darkened area will be blurred and nothing behind it will work. pressing on the dark part removes the
 * pop up. the background will not be scrollable"*.
 *
 * The Maker's own sheet (`MakerSheet`) carries the whole rule. A pop-up that cannot be that sheet — a centred panel
 * on a computer, a picker that already draws its own box — calls this and draws two things itself:
 *   · the dark: `<span aria-hidden className={POPUP_DARK} />` (the ONE look, `.sn-popup-dark`, taking no tap), and
 *   · one button under it, the whole screen, that closes.
 * This hook does the rest, with the app's own two pieces and nothing new:
 *   · NOTHING BEHIND WORKS — every branch of the page but `root` is `inert` (`inertBehind`), put back on close;
 *   · the page behind does not scroll, Escape closes, Tab stays inside `panel` (`useModalA11y`).
 * Mount it while the pop-up is open (mount = open).
 */
export function usePopupBehind({
  root,
  panel,
  onClose,
}: {
  /** The pop-up's outermost element — everything outside it goes out of reach. */
  root: RefObject<HTMLElement | null>;
  /** The element carrying `role="dialog"` (focus comes in, Tab stays in). */
  panel: RefObject<HTMLElement | null>;
  onClose: () => void;
}): void {
  useLayoutEffect(() => {
    const el = root.current;
    return el ? inertBehind(el) : undefined;
  }, [root]);
  useModalA11y({ open: true, onClose, containerRef: panel });
}

/** The dark behind a pop-up that draws its own panel: the one look, over its positioned root, taking no tap. */
export const POPUP_DARK = 'sn-popup-dark pointer-events-none absolute inset-0';
/** The one button under the dark — the whole screen — whose tap closes the pop-up. */
export const POPUP_SCRIM = 'absolute inset-0 h-full w-full cursor-default touch-none';
