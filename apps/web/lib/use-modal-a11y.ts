'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';

/**
 * useModalA11y — the single shared focus-management hook for modal dialogs,
 * bottom sheets, and drawers.
 *
 * WHY: the 2026-06-25 checkout UX audit found our overlays render correct
 * `role="dialog"` semantics but do NOT manage focus — opening a modal leaves
 * focus on the trigger behind the backdrop, Tab can wander out into the page
 * underneath, and focus isn't restored on close. That's a keyboard/SR dead-end
 * across every modal. Like `useEscapeKey`, this is one hook, called once per
 * overlay, instead of hand-rolled (and missing) focus code per surface.
 *
 * On open it:
 *   • remembers what had focus, then moves focus into the dialog,
 *   • traps Tab / Shift+Tab so focus cycles within the dialog only,
 *   • closes on Escape (composes the shared `useEscapeKey`),
 *   • optionally locks body scroll.
 * On close/unmount it removes the listeners, unlocks scroll, and restores
 * focus to wherever it was before the modal opened.
 *
 * Usage — attach `containerRef` to the element carrying `role="dialog"`:
 *   const dialogRef = useRef<HTMLDivElement>(null);
 *   useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });
 *   return open ? <div ref={dialogRef} role="dialog" aria-modal …>…</div> : null;
 *
 * For an always-mounted-while-open sub-component (parent renders `{open ? …}`),
 * pass `open` as a constant `true` — mount = open, unmount runs the restore.
 */

// Tab-reachable, not-disabled, not-explicitly-removed-from-tab-order elements.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalA11y<T extends HTMLElement = HTMLElement>({
  open,
  onClose,
  containerRef,
  lockScroll = true,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  // Generic over the element type so a `useRef<HTMLDivElement>(null)` assigns
  // cleanly — React 19's RefObject.current is mutable (invariant), so a widened
  // `RefObject<HTMLElement | null>` param would reject a div ref.
  containerRef: RefObject<T | null>;
  /** Lock `document.body` scroll while open. Default true. */
  lockScroll?: boolean;
  /** Element to focus on open. Defaults to the dialog container itself, so the
   *  SR announces the dialog (via aria-labelledby) before Tab enters it. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}): void {
  // Escape-to-close via the shared primitive (reuse, don't reinvent).
  useEscapeKey(onClose, open);

  // What had focus before the modal opened, so we can hand it back on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Visible, tab-reachable elements inside the dialog (recomputed per keypress
    // so dynamically shown/hidden controls — e.g. the voucher field — are honored).
    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus into the dialog. Default to the container (made programmatically
    // focusable) so the dialog label is announced and focus isn't dumped onto the
    // backdrop close button.
    const target = initialFocusRef?.current ?? container;
    if (target === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }
    target.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const items = focusables();
      const active = document.activeElement;
      if (items.length === 0) {
        // Nothing focusable but the container — keep focus pinned inside.
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey) {
        if (active === first || !container?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
    // Capture phase so we intercept Tab before any inner handler.
    document.addEventListener('keydown', onKeyDown, true);

    const prevOverflow = lockScroll ? document.body.style.overflow : '';
    if (lockScroll) document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, containerRef, lockScroll, initialFocusRef]);
}
