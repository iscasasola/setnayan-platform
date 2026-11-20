'use client';

/**
 * ⤴ THE GUEST CARD RISES FULL SCREEN ON A PHONE — AND A DRAG DOWN CLOSES IT (owner-approved drawing
 * `guests_redesign_2026-11-20_fable.html` § 3, "Yes, build it" 20 Nov 2026: *"Full screen, rising from the bottom. No
 * blurred list behind it; drag down or ✕ to close."*).
 *
 * The card stays the ONE card in the ONE sheet (`InspectorColumn` in the inspector's sheet — nothing here is a second
 * card or a second sheet). The rise itself is CSS, scoped to a sheet that holds a guest card and to phone widths
 * (guest-card.css "THE GUEST CARD RISES"); from 701 up it is the shipped side panel, untouched.
 *
 * This is only the gesture: a finger that starts on the card's sticky head (never on ✕ or another control), while the
 * card is at its top, and travels down past `CLOSE_AT` closes it through the sheet's own close (`ctx.close()` — the same
 * one ✕, Escape and the phone's Back use, so the slide-out and the focus return are the shipped ones). The head follows
 * the finger; let go short of the line and it settles back. Nothing is drawn: the grabber is the head's own `::before`.
 * 🔒 guests/_components/the-guest-card-is-the-20-nov-card.test.ts
 */
import { useEffect, useRef } from 'react';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';

/** How far down, in px, the finger must travel for the card to close. */
export const GUEST_CARD_DRAG_CLOSE_PX = 96;
/** Only below this width is the card a risen full screen (the sheet's own breakpoint, guest-card.css). */
const PHONE_MAX = 700.98;

export function GuestCardRise() {
  const ctx = useInspectorContext();
  const mark = useRef<HTMLSpanElement>(null);
  const close = useRef(ctx?.close);
  close.current = ctx?.close;
  useEffect(() => {
    const sheet = mark.current?.closest<HTMLElement>('.sn-inspector-sheet');
    const head = sheet?.querySelector<HTMLElement>('.sn-inspector-head');
    if (!sheet || !head) return;
    let start: { id: number; y: number } | null = null;
    const settle = () => {
      sheet.style.translate = '';
      sheet.removeAttribute('data-guest-card-dragging');
    };
    const down = (e: PointerEvent) => {
      if (window.innerWidth > PHONE_MAX || sheet.scrollTop > 0) return;
      if ((e.target as Element).closest('button, a, input, [role="button"]')) return;
      start = { id: e.pointerId, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      if (dy <= 0) return settle();
      sheet.setAttribute('data-guest-card-dragging', '');
      sheet.style.translate = `0 ${dy}px`;
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      start = null;
      if (dy >= GUEST_CARD_DRAG_CLOSE_PX && close.current) {
        // The sheet's own slide-out starts from where the finger left it.
        sheet.removeAttribute('data-guest-card-dragging');
        close.current();
        return;
      }
      settle();
    };
    const cancel = () => {
      start = null;
      settle();
    };
    head.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      head.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      settle();
    };
  }, []);
  return <span ref={mark} hidden data-guest-card-rise="" />;
}
