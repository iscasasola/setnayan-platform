'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * THE ONE DECISION, pure so a test can hold it: pinned ⇔ the control is NOT visible below the header AND it went out at
 * the TOP (scrolled up under the header). Below the fold, or with no root to measure against, it is not pinned.
 */
export function isPinnedUnderHead(entry: {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
  rootBounds: { top: number } | null;
}): boolean {
  const top = entry.rootBounds?.top;
  return !entry.isIntersecting && top != null && entry.boundingClientRect.top < top;
}

/**
 * 📌 A BODY CONTROL'S COPY IN THE PINNED HEADER, WHILE THE CONTROL IS UNDER IT (owner 2026-10-26, on the guest card:
 * *"Let the invite … button pin to the top when it goes out of screen"*).
 *
 * Given the body control, this finds the `<InspectorColumn pinSlot>` header it scrolls under and answers two things:
 *   · `slot`   — the header's `[data-inspector-pin-slot]`, for the control to PORTAL its compact copy into;
 *   · `pinned` — true only while the control has gone UP under the header (never while it is still below the fold).
 *
 * 🔑 AN IntersectionObserver, NOT SCROLL MATH. Its root is whichever box scrolls the card (the phone / tablet sheet, or
 * the desktop rail's panel) and its top edge is pulled down to the header's bottom edge (the header is sticky, so that edge does not move),
 * so "intersecting" means "visible BELOW the header". The header is re-measured when it resizes (a long name wraps the
 * eyebrow; the copy itself arriving), never on scroll.
 *
 * Nothing found (the standalone page has no header; an old browser has no observer) → `{ slot: null, pinned: false }`:
 * the control simply stays where it is, as before.
 */
export function useHeadPin(target: RefObject<HTMLElement | null>, enabled: boolean): { slot: HTMLElement | null; pinned: boolean } {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = target.current;
    if (!enabled || !el) return;
    const panel = el.closest<HTMLElement>('.sn-inspector-panel');
    const head = panel?.querySelector<HTMLElement>(':scope > .sn-inspector-head');
    const pinSlot = head?.querySelector<HTMLElement>('[data-inspector-pin-slot]');
    if (!panel || !head || !pinSlot || typeof IntersectionObserver === 'undefined') return;
    // The sheet FIRST: inside it the panel is plain content and never scrolls (as InspectorColumn reads it).
    const root = el.closest<HTMLElement>('.sn-inspector-sheet') ?? panel;
    setSlot(pinSlot);

    let io: IntersectionObserver | null = null;
    let covered = -1;
    const watch = () => {
      // How far down from the root's top edge the header reaches. The header is sticky, so it sits at the same place at
      // every scroll position — this is a layout reading, re-taken only when the header resizes.
      const next = Math.max(0, Math.round(head.getBoundingClientRect().bottom - root.getBoundingClientRect().top - root.clientTop));
      if (next === covered) return;
      covered = next;
      io?.disconnect();
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry) setPinned(isPinnedUnderHead(entry));
        },
        { root, rootMargin: `-${next}px 0px 0px 0px`, threshold: 0 },
      );
      io.observe(el);
    };
    watch();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(watch);
    ro?.observe(head);
    return () => {
      io?.disconnect();
      ro?.disconnect();
      setPinned(false);
      setSlot(null);
    };
  }, [target, enabled]);

  return { slot, pinned };
}
