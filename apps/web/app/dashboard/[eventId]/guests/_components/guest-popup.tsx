'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { POPUP_DARK, POPUP_SCRIM, usePopupBehind } from '@/lib/use-popup-behind';

/**
 * GuestPopup — THE POP-UP RULE FOR THE GUEST LIST'S OWN SHEETS (owner 2026-10-08, `INTERACTION_RULES.md` § 9, "Anything
 * popped up over the page"): *"the rest of the screen darkens … The darkened area will be blurred and nothing behind it
 * will work. pressing on the dark part removes the pop up. the background will not be scrollable"*.
 *
 * The add-a-guest sheet, quick add, the ticket view and "Add from your people" each drew their own wash (`bg-ink/[0.32]`
 * + a 1-px blur · `bg-ink/40` · `bg-ink/50` + `backdrop-blur-sm` · the Drawer's `bg-ink/30`). They keep their panels and
 * their contents; the LAYER BEHIND and the a11y wiring are this, once:
 *   · the dark is `.sn-popup-dark` (`POPUP_DARK`) — dark and blurred, taking no tap;
 *   · one button under it, the whole screen (`POPUP_SCRIM`), closes — a tap on the dark removes the pop-up;
 *   · `usePopupBehind` — everything else on the page is `inert`, the page does not scroll, Escape closes, Tab stays in the
 *     panel, focus comes in and goes back to where it was.
 * Mount it while the pop-up is open (mount = open). It draws on <body>: the dashboard page is a transformed box, inside
 * which `position: fixed` is not the screen, and no z-index in it rises above the bottom bar.
 *
 * Held by `the-guest-popups-follow-the-rule.test.ts`.
 */
export function GuestPopup({
  onClose,
  rootClassName,
  panelClassName,
  panelData,
  rootData,
  label,
  labelledById,
  focusFirstInput = false,
  children,
}: {
  onClose: () => void;
  /** The positioned root over the whole screen (`fixed inset-0 z-… flex …`). */
  rootClassName: string;
  /** The panel — it must be POSITIONED (`relative` or `absolute`), so it lies over the dark and the scrim. */
  panelClassName: string;
  /** Data marks the panel carries (`data-add-guest-sheet`). */
  panelData?: Record<`data-${string}`, string>;
  rootData?: Record<`data-${string}`, string>;
  /** The dialog's name, or the id of a heading inside it. */
  label?: string;
  labelledById?: string;
  /** The first text box takes focus once the panel is open (without moving the page behind). */
  focusFirstInput?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePopupBehind({ root, panel, onClose });
  useEffect(() => {
    if (!focusFirstInput) return;
    const raf = requestAnimationFrame(() => panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [focusFirstInput]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={root} className={rootClassName} {...rootData}>
      <button type="button" aria-label="Close" onClick={onClose} className={POPUP_SCRIM} />
      <span aria-hidden className={POPUP_DARK} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledById}
        tabIndex={-1}
        className={`focus:outline-none ${panelClassName}`}
        {...panelData}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
