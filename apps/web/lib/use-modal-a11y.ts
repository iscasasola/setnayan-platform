'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';

/**
 * useModalA11y — the single shared focus-management hook for modal dialogs,
 * bottom sheets, and drawers.
 *
 * WHY: the 2026-06-25 checkout UX audit found our overlays render correct
 * `role="dialog"` semantics but do NOT manage focus — opening a modal leaves
 * focus on the trigger behind the backdrop, Tab can wander out into the page
 * underneath, and focus isn't restored on close. That's a keyboard/SR dead-end
 * across every modal. One hook, called once per overlay, instead of hand-rolled
 * (and missing) focus code per surface.
 *
 * On open it:
 *   • remembers what had focus, then moves focus into the dialog,
 *   • traps Tab / Shift+Tab so focus cycles within the dialog only,
 *   • closes on Escape,
 *   • optionally locks body scroll.
 * On close/unmount it removes the listeners, unlocks scroll, and restores
 * focus to wherever it was before the modal opened.
 *
 * NESTING: a module-level stack tracks open modals. Only the TOPMOST open modal
 * traps Tab and closes on Escape — so a confirm rendered over a sheet, or a
 * filter sheet over a search overlay, behaves correctly: Escape peels one layer
 * at a time and Tab stays in the frontmost layer. Body-scroll-lock is
 * reference-counted so an inner modal closing doesn't unlock the page while an
 * outer modal is still open. Lone (non-nested) modals are always topmost, so
 * behavior is unchanged for them.
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

// Module-level stack of currently-open modal ids — topmost last. Only the
// topmost modal acts on Tab/Escape; the rest stand down until it closes.
const modalStack: string[] = [];

// Reference-counted body-scroll lock so nested modals don't unlock the page
// when an inner one closes while an outer one is still open.
let scrollLockCount = 0;
let savedBodyOverflow = '';
function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}
function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = savedBodyOverflow;
}

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
  // Stable per-instance id for the modal stack.
  const id = useId();
  // What had focus before the modal opened, so we can hand it back on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Latest onClose held in a ref so the effect doesn't re-run (and re-focus)
  // when an inline `() => setOpen(false)` changes identity each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    modalStack.push(id);
    const isTopmost = () => modalStack[modalStack.length - 1] === id;

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
      // Only the frontmost modal handles keys; nested-under modals stand down.
      if (!isTopmost()) return;

      if (event.key === 'Escape') {
        // The topmost modal owns this Escape — stop it reaching global / parent
        // keydown handlers so one keystroke peels exactly one layer.
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        // Nothing focusable but the container — keep focus pinned inside.
        // (Also narrows first/last under noUncheckedIndexedAccess.)
        event.preventDefault();
        container?.focus();
        return;
      }
      // The container itself (tabindex=-1, the default initial-focus target) and
      // anything outside the trap count as an edge — so the very first Tab /
      // Shift+Tab after open wraps INWARD instead of leaking to the page behind.
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const outsideTrap = !active || !items.includes(active);
      if (event.shiftKey) {
        if (active === first || outsideTrap) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || outsideTrap) {
        event.preventDefault();
        first.focus();
      }
    }
    // Capture phase so we intercept Tab before any inner handler.
    document.addEventListener('keydown', onKeyDown, true);

    if (lockScroll) lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Was this the frontmost modal when it closed? Only the topmost should
      // hand focus back — otherwise a parent closing under a still-open child
      // would yank focus out of the frontmost dialog.
      const wasTopmost = modalStack[modalStack.length - 1] === id;
      const idx = modalStack.lastIndexOf(id);
      if (idx !== -1) modalStack.splice(idx, 1);
      if (lockScroll) unlockBodyScroll();
      if (wasTopmost) {
        const prev = previouslyFocused.current;
        if (prev && prev.isConnected) {
          prev.focus();
        } else {
          // The trigger is gone (unmounted/hidden while the modal was open).
          // Land on the main landmark instead of stranding focus on <body>.
          const fallback = document.querySelector<HTMLElement>(
            'main, [role="main"]',
          );
          if (fallback) {
            if (!fallback.hasAttribute('tabindex')) {
              fallback.setAttribute('tabindex', '-1');
            }
            fallback.focus();
          }
        }
      }
    };
  }, [open, id, containerRef, lockScroll, initialFocusRef]);
}
