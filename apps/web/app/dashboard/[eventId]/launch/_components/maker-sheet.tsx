'use client';

import { useRef } from 'react';

/**
 * 📱 THE MAKER'S PHONE SHEET — owner, live phone test 2026-10-02: *"dim the
 * negative space so they know it is a pop up and pressing on the dimmed part
 * will go back to the main screen"* (the approved phone layout, frame G/I of
 * `prototypes/maker_in_four_2026-09-30_fable.html`).
 *
 * Every Maker editor on a phone is a BOTTOM SHEET over a DIMMED page:
 *   · `SheetScrim` — ink at 40% over the page (the top bar stays live, so
 *     Apply is always in reach); a tap on it closes the sheet. Nothing is dimmed
 *     while no sheet is open — the scrim is drawn only with an open sheet.
 *   · `SheetGrip` — the handle at the sheet's top: a tap, or a drag down,
 *     closes it.
 * The sheet itself wears the room cap (`MAKER_PHONE_PANEL_CAP`,
 * lib/maker-phone-room.ts), so the dimmed page keeps ≥ 55% of the visible
 * height. Phone only (`lg:hidden`): a desktop's panels sit beside the page.
 */

/** The dimmed page behind an open sheet, below the top bar (52 px — `MAKER_PHONE_BAR_PX`). */
export function SheetScrim({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close and go back to the page"
      data-sheet-scrim=""
      onClick={onClose}
      className="fixed inset-x-0 bottom-0 top-[52px] z-[29] cursor-default bg-ink/40 lg:hidden"
    />
  );
}

/** The grab handle: a tap or a drag down closes the sheet. */
export function SheetGrip({ onClose }: { onClose: () => void }) {
  const from = useRef<number | null>(null);
  return (
    <button
      type="button"
      aria-label="Close"
      data-sheet-grip=""
      onPointerDown={(e) => {
        from.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const start = from.current;
        from.current = null;
        if (start === null) return;
        const dy = e.clientY - start;
        if (dy > 24 || Math.abs(dy) < 6) onClose();
      }}
      onClick={(e) => {
        // A keyboard press (no pointer) closes too.
        if (e.detail === 0) onClose();
      }}
      className="flex h-6 w-full shrink-0 touch-none items-center justify-center lg:hidden"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-ink/20" />
    </button>
  );
}
